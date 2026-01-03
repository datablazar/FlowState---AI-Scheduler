import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, Calendar as CalendarIcon, Flag, Link as LinkIcon, Layers, AlertTriangle, Sparkles, CheckCircle2, ListTodo, Plus, Trash2, Repeat, Zap } from 'lucide-react';
import { Task, Project, Priority, TaskStatus, Subtask, RecurrenceType, EnergyLevel } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  task?: Task; // If provided, we are editing
  projects: Project[];
  allTasks: Task[]; // For dependencies
}

const toLocalDateTimeInput = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalDateTimeInput = (value: string) => {
  if (!value) return undefined;
  return new Date(value).toISOString();
};

const ENERGY_OPTIONS: Array<{ value: EnergyLevel; label: string; accent: string }> = [
  { value: 'low', label: 'Low', accent: 'text-emerald-300' },
  { value: 'medium', label: 'Medium', accent: 'text-sky-300' },
  { value: 'high', label: 'High', accent: 'text-rose-300' }
];

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, task, projects, allTasks }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [projectId, setProjectId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [actualDuration, setActualDuration] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [earliestStart, setEarliestStart] = useState('');
  const [latestEnd, setLatestEnd] = useState('');
  const [dependencySearch, setDependencySearch] = useState('');
  
  const blockingTasks = dependencies
    .map(depId => allTasks.find(t => t.id === depId))
    .filter((t): t is Task => !!t && t.status !== TaskStatus.DONE);
  
  const isBlocked = blockingTasks.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    const isEditing = !!task?.id;
    const resolvedProjectId = task?.projectId || projects[0]?.id || '';
    const projectDefaults = projects.find(p => p.id === resolvedProjectId);
    const defaultDuration = projectDefaults?.defaultTaskDuration ?? 30;
    const defaultPriority = projectDefaults?.defaultPriority ?? Priority.MEDIUM;

    if (task && isEditing) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDuration(task.durationMinutes || defaultDuration);
      setPriority(task.priority || defaultPriority);
      setProjectId(resolvedProjectId);
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '');
      setDependencies(task.dependencies || []);
      setActualDuration(task.actualDurationMinutes);
      setStatus(task.status);
      setSubtasks(task.subtasks || []);
      setRecurrence(task.recurrence || null);
      setTags(task.tags || []);
      setEnergy(task.energy || 'medium');
      setEarliestStart(toLocalDateTimeInput(task.earliestStart));
      setLatestEnd(toLocalDateTimeInput(task.latestEnd));
    } else {
      setTitle(task?.title || '');
      setDescription(task?.description || '');
      setDuration(task?.durationMinutes || defaultDuration);
      setPriority((task?.priority as Priority | undefined) || defaultPriority);
      setProjectId(resolvedProjectId);
      setDeadline(task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '');
      setDependencies(task?.dependencies || []);
      setActualDuration(task?.actualDurationMinutes);
      setStatus(task?.status || TaskStatus.TODO);
      setSubtasks(task?.subtasks || []);
      setRecurrence(task?.recurrence || null);
      setTags(task?.tags || []);
      setEnergy(task?.energy || 'medium');
      setEarliestStart(toLocalDateTimeInput(task?.earliestStart));
      setLatestEnd(toLocalDateTimeInput(task?.latestEnd));
    }
    setNewSubtaskTitle('');
    setTagInput('');
    setDependencySearch('');
  }, [isOpen, task, projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Final safety check: round duration to nearest 15
    const safeDuration = Math.max(15, Math.round(duration / 15) * 15);

    const earliestIso = fromLocalDateTimeInput(earliestStart);
    const latestIso = fromLocalDateTimeInput(latestEnd);
    const earliestDate = earliestIso ? new Date(earliestIso) : undefined;
    const latestDate = latestIso ? new Date(latestIso) : undefined;
    const safeLatest = earliestDate && latestDate && earliestDate > latestDate ? undefined : latestIso;

    const updatedTask: Task = {
      id: task?.id || Date.now().toString(),
      title,
      description,
      durationMinutes: safeDuration,
      priority,
      projectId: projectId || undefined,
      status: status,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      dependencies,
      scheduledStart: task?.scheduledStart,
      scheduledEnd: task?.scheduledEnd,
      isFixed: task?.isFixed,
      actualDurationMinutes: actualDuration,
      schedulingReason: task?.schedulingReason,
      subtasks,
      recurrence,
      tags,
      energy,
      earliestStart: earliestIso,
      latestEnd: safeLatest
    };

    onSave(updatedTask);
    onClose();
  };

  const toggleDependency = (depId: string) => {
    setDependencies(prev => 
      prev.includes(depId) 
        ? prev.filter(id => id !== depId) 
        : [...prev, depId]
    );
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if(!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtaskTitle, isCompleted: false }]);
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (id: string) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, isCompleted: !s.isCompleted } : s));
  };

  const deleteSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  };

  const availableDependencies = useMemo(() => {
    return allTasks.filter(t => t.id !== task?.id);
  }, [allTasks, task]);

  const filteredDependencies = useMemo(() => {
    if (!dependencySearch.trim()) return availableDependencies;
    const q = dependencySearch.toLowerCase();
    return availableDependencies.filter(dep =>
      dep.title.toLowerCase().includes(q) || dep.description?.toLowerCase().includes(q)
    );
  }, [availableDependencies, dependencySearch]);

  const handleTagCommit = () => {
    const cleaned = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (!cleaned) return;
    if (!tags.includes(cleaned)) {
      setTags(prev => [...prev, cleaned]);
    }
    setTagInput('');
  };

  const timeWindowInvalid = earliestStart && latestEnd && new Date(earliestStart) > new Date(latestEnd);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col scale-100 animate-in zoom-in-95 duration-200 overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-4">
           <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task name"
              className="w-full bg-transparent text-2xl font-bold text-white placeholder-white/20 border-none focus:ring-0 p-0 leading-tight"
              autoFocus
            />
           <button onClick={onClose} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full ml-4">
             <X className="w-5 h-5" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Status & Meta Bar */}
           <div className="flex gap-2 mb-2">
             <button 
                type="button"
                onClick={() => setStatus(status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${status === TaskStatus.DONE ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-motion-muted hover:bg-white/10'}`}
             >
                {status === TaskStatus.DONE ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-60"></div>}
                {status}
             </button>
             {task?.scheduledStart && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-500/10 border border-brand-500/20 text-brand-400">
                    <Clock className="w-3.5 h-3.5" />
                    Scheduled
                </div>
             )}
           </div>

          {/* Blocked Warning */}
          {isBlocked && (
             <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
               <div className="flex-1">
                 <h4 className="text-sm font-bold text-red-400">Blocked by dependencies</h4>
                 <div className="text-xs text-red-200/70 mt-1">
                   Waiting for: <span className="font-mono ml-1 bg-red-500/20 px-1 rounded text-red-100">{blockingTasks.map(b => b.title).join(', ')}</span>
                 </div>
               </div>
             </div>
          )}

          {/* Controls Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Duration */}
            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <Clock className="w-3 h-3" /> Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                    type="number"
                    min="15"
                    step="15"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 15)}
                    className="w-16 bg-transparent text-sm text-white focus:outline-none font-mono font-medium"
                />
                <span className="text-sm text-motion-muted">min</span>
              </div>
            </div>

            {/* Actual Duration */}
            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <Clock className="w-3 h-3" /> Actual Time
              </label>
              <div className="flex items-center gap-2">
                <input
                    type="number"
                    min="0"
                    step="5"
                    value={actualDuration ?? ''}
                    onChange={(e) => setActualDuration(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                    className="w-16 bg-transparent text-sm text-white focus:outline-none font-mono font-medium"
                    placeholder="--"
                />
                <span className="text-sm text-motion-muted">min</span>
              </div>
              <p className="text-[10px] text-motion-muted mt-2">Manual entry helps calibration.</p>
            </div>

            {/* Project */}
            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <Layers className="w-3 h-3" /> Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-transparent text-sm text-white focus:outline-none appearance-none cursor-pointer font-medium"
              >
                {projects.map(p => (
                    <option key={p.id} value={p.id} className="bg-motion-card text-white">
                        {p.name}
                    </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <Flag className="w-3 h-3" /> Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-transparent text-sm text-white focus:outline-none appearance-none cursor-pointer font-medium"
              >
                {Object.values(Priority).map(p => (
                    <option key={p} value={p} className="bg-motion-card text-white">
                        {p}
                    </option>
                ))}
              </select>
            </div>

             {/* Recurrence */}
            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <Repeat className="w-3 h-3" /> Recurrence
              </label>
              <select
                value={recurrence || ''}
                onChange={(e) => setRecurrence(e.target.value === '' ? null : e.target.value as RecurrenceType)}
                className="w-full bg-transparent text-sm text-white focus:outline-none appearance-none cursor-pointer font-medium"
              >
                 <option value="" className="bg-motion-card">None</option>
                 <option value="daily" className="bg-motion-card">Daily</option>
                 <option value="weekly" className="bg-motion-card">Weekly</option>
                 <option value="monthly" className="bg-motion-card">Monthly</option>
              </select>
            </div>

            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <CalendarIcon className="w-3 h-3" /> Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-transparent text-sm text-white focus:outline-none border border-white/10 rounded-lg px-2 py-1.5"
              />
            </div>
          </div>

          {/* Energy & Time Window */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-3">
                <Zap className="w-3 h-3" /> Energy Level
              </label>
              <div className="flex items-center gap-2">
                {ENERGY_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEnergy(option.value)}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-all ${energy === option.value ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-motion-muted hover:text-white'}`}
                  >
                    <span className={option.accent}>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="group bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 transition-colors">
              <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <CalendarIcon className="w-3 h-3" /> Time Window
              </label>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="text-[10px] text-motion-muted mb-1">Earliest start</div>
                  <input
                    type="datetime-local"
                    value={earliestStart}
                    onChange={(e) => setEarliestStart(e.target.value)}
                    className="w-full bg-transparent text-xs text-white focus:outline-none border border-white/10 rounded-lg px-2 py-1.5"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-motion-muted mb-1">Latest end</div>
                  <input
                    type="datetime-local"
                    value={latestEnd}
                    onChange={(e) => setLatestEnd(e.target.value)}
                    className="w-full bg-transparent text-xs text-white focus:outline-none border border-white/10 rounded-lg px-2 py-1.5"
                  />
                </div>
              </div>
              {timeWindowInvalid && (
                <p className="text-[10px] text-red-300 mt-2">Earliest start must be before latest end.</p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
              Tags
            </label>
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-2">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 bg-white/10 text-xs text-white px-2 py-0.5 rounded-full border border-white/10">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                        className="text-motion-muted hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleTagCommit();
                    }
                  }}
                  placeholder="Add tag and press Enter"
                  className="flex-1 bg-transparent text-xs text-white focus:outline-none border border-white/10 rounded-lg px-2 py-1.5"
                />
                <button
                  type="button"
                  onClick={handleTagCommit}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
              <LinkIcon className="w-3 h-3" /> Dependencies
            </label>
            <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
              <div className="p-2 border-b border-white/5">
                <input
                  type="text"
                  value={dependencySearch}
                  onChange={(e) => setDependencySearch(e.target.value)}
                  placeholder="Search tasks to link..."
                  className="w-full bg-transparent text-xs text-white focus:outline-none border border-white/10 rounded-lg px-2 py-1.5"
                />
              </div>
              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                {filteredDependencies.length === 0 && (
                  <div className="px-3 py-4 text-[11px] text-motion-muted">No tasks match this search.</div>
                )}
                {filteredDependencies.map(dep => (
                  <label
                    key={dep.id}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={dependencies.includes(dep.id)}
                      onChange={() => toggleDependency(dep.id)}
                      className="rounded-sm border-white/20 bg-white/5 text-brand-500 focus:ring-0 w-4 h-4"
                    />
                    <span className="truncate">{dep.title}</span>
                    {dep.status === TaskStatus.DONE && (
                      <span className="ml-auto text-[10px] text-green-300">Done</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
            
          {/* Subtasks Section */}
          <div>
             <label className="flex items-center justify-between text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                <div className="flex items-center gap-2"><ListTodo className="w-3 h-3" /> Checklist</div>
             </label>
             <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                <div className="p-1 space-y-0.5">
                    {subtasks.map(s => (
                        <div key={s.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg group transition-colors">
                             <input 
                                type="checkbox" 
                                checked={s.isCompleted} 
                                onChange={() => toggleSubtask(s.id)}
                                className="rounded-sm border-white/20 bg-white/5 text-brand-500 focus:ring-0 w-4 h-4 checked:bg-brand-500 transition-all cursor-pointer"
                             />
                             <input 
                                value={s.title}
                                onChange={(e) => {
                                    const newSub = [...subtasks];
                                    const idx = newSub.findIndex(x => x.id === s.id);
                                    newSub[idx].title = e.target.value;
                                    setSubtasks(newSub);
                                }}
                                className={`flex-1 bg-transparent text-sm focus:outline-none ${s.isCompleted ? 'text-motion-muted line-through' : 'text-white'}`}
                             />
                             <button type="button" onClick={() => deleteSubtask(s.id)} className="opacity-0 group-hover:opacity-100 text-motion-muted hover:text-red-400 transition-all p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                             </button>
                        </div>
                    ))}
                </div>
                <div className="p-2 border-t border-white/5">
                    <div className="flex gap-2 items-center px-2">
                        <Plus className="w-4 h-4 text-motion-muted" />
                        <input 
                            type="text" 
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            placeholder="Add subtask..."
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(e)}
                            className="flex-1 bg-transparent text-sm text-white placeholder-motion-muted/50 focus:outline-none py-1"
                        />
                    </div>
                </div>
             </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
              Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none transition-colors placeholder-motion-muted/30"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-white/10">
              <button 
                type="button" 
                className="text-red-400 hover:text-red-300 text-xs font-semibold px-2 py-1"
                onClick={() => {
                   // Optional: Add delete handler here if passed prop
                   onClose();
                }}
              >
                  Delete
              </button>
              
              <div className="flex gap-3">
                <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-semibold text-motion-muted hover:text-white transition-colors"
                >
                Cancel
                </button>
                <button
                onClick={handleSubmit}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-brand-900/20 transition-all hover:scale-[1.02]"
                >
                Save Changes
                </button>
              </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default TaskModal;
