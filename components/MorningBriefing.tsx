
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import { format, isBefore, startOfDay, addDays } from 'date-fns';
import { Sun, Calendar, ArrowRight, Check, Clock, Trash2, X } from 'lucide-react';

interface MorningBriefingProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onClose: () => void;
}

const MorningBriefing: React.FC<MorningBriefingProps> = ({ tasks, onUpdateTask, onDeleteTask, onClose }) => {
  const [step, setStep] = useState(0);
  
  // 1. Find overdue tasks
  const overdueTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return tasks.filter(t => 
      t.status !== TaskStatus.DONE && 
      t.scheduledStart && 
      isBefore(new Date(t.scheduledStart), today)
    );
  }, [tasks]);

  // 2. Find unscheduled tasks
  const unscheduledTasks = useMemo(() => {
      return tasks.filter(t => t.status !== TaskStatus.DONE && !t.scheduledStart);
  }, [tasks]);

  const reviewQueue = [...overdueTasks];

  const currentTask = reviewQueue[step];
  const isFinished = step >= reviewQueue.length;

  const handleMoveToToday = () => {
      if (!currentTask) return;
      const today = new Date();
      // Set to 9am today effectively, scheduler will refine it
      today.setHours(9, 0, 0, 0);
      
      onUpdateTask({
          ...currentTask,
          scheduledStart: today.toISOString(),
          scheduledEnd: undefined, // Clear end so scheduler recalculates
          isFixed: false,
          schedulingReason: 'Moved to today via Morning Briefing'
      });
      setStep(prev => prev + 1);
  };

  const handleMoveToTomorrow = () => {
      if (!currentTask) return;
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      onUpdateTask({
          ...currentTask,
          scheduledStart: tomorrow.toISOString(),
          scheduledEnd: undefined,
          isFixed: false,
          schedulingReason: 'Deferred to tomorrow'
      });
      setStep(prev => prev + 1);
  };

  const handleDelete = () => {
      if (!currentTask) return;
      onDeleteTask(currentTask.id);
      setStep(prev => prev + 1); // Skip current index as list shrinks logic handled by parent state update usually, but here we iterate an index
  };

  if (reviewQueue.length === 0 || isFinished) {
      return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-motion-card border border-motion-border rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl">
                  <div className="w-20 h-20 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                      <Sun className="w-10 h-10 text-brand-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
                  <p className="text-motion-muted mb-8">
                      Your backlog is clear. You have {tasks.filter(t => t.status !== TaskStatus.DONE && t.scheduledStart).length} tasks scheduled for the future.
                  </p>
                  <button 
                    onClick={onClose}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-900/20"
                  >
                      Let's Get to Work
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
        <div className="max-w-2xl w-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Sun className="w-8 h-8 text-yellow-400" /> Morning Briefing
                    </h1>
                    <p className="text-motion-muted mt-2">
                        You have <span className="text-brand-400 font-bold">{reviewQueue.length} overdue tasks</span>. Let's plan them.
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-mono font-bold text-white/20">
                        {step + 1}<span className="text-2xl">/{reviewQueue.length}</span>
                    </div>
                </div>
            </div>

            <div className="bg-motion-card border border-motion-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 h-1 bg-brand-500 transition-all duration-300" style={{ width: `${((step)/reviewQueue.length)*100}%` }} />

                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider mb-4 border border-red-500/20">
                        Overdue since {format(new Date(currentTask.scheduledStart!), 'MMM d')}
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4 leading-tight">{currentTask.title}</h2>
                    <p className="text-lg text-motion-muted">{currentTask.description || "No description provided."}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <button 
                        onClick={handleMoveToToday}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 hover:bg-brand-500/10 border border-white/5 hover:border-brand-500/50 transition-all"
                    >
                        <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Check className="w-6 h-6 text-brand-400" />
                        </div>
                        <span className="font-bold text-white">Do Today</span>
                        <span className="text-xs text-motion-muted mt-1">Auto-schedule</span>
                    </button>

                    <button 
                        onClick={handleMoveToTomorrow}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Clock className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-bold text-white">Defer</span>
                        <span className="text-xs text-motion-muted mt-1">Move to Tomorrow</span>
                    </button>

                    <button 
                        onClick={handleDelete}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/50 transition-all"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Trash2 className="w-6 h-6 text-red-400" />
                        </div>
                        <span className="font-bold text-red-400">Delete</span>
                        <span className="text-xs text-red-400/50 mt-1">Not doing it</span>
                    </button>
                </div>
            </div>
            
            <div className="mt-8 text-center">
                <button onClick={onClose} className="text-sm text-motion-muted hover:text-white transition-colors">
                    Skip Briefing
                </button>
            </div>
        </div>
    </div>
  );
};

export default MorningBriefing;
