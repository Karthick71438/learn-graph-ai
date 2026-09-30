import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.entities import Question, QuizAttempt, Mastery, MasteryHistory, Concept, Student, Recommendation
from app.schemas.api_schemas import QuestionOption, QuizSubmitRequest, QuizSubmitResponse, QuestionFeedback
from app.services.mastery import calculate_mastery_update, classify_stability
from app.services.recommendation import generate_revision_recommendations
from app.services.dependency import analyze_dependencies_and_bottlenecks
from app.services.syllabus_parser import generate_default_questions_for_concept
from app.graph_db import graph_service
from app.auth import get_current_student_optional
from app.routes.students import verify_student_access

import json
import uuid

router = APIRouter(prefix="", tags=["Quiz & Diagnostic Assessment"])

@router.get("/questions/{concept_id}", response_model=List[QuestionOption])
def get_questions_by_concept(
    concept_id: str,
    student_id: Optional[str] = None,
    mode: Optional[str] = "initial",  # "initial", "retake", "new_set"
    quiz_set_id: Optional[str] = None,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Fetch quiz questions for a given concept.
    Supports:
    - mode='retake': loads the exact same quiz set (same questions, same order).
    - mode='new_set': generates/selects an entirely different set of questions for this topic,
      guaranteeing no repetition of previously seen questions by this student.
    - mode='initial': loads the active set for this student or initializes Set 1.
    """
    from app.models.entities import QuizSet
    from app.services.question_generator import generate_and_persist_new_questions_for_concept

    concept = db.query(Concept).filter(Concept.id == concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    all_concept_questions = db.query(Question).filter(Question.concept_id == concept_id).all()

    if not all_concept_questions:
        generated = generate_default_questions_for_concept(concept.id, concept.name)
        for q_data in generated:
            existing = db.query(Question).filter(Question.id == q_data["id"]).first()
            if not existing:
                q_obj = Question(
                    id=q_data["id"],
                    concept_id=q_data["concept_id"],
                    question_text=q_data["question_text"],
                    option_a=q_data["option_a"],
                    option_b=q_data["option_b"],
                    option_c=q_data["option_c"],
                    option_d=q_data["option_d"],
                    correct_answer=q_data["correct_answer"],
                    explanation=q_data["explanation"],
                    difficulty=q_data["difficulty"]
                )
                db.add(q_obj)
        db.commit()
        all_concept_questions = db.query(Question).filter(Question.concept_id == concept_id).all()

    # If no student_id provided (e.g. general test / unauthenticated), return baseline questions
    if not student_id:
        return [
            QuestionOption(
                id=q.id,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                difficulty=q.difficulty,
                concept_id=q.concept_id,
                quiz_set_id="qset-default",
                set_number=1
            )
            for q in all_concept_questions[:limit]
        ]

    # --- RETAKE MODE ---
    if mode == "retake":
        target_set = None
        if quiz_set_id:
            target_set = db.query(QuizSet).filter(
                QuizSet.id == quiz_set_id,
                QuizSet.student_id == student_id,
                QuizSet.concept_id == concept_id
            ).first()

        if not target_set:
            # Fallback to the latest QuizSet for this student and concept
            target_set = db.query(QuizSet).filter(
                QuizSet.student_id == student_id,
                QuizSet.concept_id == concept_id
            ).order_by(QuizSet.created_at.desc()).first()

        if target_set and target_set.question_ids_json:
            try:
                target_qids = json.loads(target_set.question_ids_json)
                q_map = {q.id: q for q in db.query(Question).filter(Question.id.in_(target_qids)).all()}
                ordered_questions = [q_map[qid] for qid in target_qids if qid in q_map]
                if ordered_questions:
                    return [
                        QuestionOption(
                            id=q.id,
                            question_text=q.question_text,
                            option_a=q.option_a,
                            option_b=q.option_b,
                            option_c=q.option_c,
                            option_d=q.option_d,
                            difficulty=q.difficulty,
                            concept_id=q.concept_id,
                            quiz_set_id=target_set.id,
                            set_number=target_set.set_number
                        )
                        for q in ordered_questions
                    ]
            except Exception as e:
                print(f"[QuizRoute] Retake parse error: {e}")

    # Determine all questions previously attempted or assigned in quiz sets for this student + topic
    attempted_qids = {
        row[0] for row in db.query(QuizAttempt.question_id)
        .filter(QuizAttempt.student_id == student_id, QuizAttempt.concept_id == concept_id)
        .all()
    }
    recorded_sets = db.query(QuizSet).filter(
        QuizSet.student_id == student_id,
        QuizSet.concept_id == concept_id
    ).all()
    set_qids = set()
    for s in recorded_sets:
        if s.question_ids_json:
            try:
                set_qids.update(json.loads(s.question_ids_json))
            except Exception:
                pass

    seen_qids = attempted_qids.union(set_qids)

    # --- PRACTICE ANOTHER SET MODE ---
    if mode == "new_set":
        unused_questions = db.query(Question).filter(
            Question.concept_id == concept_id,
            ~Question.id.in_(seen_qids)
        ).all()

        target_count = min(limit, 5)
        selected_questions = list(unused_questions)

        if len(selected_questions) < target_count:
            needed = target_count - len(selected_questions)
            all_known_texts = [q.question_text for q in db.query(Question).filter(Question.concept_id == concept_id).all()]
            next_set_num = len(recorded_sets) + 1
            fresh_questions = generate_and_persist_new_questions_for_concept(
                concept_id=concept.id,
                concept_name=concept.name,
                used_question_texts=all_known_texts,
                count=needed,
                set_number=next_set_num,
                db=db
            )
            selected_questions.extend(fresh_questions)

        selected_questions = selected_questions[:target_count]

        new_set_num = len(recorded_sets) + 1
        new_set_id = f"qset-{concept_id}-{uuid.uuid4().hex[:8]}"
        new_quiz_set = QuizSet(
            id=new_set_id,
            student_id=student_id,
            concept_id=concept_id,
            question_ids_json=json.dumps([q.id for q in selected_questions]),
            set_number=new_set_num,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_quiz_set)
        db.commit()

        return [
            QuestionOption(
                id=q.id,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                difficulty=q.difficulty,
                concept_id=q.concept_id,
                quiz_set_id=new_set_id,
                set_number=new_set_num
            )
            for q in selected_questions
        ]

    # --- INITIAL MODE ---
    latest_set = db.query(QuizSet).filter(
        QuizSet.student_id == student_id,
        QuizSet.concept_id == concept_id
    ).order_by(QuizSet.created_at.desc()).first()

    if latest_set and latest_set.question_ids_json:
        try:
            q_ids = json.loads(latest_set.question_ids_json)
            q_map = {q.id: q for q in db.query(Question).filter(Question.id.in_(q_ids)).all()}
            ordered_questions = [q_map[qid] for qid in q_ids if qid in q_map]
            if len(ordered_questions) >= 3:
                return [
                    QuestionOption(
                        id=q.id,
                        question_text=q.question_text,
                        option_a=q.option_a,
                        option_b=q.option_b,
                        option_c=q.option_c,
                        option_d=q.option_d,
                        difficulty=q.difficulty,
                        concept_id=q.concept_id,
                        quiz_set_id=latest_set.id,
                        set_number=latest_set.set_number
                    )
                    for q in ordered_questions
                ]
        except Exception:
            pass

    selected_questions = all_concept_questions[:limit]
    set_1_id = f"qset-{concept_id}-{uuid.uuid4().hex[:8]}"
    set_1 = QuizSet(
        id=set_1_id,
        student_id=student_id,
        concept_id=concept_id,
        question_ids_json=json.dumps([q.id for q in selected_questions]),
        set_number=1,
        created_at=datetime.datetime.utcnow()
    )
    db.add(set_1)
    db.commit()

    return [
        QuestionOption(
            id=q.id,
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            difficulty=q.difficulty,
            concept_id=q.concept_id,
            quiz_set_id=set_1_id,
            set_number=1
        )
        for q in selected_questions
    ]

@router.post("/quiz/submit", response_model=QuizSubmitResponse)
def submit_quiz(
    payload: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_student: Optional[Student] = Depends(get_current_student_optional)
):
    """
    Submits student quiz answers, calculates transparent score with item difficulty weighting,
    updates concept mastery & stability, triggers dependency check,
    and updates explainable revision queue.
    """
    verify_student_access(payload.student_id, current_student)
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    concept = db.query(Concept).filter(Concept.id == payload.concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    if not payload.answers:
        raise HTTPException(status_code=400, detail="No answers provided in submission")

    # Evaluate answers
    question_ids = [a.question_id for a in payload.answers]
    questions = {q.id: q for q in db.query(Question).filter(Question.id.in_(question_ids)).all()}
    
    correct_count = 0
    total_questions = len(payload.answers)
    feedback_items = []
    diff_items = []
    now = datetime.datetime.now(datetime.timezone.utc)

    for ans in payload.answers:
        q = questions.get(ans.question_id)
        if not q:
            continue
            
        is_corr = (ans.selected_answer.strip().upper() == q.correct_answer.strip().upper())
        if is_corr:
            correct_count += 1
            
        diff_items.append((is_corr, q.difficulty or "medium"))
        # Use per-answer confidence if provided, otherwise fall back to top-level payload confidence
        conf = getattr(ans, "confidence", None) or payload.confidence or "medium"

        # Log attempt
        attempt = QuizAttempt(
            student_id=student.id,
            concept_id=concept.id,
            question_id=q.id,
            quiz_set_id=payload.quiz_set_id,
            selected_answer=ans.selected_answer.upper(),
            is_correct=is_corr,
            confidence=conf,
            created_at=now
        )
        db.add(attempt)
        
        feedback_items.append(QuestionFeedback(
            question_id=q.id,
            question_text=q.question_text,
            selected_answer=ans.selected_answer.upper(),
            correct_answer=q.correct_answer,
            is_correct=is_corr,
            confidence=conf,
            explanation=q.explanation
        ))

    # Fetch previous mastery
    existing_mastery = db.query(Mastery).filter(
        Mastery.student_id == student.id,
        Mastery.concept_id == concept.id
    ).first()
    
    prev_score = existing_mastery.mastery_score if existing_mastery else None

    # Calculate mastery update with difficulty weighting
    raw_score, new_mastery, delta, stability = calculate_mastery_update(
        correct_count=correct_count,
        total_questions=total_questions,
        previous_mastery=prev_score,
        difficulty_items=diff_items
    )

    # Persist mastery
    if existing_mastery:
        existing_mastery.mastery_score = new_mastery
        existing_mastery.stability = stability
        existing_mastery.last_practiced = now
        existing_mastery.updated_at = now
    else:
        new_rec = Mastery(
            id=f"m-{student.id}-{concept.id}",
            student_id=student.id,
            concept_id=concept.id,
            mastery_score=new_mastery,
            stability=stability,
            last_practiced=now
        )
        db.add(new_rec)

    # Record history point
    history_entry = MasteryHistory(
        student_id=student.id,
        concept_id=concept.id,
        mastery_score=new_mastery,
        recorded_at=now,
        note=f"Quiz completed: {correct_count}/{total_questions} ({raw_score}%)"
    )
    db.add(history_entry)
    db.commit()

    # Recompute student recommendations across all concepts
    all_mastery = db.query(Mastery).filter(Mastery.student_id == student.id).all()
    mastery_map = {}
    for m in all_mastery:
        m_dt = m.last_practiced.replace(tzinfo=datetime.timezone.utc) if m.last_practiced and m.last_practiced.tzinfo is None else m.last_practiced
        days_ago = (now - m_dt).days if m_dt else 0
        mastery_map[m.concept_id] = {
            "score": m.mastery_score,
            "peak_score": m.mastery_score,
            "days_ago": days_ago,
            "stability": m.stability
        }

    all_concepts = db.query(Concept).all()
    c_meta = {c.id: {"id": c.id, "name": c.name} for c in all_concepts}
    updated_recs = generate_revision_recommendations(student.id, mastery_map, c_meta)

    # Refresh recommendations in DB
    db.query(Recommendation).filter(Recommendation.student_id == student.id).delete()
    for r in updated_recs:
        rec_obj = Recommendation(
            id=f"rec-{student.id}-{r['concept_id']}",
            student_id=student.id,
            concept_id=r["concept_id"],
            priority=r["priority"],
            priority_score=r["priority_score"],
            action_type=r.get("action_type", "PRACTICE"),
            reason=r["reason"],
            root_cause_concept_id=r.get("root_cause_concept"),
            impacted_concept_id=r["impacted_concepts"][0] if r.get("impacted_concepts") else None
        )
        db.add(rec_obj)
    db.commit()

    # Prerequisite warning if struggling
    prereq_alert = None
    if new_mastery < 70.0:
        prereqs = graph_service.get_prerequisites(concept.id)
        weak_prereqs = []
        for p in prereqs:
            p_score = mastery_map.get(p, {}).get("score", 0.0)
            if p_score < 70.0:
                p_name = c_meta.get(p, {}).get("name", p)
                weak_prereqs.append(f"{p_name} ({p_score:.0f}%)")
        if weak_prereqs:
            prereq_alert = f"Performance alert: Weak prerequisite foundation detected in {', '.join(weak_prereqs)}. Strengthening prerequisite concepts first is recommended."

    feedback_summary = (
        f"You scored {correct_count} of {total_questions} ({raw_score:.0f}%). "
        f"Concept retention is now estimated at {new_mastery:.0f}% ({stability})."
    )

    from app.models.entities import QuizSet
    set_num = 1
    if payload.quiz_set_id:
        qs_rec = db.query(QuizSet).filter(QuizSet.id == payload.quiz_set_id).first()
        if qs_rec:
            set_num = qs_rec.set_number

    return QuizSubmitResponse(
        concept_id=concept.id,
        concept_name=concept.name,
        score=raw_score,
        total_questions=total_questions,
        correct_count=correct_count,
        previous_mastery=prev_score if prev_score is not None else raw_score,
        new_mastery=new_mastery,
        mastery_delta=delta,
        stability=stability,
        feedback_summary=feedback_summary,
        prerequisite_alert=prereq_alert,
        questions_feedback=feedback_items,
        quiz_set_id=payload.quiz_set_id,
        set_number=set_num
    )
