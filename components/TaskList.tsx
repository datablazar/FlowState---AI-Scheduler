
import React, { useMemo, useState } from 'react';
import { Task, TaskStatus, Priority, Project, EnergyLevel } from '../types';
import { Check, Clock, Lock, Flag, Trash2, Repeat, GripVertical, Copy, Search, X, CalendarClock, Zap } from 'lucide-react';
import { isTaskBlocked, getProjectColor, sortTasksForList } from '../utils/helpers';
import { format } from 'date-fns';

interface TaskListProps {
  tasks: Task[];
  projects: Project[];
  onToggleStatus: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
}

const ENERGY_STYLES: Record<EnergyLevel, { label: string; className: string }> = {
  low: { label: 'Low', className: 'text-emerald-300' },
  medium: { label: 'Medium', className: 'text-sky-300' },
  high: { label: 'High', className: 'text-rose-300' }
};

// Extracted and Memoized Task Item to prevent full list re-render
const TaskItem = React.memo(({ 
    task, 
    blocked, 
    pColor, 
    pName, 
    isScheduled,
    subtaskProgress,
    totalSubtasks,
    onToggleStatus, 
    onDelete, 
    onEdit, 
    onDuplicate 
}: {
    task: Task;
    blocked: boolean;
    pColor: string;
    pName: string;
    isScheduled: boolean;
    subtaskProgress: number;
    totalSubtasks: number;
    onToggleStatus: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (task: Task) => void;
    onDuplicate?: (task: Task) => void;
}) => {
    const energyStyle = task.energy ? ENERGY_STYLES[task.energy] : null;
    const windowLabel = task.earliestStart || task.latestEnd
      ? `${task.earliestStart ? format(new Date(task.earliestStart), 'MMM d, h:mm a') : 'Any'} - ${task.latestEnd ? format(new Date(task.latestEnd), 'MMM d, h:mm a') : 'Any'}`
      : '';

    return (
        <div
          draggable={!blocked && !isScheduled}
          onDragStart={(e) => {
              e.dataTransfer.setData('taskId', task.id);
              e.dataTransfer.effectAllowed = 'move';
              e.currentTarget.classList.add('opacity-50', 'scale-95');
          }}
          onDragEnd={(e) => {
              e.currentTarget.classList.remove('opacity-50', 'scale-95');
          }}
          onClick={() => onEdit(task)}
          className={`group relative bg-motion-card p-3 rounded-xl border border-white/5 transition-all duration-200 cursor-pointer overflow-hidden
            ${isScheduled ? 'border-brand-500/20 shadow-none opacity-80' : 'hover:border-white/10 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5'} 
            ${blocked ? 'opacity-60 bg-motion-bg cursor-not-allowed' : ''}
            ${task.status === TaskStatus.DONE ? 'opacity-40' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            
            {/* Checkbox / Status */}
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  if (!blocked) onToggleStatus(task.id);
              }}
              disabled={blocked}
              className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                  task.status === TaskStatus.DONE 
                  ? 'bg-brand-500 border-brand-500 text-white' 
                  : blocked 
                    ? 'border-white/10 bg-white/5 text-transparent cursor-not-allowed'
                    : 'border-white/20 bg-transparent text-transparent hover:border-brand-500 hover:bg-brand-500/10'
              }`}
            >
              {blocked ? <Lock className="w-2.5 h-2.5 text-motion-muted" /> : <Check className="w-3 h-3" />}
            </button>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <h3 className={`text-sm font-medium leading-snug transition-colors ${task.status === TaskStatus.DONE ? 'line-through text-motion-muted' : 'text-white'}`}>
                  {task.title}
                </h3>
                 
                 {/* Scheduled Time Pill */}
                 {isScheduled && !blocked && task.status !== TaskStatus.DONE && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 border border-brand-500/10">
                       {format(new Date(task.scheduledStart!), 'h:mm a')}
                    </div>
                 )}
              </div>
              
              {/* Progress Bar */}
              {totalSubtasks > 0 && (
                  <div className="mt-2.5 flex items-center gap-2 group-hover:opacity-100 transition-opacity">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${subtaskProgress}%` }} />
                      </div>
                      <span className="text-[9px] text-motion-muted font-mono">{Math.round(subtaskProgress)}%</span>
                  </div>
              )}
              
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {/* Project Tag */}
                <div className="flex items-center gap-1.5 text-[10px] text-motion-muted bg-white/5 px-2 py-1 rounded-md border border-white/5 group-hover:bg-white/10 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pColor }} />
                  <span className="font-medium max-w-[80px] truncate">{pName}</span>
                </div>

                {/* Priority & Duration */}
                <div className="flex items-center gap-3 text-[10px] text-motion-muted px-1">
                    <span className={`flex items-center gap-1 ${task.priority === Priority.HIGH ? 'text-red-400' : ''}`}>
                        <Flag className="w-3 h-3" /> {task.priority}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {task.durationMinutes}m
                    </span>
                    {task.recurrence && (
                        <span className="flex items-center gap-1 text-indigo-400 font-medium">
                            <Repeat className="w-3 h-3" /> {task.recurrence === 'daily' ? 'Daily' : task.recurrence === 'weekly' ? 'Weekly' : 'Monthly'}
                        </span>
                    )}
                    {energyStyle && (
                        <span className={`flex items-center gap-1 font-medium ${energyStyle.className}`}>
                            <Zap className="w-3 h-3" /> {energyStyle.label}
                        </span>
                    )}
                    {task.deadline && (
                        <span className="flex items-center gap-1 text-amber-300 font-medium">
                            <CalendarClock className="w-3 h-3" /> Due {format(new Date(task.deadline), 'MMM d')}
                        </span>
                    )}
                    {windowLabel && (
                        <span className="flex items-center gap-1 text-cyan-300 font-medium" title={windowLabel}>
                            <CalendarClock className="w-3 h-3" /> Window
                        </span>
                    )}
                </div>
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {task.tags.slice(0, 4).map(tag => (
                    <span key={tag} className="text-[10px] text-white/80 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                  {task.tags.length > 4 && (
                    <span className="text-[10px] text-motion-muted">+{task.tags.length - 4}</span>
                  )}
                </div>
              )}
            </div>

            {/* Hover Actions */}
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(task.id);
                    }}
                    className="p-1.5 hover:bg-red-500/20 rounded-md text-motion-muted hover:text-red-400 transition-colors"
                    title="Delete"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                {onDuplicate && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate(task);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-md text-motion-muted hover:text-white transition-colors"
                        title="Duplicate"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                )}
                {!blocked && !isScheduled && (
                    <div className="p-1.5 text-motion-muted cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>
                )}
            </div>
          </div>
        </div>
    );
});

const TaskList: React.FC<TaskListProps> = ({ tasks, projects, onToggleStatus, onDelete, onEdit, onDuplicate }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [energyFilter, setEnergyFilter] = useState<'all' | EnergyLevel>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const projectMap = useMemo(() => {
      return new Map(projects.map(project => [project.id, project]));
  }, [projects]);

  const tagOptions = useMemo(() => {
      const tags = new Set<string>();
      tasks.forEach(task => task.tags?.forEach(tag => tags.add(tag)));
      return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [tasks]);
  
  const filteredTasks = useMemo(() => {
      let filtered = tasks;
      
      // Status Filter
      if (statusFilter === 'todo') {
          filtered = filtered.filter(t => t.status !== TaskStatus.DONE);
      } else if (statusFilter === 'done') {
          filtered = filtered.filter(t => t.status === TaskStatus.DONE);
      }

      if (projectFilter !== 'all') {
          filtered = filtered.filter(t => projectFilter === 'none' ? !t.projectId : t.projectId === projectFilter);
      }

      if (priorityFilter !== 'all') {
          filtered = filtered.filter(t => t.priority === priorityFilter);
      }

      if (energyFilter !== 'all') {
          filtered = filtered.filter(t => t.energy === energyFilter);
      }

      if (tagFilter !== 'all') {
          filtered = filtered.filter(t => t.tags?.includes(tagFilter));
      }

      // Search
      if (search.trim()) {
          const q = search.toLowerCase();
          filtered = filtered.filter(t => 
              t.title.toLowerCase().includes(q) ||
              t.description?.toLowerCase().includes(q) ||
              t.tags?.some(tag => tag.toLowerCase().includes(q))
          );
      }

      return sortTasksForList(filtered, tasks);
  }, [tasks, search, statusFilter, projectFilter, priorityFilter, energyFilter, tagFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Search & Filter Bar */}
      <div className="mb-4 space-y-3 px-1">
          <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-motion-muted" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-motion-muted/50 focus:outline-none focus:border-brand-500/50 transition-colors"
              />
              {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-motion-muted hover:text-white">
                      <X className="w-3 h-3" />
                  </button>
              )}
          </div>
          
          <div className="flex items-center justify-between">
             <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg">
                 {(['all', 'todo', 'done'] as const).map(f => (
                     <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all capitalize ${statusFilter === f ? 'bg-white/10 text-white shadow-sm' : 'text-motion-muted hover:text-white'}`}
                     >
                         {f === 'todo' ? 'Active' : f}
                     </button>
                 ))}
             </div>
             <span className="text-[10px] text-motion-muted font-mono">{filteredTasks.length} tasks</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none"
              >
                <option value="all" className="bg-motion-card">All Projects</option>
                <option value="none" className="bg-motion-card">Unassigned</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id} className="bg-motion-card">
                    {project.name}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none"
              >
                <option value="all" className="bg-motion-card">All Priorities</option>
                {Object.values(Priority).map(level => (
                  <option key={level} value={level} className="bg-motion-card">
                    {level}
                  </option>
                ))}
              </select>

              <select
                value={energyFilter}
                onChange={(e) => setEnergyFilter(e.target.value as 'all' | EnergyLevel)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none"
              >
                <option value="all" className="bg-motion-card">All Energy</option>
                <option value="low" className="bg-motion-card">Low Energy</option>
                <option value="medium" className="bg-motion-card">Medium Energy</option>
                <option value="high" className="bg-motion-card">High Energy</option>
              </select>

              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none"
              >
                <option value="all" className="bg-motion-card">All Tags</option>
                {tagOptions.map(tag => (
                  <option key={tag} value={tag} className="bg-motion-card">
                    #{tag}
                  </option>
                ))}
              </select>
          </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar pb-8">
        {filteredTasks.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center gap-4 opacity-50">
             <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <Search className="w-5 h-5 text-motion-muted" />
             </div>
             <p className="text-xs text-motion-muted font-medium">No tasks found.</p>
          </div>
        )}
        {filteredTasks.map((task) => {
          const blocked = isTaskBlocked(task, tasks) && task.status !== TaskStatus.DONE;
          const pColor = getProjectColor(projects, task.projectId);
          const pName = projectMap.get(task.projectId || '')?.name || 'Inbox';
          const isScheduled = !!task.scheduledStart;
          
          const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
          const totalSubtasks = task.subtasks?.length || 0;
          const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

          return (
             <TaskItem 
                key={task.id}
                task={task}
                blocked={blocked}
                pColor={pColor}
                pName={pName}
                isScheduled={isScheduled}
                subtaskProgress={subtaskProgress}
                totalSubtasks={totalSubtasks}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
             />
          );
        })}
      </div>
    </div>
  );
};

export default TaskList;
