import { useState, useEffect } from 'react';
import { differenceInMinutes, isPast } from 'date-fns';
import { Task, TaskStatus } from '../types';

export const useDriftDetection = (tasks: Task[], threshold: number = 15) => {
  const [driftMinutes, setDriftMinutes] = useState(0);

  useEffect(() => {
    const checkDrift = () => {
      const now = new Date();
      let maxDrift = 0;

      tasks.forEach(task => {
        // Only check scheduled tasks that are NOT done
        if (task.scheduledEnd && task.status !== TaskStatus.DONE) {
            const scheduledEnd = new Date(task.scheduledEnd);
            // If the scheduled end time has passed and task is not done
            if (isPast(scheduledEnd)) {
                const diff = differenceInMinutes(now, scheduledEnd);
                if (diff > maxDrift) maxDrift = diff;
            }
        }
      });
      setDriftMinutes(maxDrift);
    };

    const interval = setInterval(checkDrift, 60000); // Check every minute
    checkDrift(); // Initial check

    return () => clearInterval(interval);
  }, [tasks]);

  return { driftMinutes, resetDrift: () => setDriftMinutes(0) };
};
