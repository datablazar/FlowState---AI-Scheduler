
export enum Priority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
}

export type EnergyProfile = 'morning_lark' | 'night_owl' | 'afternoon_power';
export type EnergyLevel = 'low' | 'medium' | 'high';

export interface UserSettings {
  workStartHour: number; // 0-23
  workEndHour: number;   // 0-23
  workDays: number[];    // 0=Sun, 1=Mon, ..., 6=Sat
  
  // New Chunking/Pomodoro Settings
  enableChunking: boolean;
  workChunkMinutes: number;    // e.g. 25 or 50
  shortBreakMinutes: number;   // e.g. 5 or 10
  longBreakMinutes: number;    // e.g. 15 or 30
  longBreakInterval: number;   // e.g. 4 chunks before long break
  
  // New Behavior Settings
  autoRescheduleOverdue: boolean; // If true, move past incomplete tasks to today
  defaultTaskDuration: number; // Default minutes for new tasks
  planningBufferMinutes: number; // Buffer between tasks
}

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface WorkSession {
  id: string;
  start: string; // ISO Date string
  end: string;   // ISO Date string
  durationMinutes: number;
}

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | null;

export interface Task {
  id: string;
  title: string;
  durationMinutes: number;
  priority: Priority;
  deadline?: string; // ISO Date string
  projectId?: string;
  status: TaskStatus;
  description?: string;
  isFixed?: boolean; // If true, it's a hard calendar event
  scheduledStart?: string; // ISO Date string
  scheduledEnd?: string; // ISO Date string
  dependencies?: string[]; // Array of Task IDs that must be completed before this one
  actualDurationMinutes?: number; // For tracking learning velocity
  schedulingReason?: string; // AI explanation for why this time was chosen
  tags?: string[];
  energy?: EnergyLevel;
  earliestStart?: string; // ISO Date string
  latestEnd?: string; // ISO Date string
  
  // New for Split Tasks
  originalTaskId?: string; // If this is a split part of a larger task
  partIndex?: number;      // 1, 2, 3...
  totalParts?: number; 

  // New Subtasks
  subtasks?: Subtask[];
  
  // New Recurrence
  recurrence?: RecurrenceType;

  // New Time Tracking
  sessions?: WorkSession[];
}

export interface Project {
  id: string;
  name: string;
  color: string;
  velocity: number; // 1.0 = standard speed, 0.8 = slower (needs more time), 1.2 = faster
  defaultTaskDuration?: number;
  defaultPriority?: Priority;
  weeklyCapacityHours?: number;
  icon?: string;
}

export type ViewMode = 'dashboard' | 'calendar' | 'kanban' | 'analytics' | 'settings' | 'notes' | 'capture';
export type CalendarView = 'day' | 'week' | 'month';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface UserStats {
  xp: number;
  level: number;
  streakDays: number;
  lastActiveDate: string; // ISO date
  tasksCompletedTotal: number;
}
