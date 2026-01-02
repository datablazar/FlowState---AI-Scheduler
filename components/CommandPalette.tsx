import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, Plus, BarChart2, Settings, FileText, CheckCircle2, Home, X } from 'lucide-react';
import { Task, ViewMode } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewMode) => void;
  onAddTask: () => void;
  tasks: Task[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate, onAddTask, tasks }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    { id: 'home', icon: <Home className="w-4 h-4" />, label: 'Go to Dashboard', action: () => onNavigate('dashboard') },
    { id: 'cal', icon: <Calendar className="w-4 h-4" />, label: 'Go to Calendar', action: () => onNavigate('calendar') },
    { id: 'add', icon: <Plus className="w-4 h-4" />, label: 'Create New Task', action: onAddTask },
    { id: 'stats', icon: <BarChart2 className="w-4 h-4" />, label: 'View Analytics', action: () => onNavigate('analytics') },
    { id: 'notes', icon: <FileText className="w-4 h-4" />, label: 'Open Notepad', action: () => onNavigate('notes') },
    { id: 'settings', icon: <Settings className="w-4 h-4" />, label: 'Settings', action: () => onNavigate('settings') },
  ];

  const filteredActions = actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));
  
  // Also search tasks
  const filteredTasks = query.length > 1 
    ? tasks.filter(t => t.title.toLowerCase().includes(query.toLowerCase())).slice(0, 3) 
    : [];

  const totalItems = filteredActions.length + filteredTasks.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filteredActions.length) {
          filteredActions[selectedIndex].action();
      } else {
          // Task selection logic could go here (e.g. open edit modal)
          console.log("Task selected", filteredTasks[selectedIndex - filteredActions.length]);
      }
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-[#121215] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search className="w-5 h-5 text-motion-muted" />
          <input 
            ref={inputRef}
            type="text" 
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white placeholder-motion-muted/50 focus:outline-none text-base"
          />
          <div className="flex items-center gap-2">
             <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-motion-muted opacity-100">
                ESC
             </kbd>
             <button onClick={onClose}><X className="w-4 h-4 text-motion-muted hover:text-white" /></button>
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredActions.length === 0 && filteredTasks.length === 0 && (
             <div className="py-8 text-center text-motion-muted text-sm">No results found.</div>
          )}

          {filteredActions.length > 0 && (
              <div className="text-[10px] font-bold text-motion-muted uppercase tracking-wider px-2 py-1.5">Commands</div>
          )}
          
          {filteredActions.map((action, index) => (
            <button
              key={action.id}
              onClick={() => { action.action(); onClose(); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${index === selectedIndex ? 'bg-brand-500/20 text-brand-200' : 'text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <span className={index === selectedIndex ? 'text-brand-400' : 'text-motion-muted'}>{action.icon}</span>
                <span>{action.label}</span>
              </div>
              {index === selectedIndex && <span className="text-[10px] text-brand-400 font-mono">Hit Enter</span>}
            </button>
          ))}

          {filteredTasks.length > 0 && (
              <>
                <div className="border-t border-white/5 my-2"></div>
                <div className="text-[10px] font-bold text-motion-muted uppercase tracking-wider px-2 py-1.5">Tasks</div>
                {filteredTasks.map((task, idx) => {
                    const realIndex = idx + filteredActions.length;
                    return (
                        <div
                        key={task.id}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${realIndex === selectedIndex ? 'bg-brand-500/20 text-brand-200' : 'text-white hover:bg-white/5'}`}
                        >
                        <CheckCircle2 className="w-4 h-4 text-motion-muted" />
                        <span className="truncate">{task.title}</span>
                        </div>
                    );
                })}
              </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;