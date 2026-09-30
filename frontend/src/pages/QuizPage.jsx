import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import MasteryBadge from '../components/MasteryBadge';

export default function QuizPage({
  conceptId = '',
  conceptName: initialConceptName = '',
  activeStudentId,
  onQuizCompleted,
  conceptsList = [],
}) {
  const [selectedConceptId, setSelectedConceptId] = useState(conceptId);
  const [selectedConceptName, setSelectedConceptName] = useState(initialConceptName);
  const [questions, setQuestions] = useState([]);
  const [cachedQuestions, setCachedQuestions] = useState([]);
  const [quizSetId, setQuizSetId] = useState(null);
  const [setNumber, setSetNumber] = useState(1);
  const [userAnswers, setUserAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [isGeneratingNewSet, setIsGeneratingNewSet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [noQuestions, setNoQuestions] = useState(false);

  // Sync when parent changes the selected concept
  useEffect(() => {
    setSelectedConceptId(conceptId);
    setSelectedConceptName(initialConceptName || resolveConceptName(conceptId, conceptsList));
  }, [conceptId, initialConceptName]);

  // Load questions whenever selectedConceptId changes
  useEffect(() => {
    loadQuestions(selectedConceptId, 'initial');
  }, [selectedConceptId]);

  // Resolve concept name from the concepts list if not provided
  const resolveConceptName = (cid, list) => {
    const found = list.find((c) => c.concept_id === cid || c.id === cid);
    return found?.name || '';
  };

  // Handle concept switch from the dropdown
  const handleConceptSwitch = (e) => {
    const newId = e.target.value;
    const newName = resolveConceptName(newId, conceptsList) || e.target.options[e.target.selectedIndex]?.text || '';
    setSelectedConceptId(newId);
    setSelectedConceptName(newName);
    setQuizSetId(null);
    setSetNumber(1);
    setCachedQuestions([]);
  };

  const loadQuestions = async (cid, mode = 'initial', targetSetId = null) => {
    if (!cid) {
      setLoading(false);
      return;
    }

    if (mode === 'new_set') {
      setIsGeneratingNewSet(true);
    } else {
      setLoading(true);
    }

    setError(null);
    setResult(null);
    setUserAnswers({});
    setNoQuestions(false);

    // If retake requested and we already have the exact questions cached for this concept & set
    if (mode === 'retake' && cachedQuestions.length > 0 && (!targetSetId || targetSetId === quizSetId)) {
      setQuestions([...cachedQuestions]);
      setLoading(false);
      setIsGeneratingNewSet(false);
      return;
    }

    try {
      const params = {
        student_id: activeStudentId,
        mode,
        limit: 5,
      };
      if (targetSetId) {
        params.quiz_set_id = targetSetId;
      }

      const data = await api.getQuestionsByConcept(cid, params);

      if (!data || data.length === 0) {
        setNoQuestions(true);
        setQuestions([]);
        setCachedQuestions([]);
      } else {
        setQuestions(data);
        setCachedQuestions([...data]);
        const newSetId = data[0]?.quiz_set_id || `qset-${cid}-1`;
        const newSetNum = data[0]?.set_number || (mode === 'new_set' ? setNumber + 1 : 1);
        setQuizSetId(newSetId);
        setSetNumber(newSetNum);
      }

      // Update displayed name from API response if still missing
      if (!selectedConceptName && data && data.length > 0) {
        const nameFromList = resolveConceptName(cid, conceptsList);
        if (nameFromList) setSelectedConceptName(nameFromList);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setNoQuestions(true);
        setQuestions([]);
      } else {
        console.error('Failed to load questions:', err);
        setError('Unable to load quiz questions. Please verify backend connection.');
      }
    } finally {
      setLoading(false);
      setIsGeneratingNewSet(false);
    }
  };

  // Retake: loads the exact same quiz set
  const handleRetake = () => {
    loadQuestions(selectedConceptId, 'retake', quizSetId);
  };

  // Practice Another Set: fetches/generates new questions for the same topic
  const handlePracticeAnotherSet = () => {
    loadQuestions(selectedConceptId, 'new_set');
  };

  const handleSelectOption = (questionId, optionKey) => {
    if (result) return; // Prevent change after submit
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const [confidence, setConfidence] = useState('medium');

  // Build concept options: use the actual syllabus concepts from mastery overview
  const dynamicOptions = conceptsList.map((c) => ({ id: c.concept_id || c.id, name: c.name }));
  const optionIds = new Set(dynamicOptions.map((o) => o.id));
  const mergedOptions = optionIds.has(selectedConceptId) || !selectedConceptId
    ? dynamicOptions
    : [{ id: selectedConceptId, name: selectedConceptName || selectedConceptId }, ...dynamicOptions];

  const displayName = selectedConceptName || resolveConceptName(selectedConceptId, conceptsList) || selectedConceptId;

  const handleSubmit = async () => {
    if (Object.keys(userAnswers).length === 0) {
      alert('Please answer at least one question before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payloadAnswers = Object.entries(userAnswers).map(([qid, ans]) => ({
        question_id: qid,
        selected_answer: ans,
      }));

      const res = await api.submitQuiz(
        activeStudentId,
        selectedConceptId,
        payloadAnswers,
        confidence,
        quizSetId
      );

      setResult(res);
      if (res.set_number) {
        setSetNumber(res.set_number);
      }
      if (onQuizCompleted) {
        onQuizCompleted(res);
      }
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      alert('Quiz submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = questions.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header with Topic Identity & Set Number */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-teal-400" />
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Diagnostic &amp; Revision Assessment
            </h1>
          </div>
          {displayName && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-slate-400 font-mono">Quizzing topic:</span>
              <span className="px-3 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-bold">
                {displayName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] font-bold flex items-center gap-1">
                <Layers className="w-3 h-3 text-teal-400" />
                <span>Set {setNumber}</span>
              </span>
            </div>
          )}
          <p className="text-sm text-slate-400 mt-1">
            Real-time mastery updates calculate how revision directly repairs prerequisite foundation.
          </p>
        </div>

        {/* Dynamic Concept Selector Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-mono whitespace-nowrap">Switch topic:</span>
          <select
            value={selectedConceptId}
            onChange={handleConceptSwitch}
            disabled={submitting}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-bold focus:outline-none focus:border-teal-500 max-w-[180px]"
          >
            {mergedOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No concept selected state */}
      {!selectedConceptId && !loading && (
        <div className="p-10 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-4">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-200 text-lg">Select a Concept to Begin</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Use the "Switch topic" dropdown above to pick a concept, or navigate to the Adaptive
            Roadmap or Knowledge Decay page and click "Start Quiz" on a concept.
          </p>
        </div>
      )}

      {loading && !isGeneratingNewSet && (
        <div className="p-16 text-center text-slate-400 font-mono text-sm animate-pulse flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 animate-spin text-teal-400" />
          <span>
            Loading question set for <strong className="text-teal-300">{displayName || 'selected topic'}</strong>...
          </span>
        </div>
      )}

      {isGeneratingNewSet && (
        <div className="p-12 text-center text-slate-300 font-mono text-sm bg-slate-900/60 border border-teal-500/30 rounded-2xl animate-fade-in flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
          <div>
            <p className="font-bold text-slate-100">Generating Fresh Question Set...</p>
            <p className="text-xs text-slate-400 mt-1">
              Selecting unseen diagnostic questions for <span className="text-teal-300 font-bold">{displayName}</span> (Set {setNumber + 1}).
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* No questions found state */}
      {!loading && !isGeneratingNewSet && noQuestions && (
        <div className="p-8 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
          <HelpCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="font-bold text-amber-200 text-lg">No Questions Available</h3>
          <p className="text-amber-300/80 text-sm max-w-md mx-auto">
            No more unseen questions are currently available for <strong className="text-amber-200">"{displayName}"</strong>.
            New questions will be generated shortly.
          </p>
          <div className="pt-2">
            <button
              onClick={() => loadQuestions(selectedConceptId, 'new_set')}
              className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-all inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate New Questions</span>
            </button>
          </div>
        </div>
      )}

      {/* QUIZ RESULT PANEL (After Submission) */}
      {result && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-teal-950/40 border-2 border-teal-500/50 shadow-2xl backdrop-blur-xl animate-fade-in space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono uppercase tracking-wider text-teal-400 font-bold block">
                  Assessment Outcome
                </span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 font-mono text-[10px] font-bold">
                  Set {setNumber}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-100">
                {result.concept_name} Revision Results
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <MasteryBadge stability={result.stability} score={result.new_mastery} />
            </div>
          </div>

          {/* Delta Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block mb-1">Quiz Score</span>
              <span className="text-2xl font-black font-mono text-slate-100">
                {result.correct_count} / {result.total_questions} ({Math.round(result.score)}%)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block mb-1">Estimated Mastery Change</span>
              <div className="flex items-center justify-center gap-2 text-2xl font-black font-mono">
                <span className="text-slate-400">{Math.round(result.previous_mastery)}%</span>
                <span className="text-teal-400 font-bold">→</span>
                <span className="text-emerald-400">{Math.round(result.new_mastery)}%</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block mb-1">Retention Delta</span>
              <span className={`text-2xl font-black font-mono ${result.mastery_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.mastery_delta >= 0 ? `+${result.mastery_delta}%` : `${result.mastery_delta}%`}
              </span>
            </div>
          </div>

          {/* Feedback & Prerequisite Warning */}
          <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            {result.feedback_summary}
          </p>

          {result.prerequisite_alert && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{result.prerequisite_alert}</span>
            </div>
          )}

          {/* TWO SEPARATE ACTIONS: Retake vs Practice Another Set */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            {/* 1. Retake Button */}
            <button
              type="button"
              onClick={handleRetake}
              className="group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-xs transition-all shadow-md active:scale-98 cursor-pointer"
              title="Try the exact same question set again"
            >
              <RotateCcw className="w-4 h-4 text-slate-400 group-hover:-rotate-45 transition-transform" />
              <div className="text-left">
                <span className="block font-bold">Retake Set {setNumber}</span>
                <span className="text-[10px] text-slate-400 font-normal font-mono block">
                  Try the same question set again
                </span>
              </div>
            </button>

            {/* 2. Practice Another Set Button */}
            <button
              type="button"
              onClick={handlePracticeAnotherSet}
              disabled={isGeneratingNewSet}
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-teal-500/20 active:scale-98 cursor-pointer disabled:opacity-60"
              title="Practice this topic with new questions"
            >
              {isGeneratingNewSet ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <div className="text-left">
                    <span className="block font-bold">Generating...</span>
                    <span className="text-[10px] text-slate-950/80 font-normal font-mono block lowercase">
                      fetching fresh questions
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <span className="block font-bold">Practice Another Set</span>
                    <span className="text-[10px] text-slate-950/80 font-normal font-mono block lowercase">
                      practice {displayName} with new questions
                    </span>
                  </div>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* QUESTIONS LIST */}
      {!loading && !isGeneratingNewSet && questions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              {result
                ? `Detailed Breakdown & Explanations (Set ${setNumber})`
                : `Progress: ${answeredCount} of ${totalCount} answered`}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-teal-400 font-bold">
              Set {setNumber}
            </span>
          </div>

          {questions.map((q, index) => {
            const selectedOpt = userAnswers[q.id];
            const feedbackItem = result?.questions_feedback?.find((f) => f.question_id === q.id);

            return (
              <div
                key={q.id}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg backdrop-blur-xl space-y-4"
              >
                {/* Question Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 font-mono text-xs font-bold flex items-center justify-center text-teal-400">
                      {index + 1}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                      {q.difficulty}
                    </span>
                  </div>

                  {feedbackItem && (
                    <div>
                      {feedbackItem.is_correct ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold font-mono">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Correct (+100%)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold font-mono">
                          <XCircle className="w-4 h-4" />
                          <span>Incorrect (Correct: {feedbackItem.correct_answer})</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Question Prompt */}
                <p className="text-base font-semibold text-slate-100 leading-relaxed">
                  {q.question_text}
                </p>

                {/* Multiple Choice Options */}
                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  {[
                    { key: 'A', text: q.option_a },
                    { key: 'B', text: q.option_b },
                    { key: 'C', text: q.option_c },
                    { key: 'D', text: q.option_d },
                  ].map((opt) => {
                    const isSelected = selectedOpt === opt.key;
                    const isCorrectAnswer = feedbackItem?.correct_answer === opt.key;
                    const isWrongSelection = feedbackItem && isSelected && !feedbackItem.is_correct;

                    let optClass = 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900';
                    if (isSelected && !result) {
                      optClass = 'bg-teal-500/15 border-teal-500 text-teal-200 shadow-md shadow-teal-500/10';
                    } else if (result) {
                      if (isCorrectAnswer) {
                        optClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-200';
                      } else if (isWrongSelection) {
                        optClass = 'bg-rose-500/20 border-rose-500 text-rose-200';
                      } else {
                        optClass = 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleSelectOption(q.id, opt.key)}
                        disabled={submitting || !!result}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 text-xs leading-relaxed ${optClass}`}
                      >
                        <span className="w-5 h-5 rounded-md font-mono font-bold flex items-center justify-center shrink-0 text-[11px] border border-current opacity-80">
                          {opt.key}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Detailed Explanation */}
                {feedbackItem && feedbackItem.explanation && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-mono">
                    <span className="text-teal-400 font-bold block mb-1">Explanation:</span>
                    {feedbackItem.explanation}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submission Bar */}
          {!result && (
            <div className="sticky bottom-4 p-4 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Self-reported confidence:</span>
                <div className="flex items-center gap-1.5">
                  {['low', 'medium', 'high'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfidence(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase font-bold border transition-all ${
                        confidence === lvl
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || answeredCount === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
              >
                {submitting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Evaluating Answers...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Diagnostic ({answeredCount}/{totalCount})</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
