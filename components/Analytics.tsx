
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid } from 'recharts';
import { Task, Project, TaskStatus, EnergyLevel } from '../types';
import { addDays, addMinutes, differenceInBusinessDays, differenceInMinutes, format, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, Gauge, Link as LinkIcon, Lock, Repeat, Timer, TrendingUp } from 'lucide-react';
import { getProjectColor, isTaskBlocked } from '../utils/helpers';

interface AnalyticsProps {
  tasks: Task[];
  projects: Project[];
  onApplySuggestedVelocity?: (projectId: string, velocity: number) => void;
}

interface TimelineRow {
  task: Task;
  start: Date;
  end: Date;
  barStart: number;
  barWidth: number;
  color: string;
  blocked: boolean;
  rowIndex: number;
}

type TimelineRowDraft = Omit<TimelineRow, 'rowIndex'>;

const TIMELINE_DAY_WIDTH = 64;
const TIMELINE_ROW_HEIGHT = 36;
const TIMELINE_LABEL_WIDTH = 220;
const MIN_TIMELINE_BAR_WIDTH = 12;
const TIMELINE_HORIZON_OPTIONS = [7, 14, 30];

const isEnergyAligned = (energy: EnergyLevel | undefined, start: Date): boolean => {
  if (!energy) return true;
  const hour = start.getHours() + start.getMinutes() / 60;
  if (energy === 'high') return hour < 11;
  if (energy === 'medium') return hour >= 10 && hour < 16;
  return hour >= 15;
};

