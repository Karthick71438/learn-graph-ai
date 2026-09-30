import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import DemoController from './components/DemoController';
import NodeDetailDrawer from './components/NodeDetailDrawer';
import AuthModal from './components/AuthModal';
import DashboardPage from './pages/DashboardPage';
import RoadmapPage from './pages/RoadmapPage';
import GraphPage from './pages/GraphPage';
import DecayPage from './pages/DecayPage';
import RevisionPage from './pages/RevisionPage';
import QuizPage from './pages/QuizPage';
import BrainBlastPage from './pages/BrainBlastPage';
import HelpSupportPage from './pages/HelpSupportPage';
import DoubtChatbot from './components/DoubtChatbot';
import GoogleAuthCallback from './components/GoogleAuthCallback';
import { api } from './services/api';
import { Sparkles, AlertCircle, RefreshCw, Shield } from 'lucide-react';

// Detect if the current URL is the Google OAuth callback route
const IS_GOOGLE_CALLBACK = window.location.pathname === '/auth/google/callback';


export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeStudentId, setActiveStudentId] = useState(
    () => localStorage.getItem('learnGraph_student_id') || 'student-demo-1'
  );
  const [currentStudent, setCurrentStudent] = useState(null);
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('learnGraph_display_name') || null
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState('stage_3_failed_trees');
  const [selectedConceptForQuiz, setSelectedConceptForQuiz] = useState('');
  const [selectedConceptNameForQuiz, setSelectedConceptNameForQuiz] = useState('');
  const [inspectedConcept, setInspectedConcept] = useState(null);

  // Light / Dark Theme State (Default: Dark Mode)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Core Data States
  const [masteryOverview, setMasteryOverview] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [decayData, setDecayData] = useState(null);
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check auth session on startup
  useEffect(() => {
    const checkAuth = async () => {
      // Check if URL has token from OAuth redirect
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('learnGraph_token', urlToken);
        const urlStudentId = urlParams.get('student_id');
        const urlName = urlParams.get('name');
        if (urlStudentId) localStorage.setItem('learnGraph_student_id', urlStudentId);
        if (urlName) localStorage.setItem('learnGraph_display_name', urlName);
        window.history.replaceState({}, '', window.location.pathname);
      }

      const token = localStorage.getItem('learnGraph_token');
      if (token) {
        try {
          const student = await api.getMe();
          if (student && student.id) {
            setCurrentStudent(student);
            setActiveStudentId(student.id);
            // Keep localStorage fresh with server values
            const name = student.nickname || student.name;
            localStorage.setItem('learnGraph_student_id', student.id);
            localStorage.setItem('learnGraph_display_name', name);
            setDisplayName(name);
          }
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          api.logout();
          setDisplayName(null);
        }
      }
    };
    checkAuth();
  }, []);

  // Synchronize student data from REST APIs
  const fetchStudentData = useCallback(async (studentId = activeStudentId) => {
    try {
      setError(null);
      const [mRes, gRes, dRes, rRes] = await Promise.all([
        api.getMasteryOverview(studentId),
        api.getKnowledgeGraph(studentId),
        api.getDecayAnalytics(studentId),
        api.getRecommendations(studentId),
      ]);

      setMasteryOverview(mRes);
      setGraphData(gRes);
      setDecayData(dRes);
      setRecommendationsData(rRes);
    } catch (err) {
      console.error('Failed to fetch learning intelligence data:', err);
      setError('Backend service connection error. Please ensure the FastAPI server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  }, [activeStudentId]);

  useEffect(() => {
    fetchStudentData(activeStudentId);
  }, [fetchStudentData, activeStudentId]);

  // Demo Storyboard Stage Changed
  const handleStageChanged = (newStage) => {
    setCurrentStage(newStage);
    fetchStudentData(activeStudentId);
  };

  // Switch Student Profile
  const handleSelectStudent = (studentId) => {
    setActiveStudentId(studentId);
    setLoading(true);
  };

  // Launch Quiz on a Concept
  const handleStartQuiz = (conceptId, conceptName = '') => {
    setSelectedConceptForQuiz(conceptId);
    setSelectedConceptNameForQuiz(conceptName);
    setActiveTab('quiz');
    setInspectedConcept(null);
  };

  // Quiz submission completed callback
  const handleQuizCompleted = () => {
    // Re-fetch all data to propagate updated mastery into graph & dashboard
    fetchStudentData(activeStudentId);
  };

  // Toggle Concept Completion (Task completion / incomplete)
  const handleToggleConceptComplete = async (conceptId, currentCompleted) => {
    try {
      await api.toggleConceptCompletion(activeStudentId, conceptId, !currentCompleted);
      await fetchStudentData(activeStudentId);
      if (inspectedConcept && (inspectedConcept.id === conceptId || inspectedConcept.concept_id === conceptId)) {
        setInspectedConcept((prev) =>
          prev
            ? {
                ...prev,
                mastery_score: !currentCompleted ? 90 : 0,
                stability: !currentCompleted ? 'Strong' : 'At Risk',
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to toggle concept completion:', err);
    }
  };

  // Handle Auth Success
  const handleAuthSuccess = (student) => {
    setCurrentStudent(student);
    setActiveStudentId(student.id);
    const name = student.nickname || student.name;
    setDisplayName(name);
    setLoading(true);
    fetchStudentData(student.id);
  };

  // Handle Logout
  const handleLogout = () => {
    api.logout();
    setCurrentStudent(null);
    setDisplayName(null);
    setActiveStudentId('student-demo-1');
    setLoading(true);
    fetchStudentData('student-demo-1');
  };

  const topRec = recommendationsData?.recommendations?.[0] || null;

  // Render Google OAuth callback handler when on the callback URL
  if (IS_GOOGLE_CALLBACK) {
    return (
      <GoogleAuthCallback
        onAuthSuccess={(student) => {
          handleAuthSuccess(student);
          // Navigate away from the callback URL to the app root
          window.history.replaceState({}, '', '/');
        }}
        onCancel={() => {
          window.history.replaceState({}, '', '/');
          setAuthModalOpen(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 antialiased selection:bg-teal-500/20 selection:text-teal-300">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeStudentId={activeStudentId}
        onSelectStudent={handleSelectStudent}
        currentStudent={currentStudent}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Interactive Demo Controller Bar (Only shown for Demo Students) */}
      {activeStudentId.startsWith('student-demo-') && (
        <DemoController
          currentStage={currentStage}
          onStageChanged={handleStageChanged}
          activeStudentId={activeStudentId}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchStudentData(activeStudentId)}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold text-rose-200 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center animate-spin">
              <Sparkles className="w-6 h-6 text-teal-400" />
            </div>
            <p className="font-mono text-xs text-slate-400 tracking-wider uppercase">
              Analyzing Knowledge Graph & Retention Trajectories...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                masteryOverview={masteryOverview}
                graphData={graphData}
                topRecommendation={topRec}
                onSelectNode={setInspectedConcept}
                onStartQuiz={handleStartQuiz}
                onNavigateToTab={setActiveTab}
                displayName={displayName}
              />
            )}

            {activeTab === 'roadmap' && (
              <RoadmapPage
                activeStudentId={activeStudentId}
                onStartQuiz={handleStartQuiz}
                onInspectConcept={setInspectedConcept}
                onCurriculumUpdated={() => fetchStudentData(activeStudentId)}
              />
            )}

            {activeTab === 'graph' && (
              <GraphPage
                graphData={graphData}
                onSelectNode={setInspectedConcept}
                selectedNodeId={inspectedConcept?.id}
              />
            )}

            {activeTab === 'decay' && (
              <DecayPage
                decayData={decayData}
                activeStudentId={activeStudentId}
                currentStudent={currentStudent}
                displayName={displayName}
                onRefresh={() => fetchStudentData(activeStudentId)}
                onStartQuiz={handleStartQuiz}
              />
            )}

            {activeTab === 'revision' && (
              <RevisionPage
                recommendationsData={recommendationsData}
                onStartQuiz={handleStartQuiz}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizPage
                conceptId={selectedConceptForQuiz}
                conceptName={selectedConceptNameForQuiz}
                activeStudentId={activeStudentId}
                onQuizCompleted={handleQuizCompleted}
                conceptsList={masteryOverview?.concepts || []}
              />
            )}

            {activeTab === 'brain-blast' && (
              <BrainBlastPage
                onNavigateToTab={setActiveTab}
                activeStudentId={activeStudentId}
              />
            )}

            {activeTab === 'help' && (
              <HelpSupportPage
                onNavigateToTab={setActiveTab}
                onStartQuiz={handleStartQuiz}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Reverse-Path Root Cause & Node Detail Slide-Over Inspector */}
      <NodeDetailDrawer
        concept={inspectedConcept}
        activeStudentId={activeStudentId}
        onClose={() => setInspectedConcept(null)}
        onStartQuiz={handleStartQuiz}
        onToggleComplete={handleToggleConceptComplete}
      />

      {/* Authentication & Privacy Deletion Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        currentStudent={currentStudent || { id: activeStudentId, name: masteryOverview?.student_name }}
        onDataDeleted={() => fetchStudentData(activeStudentId)}
      />

      {/* DOUBT AI Learning & Doubt Support Assistant */}
      <DoubtChatbot
        activeStudentId={activeStudentId}
        currentTab={activeTab}
        inspectedConcept={inspectedConcept}
        selectedConceptForQuiz={selectedConceptForQuiz}
        selectedConceptNameForQuiz={selectedConceptNameForQuiz}
        masteryOverview={masteryOverview}
      />

      {/* Footer & Responsible AI Notice */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-slate-400">LearnGraph AI</span> — Personalised Student Learning Graph & Knowledge Decay Analyzer.
            <p className="text-[11px] text-slate-600 mt-1">
              "Don't just track what students studied. Track what they still know."
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="text-slate-400 hover:text-teal-400 text-xs flex items-center gap-1.5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-teal-400" />
              <span>Student Privacy & Data Rights</span>
            </button>
            <div className="max-w-xs text-right text-[11px] text-slate-500 hidden sm:block">
              <strong className="text-slate-400">Responsible AI:</strong> Formative graph indicators, not deterministic cognitive labels.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
