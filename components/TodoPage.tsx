import React from 'react';
import { Play, RefreshCw, ListTodo } from 'lucide-react';
import { Task, Project, Priority } from '../types';
import QuickAdd from './QuickAdd';
import TodoListComposer from './TodoListComposer';
import TaskList from './TaskList';

interface TodoPageProps {
  tasks: Task[];
  projects: Project[];
  isScheduling: boolean;
  onAddTask: (task: Partial<Task> | Partial<Task>[]) => void;
  onAddAndSchedule: (task: Partial<Task>[]) => void;
  onToggleStatus: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onAutoSchedule: () => void;
}

const TodoPage: React.FC<TodoPageProps> = ({
  tasks,
  projects,
  isScheduling,
  onAddTask,
  onAddAndSchedule,
  onToggleStatus,
  onDelete,
  onEdit,
  onDuplicate,
  onAutoSchedule
}) => {
  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-motion-bg/40">
      <div className="flex items-center justify-between px-8 py-6 border-b border-motion-border/70 bg-motion-panel/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-600/80 flex items-center justify-center shadow-glow ring-1 ring-brand-500/30">
            <ListTodo className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">To-Do List</h1>
            <p className="text-xs text-motion-muted">Capture, prioritize, and schedule tasks independently of projects.</p>
          </div>
        </div>
        <button
          onClick={onAutoSchedule}
          disabled={isScheduling}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/20 transition-all ${isScheduling ? 'opacity-70 cursor-wait' : ''}`}
        >
          {isScheduling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isScheduling ? 'Optimizing...' : 'Auto-Schedule'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-8 overflow-y-auto custom-scrollbar">
        <div className="space-y-4 lg:col-span-1">
          <QuickAdd onAddTask={onAddTask} />
          <TodoListComposer
            defaultDuration={projects[0]?.defaultTaskDuration ?? 30}
            defaultPriority={projects[0]?.defaultPriority ?? Priority.MEDIUM}
            onAdd={onAddTask}
            onAddAndSchedule={onAddAndSchedule}
            isScheduling={isScheduling}
          />
        </div>

        <div className="lg:col-span-2 min-h-[60vh]">
          <TaskList
            tasks={tasks}
            projects={projects}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
          />
        </div>
      </div>
    </div>
  );
};

export default TodoPage;
