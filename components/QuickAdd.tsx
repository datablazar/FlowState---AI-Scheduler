import React, { useState } from 'react';
import { Sparkles, Plus, Loader2, ArrowRight, BrainCircuit, CornerDownLeft } from 'lucide-react';
import { parseTaskInput, parseBulkTasks } from '../services/geminiService';
import { Task } from '../types';

interface QuickAddProps {
  onAddTask: (task: Partial<Task> | Partial<Task>[]) => void;
}

const QuickAdd: React.FC<QuickAddProps> = ({ onAddTask }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    
    if (isBulkMode || input.includes('\n')) {
        const newTasks = await parseBulkTasks(input);
        onAddTask(newTasks);
    } else {
        const newTask = await parseTaskInput(input);
        onAddTask(newTask);
    }
    
    setInput('');
    setLoading(false);
    setIsBulkMode(false);
  };

  return (
    <div className={`relative transition-all duration-300 ${isFocused || isBulkMode ? 'scale-[1.01]' : ''}`}>
      <div className={`relative flex flex-col bg-motion-bg border rounded-xl overflow-hidden transition-all ${isFocused ? 'border-brand-500/50 shadow-glow' : 'border-white/10 shadow-sm'}`}>
        
        {/* Header / Toolbar (visible in bulk mode or when focused) */}
        {(isFocused || isBulkMode) && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/5">
                <span className="text-[10px] font-bold text-motion-muted uppercase tracking-wider">
                    {isBulkMode ? "Brain Dump Mode" : "Quick Add"}
                </span>
                <button 
                    type="button"
                    onClick={() => setIsBulkMode(!isBulkMode)}
                    className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${isBulkMode ? 'bg-brand-500/20 text-brand-400' : 'text-motion-muted hover:text-white'}`}
                >
                    <BrainCircuit className="w-3 h-3" />
                    {isBulkMode ? 'Switch to Single' : 'Bulk Mode'}
                </button>
            </div>
        )}

        <div className="flex items-start">
            <div className="pl-3 pt-3.5 flex-shrink-0 text-motion-muted">
                {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                ) : (
                <Plus className={`h-4 w-4 transition-colors ${isFocused ? 'text-brand-500' : ''}`} />
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-w-0">
                {isBulkMode ? (
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Dump your thoughts here...&#10;- Buy groceries&#10;- Call mom at 5pm&#10;- Write report"
                        className="w-full bg-transparent border-none py-3 px-3 text-sm text-white placeholder-motion-muted/70 focus:ring-0 focus:outline-none resize-none min-h-[100px]"
                        disabled={loading}
                        autoFocus
                    />
                ) : (
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Add task... use natural language"
                        className="w-full bg-transparent border-none py-3 px-3 text-sm text-white placeholder-motion-muted/70 focus:ring-0 focus:outline-none"
                        disabled={loading}
                    />
                )}
                
                {/* Footer Actions */}
                <div className={`flex items-center justify-between px-2 pb-2 ${!input.trim() && !isBulkMode ? 'hidden' : ''}`}>
                    <div className="text-[10px] text-motion-muted pl-1">
                        {isBulkMode ? 'AI will parse list' : 'AI enabled'}
                    </div>
                    <button
                        type="submit"
                        className="p-1.5 bg-brand-500 hover:bg-brand-400 text-white rounded-lg transition-all flex items-center gap-1 pr-2 shadow-lg shadow-brand-900/20"
                        disabled={loading}
                    >
                        <CornerDownLeft className="w-3.5 h-3.5 ml-1" />
                        <span className="text-[10px] font-bold">Add</span>
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default QuickAdd;