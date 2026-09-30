import React, { useState, useEffect } from 'react';
import {
  Compass,
  UploadCloud,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play,
  GitBranch,
  Sparkles,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ArrowRight,
  Layers,
  Award,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import ActionBadge from '../components/ActionBadge';
import MasteryBadge from '../components/MasteryBadge';

export default function RoadmapPage({
  activeStudentId,
  onStartQuiz,
  onInspectConcept,
  onCurriculumUpdated,
}) {
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [collapsedUnits, setCollapsedUnits] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchRoadmap = async () => {
    setLoading(true);
    try {
      const data = await api.getRoadmap(activeStudentId);
      setRoadmap(data);
    } catch (err) {
      console.error('Failed to load roadmap:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadmap();
  }, [activeStudentId]);

  const toggleUnit = (unitId) => {
    setCollapsedUnits((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const handleToggleTaskCompletion = async (conceptId, currentStatus) => {
    const nextCompleted = currentStatus !== 'Completed';

    // Immediate dynamic state recalculation across roadmap
    setRoadmap((prev) => {
      if (!prev || !prev.units) return prev;
      let total = 0;
      let completedCount = 0;
      const newUnits = prev.units.map((unit) => {
        let uTotal = 0;
        let uComp = 0;
        const newTopics = unit.topics.map((topic) => {
          const newConcepts = topic.concepts.map((c) => {
            total += 1;
            uTotal += 1;
            if (c.concept_id === conceptId) {
              const updatedStatus = nextCompleted ? 'Completed' : 'Current';
              const updatedScore = nextCompleted ? 90 : 0;
              const updatedAction = nextCompleted ? 'ADVANCE' : 'PRACTICE';
              if (nextCompleted) {
                completedCount += 1;
                uComp += 1;
              }
              return {
                ...c,
                status: updatedStatus,
                mastery_score: updatedScore,
                action_type: updatedAction,
                stability: nextCompleted ? 'Strong' : 'At Risk',
              };
            }
            if (c.status === 'Completed') {
              completedCount += 1;
              uComp += 1;
            }
            return c;
          });
          return { ...topic, concepts: newConcepts };
        });
        const completion_percentage = uTotal > 0 ? Math.round((uComp / uTotal) * 100) : 0;
        return { ...unit, topics: newTopics, completion_percentage };
      });
      const overall_progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      return {
        ...prev,
        units: newUnits,
        overall_progress,
        completed_concepts: completedCount,
      };
    });

    try {
      await api.toggleConceptCompletion(activeStudentId, conceptId, nextCompleted);
      if (onCurriculumUpdated) {
        onCurriculumUpdated();
      }
    } catch (err) {
      console.error('Failed to toggle concept completion:', err);
      fetchRoadmap();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    try {
      const res = await api.uploadSyllabus(activeStudentId, file);
      setUploadSuccess(`Uploaded "${file.name}"! Parsed ${res.total_units} units and ${res.total_concepts} concepts.`);
      await fetchRoadmap();
      if (onCurriculumUpdated) onCurriculumUpdated();
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.detail || 'Failed to parse syllabus PDF. Ensure it is a readable PDF file.');
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSample = async () => {
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);
    try {
      const res = await api.loadSampleSyllabus(activeStudentId);
      setUploadSuccess(`Loaded sample curriculum! Parsed ${res.total_units} units, ${res.total_concepts} concepts with auto-generated diagnostic questions.`);
      await fetchRoadmap();
      if (onCurriculumUpdated) onCurriculumUpdated();
    } catch (err) {
      console.error('Sample load failed:', err);
      setUploadError(err.response?.data?.detail || 'Failed to load sample syllabus.');
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'Current':
        return 'text-teal-400 bg-teal-500/10 border-teal-500/30';
      case 'Needs Review':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'At Risk':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      default:
        return 'text-slate-400 bg-slate-800/60 border-slate-700/50';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-5 h-5 text-teal-400" />
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Adaptive Curriculum Roadmap
            </h1>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">
            Auto-structured from syllabus PDF hierarchy. Concepts dynamically adapt using your real-time mastery scores,
            prerequisite dependency rules, and memory decay signals.
          </p>
        </div>

        {/* Upload & Sample Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-all shadow-sm hover:scale-[1.02]">
            <UploadCloud className="w-4 h-4 text-teal-400" />
            <span>Upload Syllabus PDF</span>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <button
            onClick={handleLoadSample}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 text-xs font-bold shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>{uploading ? 'Processing Syllabus...' : 'Load Sample Syllabus (CS202)'}</span>
          </button>
        </div>
      </div>

      {/* Upload Feedback */}
      {uploadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-rose-200 font-bold">Dismiss</button>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-emerald-400 hover:text-emerald-200 font-bold">Dismiss</button>
        </div>
      )}

      {/* Progress Metric Banner */}
      {roadmap && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Curriculum Title
            </span>
            <div className="font-extrabold text-slate-100 text-sm truncate" title={roadmap.curriculum_title}>
              {roadmap.curriculum_title || 'Core Data Structures'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Curriculum Mastery
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-teal-400 font-mono">
                {roadmap.overall_progress?.toFixed(0)}%
              </span>
              <span className="text-xs text-slate-500">overall</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Units & Topics
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-200 font-mono">
                {roadmap.units?.length || 0}
              </span>
              <span className="text-xs text-slate-500">units loaded</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Adaptive Next Step
            </span>
            <div className="font-bold text-teal-300 text-xs truncate">
              {roadmap.units?.[0]?.topics?.[0]?.concepts?.[0]?.name ? `Focus: ${roadmap.units[0].topics[0].concepts[0].name}` : 'Ready for revision'}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
          <p className="font-mono text-xs text-slate-400 uppercase tracking-wider">
            Synthesizing adaptive roadmap & prerequisite topology...
          </p>
        </div>
      ) : !roadmap || !roadmap.units || roadmap.units.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-4">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-200">No Syllabus Loaded</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Upload a syllabus PDF or click "Load Sample Syllabus (CS202)" to extract concepts,
            build the prerequisite knowledge graph, and generate your adaptive roadmap.
          </p>
          <button
            onClick={handleLoadSample}
            className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20"
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>Load Sample Syllabus (CS202)</span>
          </button>
        </div>
      ) : (
        /* Units & Topics List */
        <div className="space-y-6">
          {roadmap.units.map((unit) => {
            const isCollapsed = collapsedUnits[unit.unit_id];
            return (
              <div
                key={unit.unit_id}
                className="rounded-3xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-xl transition-all shadow-sm"
              >
                {/* Unit Header Accordion */}
                <div
                  onClick={() => toggleUnit(unit.unit_id)}
                  className="p-6 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button className="p-1 rounded-lg text-slate-400 hover:text-slate-100">
                      {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-400 uppercase tracking-wider">
                          Unit {unit.unit_number}
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-400">
                          {unit.topics.reduce((acc, t) => acc + t.concepts.length, 0)} concepts
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-100 tracking-tight mt-0.5">
                        {unit.title}
                      </h2>
                    </div>
                  </div>

                  {/* Unit Progress Gauge */}
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-right">
                      <div className="font-mono text-xs font-bold text-slate-200">
                        {unit.progress?.toFixed(0)}% Mastered
                      </div>
                      <div className="w-28 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${unit.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Topics & Concepts Inside Unit */}
                {!isCollapsed && (
                  <div className="p-6 space-y-6">
                    {unit.topics.map((topic) => (
                      <div key={topic.topic_id} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {topic.title}
                          </h4>
                        </div>

                        {/* Concept Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {topic.concepts.map((concept) => (
                            <div
                              key={concept.concept_id}
                              className="group relative p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-teal-500/50 hover:bg-slate-900/60 transition-all flex flex-col justify-between"
                            >
                              <div>
                                {/* Status & Action Badge */}
                                <div className="flex items-center justify-between gap-2 mb-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${getStatusColor(
                                      concept.status
                                    )}`}
                                  >
                                    {concept.status}
                                  </span>
                                  <ActionBadge actionType={concept.action_type} size="xs" />
                                </div>

                                {/* Concept Title */}
                                <h5 className="font-bold text-sm text-slate-100 group-hover:text-teal-300 transition-colors mb-1">
                                  {concept.name}
                                </h5>

                                {/* Mastery Rating Bar */}
                                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 my-2">
                                  <span>Mastery:</span>
                                  <span className="font-bold text-slate-200">
                                    {concept.mastery_score?.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-3">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      concept.mastery_score >= 85
                                        ? 'bg-emerald-400'
                                        : concept.mastery_score >= 70
                                        ? 'bg-teal-400'
                                        : concept.mastery_score >= 50
                                        ? 'bg-amber-400'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${concept.mastery_score || 0}%` }}
                                  />
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                                <button
                                  onClick={() => onStartQuiz(concept.concept_id, concept.name)}
                                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-teal-500/15 hover:bg-teal-500 text-teal-300 hover:text-slate-950 font-bold text-[11px] transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Practice</span>
                                </button>
                                <button
                                  onClick={() => handleToggleTaskCompletion(concept.concept_id, concept.status)}
                                  title={concept.status === 'Completed' ? 'Mark Incomplete' : 'Mark as Completed / Mastered'}
                                  className={`px-2.5 py-1.5 rounded-lg border font-bold text-[11px] transition-all flex items-center gap-1 ${
                                    concept.status === 'Completed'
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                                      : 'bg-slate-900 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/40 border-slate-800'
                                  }`}
                                >
                                  <CheckCircle className={`w-3.5 h-3.5 ${concept.status === 'Completed' ? 'text-emerald-400' : ''}`} />
                                  <span className="hidden sm:inline">{concept.status === 'Completed' ? 'Done' : 'Complete'}</span>
                                </button>
                                <button
                                  onClick={() => onInspectConcept && onInspectConcept({ ...concept, id: concept.concept_id })}
                                  title="Inspect Reverse Path Root Cause"
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] transition-colors"
                                >
                                  <GitBranch className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
