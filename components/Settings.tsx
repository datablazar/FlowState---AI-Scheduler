
import React from 'react';
import { UserSettings } from '../types';
import { Clock, Check, Settings as SettingsIcon, Timer, Coffee, Zap, Info, BatteryCharging, BrainCircuit, RefreshCw, LayoutTemplate, Download, Trash2, Save } from 'lucide-react';

interface SettingsProps {
  settings: UserSettings;
  onUpdate: (settings: UserSettings) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  
  const handleDayToggle = (dayIndex: number) => {
    const newDays = settings.workDays.includes(dayIndex)
      ? settings.workDays.filter(d => d !== dayIndex)
      : [...settings.workDays, dayIndex].sort();
    onUpdate({ ...settings, workDays: newDays });
  };

  const handleExportData = () => {
      const data = {
          tasks: localStorage.getItem('flowstate_tasks'),
          projects: localStorage.getItem('flowstate_projects'),
          settings: localStorage.getItem('flowstate_settings'),
          notes: localStorage.getItem('flowstate_notes')
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowstate-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleResetData = () => {
      if (confirm("Are you sure? This will wipe all tasks, projects, and settings. This cannot be undone.")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  return (
    <div className="h-full p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
          <div className="w-12 h-12 bg-motion-card border border-motion-border rounded-2xl flex items-center justify-center shadow-lg">
            <SettingsIcon className="w-6 h-6 text-brand-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Work Preferences</h2>
            <p className="text-motion-muted text-sm">Configure hours and rhythm so the AI matches your flow.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Left Column */}
            <div className="space-y-8">
                {/* Work Hours & Days */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-brand-400" />
                        <h3 className="text-sm font-bold text-motion-muted uppercase tracking-wider">Availability</h3>
                    </div>
                    
                    <div className="bg-motion-card border border-motion-border rounded-2xl p-6 shadow-sm space-y-6 h-full">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-white">Start Time</label>
                                <div className="relative">
                                    <select
                                    value={settings.workStartHour}
                                    onChange={(e) => onUpdate({ ...settings, workStartHour: parseInt(e.target.value) })}
                                    className="w-full bg-motion-bg border border-motion-border rounded-xl px-4 py-3 text-white appearance-none focus:ring-1 focus:ring-brand-500 outline-none cursor-pointer text-sm font-medium"
                                    >
                                    {HOURS.map(h => (
                                        <option key={h} value={h}>{formatHour(h)}</option>
                                    ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-motion-muted">
                                    <Clock className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-white">End Time</label>
                                <div className="relative">
                                    <select
                                    value={settings.workEndHour}
                                    onChange={(e) => onUpdate({ ...settings, workEndHour: parseInt(e.target.value) })}
                                    className="w-full bg-motion-bg border border-motion-border rounded-xl px-4 py-3 text-white appearance-none focus:ring-1 focus:ring-brand-500 outline-none cursor-pointer text-sm font-medium"
                                    >
                                    {HOURS.map(h => (
                                        <option key={h} value={h} disabled={h <= settings.workStartHour}>
                                        {formatHour(h)}
                                        </option>
                                    ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-motion-muted">
                                    <Clock className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-white">Active Days</label>
                            <div className="grid grid-cols-7 gap-2">
                                {DAYS.map((day, index) => {
                                const isActive = settings.workDays.includes(index);
                                return (
                                    <button
                                    key={day}
                                    onClick={() => handleDayToggle(index)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-200 ${
                                        isActive
                                        ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-900/20 transform scale-105'
                                        : 'bg-motion-bg border-motion-border text-motion-muted hover:border-motion-muted/50 hover:text-white'
                                    }`}
                                    >
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{day}</span>
                                    {isActive && <Check className="w-3 h-3 mt-1" />}
                                    </button>
                                );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Behavior Section */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-brand-400" />
                        <h3 className="text-sm font-bold text-motion-muted uppercase tracking-wider">Behavior</h3>
                    </div>
                    
                    <div className="bg-motion-card border border-motion-border rounded-2xl p-6 shadow-sm space-y-6">
                        
                        {/* Auto-Reschedule */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-sm font-semibold text-white">Auto-Reschedule Overdue</div>
                                <div className="text-xs text-motion-muted max-w-[250px]">Automatically move unfinished tasks from yesterday to today.</div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div 
                                    onClick={() => onUpdate({...settings, autoRescheduleOverdue: !settings.autoRescheduleOverdue})}
                                    className={`w-10 h-5 rounded-full p-1 transition-colors duration-200 ${settings.autoRescheduleOverdue ? 'bg-brand-500' : 'bg-motion-border'}`}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${settings.autoRescheduleOverdue ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                            </label>
                        </div>

                        {/* Default Duration */}
                        <div className="space-y-3 border-t border-motion-border pt-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-white">Default Task Duration</label>
                                <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{settings.defaultTaskDuration} min</span>
                            </div>
                            <input 
                                type="range" 
                                min="15" max="120" step="15"
                                value={settings.defaultTaskDuration}
                                onChange={(e) => onUpdate({...settings, defaultTaskDuration: parseInt(e.target.value)})}
                                className="w-full accent-brand-500 h-1.5 bg-motion-bg rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Planning Buffer */}
                        <div className="space-y-3 border-t border-motion-border pt-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-white">Buffer Between Tasks</label>
                                <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{settings.planningBufferMinutes} min</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="30" step="5"
                                value={settings.planningBufferMinutes}
                                onChange={(e) => onUpdate({...settings, planningBufferMinutes: parseInt(e.target.value)})}
                                className="w-full accent-brand-500 h-1.5 bg-motion-bg rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-[10px] text-motion-muted">Gaps between scheduled tasks.</p>
                        </div>
                    </div>
                </section>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
                {/* Chunking / Pomodoro Redesign */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4 text-brand-400" />
                            <h3 className="text-sm font-bold text-motion-muted uppercase tracking-wider">Focus Rhythm</h3>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <span className="text-xs font-medium text-motion-muted group-hover:text-white transition-colors">{settings.enableChunking ? 'Rhythm Active' : 'Off'}</span>
                            <div 
                                onClick={() => onUpdate({...settings, enableChunking: !settings.enableChunking})}
                                className={`w-10 h-5 rounded-full p-1 transition-colors duration-200 ${settings.enableChunking ? 'bg-brand-500' : 'bg-motion-border'}`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${settings.enableChunking ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </label>
                    </div>

                    <div className={`bg-motion-card border border-motion-border rounded-2xl p-6 shadow-sm space-y-8 transition-all duration-300 ${settings.enableChunking ? 'opacity-100 translate-y-0' : 'opacity-50 pointer-events-none grayscale'}`}>
                        
                        {/* Visualizer */}
                        <div className="bg-motion-bg rounded-xl p-4 border border-motion-border">
                            <div className="flex items-center justify-between text-[10px] text-motion-muted uppercase tracking-wider font-bold mb-3">
                                <span>Your Cycle</span>
                                <span>{(settings.workChunkMinutes * settings.longBreakInterval) + (settings.shortBreakMinutes * (settings.longBreakInterval - 1)) + settings.longBreakMinutes} Minutes Total</span>
                            </div>
                            <div className="flex items-center h-12 w-full gap-1">
                                {Array.from({length: Math.min(settings.longBreakInterval, 4)}).map((_, i) => (
                                    <React.Fragment key={i}>
                                        <div className="h-full bg-brand-500/20 border border-brand-500/40 rounded flex items-center justify-center flex-1 relative group cursor-help transition-all hover:bg-brand-500/30">
                                            <Zap className="w-3 h-3 text-brand-400" />
                                            <span className="absolute bottom-full mb-2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 z-10 pointer-events-none">Focus: {settings.workChunkMinutes}m</span>
                                        </div>
                                        {i < Math.min(settings.longBreakInterval, 4) - 1 && (
                                            <div className="h-2/3 bg-green-500/20 border border-green-500/40 rounded w-4 flex items-center justify-center relative group cursor-help transition-all hover:bg-green-500/30">
                                                <div className="w-1 h-1 rounded-full bg-green-500"></div>
                                                <span className="absolute bottom-full mb-2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 z-10 pointer-events-none">Recharge: {settings.shortBreakMinutes}m</span>
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}
                                {settings.longBreakInterval > 4 && <div className="text-motion-muted text-xs font-bold px-1">...</div>}
                                <div className="h-full bg-blue-500/20 border border-blue-500/40 rounded w-16 flex items-center justify-center relative group cursor-help ml-1 transition-all hover:bg-blue-500/30">
                                    <Coffee className="w-3 h-3 text-blue-400" />
                                    <span className="absolute bottom-full mb-2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 z-10 pointer-events-none">Deep Rest: {settings.longBreakMinutes}m</span>
                                </div>
                            </div>
                        </div>

                        {/* Focus Duration */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="flex items-center gap-2 text-xs font-semibold text-white">
                                    <Timer className="w-3.5 h-3.5 text-brand-400" /> Focus Session Length
                                </label>
                                <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{settings.workChunkMinutes} min</span>
                            </div>
                            <input 
                                type="range" 
                                min="15" max="120" step="15"
                                value={settings.workChunkMinutes}
                                onChange={(e) => onUpdate({...settings, workChunkMinutes: parseInt(e.target.value)})}
                                className="w-full accent-brand-500 h-1.5 bg-motion-bg rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-[10px] text-motion-muted">How long can you maintain deep focus before needing a pause?</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            {/* Short Break */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-white">
                                        <BatteryCharging className="w-3.5 h-3.5 text-green-400" /> Recharge
                                    </label>
                                    <span className="text-xs font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded">{settings.shortBreakMinutes} min</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="15" max="45" step="15"
                                    value={settings.shortBreakMinutes}
                                    onChange={(e) => onUpdate({...settings, shortBreakMinutes: parseInt(e.target.value)})}
                                    className="w-full accent-green-500 h-1.5 bg-motion-bg rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Long Break */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-white">
                                        <Coffee className="w-3.5 h-3.5 text-blue-400" /> Deep Rest
                                    </label>
                                    <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{settings.longBreakMinutes} min</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="15" max="90" step="15"
                                    value={settings.longBreakMinutes}
                                    onChange={(e) => onUpdate({...settings, longBreakMinutes: parseInt(e.target.value)})}
                                    className="w-full accent-blue-500 h-1.5 bg-motion-bg rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Interval */}
                        <div className="space-y-3 pt-2 border-t border-motion-border">
                            <div className="flex justify-between items-center mt-4">
                                <label className="text-xs font-semibold text-white">Deep Rest Cadence</label>
                                <span className="text-xs font-mono text-motion-muted">After {settings.longBreakInterval} sessions</span>
                            </div>
                            <div className="flex gap-2">
                                {[2, 3, 4, 5, 6].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => onUpdate({...settings, longBreakInterval: num})}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                                            settings.longBreakInterval === num 
                                            ? 'bg-brand-600 text-white shadow-md ring-1 ring-white/20' 
                                            : 'bg-motion-bg hover:bg-white/5 text-motion-muted'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-motion-muted">How many focus sessions to complete before taking a deep rest.</p>
                        </div>

                    </div>
                </section>

                {/* Data Management Section */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Save className="w-4 h-4 text-brand-400" />
                        <h3 className="text-sm font-bold text-motion-muted uppercase tracking-wider">Data Management</h3>
                    </div>
                    <div className="bg-motion-card border border-motion-border rounded-2xl p-6 shadow-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={handleExportData}
                                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-4 px-4 text-xs font-medium text-white transition-colors"
                            >
                                <Download className="w-4 h-4" /> Export Backup
                            </button>
                            <button 
                                onClick={handleResetData}
                                className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl py-4 px-4 text-xs font-medium text-red-400 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Factory Reset
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
