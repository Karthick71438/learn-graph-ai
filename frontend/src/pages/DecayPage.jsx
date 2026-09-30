import React, { useState, useMemo } from 'react';
import {
  Clock,
  TrendingDown,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  History,
  FileText,
  Download,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import DecayChart from '../components/DecayChart';
import MasteryBadge from '../components/MasteryBadge';
import { api } from '../services/api';

export default function DecayPage({
  decayData,
  activeStudentId,
  currentStudent,
  displayName,
  onRefresh,
  onStartQuiz,
}) {
  const concepts = decayData?.concepts_decay || [];
  const activeSyllabusTitle = decayData?.active_syllabus_title || null;

  // ── Build grouped unit → topic structure from API data ──────────────────
  const { unitNames, topicsByUnit, conceptsByUnitTopic } = useMemo(() => {
    const unitSet = new Set();
    const tbu = {}; // topicsByUnit: { unitName: Set<topicName> }
    const cbut = {}; // conceptsByUnitTopic: { unitName: { topicName: [concept] } }

    for (const c of concepts) {
      const unit = c.unit_name || 'General';
      const topic = c.topic_name || 'Core Topics';
      unitSet.add(unit);
      if (!tbu[unit]) tbu[unit] = new Set();
      tbu[unit].add(topic);
      if (!cbut[unit]) cbut[unit] = {};
      if (!cbut[unit][topic]) cbut[unit][topic] = [];
      cbut[unit][topic].push(c);
    }

    return {
      unitNames: Array.from(unitSet),
      topicsByUnit: Object.fromEntries(
        Object.entries(tbu).map(([u, s]) => [u, Array.from(s)])
      ),
      conceptsByUnitTopic: cbut,
    };
  }, [concepts]);

  // ── Selector state ───────────────────────────────────────────────────────
  const defaultUnit = unitNames[0] || '';
  const [selectedUnit, setSelectedUnit] = useState(defaultUnit);

  const topicsForUnit = topicsByUnit[selectedUnit] || [];
  const [selectedTopic, setSelectedTopic] = useState(topicsForUnit[0] || '');

  // When unit changes reset topic
  const handleUnitChange = (unit) => {
    setSelectedUnit(unit);
    const firstTopic = (topicsByUnit[unit] || [])[0] || '';
    setSelectedTopic(firstTopic);
    setSimResult(null);
  };

  // Concepts in selected unit+topic
  const topicConcepts = (conceptsByUnitTopic[selectedUnit] || {})[selectedTopic] || [];

  // Default selected concept: first assessed, else first available
  const defaultConceptId =
    topicConcepts.find((c) => c.assessed)?.concept_id ||
    topicConcepts[0]?.concept_id ||
    '';

  const [selectedConceptId, setSelectedConceptId] = useState(defaultConceptId);

  // Reset selectors when the syllabus/concepts list changes (e.g. after upload or quiz)
  React.useEffect(() => {
    const firstUnit = unitNames[0] || '';
    setSelectedUnit(firstUnit);
    const firstTopic = (topicsByUnit[firstUnit] || [])[0] || '';
    setSelectedTopic(firstTopic);
    setSelectedConceptId('');
    setSimResult(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decayData?.active_syllabus_title, concepts.length]);

  // Keep selectedConceptId in sync when topic changes
  const resolvedConceptId =
    topicConcepts.some((c) => c.concept_id === selectedConceptId)
      ? selectedConceptId
      : defaultConceptId;

  const activeConcept = topicConcepts.find((c) => c.concept_id === resolvedConceptId) || topicConcepts[0];

  // ── Simulator state ──────────────────────────────────────────────────────
  const [simDays, setSimDays] = useState(21);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const handleSimulate = async () => {
    if (!activeConcept?.concept_id) return;
    setSimulating(true);
    try {
      const res = await api.simulateGap(activeStudentId, activeConcept.concept_id, simDays);
      setSimResult(res);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to simulate decay:', err);
    } finally {
      setSimulating(false);
    }
  };

  // ── PDF Report state ─────────────────────────────────────────────────────
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('');

  const handleDownloadReport = async () => {
    setDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      const response = await api.downloadProgressReport(activeStudentId);

      let filename = `LearnGraph_AI_Learning_Progress_Report_${(
        displayName ||
        currentStudent?.name ||
        'Student'
      )
        .replace(/\s+/g, '_')}.pdf`;
      const disposition =
        response?.headers?.['content-disposition'] ||
        response?.headers?.['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setDownloadFilename(filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      console.error('Failed to download learning progress report:', err);
      setDownloadError(
        err?.response?.data?.detail ||
          'Failed to generate progress report. Please verify server connectivity.'
      );
    } finally {
      setDownloading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const stabilityColor = (s) => {
    if (s === 'Strong') return 'text-emerald-400';
    if (s === 'Stable') return 'text-teal-400';
    if (s === 'Weakening') return 'text-amber-400';
    return 'text-rose-400';
  };

  const masteryColor = (score) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-teal-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* ── Page Header + Report Download ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-slate-900/50 p-5 sm:p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingDown className="w-5 h-5 text-teal-400" />
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Knowledge Decay &amp; Memory Retention
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Track how well you remember each topic over time. See when it is time for a quick review before concepts fade from memory.
          </p>
          {activeSyllabusTitle && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] font-semibold">
              <BookOpen className="w-3 h-3" />
              <span>{activeSyllabusTitle}</span>
            </div>
          )}
        </div>

        {/* Right-Side Action Card: 📄 Download Learning Progress Report */}
        <div className="shrink-0 flex flex-col items-start lg:items-end">
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={downloading}
            className="group relative inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all duration-200 disabled:opacity-60 active:scale-[0.98]"
            title="Download verified academic learning progress report in PDF format"
          >
            {downloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Generating Academic PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-slate-950" />
                <span>📄 Download Learning Progress Report</span>
                <Download className="w-3.5 h-3.5 text-slate-950/70 group-hover:translate-y-0.5 transition-transform" />
              </>
            )}
          </button>
          <span className="text-[11px] text-slate-500 font-mono mt-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Real-time academic PDF • Multi-page summary</span>
          </span>
        </div>
      </div>

      {/* ── Download Feedback ──────────────────────────────────────────── */}
      {downloadError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{downloadError}</span>
          </div>
          <button
            onClick={() => setDownloadError(null)}
            className="text-rose-400 hover:text-rose-200 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}
      {downloadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Report generated and downloaded: <b>{downloadFilename}</b>
          </span>
        </div>
      )}

      {/* ── Unit + Topic Selectors ─────────────────────────────────────── */}
      {concepts.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-200">No Syllabus Data Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Upload a syllabus PDF or load the sample syllabus from the Adaptive Roadmap page to
            populate this view with your personalized concept decay analysis.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {/* Unit Selector */}
            <div className="relative">
              <label className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">
                Unit
              </label>
              <div className="relative">
                <select
                  value={selectedUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer"
                >
                  {unitNames.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Topic Selector */}
            <div className="relative">
              <label className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">
                Topic
              </label>
              <div className="relative">
                <select
                  value={selectedTopic}
                  onChange={(e) => {
                    setSelectedTopic(e.target.value);
                    setSimResult(null);
                  }}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer"
                >
                  {topicsForUnit.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Concept Pills (for selected topic) */}
            {topicConcepts.length > 1 && (
              <div className="flex flex-wrap items-end gap-2 mt-[22px]">
                {topicConcepts.map((c) => {
                  const isSelected = c.concept_id === resolvedConceptId;
                  return (
                    <button
                      key={c.concept_id}
                      onClick={() => {
                        setSelectedConceptId(c.concept_id);
                        setSimResult(null);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-md'
                          : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span>{c.concept_name}</span>
                      {c.assessed ? (
                        <span className="font-mono text-[10px] opacity-80">
                          ({Math.round(c.current_mastery)}%)
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-slate-500">Not assessed</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Decay Chart or "Not Assessed Yet" state ───────────────── */}
          {activeConcept && !activeConcept.assessed ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center">
                <ClipboardList className="w-7 h-7 text-slate-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200 mb-1">
                  {activeConcept.concept_name} — Not Assessed Yet
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  No quiz attempts recorded for this concept. Take a diagnostic quiz to generate a
                  real decay trajectory based on your performance.
                </p>
              </div>
              {onStartQuiz && (
                <button
                  type="button"
                  onClick={() => onStartQuiz(activeConcept.concept_id, activeConcept.concept_name)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-bold text-xs transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  Take Diagnostic Quiz for {activeConcept.concept_name}
                </button>
              )}
            </div>
          ) : (
            <DecayChart conceptDecay={activeConcept} />
          )}

          {/* ── Time Gap Simulator ─────────────────────────────────────── */}
          {activeConcept?.assessed && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-2">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>Interactive Memory Simulator</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Move the slider to see how memory naturally fades over days without practice, and how a quick review brings it right back.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Simulated Practice Gap:</span>
                    <span className="font-mono font-bold text-teal-300 text-sm">
                      {simDays} days without review
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="1"
                    value={simDays}
                    onChange={(e) => setSimDays(parseInt(e.target.value, 10))}
                    className="w-full accent-teal-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0 days (Immediate)</span>
                    <span>14 days</span>
                    <span>21 days</span>
                    <span>35+ days</span>
                  </div>
                </div>

                <div>
                  <button
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                    <span>Apply {simDays}-Day Decay Signal</span>
                  </button>
                </div>
              </div>

              {simResult && (
                <div className="mt-4 p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-200 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>{simResult.signal}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Historical Retention Audit Table ──────────────────────── */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-teal-400" />
              <span>Concept Retention Audit — {selectedUnit}</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider">
                    <th className="pb-3">Concept</th>
                    <th className="pb-3">Topic</th>
                    <th className="pb-3">Peak Mastery</th>
                    <th className="pb-3">Current</th>
                    <th className="pb-3">Gap (Days)</th>
                    <th className="pb-3">Stability</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {/* All concepts across selected unit */}
                  {Object.entries(conceptsByUnitTopic[selectedUnit] || {})
                    .flatMap(([topicName, topicConcepts]) =>
                      topicConcepts.map((c) => ({ ...c, _topicName: topicName }))
                    )
                    .map((c) => (
                      <tr
                        key={c.concept_id}
                        className={`cursor-pointer hover:bg-slate-800/40 transition-colors ${
                          c.concept_id === resolvedConceptId ? 'bg-teal-500/5' : ''
                        }`}
                        onClick={() => {
                          setSelectedTopic(c._topicName);
                          setSelectedConceptId(c.concept_id);
                          setSimResult(null);
                        }}
                      >
                        <td className="py-3.5 font-bold text-slate-100">{c.concept_name}</td>
                        <td className="py-3.5 text-slate-400">{c._topicName}</td>
                        {c.assessed ? (
                          <>
                            <td className="py-3.5 font-mono text-emerald-400 font-semibold">
                              {Math.round(c.peak_mastery)}%
                            </td>
                            <td
                              className={`py-3.5 font-mono font-bold ${masteryColor(
                                c.current_mastery
                              )}`}
                            >
                              {Math.round(c.current_mastery)}%
                            </td>
                            <td className="py-3.5 font-mono text-slate-300">
                              {c.days_since_practice}d
                            </td>
                            <td className="py-3.5">
                              <MasteryBadge stability={c.stability} score={c.current_mastery} showScore={false} />
                            </td>
                            <td className={`py-3.5 font-semibold text-[11px] ${stabilityColor(c.stability)}`}>
                              {c.stability === 'Strong' && 'Stable foundation'}
                              {c.stability === 'Stable' && 'Maintaining retention'}
                              {c.stability === 'Weakening' && 'Revision recommended'}
                              {c.stability === 'At Risk' && 'Urgent review needed'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3.5 text-slate-600 font-mono">—</td>
                            <td className="py-3.5 text-slate-600 font-mono">—</td>
                            <td className="py-3.5 text-slate-600 font-mono">—</td>
                            <td className="py-3.5">
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-500 text-[10px] font-mono">
                                Not assessed
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-500 text-[11px]">
                              Take quiz to generate data
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
