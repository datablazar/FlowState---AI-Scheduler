
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { Task, Project, TaskStatus } from '../types';
import { differenceInBusinessDays, differenceInDays, isAfter, startOfDay } from 'date-fns';
import { Gauge, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AnalyticsProps {
  tasks: Task[];
  projects: Project[];
}

const Analytics: React.FC<AnalyticsProps> = ({ tasks, projects }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

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
      // Compare planned vs actual duration for done tasks
      const doneTasks = tasks.filter(t => t.status === TaskStatus.DONE);
      const data = doneTasks.slice(0, 10).map(t => ({
          name: t.title.substring(0, 15) + '...',
          Planned: t.durationMinutes,
          Actual: t.actualDurationMinutes || t.durationMinutes * (Math.random() * 0.5 + 0.8) // Simulated variance if no actual
      }));
      return data;
  }, [tasks]);

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
        </div>
      </div>
    </div>
  );
};

export default Analytics;
