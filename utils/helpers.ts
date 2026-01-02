import { Task, TaskStatus, Project, Priority } from '../types';
import { addMinutes, isBefore, isAfter, subMinutes, setSeconds, setMilliseconds, areIntervalsOverlapping } from 'date-fns';

export const isTaskBlocked = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependencies || task.dependencies.length === 0) return false;
  return task.dependencies.some(depId => {
    const dep = allTasks.find(t => t.id === depId);
    // Blocked if dependency is not found (deleted) or not done
    return !dep || dep.status !== TaskStatus.DONE;
  });
};

export const getProjectColor = (projects: Project[], id?: string) => {
  return projects.find(p => p.id === id)?.color || '#71717a';
};

export const sortTasksForList = (tasks: Task[], allTasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => {
    // 1. Done at bottom
    if (a.status === TaskStatus.DONE && b.status !== TaskStatus.DONE) return 1;
    if (a.status !== TaskStatus.DONE && b.status === TaskStatus.DONE) return -1;
    
    // 2. Scheduled tasks pushed down (optional preference)
    if (a.scheduledStart && !b.scheduledStart) return 1;
    if (!a.scheduledStart && b.scheduledStart) return -1;

    // 3. Priority
    const pMap = { [Priority.HIGH]: 0, [Priority.MEDIUM]: 1, [Priority.LOW]: 2 };
    const pDiff = pMap[a.priority] - pMap[b.priority];
    if (pDiff !== 0) return pDiff;

    return 0;
  });
};

export const cascadeTaskMove = (allTasks: Task[], taskId: string, newStart: Date): Task[] => {
    // Deep clone to avoid mutating state directly during calculation
    const taskMap = new Map(allTasks.map(t => [t.id, { ...t }]));
    const visited = new Set<string>();

    const moveRecursively = (id: string, start: Date) => {
        if (visited.has(id)) return;
        visited.add(id);

        const task = taskMap.get(id);
        if (!task) return;

        // Update current task
        task.scheduledStart = start.toISOString();
        task.scheduledEnd = addMinutes(start, task.durationMinutes).toISOString();
        task.isFixed = true;
        task.schedulingReason = "Manually moved by user";

        // Push Successors (Tasks that depend on this one)
        const successors = Array.from(taskMap.values()).filter(t => t.dependencies?.includes(id));
        for (const successor of successors) {
            if (successor.scheduledStart) {
                const succStart = new Date(successor.scheduledStart);
                const taskEnd = new Date(task.scheduledEnd!);
                
                // If successor starts before this task ends, we must push it
                if (isBefore(succStart, taskEnd)) {
                    moveRecursively(successor.id, taskEnd);
                }
            }
        }

        // Pull Predecessors (Tasks this one depends on)
        if (task.dependencies) {
            for (const depId of task.dependencies) {
                const dep = taskMap.get(depId);
                // Only if predecessor is scheduled and ends AFTER this task starts
                if (dep && dep.scheduledEnd) {
                    const depEnd = new Date(dep.scheduledEnd);
                    const taskStart = new Date(task.scheduledStart!);
                    
                    if (isAfter(depEnd, taskStart)) {
                        // Predecessor ends after this task starts -> Pull it back so it ends when this task starts
                        const newDepStart = subMinutes(taskStart, dep.durationMinutes);
                        moveRecursively(depId, newDepStart);
                    }
                }
            }
        }
    };

    moveRecursively(taskId, newStart);
    return Array.from(taskMap.values());
};

export const resolveOverlaps = (tasks: Task[]): Task[] => {
    const sortedTasks = [...tasks]
        .filter(t => t.scheduledStart && t.scheduledEnd && t.status !== TaskStatus.DONE)
        .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());

    if (sortedTasks.length === 0) return tasks;

    const modifiedMap = new Map<string, Task>();
    
    // Iteratively push overlapping tasks forward
    for (let i = 0; i < sortedTasks.length - 1; i++) {
        const current = modifiedMap.get(sortedTasks[i].id) || sortedTasks[i];
        const next = modifiedMap.get(sortedTasks[i+1].id) || sortedTasks[i+1];
        
        const currentEnd = new Date(current.scheduledEnd!);
        const nextStart = new Date(next.scheduledStart!);

        if (isAfter(currentEnd, nextStart)) {
            // Overlap detected: Push next task to start when current ends
            const newNextStart = currentEnd;
            const newNextEnd = addMinutes(newNextStart, next.durationMinutes);
            
            const updatedNext = {
                ...next,
                scheduledStart: newNextStart.toISOString(),
                scheduledEnd: newNextEnd.toISOString(),
                isFixed: true, // Auto-resolution fixes the slot
                schedulingReason: 'Auto-resolved conflict'
            };
            
            modifiedMap.set(next.id, updatedNext);
            sortedTasks[i+1] = updatedNext; // Update array for next iteration
        }
    }

    // Merge changes back into original array
    return tasks.map(t => modifiedMap.get(t.id) || t);
};

// --- Shared Math & Date Helpers ---

export const roundToNearest15 = (minutes: number): number => {
  const rounded = Math.round(minutes / 15) * 15;
  return rounded < 15 ? 15 : rounded;
};

export const ceilTo15 = (date: Date): Date => {
    const m = date.getMinutes();
    const rem = m % 15;
    if (rem === 0) return setSeconds(setMilliseconds(date, 0), 0);
    return setSeconds(setMilliseconds(addMinutes(date, 15 - rem), 0), 0);
};

export const floorTo15 = (date: Date): Date => {
    const m = date.getMinutes();
    const rem = m % 15;
    return setSeconds(setMilliseconds(subMinutes(date, rem), 0), 0);
};