import React, { useEffect, useState } from 'react';
import { X, Gauge, Clock, Flag } from 'lucide-react';
import { Project, Priority } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  project?: Project;
}

const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
];

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, project }) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[6]);
  const [velocity, setVelocity] = useState(1.0);
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState<number | ''>('');
  const [defaultDuration, setDefaultDuration] = useState<number | ''>('');
  const [defaultPriority, setDefaultPriority] = useState<Priority | ''>('');

  useEffect(() => {
    if (!isOpen) return;
    setName(project?.name || '');
    setSelectedColor(project?.color || COLORS[6]);
    setVelocity(project?.velocity ?? 1.0);
    setWeeklyCapacityHours(project?.weeklyCapacityHours ?? '');
    setDefaultDuration(project?.defaultTaskDuration ?? '');
    setDefaultPriority(project?.defaultPriority ?? '');
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: project?.id || Date.now().toString(),
      name,
      color: selectedColor,
      velocity: velocity,
      weeklyCapacityHours: weeklyCapacityHours === '' ? undefined : weeklyCapacityHours,
      defaultTaskDuration: defaultDuration === '' ? undefined : defaultDuration,
      defaultPriority: defaultPriority === '' ? undefined : defaultPriority
    });
    setName('');
    setVelocity(1.0);
    setWeeklyCapacityHours('');
    setDefaultDuration('');
    setDefaultPriority('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-motion-card/95 border border-motion-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-white/10 scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-motion-border">
          <h2 className="text-lg font-bold text-white">{project ? 'Edit Project' : 'Create Project'}</h2>
          <button onClick={onClose} className="text-motion-muted hover:text-white transition-colors bg-white/5 p-1.5 rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing, Development"
              className="w-full bg-motion-bg/50 border border-motion-border rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder-motion-muted/50"
              autoFocus
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
              <Gauge className="w-3 h-3" /> Learning Velocity
            </label>
            <div className="bg-motion-bg/50 border border-motion-border rounded-xl p-4">
                <div className="flex justify-between text-xs text-white mb-3 font-medium">
                    <span className="text-motion-muted">Slower</span>
                    <span className="font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{velocity.toFixed(1)}x</span>
                    <span className="text-motion-muted">Faster</span>
                </div>
                <input 
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={velocity}
                    onChange={(e) => setVelocity(parseFloat(e.target.value))}
                    className="w-full accent-brand-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-motion-muted mt-3 leading-relaxed">
                    Adjust how the AI estimates time. <span className="text-white">Lower</span> means you need more time than average.
                </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-motion-bg/50 border border-motion-border rounded-xl p-4">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <Clock className="w-3 h-3" /> Weekly Focus Hours
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={weeklyCapacityHours}
                onChange={(e) => setWeeklyCapacityHours(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="e.g. 8"
                className="w-full bg-transparent text-sm text-white focus:outline-none border border-white/10 rounded-lg px-2 py-1.5"
              />
              <p className="text-[10px] text-motion-muted mt-2">Optional weekly budget for planning.</p>
            </div>

            <div className="bg-motion-bg/50 border border-motion-border rounded-xl p-4">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <Clock className="w-3 h-3" /> Default Task Duration
              </label>
              <input
                type="number"
                min="15"
                step="15"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="e.g. 45"
                className="w-full bg-transparent text-sm text-white focus:outline-none border border-white/10 rounded-lg px-2 py-1.5"
              />
              <p className="text-[10px] text-motion-muted mt-2">Overrides the global default.</p>
            </div>
          </div>

          <div className="bg-motion-bg/50 border border-motion-border rounded-xl p-4">
            <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
              <Flag className="w-3 h-3" /> Default Priority
            </label>
            <select
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value as Priority | '')}
              className="w-full bg-transparent text-sm text-white focus:outline-none border border-white/10 rounded-lg px-2 py-2"
            >
              <option value="" className="bg-motion-card">Use global default</option>
              {Object.values(Priority).map(level => (
                <option key={level} value={level} className="bg-motion-card">
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-3">
              Color Tag
            </label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-all hover:scale-110 shadow-sm ${selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-motion-card scale-110' : 'opacity-80 hover:opacity-100'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold text-motion-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-brand-900/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
              disabled={!name.trim()}
            >
              {project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
