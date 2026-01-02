
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Task, Project, CalendarView, Priority } from '../types';
import { 
  format, 
  startOfWeek, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  endOfWeek, 
  eachDayOfInterval,
  isSameDay, 
  isToday, 
  isSameMonth,
  setHours,
  setMinutes,
  areIntervalsOverlapping
} from 'date-fns';
import { Lock, Sparkles, AlertCircle, AlertTriangle, Filter, ChevronDown } from 'lucide-react';
import { isTaskBlocked, getProjectColor } from '../utils/helpers';

interface CalendarProps {
  date: Date;
  tasks: Task[];
  projects: Project[];
  view: CalendarView;
  onTaskMove?: (taskId: string, newStart: Date) => void;
  onTaskClick?: (task: Task) => void;
  onTaskResize?: (taskId: string, newDuration: number) => void;
  onResolveConflicts?: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PIXELS_PER_MINUTE = 1.6; // Slightly taller for better legibility

// Check for conflicts
const hasConflicts = (tasks: Task[]): boolean => {
    const scheduled = tasks.filter(t => t.scheduledStart && t.scheduledEnd && t.projectId !== 'system-break');
    for (let i = 0; i < scheduled.length; i++) {
        for (let j = i + 1; j < scheduled.length; j++) {
            const a = scheduled[i];
            const b = scheduled[j];
            if (areIntervalsOverlapping(
                { start: new Date(a.scheduledStart!), end: new Date(a.scheduledEnd!) },
                { start: new Date(b.scheduledStart!), end: new Date(b.scheduledEnd!) }
            )) {
                return true;
            }
        }
    }
    return false;
};

// Helper to calculate layout for overlapping events
const calculateEventLayout = (tasks: Task[]): Map<string, React.CSSProperties> => {
  const sortedTasks = [...tasks].sort((a, b) => {
      const startA = new Date(a.scheduledStart!).getTime();
      const startB = new Date(b.scheduledStart!).getTime();
      return startA - startB;
  });

  const layoutMap = new Map<string, React.CSSProperties>();
  if (sortedTasks.length === 0) return layoutMap;

  const clusters: Task[][] = [];
  let currentCluster: Task[] = [];
  let clusterEnd = 0;

  for (const task of sortedTasks) {
      const start = new Date(task.scheduledStart!).getTime();
      const end = new Date(task.scheduledEnd!).getTime();

      if (currentCluster.length === 0) {
          currentCluster.push(task);
          clusterEnd = end;
      } else {
          if (start < clusterEnd) {
              currentCluster.push(task);
              if (end > clusterEnd) clusterEnd = end;
          } else {
              clusters.push(currentCluster);
              currentCluster = [task];
              clusterEnd = end;
          }
      }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  for (const cluster of clusters) {
      const columns: Task[][] = [];
      
      for (const task of cluster) {
          let placed = false;
          const start = new Date(task.scheduledStart!).getTime();
          
          for (let i = 0; i < columns.length; i++) {
              const colTasks = columns[i];
              const lastTask = colTasks[colTasks.length - 1];
              const lastEnd = new Date(lastTask.scheduledEnd!).getTime();
              
              if (lastEnd <= start) {
                  colTasks.push(task);
                  placed = true;
                  break;
              }
          }
          
          if (!placed) {
              columns.push([task]);
          }
      }
      
      const numColumns = columns.length;
      const widthPercent = 100 / numColumns;
      
      columns.forEach((colTasks, colIndex) => {
          colTasks.forEach(task => {
              layoutMap.set(task.id, {
                  width: `calc(${widthPercent}% - 6px)`,
                  left: `calc(${colIndex * widthPercent}% + 3px)`,
                  zIndex: 10 + colIndex,
              });
          });
      });
  }

  return layoutMap;
};

// Extracted EventBlock with new styling
const EventBlock = React.memo(({ 
    task, 
    blocked, 
    color, 
    onTaskMove,
    onTaskClick,
    onTaskResize,
    style
}: { 
    task: Task, 
    blocked: boolean, 
    color: string, 
    onTaskMove?: (taskId: string, newStart: Date) => void,
    onTaskClick?: (task: Task) => void,
    onTaskResize?: (taskId: string, newDuration: number) => void,
    style?: React.CSSProperties
}) => {
    const start = new Date(task.scheduledStart!);
    const end = new Date(task.scheduledEnd!);
    
    const offsetMinutes = start.getHours() * 60 + start.getMinutes();
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const isHighPriority = task.priority === Priority.HIGH;
    const isShort = durationMinutes <= 25;
    
    const handleResizeStart = (e: React.MouseEvent) => {
      if (blocked || !onTaskResize) return;
      e.stopPropagation();
      e.preventDefault();

      const startY = e.clientY;
      const startHeight = durationMinutes * PIXELS_PER_MINUTE;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Optimistic UI updates could happen here
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        const deltaY = upEvent.clientY - startY;
        const newHeight = Math.max(15 * PIXELS_PER_MINUTE, startHeight + deltaY);
        const snappedMinutes = Math.round((newHeight / PIXELS_PER_MINUTE) / 15) * 15;
        
        if (snappedMinutes !== durationMinutes) {
          onTaskResize(task.id, snappedMinutes);
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };
    
    return (
      <div
        draggable={!blocked && !!onTaskMove}
        onDragStart={(e) => {
             e.dataTransfer.setData('taskId', task.id);
             e.dataTransfer.effectAllowed = 'move';
             e.currentTarget.style.opacity = '0.5';
        }}
        onDragEnd={(e) => {
             e.currentTarget.style.opacity = '1';
        }}
        onClick={(e) => {
            e.stopPropagation();
            onTaskClick?.(task);
        }}
        className={`absolute rounded-lg shadow-sm cursor-grab active:cursor-grabbing overflow-hidden group hover:z-50 transition-all duration-200 flex flex-col backdrop-blur-sm
        ${isShort ? 'justify-center px-2' : 'p-2'}
        ${blocked ? 'grayscale opacity-60 cursor-not-allowed border border-white/5 bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8cGF0aCBkPSJNLTEgNUw1IC0xTDUgMkwyIDV6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+")]' : 'hover:shadow-lg hover:brightness-110 ring-1 ring-inset ring-white/10'}`}
        style={{
          top: `${offsetMinutes * PIXELS_PER_MINUTE}px`,
          height: `${durationMinutes * PIXELS_PER_MINUTE}px`, 
          backgroundColor: blocked ? undefined : `${color}25`, // 15% opacity
          borderLeft: !blocked ? `3px solid ${color}` : undefined,
          ...style
        }}
      >
        <div className={`flex items-center gap-1.5 relative z-10 min-w-0 ${isShort ? '' : 'mb-0.5'}`}>
             {task.schedulingReason && !task.isFixed && <Sparkles className="w-3 h-3 text-brand-400 shrink-0 animate-pulse" />}
             {task.isFixed && <span className="text-[10px] opacity-70">🔒</span>}
             {blocked && <Lock className="w-3 h-3 text-red-300" />}
             {isHighPriority && !blocked && <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />}
             
             <span className={`font-semibold truncate text-[11px] leading-tight ${isHighPriority ? 'text-white' : 'text-white/90'}`}>
                {task.title}
             </span>
        </div>
        
        {!isShort && durationMinutes > 30 && (
             <div className="text-white/50 truncate text-[10px] font-medium flex justify-between relative z-10 mt-0.5">
                <span>{format(start, 'h:mm')} - {format(end, 'h:mm a')}</span>
             </div>
        )}
        
        {/* Resize Handle - cleaner */}
        {!blocked && !isShort && (
            <div 
              onMouseDown={handleResizeStart}
              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 flex items-end justify-center pb-0.5 transition-opacity z-20 hover:bg-white/5"
            >
                <div className="w-8 h-0.5 bg-white/30 rounded-full" />
            </div>
        )}
      </div>
    );
});

// Improved Time Indicator
const TimeIndicator = ({ weekDays }: { weekDays: Date[] }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const currentDayIndex = currentTime.getDay() === 0 ? 6 : currentTime.getDay() - 1;
    const isVisible = weekDays.some(d => isSameDay(d, currentTime));
    const currentTimeTop = (currentTime.getHours() * 60 + currentTime.getMinutes()) * PIXELS_PER_MINUTE;

    if (!isVisible) return null;

    return (
        <div className="absolute h-[2px] bg-brand-500 z-30 pointer-events-none flex items-center shadow-glow"
            style={{ 
            top: `${currentTimeTop}px`,
            left: `calc(4rem + (${currentDayIndex} * ((100% - 4rem) / 7)))`,
            width: `calc((100% - 4rem) / 7)`
            }}
        >
            <div className="w-2.5 h-2.5 rounded-full bg-brand-500 -ml-1.5 border-2 border-motion-bg shadow-sm"></div>
        </div>
    );
};

const Calendar: React.FC<CalendarProps> = ({ date, tasks, projects, view, onTaskMove, onTaskClick, onTaskResize, onResolveConflicts }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  
  const filteredTasks = useMemo(() => {
      if (filterProjectId === 'all') return tasks;
      return tasks.filter(t => t.projectId === filterProjectId);
  }, [tasks, filterProjectId]);

  const conflictsExist = useMemo(() => hasConflicts(filteredTasks), [filteredTasks]);

  useEffect(() => {
    if (view === 'week' && scrollRef.current) {
        scrollRef.current.scrollTop = 810; 
    }
  }, [view, date]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [date]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [date]);

  // Memoize layouts to avoid recalculation on every render
  const dayLayouts = useMemo(() => {
     if (view !== 'week') return [];
     return weekDays.map(day => {
         const dayTasks = filteredTasks
            .filter(t => t.scheduledStart && isSameDay(new Date(t.scheduledStart), day))
            .filter(t => t.projectId !== 'system-break');
         return {
             day,
             tasks: dayTasks,
             layout: calculateEventLayout(dayTasks)
         };
     });
  }, [weekDays, filteredTasks, view]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('taskId');
      if (!taskId || !onTaskMove) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      
      const minutes = offsetY / PIXELS_PER_MINUTE;
      const snappedMinutes = Math.round(minutes / 15) * 15;
      const finalMinutes = Math.max(0, Math.min(1440 - 15, snappedMinutes));
      
      const newStart = setMinutes(setHours(day, 0), finalMinutes);
      onTaskMove(taskId, newStart);
  };

  const renderWeekView = () => {
    return (
      <div className="flex flex-col h-full bg-motion-bg relative">
        
        {/* Calendar Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-motion-bg border-b border-motion-border">
            <div className="flex items-center gap-2">
                <div className="relative group">
                    <button className="flex items-center gap-2 text-xs font-medium text-motion-muted hover:text-white px-2 py-1 hover:bg-white/5 rounded-lg transition-colors">
                        <Filter className="w-3 h-3" />
                        {filterProjectId === 'all' ? 'All Projects' : projects.find(p => p.id === filterProjectId)?.name}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-motion-panel border border-motion-border rounded-xl shadow-2xl hidden group-hover:block z-50 p-1">
                        <button onClick={() => setFilterProjectId('all')} className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors ${filterProjectId === 'all' ? 'text-brand-400' : 'text-motion-text'}`}>All Projects</button>
                        {projects.map(p => (
                            <button key={p.id} onClick={() => setFilterProjectId(p.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors flex items-center gap-2 ${filterProjectId === p.id ? 'text-brand-400' : 'text-motion-text'}`}>
                                <span className="w-2 h-2 rounded-full" style={{backgroundColor: p.color}}></span>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Scrollable Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar relative scroll-smooth">
            
            {/* Conflict Notification Overlay */}
            {conflictsExist && onResolveConflicts && (
                <div className="absolute top-16 right-4 z-40 animate-in slide-in-from-top-4">
                    <button 
                        onClick={onResolveConflicts}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md transition-all hover:scale-105"
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Fix Conflicts
                    </button>
                </div>
            )}

            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-motion-bg/95 backdrop-blur-md border-b border-motion-border flex flex-shrink-0">
            <div className="w-16 flex-shrink-0 border-r border-motion-border bg-transparent" />
            <div className="flex-1 flex min-w-0">
                {weekDays.map((day, i) => {
                    const isCurrent = isToday(day);
                    const dayLoad = filteredTasks
                        .filter(t => t.scheduledStart && isSameDay(new Date(t.scheduledStart), day))
                        .reduce((acc, t) => acc + t.durationMinutes, 0) / 60;
                    
                    const loadColor = dayLoad > 8 ? 'text-red-400' : dayLoad > 6 ? 'text-yellow-400' : 'text-motion-muted';

                    return (
                        <div key={i} className={`flex-1 flex flex-col items-center justify-center py-3 border-r border-motion-border/30 last:border-r-0 group`}>
                            <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isCurrent ? 'text-brand-500' : 'text-motion-muted'}`}>
                                {format(day, 'EEE')}
                            </span>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isCurrent ? 'bg-brand-600 text-white shadow-glow scale-105' : 'text-motion-text hover:bg-white/5'}`}>
                                {format(day, 'd')}
                            </div>
                            <span className={`text-[9px] font-mono mt-1 opacity-50 group-hover:opacity-100 transition-opacity ${loadColor}`}>
                                {dayLoad > 0 ? `${dayLoad.toFixed(1)}h` : '-'}
                            </span>
                        </div>
                    );
                })}
            </div>
            </div>

            <div className="relative w-full" style={{ height: `${24 * 60 * PIXELS_PER_MINUTE}px` }}> 
                {/* Grid */}
                {HOURS.map((hour) => (
                <div key={hour} className="absolute w-full flex pointer-events-none" style={{ top: `${hour * 60 * PIXELS_PER_MINUTE}px` }}>
                    <div className="absolute left-0 w-16 text-right pr-4 text-[10px] text-motion-muted -mt-2 font-mono opacity-50">
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                    </div>
                    <div className="ml-16 flex-1 border-t border-motion-grid w-full" />
                </div>
                ))}

                {/* Current Time Indicator */}
                <TimeIndicator weekDays={weekDays} />

                {/* Vertical Lines */}
                <div className="absolute left-16 right-0 top-0 bottom-0 flex pointer-events-none">
                    {Array.from({length: 7}).map((_, i) => (
                        <div key={i} className="flex-1 border-r border-motion-grid h-full last:border-r-0" />
                    ))}
                </div>

                {/* Events */}
                <div className="absolute left-16 right-0 top-0 bottom-0 flex">
                {dayLayouts.map(({ day, tasks: dayTasks, layout }, colIndex) => {
                    return (
                    <div 
                        key={colIndex} 
                        className="flex-1 relative h-full transition-colors hover:bg-white/[0.01]"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDragEnter={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, day)}
                    >
                        {dayTasks.map(task => {
                            const blocked = isTaskBlocked(task, filteredTasks);
                            const color = getProjectColor(projects, task.projectId);
                            const layoutStyle = layout.get(task.id);

                            return (
                                <EventBlock 
                                    key={task.id} 
                                    task={task} 
                                    blocked={blocked} 
                                    color={color} 
                                    onTaskMove={onTaskMove}
                                    onTaskClick={onTaskClick}
                                    onTaskResize={onTaskResize}
                                    style={layoutStyle}
                                />
                            );
                        })}
                    </div>
                    );
                })}
                </div>
            </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => (
    <div className="flex flex-col h-full bg-motion-bg overflow-y-auto custom-scrollbar p-1">
        <div className="sticky top-0 z-30 bg-motion-panel border-b border-motion-border grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="py-3 text-center text-[10px] font-bold text-motion-muted uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-[600px] gap-1">
          {monthDays.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, date);
            const dayTasks = filteredTasks
                .filter(t => t.scheduledStart && isSameDay(new Date(t.scheduledStart), day))
                .filter(t => t.projectId !== 'system-break'); 

            return (
              <div key={i} 
                onClick={() => {}}
                className={`min-h-[100px] rounded-lg p-2 flex flex-col gap-1 transition-colors ${!isCurrentMonth ? 'bg-white/[0.02] opacity-50' : 'bg-motion-card hover:bg-motion-cardHover'}`}>
                <div className={`text-xs font-medium text-right mb-1 ${isToday(day) ? 'text-brand-500' : 'text-motion-muted'}`}>
                  {isToday(day) ? <span className="bg-brand-600 text-white w-6 h-6 rounded-full flex items-center justify-center ml-auto shadow-md">{format(day, 'd')}</span> : format(day, 'd')}
                </div>
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {dayTasks.slice(0, 4).map(task => {
                    const color = getProjectColor(projects, task.projectId);
                    return (
                        <div key={task.id} 
                           onClick={(e) => {
                              e.stopPropagation();
                              onTaskClick?.(task);
                           }}
                           className="text-[10px] truncate px-2 py-1 rounded-md text-white/90 font-medium flex items-center gap-1.5 border-l-2 cursor-pointer hover:brightness-110 shadow-sm transition-transform hover:scale-[1.02]"
                           title={task.title}
                           style={{ backgroundColor: `${color}15`, borderColor: color }}>
                          <span className="truncate">{task.title}</span>
                        </div>
                    );
                  })}
                  {dayTasks.length > 4 && <div className="text-[10px] text-motion-muted pl-1 font-medium text-right">+ {dayTasks.length - 4} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
  );

  return view === 'month' ? renderMonthView() : renderWeekView();
};

export default Calendar;
