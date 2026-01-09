import { Task, WorkSession } from '../types';

type MemoryType = 'task_completion' | 'focus_session' | 'note' | 'summary' | 'behavior';

interface MemoryEntry {
  id: string;
  type: MemoryType;
  text: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

interface MemoryState {
  entries: MemoryEntry[];
  summaries: MemoryEntry[];
  lastSummaryAt?: string;
  lastNoteHash?: string;
  behaviorSnapshot?: string;
}

const MEMORY_STORAGE_KEY = 'flowstate_memory_state';
const SUMMARY_INTERVAL_MS = 1000 * 60 * 60 * 24;
const EMBEDDING_DIMENSIONS = 8;
const MAX_ENTRIES = 500;
const MAX_SUMMARIES = 50;

const loadState = (): MemoryState => {
  if (typeof window === 'undefined') {
    return { entries: [], summaries: [] };
  }

  try {
    const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) {
      return { entries: [], summaries: [] };
    }
    const parsed = JSON.parse(raw) as MemoryState;
    return {
      entries: parsed.entries || [],
      summaries: parsed.summaries || [],
      lastSummaryAt: parsed.lastSummaryAt,
      lastNoteHash: parsed.lastNoteHash,
      behaviorSnapshot: parsed.behaviorSnapshot,
    };
  } catch {
    return { entries: [], summaries: [] };
  }
};

const saveState = (state: MemoryState) => {
  if (typeof window === 'undefined') return;
  state.entries = state.entries.slice(0, MAX_ENTRIES);
  state.summaries = state.summaries.slice(0, MAX_SUMMARIES);
  window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(state));
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const hashToken = (token: string) => {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const createEmbedding = (text: string) => {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vector;

  tokens.forEach(token => {
    const bucket = hashToken(token) % EMBEDDING_DIMENSIONS;
    vector[bucket] += 1;
  });

  const magnitude = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0)) || 1;
  return vector.map(val => val / magnitude);
};

const cosineSimilarity = (a: number[], b: number[]) => {
  if (!a.length || !b.length) return 0;
  const length = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
};

const createEntry = (type: MemoryType, text: string, metadata?: Record<string, unknown>): MemoryEntry => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type,
  text,
  createdAt: new Date().toISOString(),
  metadata,
  embedding: createEmbedding(text),
});

export const recordTaskCompletion = (task: Task, projectName?: string) => {
  const state = loadState();
  const summary = `Completed task "${task.title}" (${task.durationMinutes}m planned${task.actualDurationMinutes ? `, ${Math.round(task.actualDurationMinutes)}m actual` : ''})${projectName ? ` for ${projectName}` : ''}.`;
  const entry = createEntry('task_completion', summary, {
    taskId: task.id,
    projectId: task.projectId,
    completedAt: task.completedAt,
    actualDurationMinutes: task.actualDurationMinutes,
  });
  state.entries.unshift(entry);
  saveState(state);
};

export const recordFocusSession = (task: Task, session: WorkSession) => {
  const state = loadState();
  const summary = `Focus session for "${task.title}" lasted ${Math.round(session.durationMinutes)} minutes.`;
  const entry = createEntry('focus_session', summary, {
    taskId: task.id,
    start: session.start,
    end: session.end,
    durationMinutes: session.durationMinutes,
  });
  state.entries.unshift(entry);
  saveState(state);
};

const simpleHash = (text: string) => hashToken(text).toString(36);

export const recordNoteSnapshot = (noteText: string) => {
  const trimmed = noteText.trim();
  if (!trimmed) return;

  const state = loadState();
  const hash = simpleHash(trimmed);
  if (state.lastNoteHash === hash) return;

  const snippet = trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
  const entry = createEntry('note', `User note: ${snippet}`, { length: trimmed.length });
  state.entries.unshift(entry);
  state.lastNoteHash = hash;
  saveState(state);
};

export const updateBehaviorSnapshot = (tasks: Task[]) => {
  const completed = tasks.filter(task => task.actualDurationMinutes && task.durationMinutes);
  if (completed.length === 0) return;

  const ratios = completed.map(task => (task.actualDurationMinutes || 0) / task.durationMinutes);
  const averageRatio = ratios.reduce((acc, val) => acc + val, 0) / ratios.length;
  const trend = averageRatio > 1.05 ? 'longer than planned' : averageRatio < 0.95 ? 'faster than planned' : 'on target';
  const summary = `Behavior trend: recent sessions run ${trend} (avg ${averageRatio.toFixed(2)}x planned across ${ratios.length} tasks).`;

  const state = loadState();
  state.behaviorSnapshot = summary;
  saveState(state);
};

export const updateDailySummary = (tasks: Task[], notes: string) => {
  const state = loadState();
  const now = Date.now();
  if (state.lastSummaryAt && now - new Date(state.lastSummaryAt).getTime() < SUMMARY_INTERVAL_MS) {
    return;
  }

  const sevenDaysAgo = now - 1000 * 60 * 60 * 24 * 7;
  const recentTasks = tasks.filter(task => task.completedAt && new Date(task.completedAt).getTime() >= sevenDaysAgo);
  const taskLines = recentTasks.slice(0, 5).map(task => `- ${task.title} (${task.durationMinutes}m)`);
  const noteSnippet = notes.trim() ? `Recent notes: ${notes.trim().slice(0, 200)}${notes.trim().length > 200 ? '…' : ''}` : '';

  if (taskLines.length === 0 && !noteSnippet) return;

  const summaryText = [
    'Weekly summary:',
    taskLines.length ? `Completed tasks (${recentTasks.length}):` : '',
    ...taskLines,
    noteSnippet,
  ]
    .filter(Boolean)
    .join('\n');

  const entry = createEntry('summary', summaryText, { taskCount: recentTasks.length });
  state.summaries.unshift(entry);
  state.lastSummaryAt = new Date().toISOString();
  saveState(state);
};

export const getRelevantMemories = (query: string, limit = 5) => {
  const state = loadState();
  const combined = [...state.summaries, ...state.entries];
  const queryEmbedding = createEmbedding(query);

  return combined
    .map(entry => {
      const score = entry.embedding ? cosineSimilarity(entry.embedding, queryEmbedding) : 0;
      const keywordHits = tokenize(query).filter(token => entry.text.toLowerCase().includes(token)).length;
      return { entry, score: score + keywordHits * 0.2 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.entry);
};

export const getMemoryContext = (query: string) => {
  const state = loadState();
  const relevant = getRelevantMemories(query, 5);
  const behavior = state.behaviorSnapshot ? `Behavior signals: ${state.behaviorSnapshot}` : '';
  const lines = relevant.map(entry => `- ${entry.text}`);

  if (lines.length === 0 && !behavior) return '';

  return [
    'Relevant user memory:',
    ...lines,
    behavior,
  ]
    .filter(Boolean)
    .join('\n');
};