const Analytics: React.FC<AnalyticsProps> = ({ tasks, projects, onApplySuggestedVelocity }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [timelineHorizon, setTimelineHorizon] = useState<number>(14);

  const projectData = useMemo(() => {
    return projects.map(p => {
      const duration = tasks
        .filter(t => t.projectId === p.id)
        .reduce((acc, curr) => acc + curr.durationMinutes, 0);
      return { name: p.name, value: duration, color: p.color };
    }).filter(d => d.value > 0);
  }, [tasks, projects]);

  const workloadData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Initialize data for Mon-Fri (indices 1-5)
    const data = [1, 2, 3, 4, 5].map(i => ({ name: days[i], hours: 0, originalIndex: i }));
    
    tasks.forEach(task => {
        if (task.scheduledStart && task.status !== TaskStatus.DONE) {
             const date = new Date(task.scheduledStart);
             const day = date.getDay();
             const entry = data.find(d => d.originalIndex === day);
             if (entry) {
                 entry.hours += task.durationMinutes / 60;
             }
        }
    });
    
    // Round to 1 decimal place
    return data.map(d => ({ ...d, hours: Math.round(d.hours * 10) / 10 }));
  }, [tasks]);
  
  // --- Pace / Effort Calculation ---
  const paceMetrics = useMemo(() => {
    if (!selectedProjectId) return null;

    const projectTasks = tasks.filter(t => t.projectId === selectedProjectId);
    const incompleteTasks = projectTasks.filter(t => t.status !== TaskStatus.DONE);
    
    if (incompleteTasks.length === 0) return { status: 'complete' };

    // 1. Calculate Remaining Effort
    const remainingMinutes = incompleteTasks.reduce((acc, t) => acc + t.durationMinutes, 0);
    const remainingHours = remainingMinutes / 60;

    // 2. Find Deadline (Furthest scheduled date or explicit deadline)
    const now = startOfDay(new Date());
    let deadlineDate = now;
    
    projectTasks.forEach(t => {
        if (t.deadline) {
            const d = new Date(t.deadline);
            if (isAfter(d, deadlineDate)) deadlineDate = d;
        } else if (t.scheduledStart) {
            const d = new Date(t.scheduledStart);
            if (isAfter(d, deadlineDate)) deadlineDate = d;
        }
    });

    // If deadline is today/past, default to 1 day to avoid division by zero
    const daysRemaining = Math.max(1, differenceInBusinessDays(deadlineDate, now));
    
    // 3. Calculate Required Pace (Hours/Day)
    const requiredHoursPerDay = remainingHours / daysRemaining;

    // 4. Determine Status
    // Assuming a standard "sustainable" work pace on one project is ~2-3 hours/day. 
    // This is arbitrary but serves as a visual anchor.
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (requiredHoursPerDay > 3) status = 'warning';
    if (requiredHoursPerDay > 5) status = 'critical';

    return {
        remainingHours,
        daysRemaining,
        requiredHoursPerDay,
        status,
        deadlineDate
    };
  }, [tasks, selectedProjectId]);


  const velocityData = useMemo(() => {
      const doneTasks = tasks
        .filter(t => t.status === TaskStatus.DONE && t.actualDurationMinutes && t.actualDurationMinutes > 0)
        .slice(0, 10);

      return doneTasks.map(t => ({
          name: t.title.length > 15 ? `${t.title.substring(0, 15)}...` : t.title,
          Planned: t.durationMinutes,
          Actual: Math.round(t.actualDurationMinutes || 0)
      }));
  }, [tasks]);

  const velocityInsights = useMemo(() => {
    return projects.map(project => {
      const projectTasks = tasks.filter(
        task => task.projectId === project.id && task.status === TaskStatus.DONE && task.actualDurationMinutes && task.actualDurationMinutes > 0
      );
      if (projectTasks.length === 0) {
        return {
          project,
          sampleCount: 0,
          plannedMinutes: 0,
          actualMinutes: 0,
          suggestedVelocity: project.velocity,
          optimismRatio: 1
        };
      }

      const plannedMinutes = projectTasks.reduce((acc, task) => acc + task.durationMinutes, 0);
      const actualMinutes = projectTasks.reduce((acc, task) => acc + (task.actualDurationMinutes || 0), 0);
      const suggestedVelocity = Math.max(0.5, Math.min(2.0, plannedMinutes / Math.max(actualMinutes, 1)));
      const optimismRatio = actualMinutes / Math.max(plannedMinutes, 1);

      return {
        project,
        sampleCount: projectTasks.length,
        plannedMinutes,
        actualMinutes,
        suggestedVelocity,
        optimismRatio
      };
    });
  }, [projects, tasks]);

  const realityCheck = useMemo(() => {
    const completedTracked = tasks.filter(
      task => task.status === TaskStatus.DONE && task.actualDurationMinutes && task.actualDurationMinutes > 0
    );
    if (completedTracked.length === 0) {
      return null;
    }

    const plannedMinutes = completedTracked.reduce((acc, task) => acc + task.durationMinutes, 0);
    const actualMinutes = completedTracked.reduce((acc, task) => acc + (task.actualDurationMinutes || 0), 0);
    const ratio = actualMinutes / Math.max(plannedMinutes, 1);
    const score = Math.max(-100, Math.min(100, Math.round((ratio - 1) * 100)));
    const label = score > 20 ? 'Optimistic' : score < -20 ? 'Pessimistic' : 'Calibrated';
    const descriptor = score > 20
      ? 'Actual time is consistently higher than estimates.'
      : score < -20
        ? 'Actual time is consistently lower than estimates.'
        : 'Estimates are lining up with reality.';

    return {
      score,
      ratio,
      plannedMinutes,
      actualMinutes,
      label,
      descriptor
    };
  }, [tasks]);

  const timelineStart = useMemo(() => startOfDay(new Date()), []);

  const timelineDays = useMemo(() => {
    return Array.from({ length: timelineHorizon }, (_, i) => addDays(timelineStart, i));
  }, [timelineHorizon, timelineStart]);

  const timelineRows: TimelineRow[] = useMemo(() => {
    const horizonMinutes = timelineHorizon * 24 * 60;
    const minuteWidth = TIMELINE_DAY_WIDTH / (24 * 60);

    const rows = tasks
      .filter(task => task.scheduledStart && task.status !== TaskStatus.DONE)
      .map(task => {
        const start = new Date(task.scheduledStart!);
        const end = task.scheduledEnd ? new Date(task.scheduledEnd) : addMinutes(start, task.durationMinutes);
        const startOffset = differenceInMinutes(start, timelineStart);
        const endOffset = differenceInMinutes(end, timelineStart);
        const clampedStart = Math.max(0, startOffset);
        const clampedEnd = Math.min(horizonMinutes, endOffset);

        if (clampedEnd <= 0 || clampedStart >= horizonMinutes) return null;

        return {
          task,
          start,
          end,
          barStart: clampedStart * minuteWidth,
          barWidth: Math.max(MIN_TIMELINE_BAR_WIDTH, (clampedEnd - clampedStart) * minuteWidth),
          color: getProjectColor(projects, task.projectId),
          blocked: isTaskBlocked(task, tasks)
        };
      })
      .filter((row): row is TimelineRowDraft => !!row)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return rows.map((row, index) => ({ ...row, rowIndex: index }));
  }, [tasks, projects, timelineHorizon, timelineStart]);

  const dependencyLinks = useMemo(() => {
    const rowMap = new Map(timelineRows.map(row => [row.task.id, row]));
    const links: Array<{ from: TimelineRow; to: TimelineRow }> = [];

    timelineRows.forEach(row => {
      row.task.dependencies?.forEach(depId => {
        const from = rowMap.get(depId);
        if (from) {
          links.push({ from, to: row });
        }
      });
    });

    return links;
  }, [timelineRows]);

  const timelineStats = useMemo(() => {
    const scheduledCount = tasks.filter(task => task.scheduledStart && task.status !== TaskStatus.DONE).length;
    const dependencyCount = tasks.reduce((acc, task) => acc + (task.dependencies?.length || 0), 0);
    const blockedCount = tasks.filter(task => task.status !== TaskStatus.DONE && isTaskBlocked(task, tasks)).length;
    return { scheduledCount, dependencyCount, blockedCount };
  }, [tasks]);

  const constraintSets = useMemo(() => {
    const today = startOfDay(new Date());
    const dueSoonLimit = addDays(today, 4);

    const overdue = tasks.filter(task => task.deadline && isBefore(new Date(task.deadline), today) && task.status !== TaskStatus.DONE);
    const dueSoon = tasks.filter(task => task.deadline && isAfter(new Date(task.deadline), today) && isBefore(new Date(task.deadline), dueSoonLimit) && task.status !== TaskStatus.DONE);
    const fixed = tasks.filter(task => task.isFixed && task.status !== TaskStatus.DONE);
    const blocked = tasks.filter(task => task.status !== TaskStatus.DONE && isTaskBlocked(task, tasks));
    const unscheduled = tasks.filter(task => !task.scheduledStart && task.status !== TaskStatus.DONE);
    const recurring = tasks.filter(task => task.recurrence && task.status !== TaskStatus.DONE);

    return { overdue, dueSoon, fixed, blocked, unscheduled, recurring };
  }, [tasks]);

  const constraintCards = useMemo(() => ([
    {
      id: 'overdue',
      label: 'Overdue',
      icon: AlertTriangle,
      accent: 'text-red-300',
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      tasks: constraintSets.overdue
    },
    {
      id: 'due-soon',
      label: 'Due Soon',
      icon: CalendarClock,
      accent: 'text-yellow-300',
      border: 'border-yellow-500/30',
      bg: 'bg-yellow-500/5',
      tasks: constraintSets.dueSoon
    },
    {
      id: 'fixed',
      label: 'Fixed Slots',
      icon: Lock,
      accent: 'text-blue-300',
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
      tasks: constraintSets.fixed
    },
    {
      id: 'blocked',
      label: 'Blocked',
      icon: LinkIcon,
      accent: 'text-orange-300',
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/5',
      tasks: constraintSets.blocked
    },
    {
      id: 'unscheduled',
      label: 'Unscheduled',
      icon: Clock,
      accent: 'text-slate-300',
      border: 'border-white/10',
      bg: 'bg-white/5',
      tasks: constraintSets.unscheduled
    },
    {
      id: 'recurring',
      label: 'Recurring',
      icon: Repeat,
      accent: 'text-emerald-300',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
      tasks: constraintSets.recurring
    }
  ]), [constraintSets]);

  const durationData = useMemo(() => {
    const buckets = [
      { label: '0-30m', min: 0, max: 30 },
      { label: '31-60m', min: 31, max: 60 },
      { label: '1-2h', min: 61, max: 120 },
      { label: '2-4h', min: 121, max: 240 },
      { label: '4h+', min: 241, max: Number.POSITIVE_INFINITY }
    ];

    return buckets.map((bucket, index) => {
      const bucketTasks = tasks.filter(task => task.durationMinutes >= bucket.min && task.durationMinutes <= bucket.max && task.status !== TaskStatus.DONE);
      const totalMinutes = bucketTasks.reduce((acc, task) => acc + task.durationMinutes, 0);
      return {
        name: bucket.label,
        tasks: bucketTasks.length,
        hours: Math.round((totalMinutes / 60) * 10) / 10,
        color: ['#38bdf8', '#22d3ee', '#a78bfa', '#fb7185', '#f97316'][index]
      };
    });
  }, [tasks]);

  const durationSummary = useMemo(() => {
    const activeTasks = tasks.filter(task => task.status !== TaskStatus.DONE);
    const totalMinutes = activeTasks.reduce((acc, task) => acc + task.durationMinutes, 0);
    const averageMinutes = activeTasks.length ? totalMinutes / activeTasks.length : 0;
    const longestMinutes = activeTasks.reduce((max, task) => Math.max(max, task.durationMinutes), 0);

    return {
      totalHours: totalMinutes / 60,
      averageMinutes,
      longestMinutes
    };
  }, [tasks]);

  const scheduleFit = useMemo(() => {
    const scheduled = tasks.filter(
      task => task.scheduledStart && task.scheduledEnd && task.status !== TaskStatus.DONE
    );

    const energyTagged = scheduled.filter(task => task.energy);
    const energyAligned = energyTagged.filter(task => isEnergyAligned(task.energy, new Date(task.scheduledStart!)));

    const windowTagged = scheduled.filter(task => task.earliestStart || task.latestEnd);
    const windowAligned = windowTagged.filter(task => {
      const start = new Date(task.scheduledStart!);
      const end = new Date(task.scheduledEnd!);
      const earliest = task.earliestStart ? new Date(task.earliestStart) : null;
      const latest = task.latestEnd ? new Date(task.latestEnd) : null;
      const meetsEarliest = earliest ? !isBefore(start, earliest) : true;
      const meetsLatest = latest ? !isAfter(end, latest) : true;
      return meetsEarliest && meetsLatest;
    });

    return {
      scheduledCount: scheduled.length,
      energyTaggedCount: energyTagged.length,
      energyAlignedCount: energyAligned.length,
      windowTaggedCount: windowTagged.length,
      windowAlignedCount: windowAligned.length
    };
  }, [tasks]);

  const timelineWidth = timelineHorizon * TIMELINE_DAY_WIDTH;
  const timelineHeight = timelineRows.length * TIMELINE_ROW_HEIGHT;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full p-1 pb-10">
      
      {/* Pace / Effort Visualizer (New) */}
      <div className="md:col-span-2 bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-6">
              <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-brand-400" /> Project Pace Calculator
                  </h3>
                  <p className="text-xs text-motion-muted">Visualizing how hard you need to work to finish on time.</p>
              </div>
              <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg text-xs text-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                  {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
          </div>

          {paceMetrics?.status === 'complete' ? (
              <div className="flex flex-col items-center justify-center h-40 bg-green-500/5 rounded-xl border border-green-500/20">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mb-2" />
                  <p className="text-green-100 font-bold">Project Complete!</p>
              </div>
          ) : paceMetrics ? (
              <div className="flex items-center gap-8">
                  {/* Left: The Math */}
                  <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                              <div className="text-xs text-motion-muted uppercase tracking-wider mb-1">Work Left</div>
                              <div className="text-2xl font-mono font-bold text-white">{paceMetrics.remainingHours.toFixed(1)} <span className="text-sm text-motion-muted">hrs</span></div>
                          </div>
                          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                              <div className="text-xs text-motion-muted uppercase tracking-wider mb-1">Time Left</div>
                              <div className="text-2xl font-mono font-bold text-white">{paceMetrics.daysRemaining} <span className="text-sm text-motion-muted">days</span></div>
                          </div>
                           <div className={`p-4 rounded-xl border ${paceMetrics.status === 'critical' ? 'bg-red-500/10 border-red-500/30' : paceMetrics.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                              <div className="text-xs uppercase tracking-wider mb-1 opacity-80">Required Pace</div>
                              <div className="text-2xl font-mono font-bold">{paceMetrics.requiredHoursPerDay.toFixed(1)} <span className="text-sm opacity-70">hrs/day</span></div>
                          </div>
                      </div>
                      
                      {/* Visual Bar */}
                      <div className="relative pt-4">
                          <div className="flex justify-between text-xs font-bold mb-2">
                              <span className="text-green-400">Easy (1h/day)</span>
                              <span className="text-yellow-400">Focus (3h/day)</span>
                              <span className="text-red-400">Crunch (5h+/day)</span>
                          </div>
                          <div className="h-4 bg-white/10 rounded-full overflow-hidden relative">
                                {/* Safe Zone */}
                                <div className="absolute left-0 w-1/3 h-full bg-green-500/30 border-r border-black/20"></div>
                                {/* Warning Zone */}
                                <div className="absolute left-1/3 w-1/3 h-full bg-yellow-500/30 border-r border-black/20"></div>
                                {/* Danger Zone */}
                                <div className="absolute left-2/3 w-1/3 h-full bg-red-500/30"></div>
                                
                                {/* Indicator */}
                                <div 
                                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 transition-all duration-500"
                                    style={{ left: `${Math.min(100, (paceMetrics.requiredHoursPerDay / 6) * 100)}%` }}
                                ></div>
                          </div>
                      </div>
                  </div>

                  {/* Right: The Insight */}
                  <div className="w-1/3 border-l border-white/10 pl-8">
                      {paceMetrics.status === 'critical' && (
                          <div className="text-red-300">
                              <div className="flex items-center gap-2 font-bold mb-2"><AlertTriangle className="w-4 h-4" /> Overload Warning</div>
                              <p className="text-xs leading-relaxed opacity-80">To finish by the deadline, you need to work {paceMetrics.requiredHoursPerDay.toFixed(1)} hours every single day on this project alone. Consider moving the deadline or reducing scope.</p>
                          </div>
                      )}
                      {paceMetrics.status === 'warning' && (
                          <div className="text-yellow-300">
                              <div className="flex items-center gap-2 font-bold mb-2"><ArrowRight className="w-4 h-4" /> Tight Schedule</div>
                              <p className="text-xs leading-relaxed opacity-80">You need to maintain a steady {paceMetrics.requiredHoursPerDay.toFixed(1)} hours/day. Do not skip days or this will become critical.</p>
                          </div>
                      )}
                      {paceMetrics.status === 'good' && (
                          <div className="text-green-300">
                               <div className="flex items-center gap-2 font-bold mb-2"><CheckCircle2 className="w-4 h-4" /> On Track</div>
                               <p className="text-xs leading-relaxed opacity-80">You are comfortably ahead. {paceMetrics.requiredHoursPerDay.toFixed(1)} hours/day is very manageable.</p>
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              <div className="text-center text-motion-muted py-8">Select a project to analyze pace.</div>
          )}
      </div>

      {/* Reality Check */}
      <div className="bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-brand-400" /> Reality Check
          </h3>
          <span className="text-xs text-motion-muted">Bias vs actual tracked time</span>
        </div>

        {!realityCheck ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-motion-muted bg-white/5 border border-white/10 rounded-xl p-6">
            Track time on a few completed tasks to unlock a Reality Check score.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-motion-muted uppercase tracking-wider">Score</div>
                <div className="text-2xl font-mono font-bold text-white">{realityCheck.score}</div>
                <div className="text-xs text-motion-muted">{realityCheck.label}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-motion-muted uppercase tracking-wider">Actual vs planned</div>
                <div className="text-lg font-mono text-white">{realityCheck.ratio.toFixed(2)}x</div>
                <div className="text-xs text-motion-muted">{Math.round(realityCheck.actualMinutes)}m tracked</div>
              </div>
            </div>

            <div className="relative h-3 rounded-full overflow-hidden bg-white/10">
              <div className="absolute inset-y-0 left-0 w-1/2 bg-emerald-500/30"></div>
              <div className="absolute inset-y-0 left-1/2 w-1/2 bg-rose-500/30"></div>
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                style={{ left: `calc(${(realityCheck.score + 100) / 2}% - 3px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-motion-muted">
              <span>Pessimistic</span>
              <span>Realistic</span>
              <span>Optimistic</span>
            </div>
            <p className="text-xs text-motion-muted">{realityCheck.descriptor}</p>
          </div>
        )}
      </div>

      {/* Velocity Calibration */}
      <div className="bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-400" /> Velocity Calibration
          </h3>
          <span className="text-xs text-motion-muted">Suggested tuning from real data</span>
        </div>
        <div className="space-y-3">
          {velocityInsights.map(({ project, sampleCount, plannedMinutes, actualMinutes, suggestedVelocity, optimismRatio }) => {
            const delta = suggestedVelocity - project.velocity;
            const confidence = sampleCount >= 6 ? 'High' : sampleCount >= 3 ? 'Medium' : 'Low';
            const isReady = sampleCount >= 3;
            const canApply = isReady && onApplySuggestedVelocity && Math.abs(delta) >= 0.05;
            return (
              <div key={project.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }}></span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{project.name}</div>
                  {sampleCount === 0 ? (
                    <div className="text-[10px] text-motion-muted">No tracked sessions yet.</div>
                  ) : (
                    <div className="text-[10px] text-motion-muted">
                      {sampleCount} tasks / {Math.round(plannedMinutes)}m planned / {Math.round(actualMinutes)}m actual
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-motion-muted">Current</div>
                  <div className="text-xs font-mono text-white">{project.velocity.toFixed(2)}x</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-motion-muted">Suggested</div>
                  <div className="text-xs font-mono text-white">{isReady ? `${suggestedVelocity.toFixed(2)}x` : 'n/a'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-motion-muted">Confidence</div>
                  <div className={`text-xs font-semibold ${confidence === 'High' ? 'text-emerald-300' : confidence === 'Medium' ? 'text-yellow-300' : 'text-motion-muted'}`}>{confidence}</div>
                </div>
                <div className="text-right min-w-[70px]">
                  <div className="text-[10px] text-motion-muted">Bias</div>
                  <div className={`text-xs font-semibold ${optimismRatio > 1.1 ? 'text-rose-300' : optimismRatio < 0.9 ? 'text-emerald-300' : 'text-sky-300'}`}>
                    {sampleCount === 0 ? 'n/a' : `${optimismRatio.toFixed(2)}x`}
                  </div>
                </div>
                <div className="text-right min-w-[70px]">
                  <div className="text-[10px] text-motion-muted">Delta</div>
                  {isReady ? (
                    <div className={`text-xs font-semibold ${Math.abs(delta) < 0.05 ? 'text-motion-muted' : delta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-motion-muted">-</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onApplySuggestedVelocity?.(project.id, suggestedVelocity)}
                  disabled={!canApply}
                  className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-colors ${
                    canApply ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-white/5 text-motion-muted cursor-not-allowed'
                  }`}
                >
                  Apply
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-motion-muted mt-3">Suggested velocity is based on tracked actual time for completed tasks.</p>
      </div>

      {/* Scheduling Fit */}
      <div className="md:col-span-2 bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-400" /> Scheduling Fit
          </h3>
          <span className="text-xs text-motion-muted">Energy alignment and time window compliance.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] text-motion-muted uppercase tracking-wider">Energy alignment</div>
            <div className="text-2xl font-mono font-bold text-white">
              {scheduleFit.energyTaggedCount === 0
                ? '--'
                : `${Math.round((scheduleFit.energyAlignedCount / scheduleFit.energyTaggedCount) * 100)}%`}
            </div>
            <div className="text-[10px] text-motion-muted">
              {scheduleFit.energyTaggedCount === 0
                ? 'No energy-tagged tasks scheduled.'
                : `${scheduleFit.energyAlignedCount}/${scheduleFit.energyTaggedCount} tasks aligned`}
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-emerald-500/60"
                style={{
                  width: scheduleFit.energyTaggedCount === 0
                    ? '0%'
                    : `${Math.round((scheduleFit.energyAlignedCount / scheduleFit.energyTaggedCount) * 100)}%`
                }}
              />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] text-motion-muted uppercase tracking-wider">Time windows respected</div>
            <div className="text-2xl font-mono font-bold text-white">
              {scheduleFit.windowTaggedCount === 0
                ? '--'
                : `${Math.round((scheduleFit.windowAlignedCount / scheduleFit.windowTaggedCount) * 100)}%`}
            </div>
            <div className="text-[10px] text-motion-muted">
              {scheduleFit.windowTaggedCount === 0
                ? 'No window-constrained tasks scheduled.'
                : `${scheduleFit.windowAlignedCount}/${scheduleFit.windowTaggedCount} within window`}
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-sky-500/60"
                style={{
                  width: scheduleFit.windowTaggedCount === 0
                    ? '0%'
                    : `${Math.round((scheduleFit.windowAlignedCount / scheduleFit.windowTaggedCount) * 100)}%`
                }}
              />
            </div>
          </div>
        </div>
        {scheduleFit.windowTaggedCount > 0 && scheduleFit.windowAlignedCount < scheduleFit.windowTaggedCount && (
          <p className="mt-3 text-[10px] text-motion-muted">
            Some tasks are outside their defined time windows. Review warnings in the calendar.
          </p>
        )}
      </div>

      {/* Schedule Timeline & Dependencies */}
      <div className="md:col-span-2 bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Timer className="w-5 h-5 text-brand-400" /> Schedule Timeline
            </h3>
            <p className="text-xs text-motion-muted">Gantt-style view of scheduled work, dependencies, and fixed slots.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
              {TIMELINE_HORIZON_OPTIONS.map(days => (
                <button
                  key={days}
                  onClick={() => setTimelineHorizon(days)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${timelineHorizon === days ? 'bg-white/10 text-white' : 'text-motion-muted hover:text-white'}`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-motion-muted">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-400"></span>
            {timelineStats.scheduledCount} scheduled
          </span>
          <span className="flex items-center gap-2">
            <LinkIcon className="w-3 h-3" />
            {timelineStats.dependencyCount} dependencies
          </span>
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-yellow-400" />
            {timelineStats.blockedCount} blocked
          </span>
        </div>

        <div className="mt-4 border border-motion-border rounded-xl bg-motion-panel/30 overflow-hidden">
          {timelineRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-motion-muted">
              No scheduled tasks in this horizon yet. Try auto-scheduling to populate the timeline.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-auto custom-scrollbar">
              <div style={{ minWidth: `${TIMELINE_LABEL_WIDTH + timelineWidth}px` }} className="relative">
                <div className="flex sticky top-0 z-20 bg-motion-panel/90 border-b border-motion-border">
                  <div className="sticky left-0 z-30 w-[220px] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-motion-muted bg-motion-panel/95 border-r border-motion-border">
                    Task
                  </div>
                  <div className="relative flex-1" style={{ width: timelineWidth, height: 32 }}>
                    {timelineDays.map((day, index) => {
                      const isCurrent = isSameDay(day, new Date());
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <div
                          key={day.toISOString()}
                          className={`absolute top-0 bottom-0 border-r border-motion-grid ${isWeekend ? 'bg-white/[0.02]' : ''}`}
                          style={{ left: index * TIMELINE_DAY_WIDTH, width: TIMELINE_DAY_WIDTH }}
                        >
                          <div className={`px-2 py-1 text-[10px] ${isCurrent ? 'text-brand-400 font-semibold' : 'text-motion-muted'}`}>
                            {format(day, 'MMM d')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="relative" style={{ height: timelineHeight }}>
                  <div className="absolute left-[220px] top-0 h-full pointer-events-none" style={{ width: timelineWidth }}>
                    {timelineDays.map((day, index) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <div
                          key={`${day.toISOString()}-grid`}
                          className={`absolute top-0 bottom-0 border-r border-motion-grid/60 ${isWeekend ? 'bg-white/[0.02]' : ''}`}
                          style={{ left: index * TIMELINE_DAY_WIDTH, width: TIMELINE_DAY_WIDTH }}
                        />
                      );
                    })}
                  </div>

                  <svg
                    className="absolute left-[220px] top-0 z-10 pointer-events-none"
                    width={timelineWidth}
                    height={timelineHeight}
                  >
                    <defs>
                      <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" />
                      </marker>
                    </defs>
                    {dependencyLinks.map((link, index) => {
                      const fromX = link.from.barStart + link.from.barWidth;
                      const toX = link.to.barStart;
                      const fromY = link.from.rowIndex * TIMELINE_ROW_HEIGHT + TIMELINE_ROW_HEIGHT / 2;
                      const toY = link.to.rowIndex * TIMELINE_ROW_HEIGHT + TIMELINE_ROW_HEIGHT / 2;
                      const midX = fromX + 10;
                      const path = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
                      return (
                        <path
                          key={`${link.from.task.id}-${link.to.task.id}-${index}`}
                          d={path}
                          stroke="#38bdf8"
                          strokeWidth="1"
                          fill="none"
                          markerEnd="url(#dep-arrow)"
                          opacity="0.7"
                        />
                      );
                    })}
                  </svg>

                  {timelineRows.map(row => (
                    <div
                      key={row.task.id}
                      className="flex items-center border-b border-motion-border/40 last:border-b-0 box-border"
                      style={{ height: TIMELINE_ROW_HEIGHT }}
                    >
                      <div className="sticky left-0 z-20 w-[220px] px-3 text-xs text-motion-text bg-motion-panel/90 border-r border-motion-border flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }}></span>
                        <span className={`truncate ${row.blocked ? 'text-motion-muted line-through' : ''}`}>{row.task.title}</span>
                        <div className="ml-auto flex items-center gap-1 text-motion-muted">
                          {row.task.isFixed && <Lock className="w-3 h-3" />}
                          {row.task.dependencies?.length ? <LinkIcon className="w-3 h-3" /> : null}
                          {row.task.deadline ? <CalendarClock className="w-3 h-3" /> : null}
                        </div>
                      </div>
                      <div className="relative flex-1" style={{ width: timelineWidth }}>
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-md border shadow-sm ${row.blocked ? 'bg-white/5 border-white/10' : 'border-white/10'}`}
                          style={{
                            left: row.barStart,
                            width: row.barWidth,
                            backgroundColor: row.blocked ? undefined : `${row.color}35`
                          }}
                        >
                          <div className="px-2 text-[10px] font-semibold text-white/90 truncate">
                            {format(row.start, 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Constraint Matrix */}
      <div className="md:col-span-2 bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-brand-400" /> Constraint Matrix
          </h3>
          <span className="text-xs text-motion-muted">Deadlines, dependencies, fixed events, and rescheduling pressure.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {constraintCards.map(card => {
            const count = card.tasks.length;
            const preview = card.tasks.slice(0, 2).map(task => task.title).join(' / ');
            const Icon = card.icon;
            return (
              <div key={card.id} className={`rounded-xl border ${card.border} ${card.bg} p-4`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${card.accent}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {card.label}
                  </div>
                  <div className="text-xl font-mono font-bold text-white">{count}</div>
                </div>
                <div className="mt-2 text-[11px] text-motion-muted">
                  {count === 0 ? 'All clear' : preview}
                  {count > 2 ? ` +${count - 2} more` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Duration Spectrum */}
      <div className="md:col-span-2 bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-brand-400" /> Duration Spectrum
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-xs text-motion-muted">
            <span>Total {durationSummary.totalHours.toFixed(1)}h planned</span>
            <span>Avg {Math.round(durationSummary.averageMinutes)}m</span>
            <span>Longest {Math.round(durationSummary.longestMinutes)}m</span>
          </div>
        </div>
        <div className="flex-1 w-full min-h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={durationData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#27272A' }}
                contentStyle={{ backgroundColor: '#18191B', borderColor: '#27272A', borderRadius: '8px', color: '#fff' }}
                formatter={(value, name, props) => {
                  if (name === 'tasks') {
                    return [`${value} tasks`, 'Count'];
                  }
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  const hours = payload?.[0]?.payload?.hours ?? 0;
                  return `${label} - ${hours}h`;
                }}
              />
              <Bar dataKey="tasks" radius={[6, 6, 6, 6]}>
                {durationData.map((entry, index) => (
                  <Cell key={`duration-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-motion-muted">Counts of upcoming tasks by estimated duration bucket.</p>
      </div>

      {/* Project Distribution */}
      <div className="bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <h3 className="text-lg font-bold text-white mb-4">Focus Distribution</h3>
        <div className="flex-1 w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={projectData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {projectData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#18191B', borderColor: '#27272A', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
            {projectData.map(p => (
                <div key={p.name} className="flex items-center gap-1 text-xs text-motion-muted">
                    <span className="w-2 h-2 rounded-full" style={{background: p.color}}></span>
                    {p.name}
                </div>
            ))}
        </div>
      </div>

      {/* Workload */}
      <div className="bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col">
        <h3 className="text-lg font-bold text-white mb-4">Upcoming Workload</h3>
        <div className="flex-1 w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workloadData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
              <YAxis hide />
              <Tooltip 
                cursor={{fill: '#27272A'}} 
                contentStyle={{ backgroundColor: '#18191B', borderColor: '#27272A', borderRadius: '8px', color: '#fff' }}
              />
              <Bar dataKey="hours" fill="#0ea5e9" radius={[4, 4, 4, 4]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-sm text-motion-muted mt-2">Scheduled hours (Mon-Fri)</p>
      </div>

      {/* Velocity Chart */}
      <div className="bg-motion-card p-6 rounded-xl border border-motion-border shadow-sm flex flex-col md:col-span-2">
        <h3 className="text-lg font-bold text-white mb-1">Velocity Tracking</h3>
        <p className="text-xs text-motion-muted mb-4">Planned vs. Actual duration for recent tasks</p>
        <div className="flex-1 w-full min-h-[250px]">
          {velocityData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-motion-muted bg-white/5 border border-white/10 rounded-xl">
              Track time in Focus Mode to unlock velocity insights.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" tick={{fill: '#71717a', fontSize: 10}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#71717a', fontSize: 10}} axisLine={false} tickLine={false} unit="m" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18191B', borderColor: '#27272A', borderRadius: '8px', color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="Planned" fill="#71717a" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Actual" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
