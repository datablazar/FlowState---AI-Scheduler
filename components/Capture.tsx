
import React, { useState, useRef } from 'react';
import { 
  FileText, Upload, BrainCircuit, Search, ArrowRight, Loader2, 
  Trash2, Edit2, Plus, CheckCircle2, AlertCircle, File, FileImage 
} from 'lucide-react';
import { Project, Task, Priority, TaskStatus } from '../types';
import { researchTopic, generateTasksFromContent } from '../services/geminiService';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

interface CaptureProps {
  projects: Project[];
  onAddTasks: (tasks: Task[]) => void;
  onOpenProjectModal: () => void;
}

const Capture: React.FC<CaptureProps> = ({ projects, onAddTasks, onOpenProjectModal }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [inputQuery, setInputQuery] = useState('');
  const [useSearch, setUseSearch] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'text' | 'image' | null>(null);
  const [fileContent, setFileContent] = useState<string | {mimeType: string, data: string} | null>(null);
  
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  
  const [generatedTasks, setGeneratedTasks] = useState<Task[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- File Handling ---
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      fullText += text.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileContent(null);
    setFileType(null);

    try {
      if (file.type.startsWith('image/')) {
        const base64 = await convertImageToBase64(file);
        setFileContent({ mimeType: file.type, data: base64 });
        setFileType('image');
      } else if (file.type === 'application/pdf') {
        const text = await extractTextFromPdf(file);
        setFileContent(text);
        setFileType('text');
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setFileContent(result.value);
        setFileType('text');
      } else {
        const text = await file.text();
        setFileContent(text);
        setFileType('text');
      }
    } catch (e) {
      console.error(e);
      alert("Error processing file.");
    }
  };

  // --- AI Processing ---
  const handleGenerate = async () => {
    if (activeTab === 'text' && !inputQuery.trim()) return;
    if (activeTab === 'file' && !fileContent) return;

    setIsLoading(true);
    setGeneratedTasks([]);
    
    try {
      const project = projects.find(p => p.id === projectId);
      let contextContent: string | {mimeType: string, data: string} = "";
      let instruction = "";

      if (activeTab === 'text') {
        if (useSearch) {
          setProcessingStage("Researching topic on Google...");
          const searchResult = await researchTopic(inputQuery);
          contextContent = searchResult;
          instruction = `Based on this research about "${inputQuery}", generate a learning plan.`;
        } else {
          contextContent = inputQuery;
          instruction = "Parse this request into tasks.";
        }
      } else {
        // File
        if (!fileContent) throw new Error("No file content");
        contextContent = fileContent;
        instruction = `Extract tasks from this ${selectedFile?.name}.`;
      }

      setProcessingStage("Thinking & Structuring Tasks...");
      const tasks = await generateTasksFromContent(
        contextContent, 
        instruction, 
        project?.velocity || 1.0
      );

      setGeneratedTasks(tasks.map(t => ({...t, projectId})));

    } catch (e) {
      console.error(e);
      alert("AI Processing Failed. Please try again.");
    } finally {
      setIsLoading(false);
      setProcessingStage("");
    }
  };

  const handleTaskChange = (id: string, field: keyof Task, value: any) => {
    setGeneratedTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleConfirm = () => {
    onAddTasks(generatedTasks);
    // Reset form
    setInputQuery('');
    setSelectedFile(null);
    setFileContent(null);
    setGeneratedTasks([]);
  };

  return (
    <div className="flex h-full bg-motion-bg overflow-hidden">
      
      {/* LEFT: Input Column */}
      <div className="w-1/2 p-8 border-r border-motion-border flex flex-col overflow-y-auto custom-scrollbar">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Capture & Plan</h1>
          <p className="text-motion-muted">
            Turn meeting minutes, course documents, or vague goals into actionable tasks using Gemini AI.
          </p>
        </div>

        {/* Project Selector */}
        <div className="mb-6">
          <label className="block text-[10px] font-bold text-motion-muted uppercase tracking-wider mb-2">Assign to Project</label>
          <div className="flex gap-2">
            <select 
                value={projectId} 
                onChange={(e) => setProjectId(e.target.value)}
                className="flex-1 bg-motion-card border border-motion-border rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none cursor-pointer"
            >
                {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
            <button 
                onClick={onOpenProjectModal}
                className="px-4 bg-motion-card border border-motion-border hover:border-brand-500/50 rounded-xl text-motion-muted hover:text-white transition-colors"
                title="Create New Project"
            >
                <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Input Tabs */}
        <div className="flex gap-2 bg-motion-panel p-1 rounded-xl mb-6 border border-motion-border w-fit">
          <button 
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'text' ? 'bg-brand-600 text-white shadow-lg' : 'text-motion-muted hover:text-white'}`}
          >
            <BrainCircuit className="w-4 h-4" /> Goal / Topic
          </button>
          <button 
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'file' ? 'bg-brand-600 text-white shadow-lg' : 'text-motion-muted hover:text-white'}`}
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        </div>

        {/* Input Content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'text' ? (
            <div className="flex-1 flex flex-col gap-4">
              <textarea 
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder='E.g., "I want to complete the Udacity Intro to Programming Nanodegree" or "Process these meeting notes..."'
                className="w-full h-48 bg-motion-card border border-motion-border rounded-xl p-4 text-white resize-none focus:ring-1 focus:ring-brand-500 outline-none placeholder-motion-muted/50"
              />
              
              <label className="flex items-center gap-3 p-4 bg-motion-card border border-motion-border rounded-xl cursor-pointer group hover:border-brand-500/50 transition-colors">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${useSearch ? 'bg-brand-500 border-brand-500 text-white' : 'border-white/20'}`}>
                  {useSearch && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <input type="checkbox" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} className="hidden" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Search className="w-4 h-4 text-brand-400" />
                    Use Search Grounding
                  </div>
                  <p className="text-xs text-motion-muted">Enable to fetch real-time syllabus, requirements, or web info.</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer ${selectedFile ? 'border-brand-500/50 bg-brand-500/5' : 'border-motion-border hover:border-brand-500/30'}`}
              >
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" />
                {selectedFile ? (
                  <div className="text-center">
                    {fileType === 'image' ? <FileImage className="w-12 h-12 text-brand-400 mx-auto mb-4" /> : <FileText className="w-12 h-12 text-brand-400 mx-auto mb-4" />}
                    <p className="font-bold text-white mb-1">{selectedFile.name}</p>
                    <p className="text-xs text-motion-muted">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <button className="mt-4 text-xs text-brand-400 hover:text-brand-300">Change File</button>
                  </div>
                ) : (
                  <div className="text-center text-motion-muted">
                    <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium mb-1">Click to upload document</p>
                    <p className="text-xs opacity-60">PDF, DOCX, Images (Meeting Minutes, Syllabus)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <button 
            onClick={handleGenerate}
            disabled={isLoading || (activeTab === 'text' ? !inputQuery : !fileContent)}
            className="mt-6 w-full py-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-brand-900/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{processingStage || "Processing..."}</span>
              </>
            ) : (
              <>
                <BrainCircuit className="w-5 h-5" />
                <span>Analyze & Generate Plan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* RIGHT: Output Column */}
      <div className="w-1/2 p-8 flex flex-col bg-motion-panel/30">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Proposed Tasks</h2>
            <p className="text-xs text-motion-muted">{generatedTasks.length} tasks generated</p>
          </div>
          {generatedTasks.length > 0 && (
            <button 
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> Accept All
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
          {generatedTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-motion-muted opacity-30 border-2 border-dashed border-motion-border rounded-xl">
              <File className="w-16 h-16 mb-4" />
              <p className="font-medium">AI generated tasks will appear here</p>
            </div>
          ) : (
            generatedTasks.map((task) => (
              <div key={task.id} className="bg-motion-card border border-motion-border rounded-xl p-4 group hover:border-brand-500/30 transition-all">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 space-y-2">
                    {editingTaskId === task.id ? (
                      <input 
                        value={task.title}
                        onChange={(e) => handleTaskChange(task.id, 'title', e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-500"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white">{task.title}</h3>
                        <button onClick={() => setEditingTaskId(task.id)} className="opacity-0 group-hover:opacity-100 text-motion-muted hover:text-white">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    
                    <textarea 
                      value={task.description}
                      onChange={(e) => handleTaskChange(task.id, 'description', e.target.value)}
                      className="w-full bg-transparent text-xs text-motion-muted focus:text-white resize-none outline-none"
                      rows={2}
                    />
                    
                    {/* Subtasks Preview */}
                    {task.subtasks && task.subtasks.length > 0 && (
                        <div className="space-y-1 pl-2 border-l border-white/10">
                            {task.subtasks.map((sub, idx) => (
                                <div key={idx} className="text-[10px] text-motion-muted flex items-center gap-1">
                                    <div className="w-1 h-1 rounded-full bg-brand-500"></div>
                                    {sub.title}
                                </div>
                            ))}
                        </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md">
                        <input 
                            type="number" 
                            value={task.durationMinutes}
                            onChange={(e) => handleTaskChange(task.id, 'durationMinutes', parseInt(e.target.value))}
                            className="w-8 bg-transparent text-right text-xs font-mono text-white focus:outline-none"
                        />
                        <span className="text-[10px] text-motion-muted">m</span>
                    </div>
                    <select 
                        value={task.priority}
                        onChange={(e) => handleTaskChange(task.id, 'priority', e.target.value)}
                        className="bg-white/5 border-none text-[10px] rounded px-1 py-0.5 text-white cursor-pointer focus:ring-0"
                    >
                        {Object.values(Priority).map(p => <option key={p} value={p} className="bg-motion-card">{p}</option>)}
                    </select>
                    <button 
                        onClick={() => setGeneratedTasks(prev => prev.filter(t => t.id !== task.id))}
                        className="p-1.5 text-motion-muted hover:text-red-400 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Capture;
