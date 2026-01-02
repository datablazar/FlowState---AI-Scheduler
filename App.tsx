
import React, { useEffect } from 'react';
import { 
  Calendar as CalendarIcon, PieChart, Zap, Plus, RefreshCw, 
  ChevronLeft, ChevronRight, UploadCloud, AlertTriangle, 
  LayoutGrid, Settings as SettingsIcon, Play, Layers, FileText, Home, Columns, BrainCircuit
} from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

import TaskList from './components/TaskList';
import Calendar from './components/Calendar';
import KanbanBoard from './components/KanbanBoard';
import QuickAdd from './components/QuickAdd';
import Analytics from './components/Analytics';
import TaskModal from './components/TaskModal';
import ProjectModal from './components/ProjectModal';
import CourseImportModal from './components/CourseImportModal';
import Settings from './components/Settings';
import FocusMode from './components/FocusMode';
import Dashboard from './components/Dashboard';
import Capture from './components/Capture';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/ToastContainer';
import MorningBriefing from './components/MorningBriefing';
import { useAppLogic } from './hooks/useAppLogic';
import { ViewMode } from './types';

export default function App() {
  const {
      tasks, projects, userStats,
      mainView, setMainView,
      calendarView, setCalendarView,
      currentDate, setCurrentDate,
      userSettings, setUserSettings,
      sidebarNotes, setSidebarNotes,
      isScheduling, driftMinutes,
      toasts, removeToast,
      
      isTaskModalOpen, setIsTaskModalOpen,
      editingTask, 
      isProjectModalOpen, setIsProjectModalOpen,
      editingProject,
      isCourseImportOpen, setIsCourseImportOpen,
      isFocusModeOpen, setIsFocusModeOpen,
      isMorningBriefingOpen, setIsMorningBriefingOpen,
      activeFocusTask,
      isCmdPaletteOpen, setIsCmdPaletteOpen,
      
      handleAddTask, handleImportTasks, handleSaveTask,
      handleDeleteTask, handleToggleStatus, handleAddProject, handleUpdateProject,
      handleOpenEditTask, handleOpenNewTask, handleTaskMove, handleTaskResize, 
      handleDuplicateTask, handleResolveConflicts, handleTaskMoveStatus, awardXP,
      handleAutoSchedule, navigateDate, handleOpenFocusMode, handleStartTask,
      handleOpenEditProject, handleOpenNewProject, handleApplySuggestedVelocity
  } = useAppLogic();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsCmdPaletteOpen(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getHeaderDateText = () => {
    if (calendarView === 'month') return format(currentDate, 'MMMM yyyy');
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    if (start.getMonth() !== end.getMonth()) return `${format(start, 'MMM yyyy')}`;
    return format(start, 'MMMM yyyy');
  };

  const viewDetails: Record<ViewMode, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = {
      dashboard: { title: 'Dashboard', subtitle: 'Your performance at a glance', icon: LayoutGrid },
      capture: { title: 'Capture', subtitle: 'Collect ideas and shape plans', icon: BrainCircuit },
      calendar: { title: 'Planner', subtitle: 'Schedule and focus timeline', icon: CalendarIcon },
      kanban: { title: 'Kanban', subtitle: 'Move tasks across stages', icon: Columns },
      analytics: { title: 'Insights', subtitle: 'Trends, pacing, and constraints', icon: PieChart },
      notes: { title: 'Notes', subtitle: 'Quick thoughts and loose ideas', icon: FileText },
      settings: { title: 'Settings', subtitle: 'Tune your workflow', icon: SettingsIcon },
  };

  const activeView = viewDetails[mainView];
  const ActiveViewIcon = activeView.icon;

  return (
    <div className="relative h-screen overflow-hidden bg-motion-bg text-motion-text font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-brand-500/10 blur-[140px]" />
        <div className="absolute -top-24 right-[-120px] h-[360px] w-[360px] rounded-full bg-sky-400/10 blur-[140px]" />
        <div className="absolute bottom-[-160px] left-1/3 h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(255,255,255,0.06),transparent_60%)]" />
      </div>

      <div className="relative z-10 flex h-full">
        {/* Sidebar - Slim Rail */}
        <aside className="w-[88px] bg-motion-panel/90 border-r border-motion-border flex flex-col items-center py-6 gap-6 z-30 flex-shrink-0 backdrop-blur-xl">
          <div className="w-11 h-11 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-glow mb-2 ring-1 ring-white/10">
              <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          
          <nav className="flex-1 flex flex-col gap-3 w-full px-2">
            <button 
              onClick={() => setMainView('dashboard')} 
              className={`relative group w-full h-14 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1
              ${mainView === 'dashboard' ? 'bg-brand-500/10 text-brand-300 shadow-glow' : 'text-motion-muted hover:text-white hover:bg-white/5'}`}
              title="Home"
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full ${mainView === 'dashboard' ? 'bg-brand-500' : 'bg-transparent'}`} />
              <Home className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Home</span>
            </button>

            <button 
              onClick={() => setMainView('capture')} 
              className={`relative group w-full h-14 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1
              ${mainView === 'capture' ? 'bg-brand-500/10 text-brand-300 shadow-glow' : 'text-motion-muted hover:text-white hover:bg-white/5'}`}
              title="Capture & Plan"
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full ${mainView === 'capture' ? 'bg-brand-500' : 'bg-transparent'}`} />
              <BrainCircuit className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Capture</span>
            </button>

            <button 
              onClick={() => setMainView('calendar')} 
              className={`relative group w-full h-14 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1
              ${mainView === 'calendar' ? 'bg-brand-500/10 text-brand-300 shadow-glow' : 'text-motion-muted hover:text-white hover:bg-white/5'}`}
              title="Calendar & Tasks"
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full ${mainView === 'calendar' ? 'bg-brand-500' : 'bg-transparent'}`} />
              <CalendarIcon className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Planner</span>
            </button>

            <button 
              onClick={() => setMainView('kanban')} 
              className={`relative group w-full h-14 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1
              ${mainView === 'kanban' ? 'bg-brand-500/10 text-brand-300 shadow-glow' : 'text-motion-muted hover:text-white hover:bg-white/5'}`}
              title="Kanban Board"
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full ${mainView === 'kanban' ? 'bg-brand-500' : 'bg-transparent'}`} />
              <Columns className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Kanban</span>
            </button>
            
            <button 
              onClick={() => setMainView('analytics')} 
              className={`relative group w-full h-14 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1
              ${mainView === 'analytics' ? 'bg-brand-500/10 text-brand-300 shadow-glow' : 'text-motion-muted hover:text-white hover:bg-white/5'}`}
              title="Analytics"
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full ${mainView === 'analytics' ? 'bg-brand-500' : 'bg-transparent'}`} />
              <PieChart className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Insights</span>
            </button>
            
            <button 
              onClick={() => setMainView('notes')} 
              className={`relative group w-full h-14 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1
              ${mainView === 'notes' ? 'bg-brand-500/10 text-brand-300 shadow-glow' : 'text-motion-muted hover:text-white hover:bg-white/5'}`}
              title="Notepad"
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full ${mainView === 'notes' ? 'bg-brand-500' : 'bg-transparent'}`} />
              <FileText className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Notes</span>
            </button>

            <button 
              onClick={() => setMainView('settings')} 
              className={`relative group w-full h-14 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1
              ${mainView === 'settings' ? 'bg-brand-500/10 text-brand-300 shadow-glow' : 'text-motion-muted hover:text-white hover:bg-white/5'}`}
              title="Settings"
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full ${mainView === 'settings' ? 'bg-brand-500' : 'bg-transparent'}`} />
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Settings</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col h-full min-w-0 bg-motion-bg/70 relative backdrop-blur-xl">
        
        {/* Drift Alert - Floating */}
        {driftMinutes > 15 && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-red-950/80 border border-red-500/30 px-4 py-2 rounded-full flex items-center gap-3 backdrop-blur-md shadow-2xl animate-in slide-in-from-top-4">
                <div className="flex items-center gap-2 text-red-200 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Schedule drift detected: {driftMinutes}m</span>
                </div>
                <button onClick={handleAutoSchedule} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" /> Fix
                </button>
            </div>
        )}

        {/* Global Header */}
        <header className="h-16 border-b border-motion-border flex items-center justify-between px-6 flex-shrink-0 bg-motion-bg/70 backdrop-blur-xl z-20 sticky top-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner-light">
              <ActiveViewIcon className="w-4 h-4 text-brand-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{activeView.title}</div>
              <div className="hidden sm:block text-[11px] text-motion-muted truncate">{activeView.subtitle}</div>
            </div>

            {mainView === 'calendar' && (
              <div className="hidden md:flex items-center gap-3 pl-4 ml-2 border-l border-motion-border">
                <h2 className="text-sm font-bold text-white tracking-tight min-w-[120px]">{getHeaderDateText()}</h2>
                <div className="flex items-center gap-1 bg-motion-card/40 rounded-lg p-1 border border-motion-border">
                    <button onClick={() => navigateDate('prev')} className="p-1 hover:bg-white/10 rounded text-motion-muted hover:text-white transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <button 
                        onClick={() => setCurrentDate(new Date())} 
                        className="px-3 py-0.5 text-[11px] font-semibold text-motion-text hover:text-white transition-colors"
                    >
                        Today
                    </button>
                    <button onClick={() => navigateDate('next')} className="p-1 hover:bg-white/10 rounded text-motion-muted hover:text-white transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCmdPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            >
              Command
              <span className="text-[10px] text-motion-muted">Ctrl+K</span>
            </button>

            <button
              onClick={() => handleOpenNewTask()}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold shadow-lg shadow-brand-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Task</span>
              <span className="sm:hidden">New</span>
            </button>

            {mainView === 'calendar' && (
              <>
                <button 
                    onClick={handleOpenFocusMode}
                    disabled={tasks.every(t => t.status === 'Done')}
                    className="hidden md:flex group items-center gap-2 bg-motion-card/60 hover:bg-brand-500/10 border border-motion-border hover:border-brand-500/30 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-motion-text hover:text-brand-400 transition-all shadow-sm"
                >
                    <div className="w-5 h-5 rounded-full bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20">
                        <Play className="w-2.5 h-2.5 fill-current" />
                    </div>
                    Focus
                </button>

                <button 
                    onClick={handleAutoSchedule} 
                    disabled={isScheduling} 
                    className={`group relative overflow-hidden hidden md:flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-[11px] font-semibold shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 disabled:shadow-none ${isScheduling ? 'cursor-wait' : ''}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    <RefreshCw className={`w-3.5 h-3.5 ${isScheduling ? 'animate-spin' : ''}`} />
                    {isScheduling ? 'Optimizing...' : 'Auto-Schedule'}
                </button>
                
                <div className="hidden md:block h-6 w-px bg-motion-border mx-1"></div>
                
                <div className="hidden md:flex items-center gap-1">
                    <button 
                        onClick={() => setCalendarView('week')} 
                        className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${calendarView === 'week' ? 'bg-white/10 text-white' : 'text-motion-muted hover:text-white'}`}
                    >
                        Week
                    </button>
                    <button 
                        onClick={() => setCalendarView('month')} 
                        className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${calendarView === 'month' ? 'bg-white/10 text-white' : 'text-motion-muted hover:text-white'}`}
                    >
                        Month
                    </button>
                </div>

                <div className="flex md:hidden items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                  <button onClick={() => navigateDate('prev')} className="p-1 hover:bg-white/10 rounded text-motion-muted hover:text-white transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <button 
                      onClick={() => setCurrentDate(new Date())} 
                      className="px-2 py-0.5 text-[10px] font-semibold text-motion-text hover:text-white transition-colors"
                  >
                      Today
                  </button>
                  <button onClick={() => navigateDate('next')} className="p-1 hover:bg-white/10 rounded text-motion-muted hover:text-white transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>

                <div className="flex md:hidden items-center gap-1">
                    <button 
                        onClick={() => setCalendarView('week')} 
                        className={`px-2 py-1 text-[10px] font-semibold rounded-lg transition-colors ${calendarView === 'week' ? 'bg-white/10 text-white' : 'text-motion-muted hover:text-white'}`}
                    >
                        Week
                    </button>
                    <button 
                        onClick={() => setCalendarView('month')} 
                        className={`px-2 py-1 text-[10px] font-semibold rounded-lg transition-colors ${calendarView === 'month' ? 'bg-white/10 text-white' : 'text-motion-muted hover:text-white'}`}
                    >
                        Month
                    </button>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex relative">
            {mainView === 'calendar' ? (
                <>
                    <div className="flex-1 overflow-hidden h-full flex flex-col bg-motion-bg relative">
                       <Calendar 
                        date={currentDate} 
                        tasks={tasks} 
                        projects={projects} 
                        view={calendarView} 
                        onTaskMove={handleTaskMove}
                        onTaskClick={handleOpenEditTask}
                        onTaskResize={handleTaskResize}
                        onResolveConflicts={handleResolveConflicts}
                       />
                    </div>
                    
                    {/* Right Sidebar (Task Panel) */}
                    <div className="w-[340px] bg-motion-panel border-l border-motion-border flex flex-col flex-shrink-0 h-full z-10 shadow-2xl">
                        <div className="p-4 border-b border-motion-border flex items-center justify-between bg-motion-panel/95 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-brand-400" />
                                <span className="text-sm font-bold text-white tracking-wide">Tasks</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setMainView('capture')} title="Import & Plan" className="text-motion-muted hover:text-white p-2 hover:bg-white/5 rounded-lg transition-colors"><UploadCloud className="w-4 h-4" /></button>
                                <button onClick={handleOpenNewProject} title="New Project" className="text-motion-muted hover:text-white p-2 hover:bg-white/5 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>
                        
                        <div className="p-4 border-b border-motion-border/50 bg-motion-bg/30">
                            <QuickAdd onAddTask={handleAddTask} />
                        </div>
                        
                        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
                            <TaskList 
                                tasks={tasks} 
                                projects={projects} 
                                onToggleStatus={handleToggleStatus} 
                                onDelete={handleDeleteTask} 
                                onEdit={handleOpenEditTask}
                                onDuplicate={handleDuplicateTask}
                            />
                        </div>
                    </div>
                </>
            ) : mainView === 'kanban' ? (
                <KanbanBoard 
                    tasks={tasks}
                    projects={projects}
                    onTaskMoveStatus={handleTaskMoveStatus}
                    onEditTask={handleOpenEditTask}
                    onAddTask={handleOpenNewTask}
                />
            ) : mainView === 'analytics' ? (
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <Analytics tasks={tasks} projects={projects} onApplySuggestedVelocity={handleApplySuggestedVelocity} />
                </div>
            ) : mainView === 'dashboard' ? (
                <Dashboard 
                    tasks={tasks} 
                    projects={projects} 
                    userStats={userStats}
                    onStartTask={handleStartTask} 
                    onNavigate={setMainView}
                    onOpenBriefing={() => setIsMorningBriefingOpen(true)}
                />
            ) : mainView === 'capture' ? (
                <Capture 
                    projects={projects}
                    onAddTasks={handleImportTasks}
                    onOpenProjectModal={handleOpenNewProject}
                />
            ) : mainView === 'notes' ? (
                <div className="flex-1 p-8 overflow-hidden flex flex-col">
                     <div className="max-w-3xl mx-auto w-full h-full flex flex-col bg-motion-card border border-motion-border rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-motion-border flex items-center gap-2 bg-white/5">
                            <FileText className="w-5 h-5 text-brand-400" />
                            <h2 className="font-bold text-white">Notepad</h2>
                            <span className="text-xs text-motion-muted ml-auto">Auto-saved</span>
                        </div>
                        <textarea 
                            value={sidebarNotes}
                            onChange={(e) => setSidebarNotes(e.target.value)}
                            placeholder="Jot down quick thoughts, unformatted lists, or ideas here..."
                            className="flex-1 w-full bg-transparent p-6 text-white/90 focus:outline-none resize-none font-mono text-sm leading-relaxed"
                        />
                     </div>
                </div>
            ) : (
                <Settings 
                  settings={userSettings} 
                  onUpdate={setUserSettings}
                  projects={projects}
                  onEditProject={handleOpenEditProject}
                  onCreateProject={handleOpenNewProject}
                />
            )}
        </div>
      </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <CommandPalette 
        isOpen={isCmdPaletteOpen} 
        onClose={() => setIsCmdPaletteOpen(false)} 
        onNavigate={setMainView}
        onAddTask={handleOpenNewTask}
        tasks={tasks}
      />

      <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={handleSaveTask} task={editingTask} projects={projects} allTasks={tasks} />
      <ProjectModal 
        isOpen={isProjectModalOpen} 
        onClose={() => setIsProjectModalOpen(false)} 
        onSave={editingProject ? handleUpdateProject : handleAddProject}
        project={editingProject || undefined}
      />
      {/* Deprecated Modal, logic moved to Capture page but keeping component valid if needed */}
      <CourseImportModal isOpen={isCourseImportOpen} onClose={() => setIsCourseImportOpen(false)} onImport={handleImportTasks} projects={projects} completedTasks={tasks} />
      
      {isMorningBriefingOpen && (
          <MorningBriefing 
            tasks={tasks}
            onUpdateTask={handleSaveTask}
            onDeleteTask={handleDeleteTask}
            onClose={() => setIsMorningBriefingOpen(false)}
          />
      )}

      {isFocusModeOpen && activeFocusTask && (
         <FocusMode 
            task={activeFocusTask} 
            onClose={() => setIsFocusModeOpen(false)}
            onComplete={() => {
                handleToggleStatus(activeFocusTask.id);
                setIsFocusModeOpen(false);
                awardXP(50);
            }}
            onUpdateTask={handleSaveTask}
         />
      )}
    </div>
  );
}
