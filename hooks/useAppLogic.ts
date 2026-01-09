
import { useState, useCallback, useEffect, useRef } from 'react';
import { Task, Project, ViewMode, TaskStatus, CalendarView, EnergyProfile, UserSettings, Priority, ToastMessage, UserStats } from '../types';
import { INITIAL_TASKS, INITIAL_PROJECTS } from '../constants';
import { suggestSchedule } from '../utils/scheduler';
import { useDriftDetection } from './useDriftDetection';
import { cascadeTaskMove, resolveOverlaps } from '../utils/helpers';
import { addWeeks, subWeeks, addMonths, subMonths, addMinutes, addDays, startOfDay, isBefore, isSameDay } from 'date-fns';
import { recordFocusSession, recordNoteSnapshot, recordTaskCompletion, updateBehaviorSnapshot, updateDailySummary } from '../services/memoryService';

export const useAppLogic = () => {
  // --- Initialization with Local Storage ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
        const saved = localStorage.getItem('flowstate_tasks');
        return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
        return INITIAL_TASKS;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
      try {
          const saved = localStorage.getItem('flowstate_projects');
          return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
      } catch {
          return INITIAL_PROJECTS;
      }
  });

  const [userStats, setUserStats] = useState<UserStats>(() => {
      try {
          const saved = localStorage.getItem('flowstate_stats');
          return saved ? JSON.parse(saved) : { xp: 0, level: 1, streakDays: 0, lastActiveDate: new Date().toISOString(), tasksCompletedTotal: 0 };
      } catch {
          return { xp: 0, level: 1, streakDays: 0, lastActiveDate: new Date().toISOString(), tasksCompletedTotal: 0 };
      }
  });

  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
      try {
          const saved = localStorage.getItem('flowstate_settings');
          const parsed = saved ? JSON.parse(saved) : {};
          return {
            workStartHour: 11,
            workEndHour: 18,
            workDays: [0, 1, 2, 3, 4, 5, 6],
            enableChunking: true,
            workChunkMinutes: 30,
            shortBreakMinutes: 15,
            longBreakMinutes: 30,
            longBreakInterval: 2,
            autoRescheduleOverdue: false,
            defaultTaskDuration: 30,
            planningBufferMinutes: 0,
            ...parsed // Merge to ensure new fields exist
          };
      } catch {
          return {
            workStartHour: 11,
            workEndHour: 18,
            workDays: [0, 1, 2, 3, 4, 5, 6],
            enableChunking: true,
            workChunkMinutes: 30,
            shortBreakMinutes: 15,
            longBreakMinutes: 30,
            longBreakInterval: 2,
            autoRescheduleOverdue: false,
            defaultTaskDuration: 30,
            planningBufferMinutes: 0
          };
      }
  });

  const [sidebarNotes, setSidebarNotes] = useState<string>(() => {
      try {
          return localStorage.getItem('flowstate_notes') || '';
      } catch {
          return '';
      }
  });
  
  // --- Effects for Persistence with Debounce ---
  // Simple debounce refs
  const tasksTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const projectsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const settingsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const summaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const behaviorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (tasksTimeoutRef.current) clearTimeout(tasksTimeoutRef.current);
    tasksTimeoutRef.current = setTimeout(() => {
        localStorage.setItem('flowstate_tasks', JSON.stringify(tasks));
    }, 1000);
  }, [tasks]);

  useEffect(() => {
    if (projectsTimeoutRef.current) clearTimeout(projectsTimeoutRef.current);
    projectsTimeoutRef.current = setTimeout(() => {
        localStorage.setItem('flowstate_projects', JSON.stringify(projects));
    }, 1000);
  }, [projects]);

  useEffect(() => {
      if (settingsTimeoutRef.current) clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = setTimeout(() => {
          localStorage.setItem('flowstate_settings', JSON.stringify(userSettings));
      }, 1000);
  }, [userSettings]);

  useEffect(() => {
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
      notesTimeoutRef.current = setTimeout(() => {
          localStorage.setItem('flowstate_notes', sidebarNotes);
          recordNoteSnapshot(sidebarNotes);
      }, 1000);
  }, [sidebarNotes]);

  useEffect(() => {
      if (statsTimeoutRef.current) clearTimeout(statsTimeoutRef.current);
      statsTimeoutRef.current = setTimeout(() => {
          localStorage.setItem('flowstate_stats', JSON.stringify(userStats));
      }, 1000);
  }, [userStats]);

  useEffect(() => {
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
      summaryTimeoutRef.current = setTimeout(() => {
          updateDailySummary(tasks, sidebarNotes);
      }, 1500);
  }, [tasks, sidebarNotes]);

  useEffect(() => {
      if (behaviorTimeoutRef.current) clearTimeout(behaviorTimeoutRef.current);
      behaviorTimeoutRef.current = setTimeout(() => {
          updateBehaviorSnapshot(tasks);
      }, 1500);
  }, [tasks]);


  // Modals & View State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCourseImportOpen, setIsCourseImportOpen] = useState(false);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [activeFocusTask, setActiveFocusTask] = useState<Task | null>(null);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isMorningBriefingOpen, setIsMorningBriefingOpen] = useState(false);

  // Settings & State
  const [mainView, setMainView] = useState<ViewMode>('dashboard');
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isScheduling, setIsScheduling] = useState(false);
  const [unscheduledTasks, setUnscheduledTasks] = useState<{ task: Task; reason: string }[]>([]);
  
  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Reactive Scheduling
  const { driftMinutes, resetDrift } = useDriftDetection(tasks, 15);

  // --- Helper Methods ---
  
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const overwriteTasks = useCallback((updater: (prev: Task[]) => Task[]) => {
      setTasks(prev => updater(prev));
  }, []);

  const awardXP = (amount: number) => {
      setUserStats(prev => {
          const newXP = prev.xp + amount;
          const newLevel = Math.floor(newXP / 1000) + 1;
          const isLevelUp = newLevel > prev.level;
          
          if (isLevelUp) {
              addToast('success', `Level Up! You are now Level ${newLevel}`);
          }

          // Streak Logic
          const today = new Date();
          const lastActive = new Date(prev.lastActiveDate);
          let newStreak = prev.streakDays;
          
          if (!isSameDay(today, lastActive)) {
              if (differenceInDays(today, lastActive) === 1) {
                  newStreak += 1;
              } else {
                  newStreak = 1; // Reset if missed a day
              }
          }

          return {
              ...prev,
              xp: newXP,
              level: newLevel,
              streakDays: newStreak,
              lastActiveDate: today.toISOString(),
              tasksCompletedTotal: prev.tasksCompletedTotal + (amount === 50 ? 1 : 0) // Assuming 50xp is completion
          };
      });
  };

  const differenceInDays = (d1: Date, d2: Date) => {
      return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));
  };

  const recalculateProjectVelocity = useCallback((projectId: string, currentTasks: Task[]) => {
      const projectTasks = currentTasks.filter(
          t => t.projectId === projectId && t.status === TaskStatus.DONE && t.actualDurationMinutes && t.actualDurationMinutes > 0
      );
      if (projectTasks.length < 3) return; // Need minimum data points

      const calibrationTasks = projectTasks.slice(-10);
      const totalPlanned = calibrationTasks.reduce((acc, t) => acc + t.durationMinutes, 0);
      const totalActual = calibrationTasks.reduce((acc, t) => acc + (t.actualDurationMinutes || 0), 0);
      
      const newVelocity = totalPlanned / Math.max(totalActual, 1);
      
      // Clamp velocity reasonable bounds (0.5x to 2.0x)
      const clampedVelocity = Math.max(0.5, Math.min(2.0, newVelocity));

      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          const smoothedVelocity = p.velocity * 0.7 + clampedVelocity * 0.3;
          if (Math.abs(p.velocity - smoothedVelocity) > 0.05) {
              return { ...p, velocity: parseFloat(smoothedVelocity.toFixed(2)) };
          }
          return p;
      }));
  }, []);

  // --- Handlers ---

  const handleAddTask = useCallback((taskInput: Partial<Task> | Partial<Task>[]) => {
    const inputs = Array.isArray(taskInput) ? taskInput : [taskInput];
    
    const newTasks: Task[] = inputs.map(partialTask => {
        const resolvedProjectId = partialTask.projectId || projects[0].id;
        const projectDefaults = projects.find(p => p.id === resolvedProjectId);

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            title: partialTask.title || 'New Task',
            durationMinutes: partialTask.durationMinutes
                ?? projectDefaults?.defaultTaskDuration
                ?? userSettings.defaultTaskDuration,
            priority: (partialTask.priority as Priority | undefined)
                ?? projectDefaults?.defaultPriority
                ?? Priority.MEDIUM,
            status: TaskStatus.TODO,
            projectId: resolvedProjectId,
            subtasks: [],
            ...partialTask,
        };
    });
    
    setTasks(prev => [...newTasks, ...prev]);
    addToast('success', `Added ${newTasks.length} task(s)`);
  }, [projects, userSettings.defaultTaskDuration]);

  const handleImportTasks = useCallback((newTasks: Task[]) => {
    setTasks(prev => [...newTasks, ...prev]);
    addToast('success', `Imported ${newTasks.length} tasks from plan`);
  }, []);

  const handleSaveTask = useCallback((task: Task) => {
      setTasks(prev => {
          const exists = prev.find(t => t.id === task.id);
          let newTasks = prev;
          if (exists) {
              newTasks = prev.map(t => t.id === task.id ? task : t);
          } else {
              newTasks = [task, ...prev];
          }
          
          // Recalculate velocity if task has project and actualDuration
          if (task.projectId && task.actualDurationMinutes) {
              // Defer velocity update slightly to avoid render loop if called synchronously during render (though it shouldn't be)
              setTimeout(() => recalculateProjectVelocity(task.projectId!, newTasks), 0);
          }

          if (task.sessions?.length) {
              const existingIds = new Set((exists?.sessions || []).map(session => session.id));
              task.sessions
                .filter(session => !existingIds.has(session.id))
                .forEach(session => recordFocusSession(task, session));
          }
          
          return newTasks;
      });
      // Don't toast for every auto-save from focus mode
      // addToast('success', 'Task saved'); 
  }, [recalculateProjectVelocity]);

  const handleDeleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    addToast('info', 'Task deleted');
  }, []);

  const handleDuplicateTask = useCallback((task: Task) => {
      const newTask: Task = {
          ...task,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          title: `${task.title} (Copy)`,
          status: TaskStatus.TODO,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          isFixed: false,
          sessions: [], // Reset sessions
          actualDurationMinutes: 0,
          completedAt: undefined,
          subtasks: task.subtasks?.map(s => ({...s, isCompleted: false})) || []
      };
      setTasks(prev => [newTask, ...prev]);
      addToast('success', 'Task duplicated');
  }, []);

  const handleToggleStatus = useCallback((id: string) => {
    setTasks(prev => {
        const task = prev.find(t => t.id === id);
        if (!task) return prev;

        const newStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
        const completedAt = newStatus === TaskStatus.DONE ? new Date().toISOString() : undefined;
        
        if (newStatus === TaskStatus.DONE) {
            awardXP(50); // Award XP for completion
            addToast('success', 'Task completed! +50 XP');
        }

        let newTasks = prev.map(t => t.id === id ? { ...t, status: newStatus, completedAt } : t);

        // Recurrence Logic: Only trigger when marking AS DONE
        if (newStatus === TaskStatus.DONE && task.recurrence) {
            let nextStart: Date | undefined;
            if (task.scheduledStart) {
                const currentStart = new Date(task.scheduledStart);
                if (task.recurrence === 'daily') nextStart = addDays(currentStart, 1);
                else if (task.recurrence === 'weekly') nextStart = addWeeks(currentStart, 1);
                else if (task.recurrence === 'monthly') nextStart = addMonths(currentStart, 1);
            } else {
                 const tomorrow = addDays(new Date(), 1);
            }

            const nextTask: Task = {
                ...task,
                id: Date.now().toString() + '_rec',
                status: TaskStatus.TODO,
                scheduledStart: nextStart?.toISOString(),
                scheduledEnd: nextStart ? addMinutes(nextStart, task.durationMinutes).toISOString() : undefined,
                dependencies: [], 
                isFixed: !!task.scheduledStart,
                sessions: [],
                actualDurationMinutes: 0,
                subtasks: task.subtasks?.map(s => ({...s, isCompleted: false})) || [],
                completedAt: undefined,
            };
            newTasks = [...newTasks, nextTask];
        }
        
        if (task.projectId && newStatus === TaskStatus.DONE) {
             setTimeout(() => recalculateProjectVelocity(task.projectId!, newTasks), 0);
        }

        if (newStatus === TaskStatus.DONE) {
            const projectName = projects.find(project => project.id === task.projectId)?.name;
            recordTaskCompletion({ ...task, completedAt }, projectName);
        }

        return newTasks;
    });
  }, [projects, recalculateProjectVelocity]);

  const handleAddProject = useCallback((project: Project) => {
      setProjects(prev => [...prev, project]);
      addToast('success', 'Project created');
  }, []);

  const handleUpdateProject = useCallback((project: Project) => {
      setProjects(prev => prev.map(p => (p.id === project.id ? { ...p, ...project } : p)));
      addToast('success', 'Project updated');
  }, []);

  const handleOpenEditProject = useCallback((project: Project) => {
      setEditingProject(project);
      setIsProjectModalOpen(true);
  }, []);

  const handleOpenNewProject = useCallback(() => {
      setEditingProject(null);
      setIsProjectModalOpen(true);
  }, []);

  const handleApplySuggestedVelocity = useCallback((projectId: string, velocity: number) => {
      setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, velocity: parseFloat(velocity.toFixed(2)) } : p)));
      addToast('success', 'Velocity updated');
  }, []);

  const handleOpenEditTask = useCallback((task: Task) => {
      setEditingTask(task);
      setIsTaskModalOpen(true);
  }, []);

  const handleOpenNewTask = useCallback((status: TaskStatus = TaskStatus.TODO) => {
      setEditingTask({ status } as any); // Hack to pass status pref
      setIsTaskModalOpen(true);
  }, []);

  const handleTaskMove = useCallback((taskId: string, newStart: Date) => {
    setTasks(prevTasks => cascadeTaskMove(prevTasks, taskId, newStart));
  }, []);

  const handleTaskResize = useCallback((taskId: string, newDuration: number) => {
      setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          
          let newScheduledEnd = t.scheduledEnd;
          if (t.scheduledStart) {
              const start = new Date(t.scheduledStart);
              newScheduledEnd = addMinutes(start, newDuration).toISOString();
          }

          return {
              ...t,
              durationMinutes: newDuration,
              scheduledEnd: newScheduledEnd,
              isFixed: true,
              schedulingReason: 'Manually resized'
          };
      }));
  }, []);

  const handleResolveConflicts = useCallback(() => {
      setTasks(prev => resolveOverlaps(prev));
      addToast('success', 'Conflicts resolved');
  }, []);

  const handleAutoSchedule = async () => {
    setIsScheduling(true);
    addToast('info', 'AI is optimizing your schedule...');
    setUnscheduledTasks([]);
    
    let processedTasks = [...tasks];
    if (userSettings.autoRescheduleOverdue) {
        const now = new Date();
        const startOfToday = startOfDay(now);
        processedTasks = processedTasks.map(t => {
            if (t.status !== TaskStatus.DONE && t.scheduledStart && isBefore(new Date(t.scheduledStart), startOfToday)) {
                return { 
                    ...t, 
                    scheduledStart: undefined, 
                    scheduledEnd: undefined, 
                    isFixed: false, 
                    schedulingReason: 'Auto-rescheduled overdue' 
                };
            }
            return t;
        });
    }

    const fixed = processedTasks.filter(t => (t.isFixed && t.projectId !== 'system-break') || t.status === TaskStatus.DONE);
    const floaters = processedTasks.filter(t => !t.isFixed && t.status !== TaskStatus.DONE && t.projectId !== 'system-break');
    
    // Merge logic for split tasks
    const uniqueTasksMap = new Map<string, Task>();
    floaters.forEach(t => {
        const rootId = t.originalTaskId || t.id;
        const currentDuration = t.durationMinutes;

        if (uniqueTasksMap.has(rootId)) {
             const existing = uniqueTasksMap.get(rootId)!;
             existing.durationMinutes += currentDuration; 
        } else {
             uniqueTasksMap.set(rootId, { 
                 ...t, 
                 id: rootId, 
                 title: t.title.replace(/ \(\d+\)$/, ''),
                 durationMinutes: currentDuration,
                 originalTaskId: undefined, 
                 partIndex: undefined,
                 totalParts: undefined,
                 scheduledStart: undefined, 
                 scheduledEnd: undefined, 
                 schedulingReason: undefined
             });
        }
    });
    
    const tasksToSchedule = Array.from(uniqueTasksMap.values());

    try {
        const result = await suggestSchedule(
            tasksToSchedule, 
            fixed, 
            new Date(), 
            'morning_lark', 
            userSettings
        );
        
        const doneTasks = processedTasks.filter(t => t.status === TaskStatus.DONE);
        const unscheduledClean = result.unscheduled.map(({ task, reason }) => ({
            ...task,
            scheduledStart: undefined,
            scheduledEnd: undefined,
            isFixed: false,
            schedulingReason: reason
        }));

        setTasks([...fixed, ...doneTasks, ...result.scheduled, ...unscheduledClean]);
        setUnscheduledTasks(result.unscheduled);
        if (result.unscheduled.length > 0) {
            addToast('info', `${result.unscheduled.length} task(s) left unscheduled. Review options below.`);
        }
        if (result.warnings.length > 0) {
            result.warnings.forEach(w => addToast('error', w));
        }
        resetDrift();
        addToast('success', 'Schedule optimized successfully');

    } catch (e) {
        console.error("Scheduling failed", e);
        addToast('error', 'Scheduling failed. Check console.');
    } finally {
        setIsScheduling(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (calendarView === 'week') {
      setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    }
  };

  const handleStartTask = (task: Task) => {
      setActiveFocusTask(task);
      setIsFocusModeOpen(true);
  };

  const handleOpenFocusMode = () => {
      const now = new Date();
      
      const inProgress = tasks.find(t => 
          t.status !== TaskStatus.DONE && 
          t.scheduledStart && t.scheduledEnd && 
          new Date(t.scheduledStart) <= now && 
          new Date(t.scheduledEnd) > now
      );

      if (inProgress) {
          setActiveFocusTask(inProgress);
      } else {
          const upcoming = tasks
            .filter(t => t.status !== TaskStatus.DONE && t.scheduledStart && new Date(t.scheduledStart) > now)
            .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime())[0];
          
          if (upcoming) {
              setActiveFocusTask(upcoming);
          } else {
              const topPriority = tasks
                 .filter(t => t.status !== TaskStatus.DONE)
                 .sort((a, b) => {
                     const pMap = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
                     return pMap[b.priority] - pMap[a.priority];
                 })[0];
              setActiveFocusTask(topPriority || null);
          }
      }
      setIsFocusModeOpen(true);
  };

  // Kanban Specific
  const handleTaskMoveStatus = (taskId: string, newStatus: TaskStatus) => {
      setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
              if (newStatus === TaskStatus.DONE && t.status !== TaskStatus.DONE) {
                  awardXP(50);
                  addToast('success', 'Task Done! +50 XP');
              }
              return { ...t, status: newStatus };
          }
          return t;
      }));
  };

  return {
      // State
      tasks, projects, userStats,
      mainView, setMainView,
      calendarView, setCalendarView,
      currentDate, setCurrentDate,
      userSettings, setUserSettings,
      sidebarNotes, setSidebarNotes,
      isScheduling, driftMinutes,
      toasts, unscheduledTasks,
      
      // Modals
      isTaskModalOpen, setIsTaskModalOpen,
      editingTask, setEditingTask,
      isProjectModalOpen, setIsProjectModalOpen,
      editingProject,
      isCourseImportOpen, setIsCourseImportOpen,
      isFocusModeOpen, setIsFocusModeOpen,
      isMorningBriefingOpen, setIsMorningBriefingOpen,
      activeFocusTask,
      isCmdPaletteOpen, setIsCmdPaletteOpen,
      
      // Handlers
      handleAddTask, handleImportTasks, handleSaveTask,
      handleDeleteTask, handleToggleStatus, handleAddProject, handleUpdateProject,
      handleOpenEditTask, handleOpenNewTask, handleTaskMove, handleTaskResize, handleDuplicateTask,
      handleResolveConflicts, handleAutoSchedule, navigateDate, resetDrift, handleOpenFocusMode,
      handleStartTask, handleTaskMoveStatus, handleOpenEditProject, handleOpenNewProject,
      handleApplySuggestedVelocity, removeToast, awardXP, overwriteTasks, setUnscheduledTasks
  };
};
