
import React, { useMemo } from 'react';
import { Task, Project, TaskStatus, Priority } from '../types';
import { getProjectColor } from '../utils/helpers';
import { MoreHorizontal, Plus, Circle, Clock, CheckCircle2, GripVertical } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  projects: Project[];
  onTaskMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, projects, onTaskMoveStatus, onEditTask, onAddTask }) => {
  
  const columns = [
    { id: TaskStatus.TODO, title: 'To Do', icon: Circle, color: 'text-motion-muted' },
    { id: TaskStatus.IN_PROGRESS, title: 'In Progress', icon: Clock, color: 'text-brand-400' },
    { id: TaskStatus.DONE, title: 'Done', icon: CheckCircle2, color: 'text-green-400' },
  ];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onTaskMoveStatus(taskId, status);
    }
  };

  return (
    <div className="flex-1 h-full overflow-x-auto overflow-y-hidden p-6">
      <div className="flex gap-6 h-full min-w-[1000px]">
        {columns.map((col) => {
          const colTasks = tasks.filter(t => t.status === col.id);
          const Icon = col.icon;

          return (
            <div 
              key={col.id} 
              className="flex-1 flex flex-col min-w-[300px] bg-motion-panel/50 rounded-2xl border border-motion-border backdrop-blur-sm"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column Header */}
              <div className="p-4 border-b border-motion-border flex items-center justify-between sticky top-0 bg-motion-panel/90 backdrop-blur-md rounded-t-2xl z-10">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${col.color}`} />
                  <h3 className="font-bold text-white text-sm">{col.title}</h3>
                  <span className="bg-white/5 text-motion-muted text-xs px-2 py-0.5 rounded-full font-mono">{colTasks.length}</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => onAddTask(col.id)} className="p-1.5 hover:bg-white/5 rounded text-motion-muted hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-white/5 rounded text-motion-muted hover:text-white transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
              </div>

              {/* Task List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => onEditTask(task)}
                    className="group bg-motion-card hover:bg-white/10 p-4 rounded-xl border border-white/5 hover:border-white/10 shadow-sm cursor-pointer transition-all duration-200 active:cursor-grabbing active:scale-95"
                  >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-[10px] text-motion-muted">
                            <span 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: getProjectColor(projects, task.projectId) }}
                            />
                            <span className="uppercase tracking-wider font-bold truncate max-w-[100px]">
                                {projects.find(p => p.id === task.projectId)?.name || 'No Project'}
                            </span>
                        </div>
                        <GripVertical className="w-4 h-4 text-motion-muted opacity-0 group-hover:opacity-50" />
                    </div>
                    
                    <h4 className={`text-sm font-medium leading-snug mb-3 ${task.status === TaskStatus.DONE ? 'line-through text-motion-muted' : 'text-white'}`}>
                        {task.title}
                    </h4>

                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                            task.priority === Priority.HIGH ? 'text-red-400 bg-red-500/10' :
                            task.priority === Priority.MEDIUM ? 'text-yellow-400 bg-yellow-500/10' :
                            'text-green-400 bg-green-500/10'
                        }`}>
                            {task.priority}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-motion-muted font-mono bg-white/5 px-2 py-1 rounded-md">
                            <Clock className="w-3 h-3" />
                            {task.durationMinutes}m
                        </div>
                    </div>
                  </div>
                ))}
                
                {/* Empty State */}
                {colTasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-motion-muted opacity-30 min-h-[200px]">
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-2">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold">Drop tasks here</span>
                    </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanBoard;
