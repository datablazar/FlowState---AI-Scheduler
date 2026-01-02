
import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, Play, Pause, Maximize2, Minimize2, ListTodo, Volume2, VolumeX, History, Clock } from 'lucide-react';
import { Task } from '../types';
import { focusAudio, NoiseType } from '../utils/audioEngine';
import { addSeconds, format } from 'date-fns';

interface FocusModeProps {
  task: Task;
  onComplete: () => void;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
}

const FocusMode: React.FC<FocusModeProps> = ({ task, onComplete, onClose, onUpdateTask }) => {
  const [timeLeft, setTimeLeft] = useState(task.durationMinutes * 60);
  const [isActive, setIsActive] = useState(false); // Start paused so session trigger is explicit
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Audio State
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.3);
  const [noiseType, setNoiseType] = useState<NoiseType>('brown');
  const [showAudioControls, setShowAudioControls] = useState(false);

  // Time Tracking Refs
  const sessionStartRef = useRef<number | null>(null);
  
  // Start session on mount if user wants (optional, currently waiting for user to click play)
  useEffect(() => {
      // Auto-start disabled to let user get ready, or enable if preferred:
      handleStartSession();
      return () => {
          handleStopSession();
          focusAudio.stop();
      };
  }, []);

  const handleStartSession = () => {
      if (isActive) return;
      setIsActive(true);
      sessionStartRef.current = Date.now();
      if (isAudioPlaying) focusAudio.play(noiseType, audioVolume);
  };

  const handleStopSession = () => {
      if (!isActive || !sessionStartRef.current) return;
      
      const now = Date.now();
      const durationMs = now - sessionStartRef.current;
      const durationMinutes = durationMs / 1000 / 60;
      
      if (durationMinutes > 0.1) { // Only record if > 6 seconds
          const newSession = {
              id: Date.now().toString(),
              start: new Date(sessionStartRef.current).toISOString(),
              end: new Date(now).toISOString(),
              durationMinutes: durationMinutes
          };
          
          const updatedTask = {
              ...task,
              sessions: [...(task.sessions || []), newSession],
              actualDurationMinutes: (task.actualDurationMinutes || 0) + durationMinutes
          };
          
          // Update parent state but don't cause a full unmount/remount flicker if possible
          // We call this to persist data
          onUpdateTask(updatedTask);
      }
      
      setIsActive(false);
      sessionStartRef.current = null;
      focusAudio.stop();
  };

  const toggleTimer = () => {
      if (isActive) {
          handleStopSession();
      } else {
          handleStartSession();
      }
  };

  // Timer Countdown Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
        interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0) {
                    handleStopSession();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const toggleAudio = () => {
      if (isAudioPlaying) {
          focusAudio.stop();
          setIsAudioPlaying(false);
      } else {
          focusAudio.play(noiseType, audioVolume);
          setIsAudioPlaying(true);
          // If timer not running, should we start it? No, keep separate.
      }
  };

  const changeVolume = (val: number) => {
      setAudioVolume(val);
      focusAudio.setVolume(val);
  };
  
  const changeNoiseType = (type: NoiseType) => {
      setNoiseType(type);
      if (isAudioPlaying) {
          focusAudio.play(type, audioVolume);
      }
  };

  const handleComplete = () => {
      handleStopSession();
      onComplete();
  };

  const handleClose = () => {
      handleStopSession();
      onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSeconds = task.durationMinutes * 60;
  const progress = Math.min(100, Math.max(0, ((totalSeconds - timeLeft) / totalSeconds) * 100));
  
  // SVG Circle calculation
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalSeconds) * circumference;

  const toggleSubtask = (subtaskId: string) => {
    if (!task.subtasks) return;
    const updatedSubtasks = task.subtasks.map(s => 
        s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };

  // Calculate total actual time for display
  // Note: we add current session time if active for live display
  const getLiveActualTime = () => {
      let total = task.actualDurationMinutes || 0;
      if (isActive && sessionStartRef.current) {
          total += (Date.now() - sessionStartRef.current) / 1000 / 60;
      }
      return total;
  };
  
  // We use a separate state for live actual time just for render to avoid hitting props too often
  const [liveActual, setLiveActual] = useState(task.actualDurationMinutes || 0);
  
  useEffect(() => {
      const interval = setInterval(() => {
          setLiveActual(getLiveActualTime());
      }, 1000);
      return () => clearInterval(interval);
  }, [isActive, task.actualDurationMinutes]);

  // --- Time Blindness Feature: Projected End Time ---
  const projectedEndTime = addSeconds(new Date(), timeLeft);

  if (isMinimized) {
      return (
          <div className="fixed bottom-6 right-6 z-50 bg-motion-card border border-motion-border rounded-xl shadow-2xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-5 glass-panel">
               <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-brand-500 transition-all duration-1000 ease-linear" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                    <span className="text-[10px] font-mono font-bold text-white">{Math.ceil(timeLeft / 60)}m</span>
               </div>
               <div className="flex flex-col">
                   <span className="text-xs font-bold text-white max-w-[150px] truncate">{task.title}</span>
                   <span className="text-[10px] text-motion-muted flex items-center gap-1">
                       {isActive ? 'Focusing...' : 'Paused'}
                       <span className="text-brand-400">• {Math.round(liveActual)}m tracked</span>
                   </span>
               </div>
               <button onClick={() => setIsMinimized(false)} className="p-2 hover:bg-white/10 rounded-lg text-motion-muted hover:text-white">
                   <Maximize2 className="w-4 h-4" />
               </button>
          </div>
      )
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#000] flex flex-col animate-in fade-in duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-900/10 to-black pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 p-6 flex justify-between items-center max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 text-white/80 font-mono text-sm tracking-widest">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            FLOW MODE
        </div>
        <div className="flex items-center gap-4">
             {/* Sound Controls */}
             <div className="relative">
                 <button 
                    onClick={() => setShowAudioControls(!showAudioControls)} 
                    className={`p-2 rounded-full transition-colors ${isAudioPlaying ? 'bg-brand-500/20 text-brand-400' : 'text-white/50 hover:bg-white/10'}`}
                 >
                    {isAudioPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                 </button>
                 
                 {showAudioControls && (
                     <div className="absolute top-full right-0 mt-2 w-64 bg-[#121215] border border-white/10 rounded-xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                         <div className="flex justify-between items-center mb-4">
                             <span className="text-xs font-bold text-white uppercase">Soundscape</span>
                             <button onClick={toggleAudio} className={`text-[10px] px-2 py-0.5 rounded font-bold ${isAudioPlaying ? 'bg-brand-500 text-white' : 'bg-white/10 text-motion-muted'}`}>
                                 {isAudioPlaying ? 'ON' : 'OFF'}
                             </button>
                         </div>
                         
                         <div className="grid grid-cols-3 gap-2 mb-4">
                             {(['brown', 'pink', 'white'] as NoiseType[]).map(type => (
                                 <button 
                                    key={type}
                                    onClick={() => changeNoiseType(type)}
                                    className={`px-2 py-2 rounded-lg text-xs capitalize transition-colors ${noiseType === type ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-motion-muted hover:bg-white/10'}`}
                                 >
                                     {type}
                                 </button>
                             ))}
                         </div>
                         
                         <div className="flex items-center gap-2">
                             <Volume2 className="w-3 h-3 text-motion-muted" />
                             <input 
                                type="range" 
                                min="0" max="1" step="0.05"
                                value={audioVolume}
                                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                                className="w-full accent-brand-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                             />
                         </div>
                     </div>
                 )}
             </div>

             <button onClick={() => setIsMinimized(true)} className="text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                <Minimize2 className="w-5 h-5" />
             </button>
             <button onClick={handleClose} className="text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
             </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full px-6">
          
          <div className="flex flex-col md:flex-row items-center justify-center w-full gap-16">
            {/* Timer Section */}
            <div className="flex flex-col items-center">
                <div className="relative mb-8 group cursor-pointer" onClick={toggleTimer}>
                    {/* Glow behind timer */}
                    <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-1000 ${isActive ? 'bg-brand-500/10 scale-110' : 'bg-transparent scale-100'}`} />
                    
                    <div className="relative w-80 h-80 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 260 260">
                            {/* Background Circle */}
                            <circle cx="130" cy="130" r={radius} fill="none" stroke="#27272a" strokeWidth="6" />
                            {/* Progress Circle */}
                            <circle 
                                cx="130" cy="130" r={radius} 
                                fill="none" 
                                stroke={isActive ? "#0ea5e9" : "#52525b"} 
                                strokeWidth="6" 
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-7xl font-mono font-bold tracking-tighter text-white tabular-nums drop-shadow-2xl">
                                {formatTime(timeLeft)}
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-brand-400 uppercase tracking-widest bg-brand-500/10 px-3 py-1 rounded-full">
                                    {isActive ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                                    {isActive ? 'Focusing' : 'Paused'}
                                </div>
                            </div>
                            
                            {/* Live Actual Time */}
                            <div className="absolute bottom-16 flex items-center gap-1.5 text-xs font-medium text-motion-muted">
                                <History className="w-3.5 h-3.5" />
                                <span>Total: {Math.round(liveActual)}m</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Time Blindness Aid: Finish Time */}
                {isActive && (
                    <div className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5 animate-in slide-in-from-top-2">
                        <Clock className="w-3.5 h-3.5 text-motion-muted" />
                        <span className="text-xs text-motion-muted">
                            Finishes at <span className="text-white font-bold">{format(projectedEndTime, 'h:mm a')}</span>
                        </span>
                    </div>
                )}

                <div className="flex gap-4">
                    <button 
                        onClick={toggleTimer}
                        className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all text-sm"
                    >
                        {isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button 
                        onClick={handleComplete}
                        className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-lg shadow-brand-900/20 transition-all hover:scale-105 flex items-center gap-2 text-sm"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Done
                    </button>
                </div>
            </div>

            {/* Task Info Section */}
            <div className="max-w-md w-full text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                    {task.title}
                </h1>
                {task.description && (
                    <p className="text-motion-muted text-sm leading-relaxed mb-8 border-l-2 border-white/10 pl-4">
                        {task.description}
                    </p>
                )}

                {/* Subtasks / Checklist */}
                {task.subtasks && task.subtasks.length > 0 && (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-wider mb-4">
                            <ListTodo className="w-4 h-4" />
                            Session Checklist
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {task.subtasks.map(sub => (
                                <label key={sub.id} className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer group ${sub.isCompleted ? 'bg-brand-500/10' : 'hover:bg-white/5'}`}>
                                    <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${sub.isCompleted ? 'bg-brand-500 border-brand-500 text-white' : 'border-white/20 bg-transparent text-transparent group-hover:border-white/40'}`}>
                                        <input type="checkbox" className="hidden" checked={sub.isCompleted} onChange={() => toggleSubtask(sub.id)} />
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-sm font-medium transition-all ${sub.isCompleted ? 'text-brand-200 line-through' : 'text-white'}`}>
                                        {sub.title}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>

      </main>
    </div>
  );
};

export default FocusMode;
