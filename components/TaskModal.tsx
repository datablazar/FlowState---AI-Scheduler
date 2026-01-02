import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar as CalendarIcon, Flag, Link as LinkIcon, Layers, AlertTriangle, Sparkles, CheckCircle2, ListTodo, Plus, Trash2, Repeat } from 'lucide-react';
import { Task, Project, Priority, TaskStatus, Subtask, RecurrenceType } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  task?: Task; // If provided, we are editing
  projects: Project[];
  allTasks: Task[]; // For dependencies
}

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
  
  const blockingTasks = dependencies
    .map(depId => allTasks.find(t => t.id === depId))
    .filter((t): t is Task => !!t && t.status !== TaskStatus.DONE);
  
  const isBlocked = blockingTasks.length > 0;

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        setDuration(task.durationMinutes);
        setPriority(task.priority);
        setProjectId(task.projectId || projects[0]?.id || '');
        setDeadline(task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '');
        setDependencies(task.dependencies || []);
        setActualDuration(task.actualDurationMinutes);
        setStatus(task.status);
        setSubtasks(task.subtasks || []);
        setRecurrence(task.recurrence || null);
      } else {
        setTitle('');
        setDescription('');
        setDuration(30);
        setPriority(Priority.MEDIUM);
        setProjectId(projects[0]?.id || '');
        setDeadline('');
        setDependencies([]);
        setActualDuration(undefined);
        setStatus(TaskStatus.TODO);
        setSubtasks([]);
        setRecurrence(null);
      }
      setNewSubtaskTitle('');
    }
  }, [isOpen, task, projects]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Final safety check: round duration to nearest 15
    const safeDuration = Math.max(15, Math.round(duration / 15) * 15);

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
      recurrence
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