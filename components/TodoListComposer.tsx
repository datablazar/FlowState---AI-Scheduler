import React, { useEffect, useMemo, useState } from 'react';
import { ListTodo, Sparkles, Clock, Flag, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import { Priority, TaskStatus, Task } from '../types';
import { estimateTodoList } from '../services/geminiService';

interface TodoListComposerProps {
  defaultDuration: number;
  defaultPriority: Priority;
  onAdd: (tasks: Partial<Task>[]) => void;
  onAddAndSchedule: (tasks: Partial<Task>[]) => void;
  isScheduling?: boolean;
}

type DraftTodo = {
  id: string;
  title: string;
  durationMinutes: number;
  priority: Priority;
  deadline?: string;
  source: 'manual' | 'ai';
};

const normalizeDuration = (value: number) => Math.max(15, Math.round(value / 15) * 15);

const TodoListComposer: React.FC<TodoListComposerProps> = ({
  defaultDuration,
  defaultPriority,
  onAdd,
  onAddAndSchedule,
  isScheduling = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [manualDuration, setManualDuration] = useState(defaultDuration);
  const [manualPriority, setManualPriority] = useState<Priority>(defaultPriority);
  const [manualDeadline, setManualDeadline] = useState<string>('');
  const [draftTodos, setDraftTodos] = useState<DraftTodo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => setManualDuration(defaultDuration), [defaultDuration]);
  useEffect(() => setManualPriority(defaultPriority), [defaultPriority]);

  const lines = useMemo(
    () => rawInput.split('\n').map(l => l.trim()).filter(Boolean),
    [rawInput]
  );

  const hydrateDrafts = (items: { title: string; durationMinutes: number; priority: Priority; deadline?: string; source: 'manual' | 'ai' }[]) => {
    setDraftTodos(
      items.map(item => ({
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      }))
    );
    setIsOpen(true);
  };

  const seedManualList = () => {
    if (lines.length === 0) return;
    hydrateDrafts(
      lines.map(title => ({
        title,
        durationMinutes: normalizeDuration(manualDuration),
        priority: manualPriority,
        deadline: manualDeadline ? new Date(manualDeadline).toISOString() : undefined,
        source: 'manual',
      }))
    );
  };

  const runAiEstimation = async () => {
    if (lines.length === 0) return;
    setIsLoading(true);
    try {
      const estimates = await estimateTodoList(lines, {
        durationMinutes: normalizeDuration(manualDuration),
        priority: manualPriority
      });
      hydrateDrafts(
        estimates.map(e => ({
          ...e,
          durationMinutes: normalizeDuration(e.durationMinutes),
          deadline: e.deadline,
          source: 'ai'
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateDraft = (id: string, field: keyof DraftTodo, value: string | number) => {
    setDraftTodos(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === 'durationMinutes'
                  ? normalizeDuration(Number(value) || 15)
                  : value,
            }
          : item
      )
    );
  };

  const removeDraft = (id: string) => {
    setDraftTodos(prev => prev.filter(item => item.id !== id));
  };

  const commit = (shouldSchedule: boolean) => {
    if (draftTodos.length === 0) return;
    const payload = draftTodos.map(todo => ({
      title: todo.title,
      durationMinutes: todo.durationMinutes,
      priority: todo.priority,
      status: TaskStatus.TODO,
      deadline: todo.deadline,
      isTodoList: true,
    }));

    if (shouldSchedule) {
      onAddAndSchedule(payload);
    } else {
      onAdd(payload);
    }

    setDraftTodos([]);
    setRawInput('');
  };

  return (
    <div className="bg-motion-bg border border-motion-border rounded-xl shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-brand-400" />
          <div>
            <p className="text-xs font-semibold text-white">To-Do List Builder</p>
            <p className="text-[10px] text-motion-muted">
              Prioritize tasks and set durations (AI or manual)
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-motion-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-motion-muted" />
        )}
      </button>

      {isOpen && (
        <div className="p-3 pt-0 space-y-3">
          <div className="space-y-2">
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="One task per line..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-motion-muted/60 focus:outline-none focus:border-brand-500/50 min-h-[80px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-2">
                <label className="text-[10px] text-motion-muted font-semibold flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" /> Default duration
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={manualDuration}
                    onChange={(e) => setManualDuration(normalizeDuration(Number(e.target.value) || 15))}
                    className="w-16 bg-transparent text-xs text-white font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-motion-muted">min</span>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-2">
                <label className="text-[10px] text-motion-muted font-semibold flex items-center gap-1 mb-1">
                  <Flag className="w-3 h-3" /> Default priority
                </label>
                <select
                  value={manualPriority}
                  onChange={(e) => setManualPriority(e.target.value as Priority)}
                  className="w-full bg-transparent text-xs text-white focus:outline-none appearance-none cursor-pointer"
                >
                  {Object.values(Priority).map(level => (
                    <option key={level} value={level} className="bg-motion-card text-white">
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-2">
              <label className="text-[10px] text-motion-muted font-semibold flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3" /> Default deadline (optional)
              </label>
              <input
                type="date"
                value={manualDeadline}
                onChange={(e) => setManualDeadline(e.target.value)}
                className="w-full bg-transparent text-xs text-white focus:outline-none border border-white/10 rounded-md px-2 py-1"
              />
              <p className="text-[10px] text-motion-muted mt-1">Applied to manual defaults; AI may override.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={seedManualList}
                disabled={lines.length === 0}
                className="flex-1 px-3 py-2 text-[11px] font-semibold rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
              >
                Use defaults
              </button>
              <button
                type="button"
                onClick={runAiEstimation}
                disabled={lines.length === 0 || isLoading}
                className="flex-1 px-3 py-2 text-[11px] font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white shadow-brand-900/20 shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> AI durations & priorities
                  </>
                )}
              </button>
            </div>
          </div>

          {draftTodos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-motion-muted">
                <span>Editable list — tweak duration or priority anytime.</span>
                <span className="font-mono">{draftTodos.length} item(s)</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {draftTodos.map(todo => (
                  <div
                    key={todo.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-2 flex items-start gap-2"
                  >
                    <div className="flex-1 space-y-1">
                      <input
                        value={todo.title}
                        onChange={(e) => updateDraft(todo.id, 'title', e.target.value)}
                        className="w-full bg-transparent text-xs text-white font-semibold focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                          <Clock className="w-3 h-3 text-motion-muted" />
                          <input
                            type="number"
                            min={15}
                            step={15}
                            value={todo.durationMinutes}
                            onChange={(e) => updateDraft(todo.id, 'durationMinutes', Number(e.target.value))}
                            className="w-12 bg-transparent text-[11px] text-white font-mono focus:outline-none"
                          />
                          <span className="text-[10px] text-motion-muted">m</span>
                        </div>
                        <input
                          type="date"
                          value={todo.deadline ? todo.deadline.slice(0, 10) : ''}
                          onChange={(e) => updateDraft(todo.id, 'deadline', e.target.value ? new Date(e.target.value).toISOString() : '')}
                          className="bg-white/5 border border-white/10 rounded-md text-[11px] text-white px-2 py-1 focus:outline-none"
                        />
                        <select
                          value={todo.priority}
                          onChange={(e) => updateDraft(todo.id, 'priority', e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-md text-[11px] text-white px-2 py-1 focus:outline-none cursor-pointer"
                        >
                          {Object.values(Priority).map(level => (
                            <option key={level} value={level} className="bg-motion-card text-white">
                              {level}
                            </option>
                          ))}
                        </select>
                        <span className={`text-[10px] font-mono px-2 py-1 rounded-md border ${todo.source === 'ai' ? 'border-brand-500/30 text-brand-300 bg-brand-500/10' : 'border-white/10 text-motion-muted bg-white/5'}`}>
                          {todo.source === 'ai' ? 'AI' : 'Manual'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDraft(todo.id)}
                      className="text-motion-muted hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => commit(false)}
                  disabled={draftTodos.length === 0}
                  className="flex-1 px-3 py-2 text-[11px] font-bold rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                >
                  Add tasks
                </button>
                <button
                  type="button"
                  onClick={() => commit(true)}
                  disabled={draftTodos.length === 0 || isScheduling}
                  className="flex-1 px-3 py-2 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 disabled:opacity-50 transition-all"
                >
                  Add & schedule
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TodoListComposer;
