import React, { useState, useRef } from 'react';
import { X, Upload, FileText, BrainCircuit, Loader2, Check, File, FileImage, Sparkles, Link as LinkIcon } from 'lucide-react';
import { Project, Task, Priority } from '../types';
import { generateStudyPlan } from '../services/geminiService';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs.GlobalWorkerOptions) {
    // Use cdnjs for the worker to ensure it's a classic script (not ESM) that can be loaded via importScripts
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

interface CourseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (tasks: Task[]) => void;
  projects: Project[];
  completedTasks: Task[];
}

// Gemini 1.5 Flash/Pro have huge context windows (1M+ tokens).
// 300,000 characters is roughly 75k tokens, well within safe limits, reducing the need for chunking significantly.
const CHUNK_SIZE = 300000;

const CourseImportModal: React.FC<CourseImportModalProps> = ({ 
  isOpen, 
  onClose, 
  onImport, 
  projects,
  completedTasks
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [deadline, setDeadline] = useState('');
  
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'text' | 'image' | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number, message: string} | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<Task[]>([]);
  
  // New state for sequential dependencies
  const [isSequential, setIsSequential] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `\n--- Page ${i} ---\n${pageText}`;
    }
    return fullText;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setTextInput('');
    setBase64Image(null);
    setFileType(null);

    try {
      if (file.type === 'application/pdf') {
        const text = await extractTextFromPdf(file);
        setTextInput(text);
        setFileType('text');
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const text = await extractTextFromDocx(file);
        setTextInput(text);
        setFileType('text');
      } else if (file.type.startsWith('image/')) {
        const base64 = await convertImageToBase64(file);
        setBase64Image(base64);
        setFileType('image');
      } else {
        const text = await file.text();
        setTextInput(text);
        setFileType('text');
      }
    } catch (error) {
      console.error(error);
      alert("Error reading file. Please try another format.");
      setSelectedFile(null);
    }
  };

  const handleAnalyze = async () => {
    if ((!textInput.trim() && !base64Image) || !projectId) return;
    
    setIsLoading(true);
    setGeneratedTasks([]);
    
    try {
      const project = projects.find(p => p.id === projectId);
      let allTasks: Task[] = [];

      // Case 1: Image Analysis (requires base64 data)
      if (fileType === 'image' && base64Image && selectedFile) {
        setProgress({ current: 1, total: 1, message: "Analyzing image content..." });
        const tasks = await generateStudyPlan(
          { mimeType: selectedFile.type, data: base64Image },
          project?.name || 'Unknown',
          deadline || undefined,
          completedTasks,
          project?.velocity
        );
        allTasks = tasks;
      } 
      // Case 2: Text Analysis (PDF/DOCX/TXT extracted text)
      else {
        // We use the extracted textInput directly.
        const content = textInput;
        
        // Only chunk if content is excessively large (> 300k chars)
        const totalChunks = Math.ceil(content.length / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = start + CHUNK_SIZE;
          const chunk = content.substring(start, end);
          
          setProgress({ 
            current: i + 1, 
            total: totalChunks, 
            message: totalChunks > 1 
              ? `Analyzing part ${i + 1} of ${totalChunks}...` 
              : "Analyzing document..." 
          });

          const chunkTasks = await generateStudyPlan(
            chunk,
            project?.name || 'Unknown',
            deadline || undefined,
            completedTasks,
            project?.velocity,
            totalChunks > 1 ? { current: i + 1, total: totalChunks } : undefined
          );

          allTasks = [...allTasks, ...chunkTasks];
        }
      }

      const finalTasks = allTasks.map(t => ({ ...t, projectId }));
      
      setGeneratedTasks(finalTasks);
      setStep(2);
    } catch (error) {
      console.error(error);
      alert("Failed to analyze content. Please ensure your API Key is valid.");
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleConfirm = () => {
    let tasksToImport = [...generatedTasks];

    // Apply sequential dependencies if enabled
    if (isSequential && tasksToImport.length > 1) {
        tasksToImport = tasksToImport.map((task, index) => {
            if (index === 0) return task;
            const prevTask = tasksToImport[index - 1];
            return {
                ...task,
                dependencies: [prevTask.id]
            };
        });
    }

    onImport(tasksToImport);
    setStep(1);
    setTextInput('');
    setSelectedFile(null);
    setBase64Image(null);
    setFileType(null);
    setGeneratedTasks([]);
    setIsSequential(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-motion-card/95 border border-motion-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/10 scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-motion-border bg-motion-panel/50">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg">
                <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Import Course Material</h2>
                <p className="text-xs text-motion-muted font-medium">Generate a study plan from PDF, DOCX, or Images</p>
            </div>
          </div>
          <button onClick={onClose} className="text-motion-muted hover:text-white transition-colors bg-white/5 p-1.5 rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">Project</label>
                  <select 
                    value={projectId} 
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-motion-bg/50 border border-motion-border rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none font-medium appearance-none"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-motion-card text-white">{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">Target Deadline</label>
                  <input 
                    type="date" 
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-motion-bg/50 border border-motion-border rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none dark-date-picker font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">Upload File</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed ${selectedFile ? 'border-brand-500 bg-brand-500/10' : 'border-motion-border hover:border-brand-500/50 hover:bg-motion-bg/50'} rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group`}
                >
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".txt,.md,.json,.pdf,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    
                    {selectedFile ? (
                      <>
                        {fileType === 'image' ? <FileImage className="w-10 h-10 text-brand-400 mb-3" /> : <File className="w-10 h-10 text-brand-400 mb-3" />}
                        <p className="text-sm text-white font-bold">{selectedFile.name}</p>
                        <p className="text-xs text-motion-muted mt-1 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        <p className="text-xs text-brand-400 mt-3 font-medium hover:underline">Click to change</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-motion-muted mb-3 group-hover:text-brand-400 transition-colors" />
                        <p className="text-sm text-white font-bold">Click to upload</p>
                        <p className="text-xs text-motion-muted mt-1">PDF, DOCX, Images, Text</p>
                      </>
                    )}
                </div>
              </div>

              {fileType !== 'image' && (
                <div>
                   <label className="flex justify-between text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">
                     <span>Content Preview / Edit</span>
                     {textInput.length > CHUNK_SIZE && (
                       <span className="text-yellow-500">Large content: will be split into batches</span>
                     )}
                   </label>
                   <textarea 
                    value={textInput}
                    onChange={(e) => {
                      setTextInput(e.target.value);
                      setSelectedFile(null);
                    }}
                    placeholder="Or paste text here..."
                    className="w-full h-32 bg-motion-bg/50 border border-motion-border rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none placeholder-motion-muted/50 font-medium"
                   />
                </div>
              )}

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                <p className="text-xs text-indigo-200/80 leading-relaxed font-medium">
                   <strong className="text-indigo-100">AI Intelligence:</strong> {textInput.length > CHUNK_SIZE 
                  ? "Large content detected. It will be analyzed in parts to ensure accuracy." 
                  : "The content will be analyzed directly to create a study plan optimized for your velocity."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white">Generated Plan</h3>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                checked={isSequential}
                                onChange={(e) => setIsSequential(e.target.checked)}
                                className="rounded border-motion-muted bg-white/5 text-brand-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 checked:bg-brand-500 transition-all"
                            />
                            <span className="text-xs font-medium text-motion-muted group-hover:text-white transition-colors">Sequential Order</span>
                        </label>
                        <span className="text-xs font-medium text-brand-400 bg-brand-500/10 px-2 py-1 rounded-md">{generatedTasks.length} Tasks Created</span>
                    </div>
                </div>
                
                <div className="bg-motion-bg/50 border border-motion-border rounded-xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                    {generatedTasks.map((task, idx) => (
                        <div key={idx} className="p-4 border-b border-motion-border/50 last:border-0 flex items-start gap-3 hover:bg-white/5 transition-colors relative">
                            {isSequential && idx > 0 && (
                                <div className="absolute left-7 -top-4 w-0.5 h-8 bg-motion-border z-0"></div>
                            )}
                            <div className="mt-1 bg-indigo-500/20 text-indigo-400 p-1.5 rounded-lg z-10">
                                <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-semibold text-white truncate pr-2">{task.title}</h4>
                                    <span className="text-[10px] font-mono text-motion-muted bg-white/5 px-1.5 py-0.5 rounded whitespace-nowrap">{task.durationMinutes}m</span>
                                </div>
                                <p className="text-xs text-motion-muted line-clamp-2 mt-1 leading-relaxed opacity-80">{task.description?.split('\n')[0]}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        task.priority === Priority.HIGH ? 'text-red-400 bg-red-500/10' :
                                        task.priority === Priority.MEDIUM ? 'text-yellow-400 bg-yellow-500/10' :
                                        'text-green-400 bg-green-500/10'
                                    }`}>
                                        {task.priority}
                                    </span>
                                    {isSequential && idx > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] text-motion-muted bg-white/5 px-1.5 py-0.5 rounded">
                                            <LinkIcon className="w-2.5 h-2.5" />
                                            <span>After: {generatedTasks[idx-1].title.substring(0, 15)}...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-motion-border bg-motion-panel/50 flex justify-between items-center">
            {step === 2 && (
                <button 
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-motion-muted hover:text-white px-2 transition-colors"
                >
                    Back
                </button>
            )}
            
            {isLoading && progress && (
               <div className="flex-1 mx-6">
                  <div className="flex justify-between text-[10px] font-bold text-indigo-300 mb-1.5 uppercase tracking-wide">
                      <span>{progress.message}</span>
                      <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-motion-bg rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out" 
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                  </div>
               </div>
            )}

            <div className="flex gap-3 ml-auto">
                <button
                    onClick={onClose}
                    className="px-5 py-2.5 text-xs font-semibold text-motion-muted hover:text-white transition-colors"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                {step === 1 ? (
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || (!textInput.trim() && !base64Image)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-indigo-900/20 hover:scale-[1.02]"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                        {isLoading ? 'Processing...' : 'Analyze & Plan'}
                    </button>
                ) : (
                    <button
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-brand-900/20 hover:scale-[1.02]"
                    >
                        <Check className="w-4 h-4" />
                        Import Plan
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default CourseImportModal;