
import { Task, TaskStatus, Priority, UserSettings, EnergyLevel } from '../types';
import { 
  addMinutes, isBefore, isAfter, setHours, setMinutes, 
  areIntervalsOverlapping, startOfDay, addDays, 
  differenceInMinutes, isEqual, setSeconds, setMilliseconds, subMinutes, endOfDay
} from "date-fns";

interface Slot {
    start: Date;
    end: Date;
    duration: number;
}

// Helper functions needed for scheduling
const roundToNearest15 = (minutes: number): number => {
  const rounded = Math.round(minutes / 15) * 15;
  return rounded < 15 ? 15 : rounded;
};

const ceilTo15 = (date: Date): Date => {
    const m = date.getMinutes();
    const rem = m % 15;
    if (rem === 0) return setSeconds(setMilliseconds(date, 0), 0);
    return setSeconds(setMilliseconds(addMinutes(date, 15 - rem), 0), 0);
};

const floorTo15 = (date: Date): Date => {
    const m = date.getMinutes();
    const rem = m % 15;
    return setSeconds(setMilliseconds(subMinutes(date, rem), 0), 0);
};

const getEnergyScore = (energy: EnergyLevel | undefined, start: Date): number => {
    if (!energy) return 1;
    const hour = start.getHours() + start.getMinutes() / 60;
    if (energy === 'high') {
        if (hour < 11) return 3;
        if (hour < 15) return 2;
        return 1;
    }
    if (energy === 'medium') {
        if (hour >= 10 && hour < 16) return 3;
        if (hour >= 8 && hour < 18) return 2;
        return 1;
    }
    if (hour >= 15) return 3;
    if (hour >= 12) return 2;
    return 1;
};

/**
 * Deterministic Scheduler.
 * 1. Creates Availability Grid.
 * 2. Subtracts Fixed Tasks.
 * 3. Applies Chunking/Rhythm logic.
 * 4. Fits Tasks respecting dependencies.
 */
