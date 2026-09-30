import React from 'react';
import {
  Network,
  LayoutDashboard,
  Compass,
  GitBranch,
  TrendingDown,
  ListOrdered,
  BookOpen,
  User,
  LogIn,
  LogOut,
  ShieldCheck,
  HelpCircle,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';

export default function Navbar({
  activeTab,
  onSelectTab,
  activeStudentId,
  onSelectStudent,
  currentStudent,
  onOpenAuth,
  onLogout,
  theme = 'dark',
  onToggleTheme,
}) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'roadmap', label: 'Adaptive Roadmap', icon: Compass },
    { id: 'graph', label: 'Knowledge Graph', icon: GitBranch },
    { id: 'decay', label: 'Knowledge Decay', icon: TrendingDown },
    { id: 'revision', label: 'Revision Queue', icon: ListOrdered },
    { id: 'quiz', label: 'Quiz & Testing', icon: BookOpen },
    { id: 'brain-blast', label: 'Brain Blast', icon: Zap },
    { id: 'help', label: 'Help & Support', icon: HelpCircle },
  ];

  const isDemo = activeStudentId?.startsWith('student-demo-');

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Primary Brand Identity */}
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-3 shrink-0 mr-4 sm:mr-6 lg:mr-8 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 rounded-xl transition-opacity hover:opacity-95 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-teal-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Network className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <span className="font-extrabold text-lg sm:text-xl text-slate-100 tracking-tight whitespace-nowrap">
              LearnGraph<span className="text-teal-400">.ai</span>
            </span>
          </button>


          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Theme Switch, Student Profile Selector & Auth */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all flex items-center justify-center shadow-sm"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 animate-fade-in" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 animate-fade-in" />
              )}
            </button>

            {/* Student Switcher / Profile */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <User className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              {currentStudent && !isDemo ? (
                <span className="font-semibold text-slate-200 truncate max-w-[120px]">
                  {currentStudent.name}
                </span>
              ) : (
                <select
                  value={activeStudentId}
                  onChange={(e) => onSelectStudent(e.target.value)}
                  className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="student-demo-1" className="bg-slate-900 text-slate-100">
                    Aiden Vance (CS)
                  </option>
                  <option value="student-demo-2" className="bg-slate-900 text-slate-100">
                    Maya Lin (Data Sci)
                  </option>
                </select>
              )}
            </div>

            {/* Auth / Profile Button */}
            {currentStudent && !isDemo ? (
              <button
                onClick={onLogout}
                title="Log out from personal account"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 font-semibold text-xs transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In / Register</span>
              </button>
            )}

            {/* Live Engine Indicator */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Engine Active</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/60 overflow-x-auto gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium rounded-lg shrink-0 ${
                  isActive ? 'text-teal-400 bg-teal-500/10' : 'text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
