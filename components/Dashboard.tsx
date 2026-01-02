
import React, { useMemo } from 'react';
import { Task, Project, TaskStatus, UserStats, UserSettings } from '../types';
import { format, isSameDay, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { Play, CheckCircle2, Calendar, TrendingUp, Sun, Moon, CloudSun, Quote, Trophy, Zap, Star, Battery, AlertTriangle } from 'lucide-react';
import { getProjectColor } from '../utils/helpers';

interface DashboardProps {
  tasks: Task[];
  projects: Project[];
  userStats: UserStats;
  userSettings?: UserSettings; // Made optional for backward compat, but we will pass it
  onStartTask: (task: Task) => void;
  onNavigate: (view: any) => void;
  onOpenBriefing: () => void;
}

const QUOTES = [
  "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.",
  "You don't have to be great to start, but you have to start to be great.",
  "Focus is about saying no.",
  "The way to get started is to quit talking and begin doing.",
  "Productivity is never an accident. It is always the result of a commitment to excellence.",
];

const Dashboard: React.FC<DashboardProps> = ({ tasks, projects, userStats, userSettings, onStartTask, onNavigate, onOpenBriefing }) => {
  const now = new Date();
  
  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return { text: "Good Morning", icon: <Sun className="w-6 h-6 text-orange-400" /> };
    if (hour < 18) return { text: "Good Afternoon", icon: <CloudSun className="w-6 h-6 text-yellow-400" /> };
    return { text: "Good Evening", icon: <Moon className="w-6 h-6 text-indigo-400" /> };
  }, [now]);

  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  const todayTasks = useMemo(() => {
      return tasks.filter(t => 
        (t.scheduledStart && isSameDay(new Date(t.scheduledStart), now)) ||
        (t.status === TaskStatus.DONE && t.scheduledEnd && isSameDay(new Date(t.scheduledEnd), now))
      );
  }, [tasks]);

  // --- Capacity / Time Blindness Calculation ---
  const capacityMetrics = useMemo(() => {
    if (!userSettings) return { totalMinutes: 0, scheduledMinutes: 0, percent: 0, isOverloaded: false };

    // Calculate Available Work Minutes today based on settings
    const start = setMinutes(setHours(now, userSettings.workStartHour), 0);
    const end = setMinutes(setHours(now, userSettings.workEndHour), 0);
    const totalMinutesAvailable = Math.max(0, differenceInMinutes(end, start));

    // Calculate Scheduled Minutes (excluding breaks)
    const scheduledMinutes = todayTasks
        .filter(t => t.projectId !== 'system-break')
        .reduce((acc, t) => acc + t.durationMinutes, 0);

    const percent = totalMinutesAvailable > 0 ? (scheduledMinutes / totalMinutesAvailable) * 100 : 0;
    
    return {
        totalMinutes: totalMinutesAvailable,
        scheduledMinutes,
        percent,
        isOverloaded: percent > 100
    };
  }, [userSettings, todayTasks, now]);


  const completedToday = todayTasks.filter(t => t.status === TaskStatus.DONE).length;
  
  const upNext = tasks
    .filter(t => t.status !== TaskStatus.DONE && t.scheduledStart && new Date(t.scheduledStart) > now)
    .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime())[0];

  // Level Logic
  const xpProgress = (userStats.xp % 1000) / 1000 * 100;

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header with Level Info */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
                <div className="flex items-center gap-3">
                    {greeting.icon}
                    <h1 className="text-3xl font-bold text-white tracking-tight">{greeting.text}</h1>
                </div>
                <p className="text-motion-muted text-sm">{format(now, 'EEEE, MMMM do, yyyy')}</p>
            </div>
            
            <div className="flex items-center gap-4 bg-motion-card border border-motion-border px-4 py-2 rounded-2xl shadow-lg">
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <div className="absolute inset-0 bg-brand-500 rounded-full opacity-20 animate-pulse"></div>
                    <Trophy className="w-6 h-6 text-brand-400 relative z-10" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Level {userStats.level}</span>
                        <span className="text-[10px] bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded font-mono">{userStats.xp} XP</span>
                    </div>
                    <div className="w-32 h-1.5 bg-motion-bg rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${xpProgress}%` }}></div>
                    </div>
                </div>
            </div>
        </div>

        {/* REALITY CHECK GAUGE (Time Blindness Tool) */}
        {userSettings && (
            <div className={`border p-6 rounded-2xl flex items-center gap-6 relative overflow-hidden transition-all duration-500 ${capacityMetrics.isOverloaded ? 'bg-red-950/20 border-red-500/30' : 'bg-motion-card border-motion-border'}`}>
                {capacityMetrics.isOverloaded && (
                    <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>
                )}
                
                <div className="flex-1 z-10">
                    <div className="flex items-center gap-2 mb-2">
                        {capacityMetrics.isOverloaded ? (
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                        ) : (
                            <Battery className="w-5 h-5 text-brand-400" />
                        )}
                        <h3 className={`text-lg font-bold ${capacityMetrics.isOverloaded ? 'text-red-200' : 'text-white'}`}>
                            Daily Capacity Check
                        </h3>
                    </div>
                    
                    <div className="relative h-6 bg-motion-bg rounded-full overflow-hidden border border-white/5 mb-2">
                        {/* Capacity Bar */}
                        <div 
                            className={`h-full transition-all duration-700 ease-out ${capacityMetrics.isOverloaded ? 'bg-red-500' : 'bg-brand-500'}`}
                            style={{ width: `${Math.min(100, capacityMetrics.percent)}%` }}
                        />
                        {/* Overload Marker */}
                        {capacityMetrics.isOverloaded && (
                             <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/50 z-20" title="Limit"></div>
                        )}
                    </div>
                    
                    <div className="flex justify-between text-xs font-mono">
                        <span className="text-motion-muted">
                            Scheduled: <span className={capacityMetrics.isOverloaded ? 'text-red-300 font-bold' : 'text-white'}>{Math.round(capacityMetrics.scheduledMinutes / 60 * 10) / 10}h</span>
                        </span>
                        <span className="text-motion-muted">
                            Available: <span className="text-white">{Math.round(capacityMetrics.totalMinutes / 60 * 10) / 10}h</span>
                        </span>
                    </div>
                </div>

                <div className="hidden md:block w-px h-16 bg-white/10 mx-2"></div>

                <div className="hidden md:block w-1/3 z-10">
                    <p className="text-sm text-motion-muted leading-relaxed">
                        {capacityMetrics.isOverloaded 
                            ? "⚠️ Time Bankruptcy Warning: You have planned more work than fits in your day. You must prioritize or defer tasks."
                            : "You are within your capacity limits. Keep focused and you will finish on time."}
                    </p>
                    {capacityMetrics.isOverloaded && (
                        <button onClick={onOpenBriefing} className="mt-2 text-xs text-red-300 underline hover:text-red-200">
                            Reschedule Overdue Tasks
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Daily Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-motion-card border border-motion-border p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:border-brand-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CheckCircle2 className="w-16 h-16 text-brand-500" />
                </div>
                <span className="text-motion-muted text-xs font-bold uppercase tracking-wider">Completed Today</span>
                <div className="flex items-end gap-2">
                    <span className="text-4xl font-mono font-bold text-white">{completedToday}</span>
                    <span className="text-sm text-motion-muted mb-1.5">tasks</span>
                </div>
            </div>

            <div className="bg-motion-card border border-motion-border p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:border-brand-500/30 transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap className="w-16 h-16 text-yellow-500" />
                </div>
                <span className="text-motion-muted text-xs font-bold uppercase tracking-wider">Active Streak</span>
                <div className="flex items-end gap-2">
                    <span className="text-4xl font-mono font-bold text-white">{userStats.streakDays}</span>
                    <span className="text-sm text-motion-muted mb-1.5">days</span>
                </div>
            </div>

             <div className="bg-motion-card border border-motion-border p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden shadow-lg shadow-black/20">
                <span className="text-brand-100 text-xs font-bold uppercase tracking-wider flex items-center gap-2 opacity-50">
                    <Quote className="w-3 h-3" /> Daily Insight
                </span>
                <p className="text-white text-sm font-medium italic leading-relaxed opacity-90 line-clamp-3">
                    "{quote}"
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Up Next Card */}
            <div className="lg:col-span-2 space-y-4">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-brand-400 fill-brand-400" /> Up Next
                 </h2>
                 {upNext ? (
                     <div className="bg-motion-card border border-brand-500/30 p-6 rounded-2xl shadow-lg shadow-brand-900/10 flex items-center gap-6 group hover:border-brand-500/50 transition-all relative overflow-hidden">
                        <div className="absolute inset-0 bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="relative w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center shrink-0 border border-brand-500/20 group-hover:scale-105 transition-transform">
                             <div className="text-center">
                                 <div className="text-xs text-brand-400 font-bold uppercase">{format(new Date(upNext.scheduledStart!), 'MMM')}</div>
                                 <div className="text-xl font-bold text-white">{format(new Date(upNext.scheduledStart!), 'd')}</div>
                             </div>
                        </div>
                        <div className="relative flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                                 <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                                     {format(new Date(upNext.scheduledStart!), 'h:mm a')}
                                 </span>
                                 <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: getProjectColor(projects, upNext.projectId)}}></span>
                                 <span className="text-xs text-motion-muted">{projects.find(p => p.id === upNext.projectId)?.name}</span>
                             </div>
                             <h3 className="text-xl font-bold text-white truncate">{upNext.title}</h3>
                             <p className="text-sm text-motion-muted mt-1 line-clamp-1">{upNext.description || "No description provided."}</p>
                        </div>
                        <button 
                            onClick={() => onStartTask(upNext)}
                            className="relative h-12 w-12 rounded-full bg-brand-500 hover:bg-brand-400 flex items-center justify-center text-white shadow-lg hover:scale-110 transition-all z-10"
                        >
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                        </button>
                     </div>
                 ) : (
                     <div className="bg-motion-card border border-motion-border p-8 rounded-2xl text-center text-motion-muted">
                         <p>No upcoming tasks scheduled for today.</p>
                         <button onClick={() => onNavigate('calendar')} className="mt-4 text-brand-400 hover:text-brand-300 text-sm font-medium">Go to Calendar</button>
                     </div>
                 )}

                 {/* Recent List */}
                 <div className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Today's Agenda</h2>
                        <button onClick={() => onNavigate('calendar')} className="text-xs text-brand-400 hover:text-brand-300">View Full Schedule</button>
                    </div>
                    <div className="space-y-2">
                        {todayTasks.length > 0 ? todayTasks.slice(0, 5).map(task => (
                            <div key={task.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group">
                                <div className={`w-2 h-2 rounded-full ${task.status === TaskStatus.DONE ? 'bg-green-500' : 'bg-motion-border'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium text-white truncate ${task.status === TaskStatus.DONE ? 'line-through text-motion-muted' : ''}`}>{task.title}</div>
                                    <div className="text-xs text-motion-muted flex items-center gap-2">
                                        <span>{format(new Date(task.scheduledStart!), 'h:mm a')}</span>
                                        <span>•</span>
                                        <span>{task.durationMinutes}m</span>
                                    </div>
                                </div>
                                {task.status !== TaskStatus.DONE && (
                                     <button onClick={() => onStartTask(task)} className="text-motion-muted hover:text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Play className="w-4 h-4" />
                                     </button>
                                )}
                            </div>
                        )) : (
                            <p className="text-sm text-motion-muted">Your agenda is clear.</p>
                        )}
                    </div>
                 </div>
            </div>

            {/* Quick Actions / Tips */}
            <div className="space-y-4">
                 <div className="bg-motion-panel border border-motion-border rounded-2xl p-6">
                     <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Actions</h3>
                     <div className="space-y-2">
                         <button onClick={() => onNavigate('calendar')} className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white transition-colors flex items-center gap-3">
                             <Calendar className="w-4 h-4 text-brand-400" /> View Calendar
                         </button>
                         <button onClick={() => onNavigate('kanban')} className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white transition-colors flex items-center gap-3">
                             <div className="w-4 h-4 grid grid-cols-2 gap-0.5 opacity-80">
                                 <div className="bg-current rounded-[1px]"></div><div className="bg-current rounded-[1px]"></div>
                                 <div className="bg-current rounded-[1px]"></div><div className="bg-current rounded-[1px]"></div>
                             </div>
                             Project Board
                         </button>
                         <button onClick={() => onNavigate('analytics')} className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white transition-colors flex items-center gap-3">
                             <TrendingUp className="w-4 h-4 text-green-400" /> Check Analytics
                         </button>
                     </div>
                 </div>

                 <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6">
                     <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wider mb-2">Pro Tip</h3>
                     <p className="text-xs text-indigo-200/70 leading-relaxed">
                         Use <strong>Cmd + K</strong> to open the command palette from anywhere. It allows you to quickly add tasks or navigate without using your mouse.
                     </p>
                 </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