export const suggestSchedule = async (
  unscheduledTasks: Task[],
  fixedTasks: Task[],
  currentDate: Date,
  energyProfile: string = 'morning_lark',
  settings: UserSettings
): Promise<{ scheduled: Task[], breaks: Task[], unscheduled: { task: Task; reason: string }[], warnings: string[] }> => {
  
  const LOOKAHEAD_DAYS = 180; // 6 months lookahead
  
  // Optimization: Pre-index fixed tasks by day to avoid O(D * T) checks
  const fixedTasksByDay = new Map<number, Task[]>();
  
  fixedTasks.forEach(t => {
      if (t.scheduledStart && t.scheduledEnd && t.status !== TaskStatus.DONE) {
          const dayStart = startOfDay(new Date(t.scheduledStart)).getTime();
          if (!fixedTasksByDay.has(dayStart)) {
              fixedTasksByDay.set(dayStart, []);
          }
          fixedTasksByDay.get(dayStart)!.push(t);
      }
  });

  // --- 1. Generate Base Availability Windows (Subtracting Fixed Tasks) ---
  let availableWindows: Slot[] = [];
  
  let iterDate = startOfDay(currentDate);
  const endDate = addDays(iterDate, LOOKAHEAD_DAYS);

  while (isBefore(iterDate, endDate)) {
      const dayOfWeek = iterDate.getDay();
      
      if (settings.workDays.includes(dayOfWeek)) {
          // Define Work Day Limits
          let workStart = ceilTo15(setMinutes(setHours(iterDate, settings.workStartHour), 0));
          const workEnd = floorTo15(setMinutes(setHours(iterDate, settings.workEndHour), 0));

          // If today, start from NOW (rounded up to next 15 min)
          if (isBefore(workStart, currentDate) && isBefore(currentDate, workEnd)) {
              workStart = ceilTo15(currentDate);
          } else if (isAfter(currentDate, workStart) && isAfter(currentDate, workEnd)) {
              // Day is over, move next
              iterDate = addDays(iterDate, 1);
              continue;
          }

          if (isAfter(workStart, workEnd) || isEqual(workStart, workEnd)) {
             iterDate = addDays(iterDate, 1);
             continue;
          }

          // Initial Window for the day
          let dayWindows: Slot[] = [{
              start: workStart,
              end: workEnd,
              duration: differenceInMinutes(workEnd, workStart)
          }];

          // Efficiently get fixed tasks for this specific day
          const dayTimestamp = startOfDay(iterDate).getTime();
          const dayFixedTasks = fixedTasksByDay.get(dayTimestamp) || [];

          // Only filter tasks strictly overlapping work hours (optimization)
          const overlappingFixed = dayFixedTasks.filter(t => {
              const tStart = new Date(t.scheduledStart!);
              const tEnd = new Date(t.scheduledEnd!);
              return isBefore(tStart, workEnd) && isAfter(tEnd, workStart);
          });

          for (const fixed of overlappingFixed) {
              const fStart = new Date(fixed.scheduledStart!);
              const fEnd = new Date(fixed.scheduledEnd!);
              
              const newWindows: Slot[] = [];
              for (const win of dayWindows) {
                   if (!areIntervalsOverlapping({ start: win.start, end: win.end }, { start: fStart, end: fEnd })) {
                       newWindows.push(win);
                       continue;
                   }
                   
                   // Split window
                   if (isBefore(win.start, fStart)) {
                       newWindows.push({ start: win.start, end: fStart, duration: differenceInMinutes(fStart, win.start) });
                   }
                   if (isAfter(win.end, fEnd)) {
                       newWindows.push({ start: fEnd, end: win.end, duration: differenceInMinutes(win.end, fEnd) });
                   }
              }
              dayWindows = newWindows;
          }

          // FINAL GRID ALIGNMENT
          dayWindows = dayWindows.map(win => {
             const alignedStart = ceilTo15(win.start);
             const alignedEnd = floorTo15(win.end);
             
             if (!isBefore(alignedStart, alignedEnd)) return null;

             return {
                 start: alignedStart,
                 end: alignedEnd,
                 duration: differenceInMinutes(alignedEnd, alignedStart)
             };
          }).filter((w): w is Slot => w !== null && w.duration >= 15);
          
          availableWindows.push(...dayWindows);
      }
      iterDate = addDays(iterDate, 1);
  }

  // --- 2. Refine Windows based on Settings (Chunking) ---
  // Note: Using a single array for finalWorkSlots is efficient enough for client-side (typically < 1000 items)
  let finalWorkSlots: Slot[] = [];
  let generatedBreaks: Task[] = [];
  let chunkCounter = 0;

  if (settings.enableChunking) {
      for (const window of availableWindows) {
          let cursor = window.start;
          
          while (isBefore(cursor, window.end)) {
              const remainingInWindow = differenceInMinutes(window.end, cursor);
              if (remainingInWindow < 15) break;

              const settingsChunk = roundToNearest15(settings.workChunkMinutes);
              const workDuration = Math.min(settingsChunk, Math.floor(remainingInWindow / 15) * 15);
              
              if (workDuration < 15) break;

              const workEnd = addMinutes(cursor, workDuration);

              finalWorkSlots.push({
                  start: cursor,
                  end: workEnd,
                  duration: workDuration
              });

              cursor = workEnd;
              chunkCounter++;

              if (differenceInMinutes(window.end, cursor) >= 15) {
                   const isLongBreak = chunkCounter % settings.longBreakInterval === 0;
                   const targetBreakDuration = roundToNearest15(isLongBreak ? settings.longBreakMinutes : settings.shortBreakMinutes);
                   const breakDuration = Math.min(targetBreakDuration, Math.floor(differenceInMinutes(window.end, cursor) / 15) * 15);
                   
                   if (breakDuration >= 15) {
                        const breakEnd = addMinutes(cursor, breakDuration);
                        generatedBreaks.push({
                            id: `break-${cursor.getTime()}`,
                            title: isLongBreak ? "Long Break" : "Short Break",
                            durationMinutes: breakDuration,
                            priority: Priority.LOW,
                            status: TaskStatus.TODO,
                            isFixed: true,
                            scheduledStart: cursor.toISOString(),
                            scheduledEnd: breakEnd.toISOString(),
                            projectId: 'system-break',
                            description: 'Auto-generated break.'
                        });
                        cursor = breakEnd;
                   }
              }
          }
      }
  } else {
      finalWorkSlots = availableWindows;
  }

  // --- 3. Fit Tasks (Greedy with Dependencies) ---
  const scheduledTasks: Task[] = [];
  const taskCompletionTimes = new Map<string, Date>();
  const unscheduled: { task: Task; reason: string }[] = [];
  let scheduledHighTodo = false;
  let alternateTodo = true;
  
  // Initialize fixed task completion times
  fixedTasks.forEach(t => {
      if (t.scheduledEnd) {
          taskCompletionTimes.set(t.id, new Date(t.scheduledEnd));
      }
  });

  let pendingTasks = [...unscheduledTasks].map(t => ({
      ...t,
      durationMinutes: roundToNearest15(t.durationMinutes)
  }));

  const getTaskScore = (t: Task) => {
      const pMap = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
      let score = pMap[t.priority] * 100;
      if (t.deadline) score += 50; 
      if (t.latestEnd) score += 60;
      return score;
  };

  const pendingMap = new Map(pendingTasks.map(t => [t.id, t]));
  const processedIds = new Set<string>();

  while (processedIds.size < pendingTasks.length) {
      const readyTasks = pendingTasks.filter(t => 
          !processedIds.has(t.id) && 
          (!t.dependencies || t.dependencies.every(depId => taskCompletionTimes.has(depId) || !pendingMap.has(depId)))
      );

      if (readyTasks.length === 0) {
          console.warn("Scheduler: Dependency cycle or blockage detected.");
          break;
      }

      const sortByScore = (arr: Task[]) => arr.sort((a, b) => {
          const scoreA = getTaskScore(a);
          const scoreB = getTaskScore(b);
          if (scoreB !== scoreA) return scoreB - scoreA;
          if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          return b.durationMinutes - a.durationMinutes;
      });

      const readyTodos = sortByScore(readyTasks.filter(t => t.isTodoList));
      const readyProjects = sortByScore(readyTasks.filter(t => !t.isTodoList));
      const urgentTodos = readyTodos.filter(t => t.deadline);

      let task: Task | undefined;
      if (urgentTodos.length > 0) {
          task = urgentTodos[0];
      } else if (alternateTodo && readyTodos.length > 0) {
          task = readyTodos[0];
      } else if (!alternateTodo && readyProjects.length > 0) {
          task = readyProjects[0];
      } else if (readyTodos.length > 0) {
          task = readyTodos[0];
      } else {
          task = readyProjects[0];
      }

      if (!task) break;
      alternateTodo = !alternateTodo;
      processedIds.add(task.id);

      let dependencyConstraint = currentDate;
      if (task.dependencies) {
          task.dependencies.forEach(depId => {
              const end = taskCompletionTimes.get(depId);
              if (end && isAfter(end, dependencyConstraint)) {
                  dependencyConstraint = end;
              }
          });
      }
      if (task.earliestStart) {
          const earliest = new Date(task.earliestStart);
          if (isAfter(earliest, dependencyConstraint)) {
              dependencyConstraint = earliest;
          }
      }

      const deadlineConstraint = task.deadline ? endOfDay(new Date(task.deadline)) : null;
      const latestConstraint = (() => {
          const explicit = task.latestEnd ? new Date(task.latestEnd) : null;
          if (deadlineConstraint && explicit) {
              return isBefore(deadlineConstraint, explicit) ? deadlineConstraint : explicit;
          }
          return deadlineConstraint || explicit;
      })();

      let startSlotIndex = 0;
      if (task.energy) {
          let bestIndex = -1;
          let bestScore = -1;
          let bestStart: Date | null = null;

          for (let i = 0; i < finalWorkSlots.length; i++) {
              const slot = finalWorkSlots[i];
              if (slot.duration < 15) continue;

              let usableStart = slot.start;
              if (isBefore(usableStart, dependencyConstraint)) {
                  usableStart = ceilTo15(dependencyConstraint);
              }

              if (latestConstraint && isBefore(latestConstraint, usableStart)) continue;

              const slotEnd = latestConstraint && isBefore(latestConstraint, slot.end) ? latestConstraint : slot.end;
              if (isAfter(usableStart, slotEnd) || isEqual(usableStart, slotEnd)) continue;

              const availableInSlot = differenceInMinutes(slotEnd, usableStart);
              if (availableInSlot < 15) continue;

              const score = getEnergyScore(task.energy, usableStart);
              if (score > bestScore || (score === bestScore && (!bestStart || isBefore(usableStart, bestStart)))) {
                  bestIndex = i;
                  bestScore = score;
                  bestStart = usableStart;
              }
          }

          if (bestIndex >= 0) {
              startSlotIndex = bestIndex;
          }
      }

      let remainingDuration = task.durationMinutes;
      let taskParts: Task[] = [];
      let slotsToRemove: number[] = [];
      let scheduledEndTime: Date | null = null;

      for (let i = startSlotIndex; i < finalWorkSlots.length; i++) {
          const slot = finalWorkSlots[i];
          if (slot.duration < 15) continue; 

          let usableStart = slot.start;
          if (isBefore(usableStart, dependencyConstraint)) {
              usableStart = ceilTo15(dependencyConstraint); 
          }

          if (latestConstraint && isBefore(latestConstraint, usableStart)) continue;

          const slotEnd = latestConstraint && isBefore(latestConstraint, slot.end) ? latestConstraint : slot.end;
          if (isAfter(usableStart, slotEnd) || isEqual(usableStart, slotEnd)) continue;

          const availableInSlot = differenceInMinutes(slotEnd, usableStart);
          if (availableInSlot < 15) continue;

          const fit = Math.min(availableInSlot, remainingDuration);
          const partStart = usableStart;
          const partEnd = addMinutes(usableStart, fit);

          const baseReason = settings.enableChunking 
              ? `Optimized for ${settings.workChunkMinutes}m flow.` 
              : `Scheduled with priority-first order.`;
          const priorityReason = ` Priority ${task.priority} placed ahead of lower levels.`;
          const energyReason = task.energy ? ` Energy ${task.energy}.` : '';
          const windowReason = task.earliestStart || task.latestEnd ? ` Window applied.` : '';

          taskParts.push({
              ...task,
              id: taskParts.length === 0 ? task.id : `${task.id}-part-${taskParts.length + 1}`,
              originalTaskId: task.id,
              partIndex: taskParts.length + 1,
              title: remainingDuration === task.durationMinutes && fit === remainingDuration 
                    ? task.title 
                    : `${task.title} (${taskParts.length + 1})`,
              durationMinutes: fit,
              scheduledStart: partStart.toISOString(),
              scheduledEnd: partEnd.toISOString(),
              schedulingReason: `${baseReason}${priorityReason}${energyReason}${windowReason}`
          });

          remainingDuration -= fit;
          scheduledEndTime = partEnd;

          if (isEqual(usableStart, slot.start)) {
              if (fit === availableInSlot) {
                  slotsToRemove.push(i);
              } else {
                  finalWorkSlots[i] = {
                      start: partEnd,
                      end: slot.end,
                      duration: differenceInMinutes(slot.end, partEnd)
                  };
              }
          } else {
              const oldEnd = slot.end;
              finalWorkSlots[i] = {
                  start: slot.start,
                  end: usableStart,
                  duration: differenceInMinutes(usableStart, slot.start)
              };

              if (isBefore(partEnd, oldEnd)) {
                  finalWorkSlots.splice(i + 1, 0, {
                      start: partEnd,
                      end: oldEnd,
                      duration: differenceInMinutes(oldEnd, partEnd)
                  });
              }
          }

          if (remainingDuration <= 0) break;
      }

      if (remainingDuration <= 0 && scheduledEndTime) {
          scheduledTasks.push(...taskParts);
          taskCompletionTimes.set(task.id, scheduledEndTime);
          if (task.isTodoList && task.priority === Priority.HIGH) scheduledHighTodo = true;
          slotsToRemove.sort((a, b) => b - a).forEach(idx => finalWorkSlots.splice(idx, 1));
      } else {
          unscheduled.push({
              task,
              reason: latestConstraint
                ? `No slot before deadline/window (${latestConstraint.toISOString()})`
                : 'Insufficient availability'
          });
          console.warn(`Could not schedule task ${task.title} - insufficient time slots.`);
      }
  }

  const warnings: string[] = [];
  if (scheduledHighTodo) {
      const slippedProjects = scheduledTasks.filter(t => !t.isTodoList && t.deadline && t.scheduledEnd && isAfter(new Date(t.scheduledEnd), new Date(t.deadline)));
      if (slippedProjects.length > 0) {
          warnings.push(`High-priority to-dos pushed ${slippedProjects.length} project task(s) past their deadlines.`);
      }
  }

  return {
      scheduled: scheduledTasks,
      breaks: generatedBreaks,
      unscheduled,
      warnings
  };
};
