import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MacWindow } from './components/MacWindow';
import { Sidebar, StoredNavConfig, NAV_ITEMS_DEF } from './components/Sidebar';
import { Heatmap } from './components/Heatmap';
import { InsightsPanel } from './components/InsightsPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import { TimerPanel } from './components/TimerPanel';
import { CountdownPanel } from './components/CountdownPanel';
import { CalendarPanel } from './components/CalendarPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { StudyLog, ViewMode, HeatmapTheme, UserGoals, Project, CustomEvent } from './types';
import * as storage from './services/storageService';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  
  // Lazy init for projects to ensure initial render has data
  const [projects, setProjects] = useState<Project[]>(() => storage.getProjects());
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
      const p = storage.getProjects();
      return p.length > 0 ? p[0].id : '';
  });

  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [goals, setGoals] = useState<UserGoals>({ weekly: 40, monthly: 160, yearly: 2000 });
  
  // Dashboard state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hoursInput, setHoursInput] = useState<number | string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [heatmapTheme, setHeatmapTheme] = useState<HeatmapTheme>('green');
  
  // Goals Editing State
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState<UserGoals>(goals);
  const [goalViewMode, setGoalViewMode] = useState<'rings' | 'bars' | 'pie'>('rings');
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const goalSettingsRef = useRef<HTMLDivElement>(null);

  // Sidebar Config State (Lifted from Sidebar)
  const [navConfig, setNavConfig] = useState<StoredNavConfig[]>([]);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('focusflow_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Reminder Logic State
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Load Logs
    let loadedLogs = storage.getLogs();
    
    if (loadedLogs.length === 0) {
      loadedLogs = storage.seedData(); 
    }
    setLogs(loadedLogs);
    const loadedGoals = storage.getGoals();
    setGoals(loadedGoals);
    setTempGoals(loadedGoals);
    
    // Set theme for initial project if needed
    if (currentProjectId) {
        const p = projects.find(proj => proj.id === currentProjectId);
        if (p) setHeatmapTheme(p.theme);
    }

    // Load Sidebar Config
    const savedConfig = localStorage.getItem('focusflow_sidebar_config_v1');
    if (savedConfig) {
        try {
            const parsed = JSON.parse(savedConfig) as StoredNavConfig[];
            // Merge with defaults to ensure all items exist if updated app
            const merged = [...parsed];
            NAV_ITEMS_DEF.forEach(def => {
                if (!merged.find(item => item.view === def.view)) {
                    merged.push({ view: def.view, isVisible: true });
                }
            });
            setNavConfig(merged);
        } catch (e) {
            setNavConfig(NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true })));
        }
    } else {
        setNavConfig(NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true })));
    }

    // Request Notification Permission
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // Start Reminder Check Interval
    const reminderInterval = setInterval(checkReminders, 30000); // Check every 30 seconds

    // Click outside listener for Goal Settings
    const handleClickOutside = (event: MouseEvent) => {
        if (goalSettingsRef.current && !goalSettingsRef.current.contains(event.target as Node)) {
            setShowGoalSettings(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
        clearInterval(reminderInterval);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUpdateNavConfig = (newConfig: StoredNavConfig[]) => {
      setNavConfig(newConfig);
      localStorage.setItem('focusflow_sidebar_config_v1', JSON.stringify(newConfig));
  };

  const checkReminders = () => {
      if (Notification.permission !== "granted") return;

      const events = storage.getCustomEvents();
      const now = new Date();
      
      events.forEach(event => {
          if (!event.reminderMinutes || !event.time) return;
          
          // Helper to check if event occurs today
          // This is a simplified version of CalendarPanel logic
          const parts = event.date.split('-');
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          
          const eventDateObj = new Date(y, m - 1, d);
          const todayStr = now.toISOString().split('T')[0];
          
          let occursToday = false;
          
          if (event.recurrence === 'daily') {
               occursToday = now >= eventDateObj;
          } else if (event.recurrence === 'weekly') {
               occursToday = now >= eventDateObj && now.getDay() === eventDateObj.getDay();
          } else if (event.recurrence === 'monthly') {
               occursToday = now >= eventDateObj && now.getDate() === eventDateObj.getDate();
          } else {
               occursToday = event.date === todayStr;
          }

          if (occursToday) {
              const partsTime = event.time?.split(':') || ['0', '0'];
              const h = parseInt(partsTime[0], 10);
              const min = parseInt(partsTime[1], 10);
              
              const eventTime = new Date(now);
              eventTime.setHours(h, min, 0, 0);

              const triggerTime = new Date(eventTime.getTime() - (event.reminderMinutes! * 60 * 1000));
              
              // If we are past the trigger time but within a 2-minute window, and haven't notified yet
              // (Using 2 mins to be safe with 30s interval)
              const diff = now.getTime() - triggerTime.getTime();
              
              // Notification Window: 0 to 90 seconds after trigger
              if (diff >= 0 && diff < 90000) {
                  // Unique ID for today's occurrence to prevent re-notify
                  const occurrenceId = `${event.id}-${todayStr}`;
                  
                  if (!notifiedEventsRef.current.has(occurrenceId)) {
                      new Notification(`Reminder: ${event.title}`, {
                          body: `Event starts in ${event.reminderMinutes} minutes.`,
                          icon: '/favicon.ico' 
                      });
                      notifiedEventsRef.current.add(occurrenceId);
                  }
              }
          }
      });
  };

  // Update theme when project changes
  useEffect(() => {
      const project = projects.find(p => p.id === currentProjectId);
      if (project) {
          setHeatmapTheme(project.theme);
      }
      
      // Update form inputs if date selected
      const projectLog = logs.find(l => l.date === selectedDate && l.projectId === currentProjectId);
      setHoursInput(projectLog ? projectLog.hours : '');
      setNotesInput(projectLog ? projectLog.notes || '' : '');
      
  }, [currentProjectId, projects, selectedDate, logs]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('focusflow_theme', newMode ? 'dark' : 'light');
  };

  const handleUpdateGoals = (newGoals: UserGoals) => {
      setGoals(newGoals);
      setTempGoals(newGoals);
      storage.saveGoals(newGoals);
      setIsEditingGoals(false);
  };

  const saveLogEntry = (date: string, hours: number, notes?: string, customProjectId?: string) => {
      const targetProject = customProjectId || currentProjectId;
      if (!targetProject) return;
      
      const newLogs = storage.saveLog({
          date: date,
          hours: hours,
          notes: notes,
          projectId: targetProject
      });
      setLogs(newLogs);
      
      // Update form inputs if we are viewing that date AND that project
      if (selectedDate === date && targetProject === currentProjectId) {
          setHoursInput(hours);
          setNotesInput(notes || '');
      }
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hoursInput);
    if (isNaN(h) || h < 0 || h > 24) return;
    saveLogEntry(selectedDate, h, notesInput);
  };

  const handleTimerSave = (sessionHours: number, sessionNote?: string, sessionProjectId?: string) => {
      const targetProject = sessionProjectId || currentProjectId;
      if (!targetProject) return;
      
      const today = new Date().toISOString().split('T')[0];
      const existing = logs.find(l => l.date === today && l.projectId === targetProject);
      
      const totalHours = (existing ? existing.hours : 0) + sessionHours;
      const mergedNotes = existing 
          ? (existing.notes ? existing.notes + '; ' + sessionNote : sessionNote)
          : sessionNote;

      saveLogEntry(today, totalHours, mergedNotes, targetProject);
  };
  
  const handleDeleteLog = () => {
      const confirmed = window.confirm("Are you sure you want to delete this entry?");
      if (confirmed && currentProjectId) {
          const newLogs = storage.deleteLog(selectedDate, currentProjectId);
          setLogs(newLogs);
          setHoursInput('');
          setNotesInput('');
      }
  };

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    const existing = logs.find(l => l.date === date && l.projectId === currentProjectId);
    setHoursInput(existing ? existing.hours : '');
    setNotesInput(existing ? existing.notes || '' : '');
    
    // If not on Dashboard, switch to it to show the form
    if (currentView !== ViewMode.DASHBOARD) {
        setCurrentView(ViewMode.DASHBOARD);
    }
  };
  
  const handleEditLogFromStats = (date: string) => {
      handleDayClick(date);
      setCurrentView(ViewMode.DASHBOARD);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const date = e.target.value;
      setSelectedDate(date);
      const existing = logs.find(l => l.date === date && l.projectId === currentProjectId);
      setHoursInput(existing ? existing.hours : '');
      setNotesInput(existing ? existing.notes || '' : '');
  };

  // --- Project Handlers ---
  const handleCreateProject = (name: string, theme: HeatmapTheme) => {
      const newProject: Project = {
          id: Date.now().toString(),
          name,
          theme,
          createdAt: new Date().toISOString()
      };
      const updatedProjects = storage.saveProject(newProject);
      setProjects(updatedProjects);
      setCurrentProjectId(newProject.id);
  };

  const handleDeleteProject = (id: string) => {
      const updatedProjects = storage.deleteProject(id);
      setProjects(updatedProjects);
      // If deleted active project, switch to first available
      if (currentProjectId === id && updatedProjects.length > 0) {
          setCurrentProjectId(updatedProjects[0].id);
      }
  };

  const handleThemeChange = (newTheme: HeatmapTheme) => {
      setHeatmapTheme(newTheme);
      // Update project theme in storage
      const updatedProjects = projects.map(p => p.id === currentProjectId ? {...p, theme: newTheme} : p);
      setProjects(updatedProjects);
      // Find and save active project
      const activeP = updatedProjects.find(p => p.id === currentProjectId);
      if (activeP) storage.saveProject(activeP);
  };

  const currentYear = new Date().getFullYear();

  // Filter logs for current project
  const projectLogs = useMemo(() => {
      return logs.filter(l => l.projectId === currentProjectId);
  }, [logs, currentProjectId]);

  // Check if current selection has an existing log
  const activeLog = useMemo(() => projectLogs.find(l => l.date === selectedDate), [projectLogs, selectedDate]);

  // Stats calculation
  const totalHours = useMemo(() => logs.reduce((acc, curr) => acc + curr.hours, 0), [logs]); // Total hours across ALL projects for profile stats
  
  // Weekly Progress (Global for Sidebar)
  const currentWeeklyHours = useMemo(() => {
      const now = new Date();
      // Adjust to get Monday of current week
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
      
      const monday = new Date(now.getTime());
      monday.setDate(diff);
      monday.setHours(0,0,0,0);
      
      const nextMonday = new Date(monday.getTime());
      nextMonday.setDate(monday.getDate() + 7);
      
      return logs // Use ALL logs for general goal tracking
        .filter(l => {
            const d = new Date(l.date);
            return d >= monday && d < nextMonday;
        })
        .reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);

  // Monthly Progress
  const currentMonthlyHours = useMemo(() => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return logs.filter(l => new Date(l.date) >= startOfMonth).reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);
  
  // Yearly Progress
  const currentYearlyHours = useMemo(() => {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      return logs.filter(l => new Date(l.date) >= startOfYear).reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);

  const weeklyPercent = Math.min(100, (currentWeeklyHours / goals.weekly) * 100);
  const monthlyPercent = Math.min(100, (currentMonthlyHours / goals.monthly) * 100);
  const yearlyPercent = Math.min(100, (currentYearlyHours / goals.yearly) * 100);

  // Streak Calculation (Global)
  const streaks = useMemo(() => {
      if (logs.length === 0) return { current: 0, longest: 0 };
      
      const activeDates = Array.from(new Set<string>(
        logs.filter(l => l.hours > 0).map(l => l.date)
      )).sort();
      
      if (activeDates.length === 0) return { current: 0, longest: 0 };

      const timestamps = activeDates.map((d: string) => new Date(d).setHours(0,0,0,0));
      
      let longest = 1;
      let currentRun = 1;

      for (let i = 1; i < timestamps.length; i++) {
          const diffDays = (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60 * 24);
          if (diffDays === 1) {
              currentRun++;
          } else {
              currentRun = 1;
          }
          if (currentRun > longest) longest = currentRun;
      }

      const today = new Date().setHours(0,0,0,0);
      const yesterday = today - 86400000;
      const lastLogDate = timestamps[timestamps.length - 1];
      
      let current = 0;
      if (lastLogDate === today || lastLogDate === yesterday) {
          current = 1;
          for (let i = timestamps.length - 2; i >= 0; i--) {
              const diffDays = (timestamps[i+1] - timestamps[i]) / (1000 * 60 * 60 * 24);
              if (diffDays === 1) {
                  current++;
              } else {
                  break;
              }
          }
      }

      return { current, longest };
  }, [logs]);

  const activeProjectName = projects.find(p => p.id === currentProjectId)?.name || 'Project';

  // Helper Visual Components
  const RingProgress = ({ percent, color, label, value, target }: { percent: number, color: string, label: string, value: number, target: number }) => {
        const radius = 28;
        const stroke = 5;
        const normalizedRadius = radius - stroke * 2;
        const circumference = normalizedRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (percent / 100) * circumference;

        return (
            <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
                        <circle
                            stroke="currentColor"
                            fill="transparent"
                            strokeWidth={stroke}
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                            className="text-gray-200 dark:text-gray-700"
                        />
                        <circle
                            stroke="currentColor"
                            fill="transparent"
                            strokeWidth={stroke}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset }}
                            strokeLinecap="round"
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                            className={`${color} transition-all duration-1000 ease-out`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-xs font-bold ${color.replace('text-', 'text-opacity-80 ')}`}>{Math.round(percent)}%</span>
                    </div>
                </div>
                <div className="text-center mt-1">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{value.toFixed(0)} <span className="text-gray-400 text-[10px]">/ {target}</span></p>
                </div>
            </div>
        );
    };

    const LinearProgress = ({ percent, color, label, value, target }: { percent: number, color: string, label: string, value: number, target: number }) => {
        // Extract color class for bg (assuming tailwind classes like 'text-blue-500')
        const colorClass = color.replace('text-', 'bg-');
        
        return (
            <div className="w-full">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{label}</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{value.toFixed(0)} <span className="text-gray-400 text-[10px]">/ {target}</span></span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out relative ${colorClass}`}
                        style={{ width: `${percent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
            </div>
        );
    };

    const PieProgress = ({ percent, color, label, value, target }: { percent: number, color: string, label: string, value: number, target: number }) => {
        const size = 60;
        const radius = size / 2; 
        const r = radius / 2;
        const strokeWidth = radius; 
        const circumference = 2 * Math.PI * r;
        const strokeDashoffset = circumference - (percent / 100) * circumference;
        
        return (
            <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg height={size} width={size} className="rotate-[-90deg]">
                        <circle
                            stroke="currentColor"
                            fill="transparent"
                            strokeWidth={strokeWidth}
                            r={r}
                            cx={radius}
                            cy={radius}
                            className="text-gray-100 dark:text-gray-700"
                        />
                        <circle
                            stroke="currentColor"
                            fill="transparent"
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset }}
                            r={r}
                            cx={radius}
                            cy={radius}
                            className={`${color} transition-all duration-1000 ease-out`}
                        />
                    </svg>
                </div>
                <div className="text-center mt-2">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`}></div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{Math.round(percent)}%</span>
                    </div>
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-xs text-gray-400">{value.toFixed(0)} / {target}</p>
                </div>
            </div>
        );
    };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 transition-colors duration-500">
      <MacWindow isDarkMode={isDarkMode} onToggleTheme={toggleTheme}>
        <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView} 
            weeklyGoal={goals.weekly}
            currentWeeklyHours={currentWeeklyHours}
            projects={projects}
            currentProjectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            navConfig={navConfig}
        />
        
        <div className="flex-1 bg-white dark:bg-gray-900 relative overflow-hidden flex flex-col transition-colors duration-300">
          {currentView === ViewMode.DASHBOARD && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gray-50/50 dark:bg-black/20">
              <div className="p-8 pb-0">
                
                {/* Header Area */}
                <header className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Left Panel: Project Info */}
                  <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 border border-gray-200 dark:border-gray-700/50 shadow-sm flex flex-col justify-center h-32">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                        {activeProjectName} 
                        <span className="mx-3 text-gray-300 dark:text-gray-700 font-light text-2xl">|</span>
                        <span className="text-gray-400 dark:text-gray-500 font-normal">{currentYear}</span>
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Dashboard Overview</p>
                  </div>
                  
                  {/* Right Panel: Streak */}
                  <div className="relative group overflow-hidden bg-gradient-to-r from-orange-500 to-rose-500 rounded-3xl shadow-xl h-32 transform transition-transform hover:scale-[1.02]">
                      {/* Decorative Shapes */}
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
                      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-yellow-400 opacity-20 rounded-full blur-2xl"></div>
                      
                      <div className="relative p-6 h-full flex items-center justify-between">
                          <div className="flex-1 border-r border-white/20 pr-6">
                              <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest opacity-90 mb-1">Current Streak</p>
                              <div className="flex items-baseline">
                                  <span className="text-4xl font-black text-white tracking-tighter drop-shadow-sm leading-none">{streaks.current}</span>
                                  <span className="ml-1.5 text-sm font-bold text-orange-50/90">Days</span>
                              </div>
                          </div>
                          <div className="flex-1 pl-6">
                               <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest opacity-90 mb-1">Longest Streak</p>
                              <div className="flex items-baseline">
                                  <span className="text-4xl font-black text-white tracking-tighter drop-shadow-sm leading-none">{streaks.longest}</span>
                                  <span className="ml-1.5 text-sm font-bold text-orange-50/90">Days</span>
                              </div>
                          </div>
                          
                          <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl shadow-inner border border-white/10 transform rotate-3 group-hover:rotate-6 transition-transform duration-300 ml-4 hidden sm:block">
                               <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                          </div>
                      </div>
                  </div>
                </header>

                {/* Form Area */}
                <div className="w-full bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-200 dark:border-gray-700/50 shadow-lg mb-4 relative overflow-hidden group transition-colors">
                    {/* Optional: Subtle background gradient/effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                                <span className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500 dark:text-blue-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </span>
                                {activeLog ? 'Edit Session' : 'Log Session'}
                            </h3>
                            <div className="flex items-center gap-3">
                                {activeLog && (
                                    <span className="text-[10px] text-gray-400 font-medium hidden sm:inline-block">
                                        Editing entry for <span className="text-gray-600 dark:text-gray-200">{selectedDate}</span>
                                    </span>
                                )}
                                <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg border ${activeLog ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                                    {activeLog ? 'Update Mode' : 'New Entry'}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSaveLog} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            {/* Date */}
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest pl-1">Date</label>
                                <input 
                                    type="date" 
                                    value={selectedDate}
                                    onChange={handleDateChange}
                                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm text-gray-900 dark:text-gray-200 transition-all [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                            
                            {/* Hours */}
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest pl-1">Hours</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    min="0"
                                    max="24"
                                    value={hoursInput}
                                    onChange={(e) => setHoursInput(e.target.value)}
                                    placeholder="0.0"
                                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm text-gray-900 dark:text-gray-200 transition-all placeholder-gray-400 dark:placeholder-gray-600 font-mono"
                                />
                            </div>

                            {/* Notes */}
                            <div className="md:col-span-6 space-y-1.5">
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest pl-1">Notes</label>
                                <input
                                    type="text"
                                    value={notesInput}
                                    onChange={(e) => setNotesInput(e.target.value)}
                                    placeholder="What did you work on?"
                                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm text-gray-900 dark:text-gray-200 transition-all placeholder-gray-400 dark:placeholder-gray-600"
                                />
                            </div>
                            
                            {/* Actions */}
                            <div className="md:col-span-2 flex gap-2 h-[42px]"> 
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95 h-full flex items-center justify-center"
                                >
                                    {activeLog ? 'Update' : 'Save'}
                                </button>
                                
                                {activeLog && (
                                    <button 
                                        type="button"
                                        onClick={handleDeleteLog}
                                        className="px-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-500 dark:hover:text-white rounded-xl transition-all active:scale-95 border border-red-200 dark:border-red-500/20 h-full flex items-center justify-center"
                                        title="Delete Entry"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Goals Section (Expanded) */}
                <div className="mb-8 relative">
                    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Goal Progress
                            </h3>
                            <div className="relative" ref={goalSettingsRef}>
                                <button 
                                    onClick={() => setShowGoalSettings(!showGoalSettings)}
                                    className={`text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${showGoalSettings ? 'text-gray-900 bg-gray-100 dark:text-white dark:bg-white/10' : ''}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                </button>
                                {/* Dropdown */}
                                {showGoalSettings && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700/50 p-2 z-20 animate-fade-in-up">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1.5">View Style</div>
                                        <div className="flex bg-gray-100 dark:bg-[#2c2c2e] p-1 rounded-lg mb-2">
                                            {(['rings', 'bars', 'pie'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => { setGoalViewMode(mode); setShowGoalSettings(false); }}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase ${goalViewMode === mode ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                                        <button 
                                            onClick={() => { setIsEditingGoals(true); setShowGoalSettings(false); }}
                                            className="w-full text-left px-2 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center"
                                        >
                                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            Edit Goals
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isEditingGoals ? (
                            <div className="space-y-4 animate-fade-in bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Weekly Target</label>
                                        <div className="relative">
                                            <input type="number" value={tempGoals.weekly} onChange={e => setTempGoals({...tempGoals, weekly: parseInt(e.target.value)})} className="w-full p-2.5 pl-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                            <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">hrs</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Monthly Target</label>
                                        <div className="relative">
                                            <input type="number" value={tempGoals.monthly} onChange={e => setTempGoals({...tempGoals, monthly: parseInt(e.target.value)})} className="w-full p-2.5 pl-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                            <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">hrs</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Yearly Target</label>
                                        <div className="relative">
                                            <input type="number" value={tempGoals.yearly} onChange={e => setTempGoals({...tempGoals, yearly: parseInt(e.target.value)})} className="w-full p-2.5 pl-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                            <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">hrs</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button onClick={() => setIsEditingGoals(false)} className="px-4 py-2 mr-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium text-sm">Cancel</button>
                                    <button onClick={() => handleUpdateGoals(tempGoals)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-md">Save Changes</button>
                                </div>
                            </div>
                        ) : (
                            goalViewMode === 'rings' ? (
                                <div className="flex justify-around items-center px-4 md:px-12 py-2 animate-fade-in">
                                    <RingProgress 
                                        percent={weeklyPercent} 
                                        color="text-blue-500" 
                                        label="Weekly" 
                                        value={currentWeeklyHours}
                                        target={goals.weekly}
                                    />
                                    <div className="w-px h-16 bg-gray-100 dark:bg-gray-700"></div>
                                    <RingProgress 
                                        percent={monthlyPercent} 
                                        color="text-purple-500" 
                                        label="Monthly" 
                                        value={currentMonthlyHours}
                                        target={goals.monthly}
                                    />
                                    <div className="w-px h-16 bg-gray-100 dark:bg-gray-700"></div>
                                    <RingProgress 
                                        percent={yearlyPercent} 
                                        color="text-orange-500" 
                                        label="Yearly" 
                                        value={currentYearlyHours}
                                        target={goals.yearly}
                                    />
                                </div>
                            ) : goalViewMode === 'pie' ? (
                                <div className="flex justify-around items-center px-4 md:px-12 py-2 animate-fade-in">
                                    <PieProgress 
                                        percent={weeklyPercent} 
                                        color="text-blue-500" 
                                        label="Weekly" 
                                        value={currentWeeklyHours}
                                        target={goals.weekly}
                                    />
                                    <div className="w-px h-16 bg-gray-100 dark:bg-gray-700"></div>
                                    <PieProgress 
                                        percent={monthlyPercent} 
                                        color="text-purple-500" 
                                        label="Monthly" 
                                        value={currentMonthlyHours}
                                        target={goals.monthly}
                                    />
                                    <div className="w-px h-16 bg-gray-100 dark:bg-gray-700"></div>
                                    <PieProgress 
                                        percent={yearlyPercent} 
                                        color="text-orange-500" 
                                        label="Yearly" 
                                        value={currentYearlyHours}
                                        target={goals.yearly}
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 py-4 animate-fade-in">
                                    <LinearProgress 
                                        percent={weeklyPercent} 
                                        color="text-blue-500" 
                                        label="Weekly" 
                                        value={currentWeeklyHours}
                                        target={goals.weekly}
                                    />
                                    <LinearProgress 
                                        percent={monthlyPercent} 
                                        color="text-purple-500" 
                                        label="Monthly" 
                                        value={currentMonthlyHours}
                                        target={goals.monthly}
                                    />
                                    <LinearProgress 
                                        percent={yearlyPercent} 
                                        color="text-orange-500" 
                                        label="Yearly" 
                                        value={currentYearlyHours}
                                        target={goals.yearly}
                                    />
                                </div>
                            )
                        )}
                    </div>
                </div>

                <div className="mb-8 w-full">
                   <Heatmap 
                      data={projectLogs} 
                      year={currentYear} 
                      onDayClick={handleDayClick} 
                      isDarkMode={isDarkMode}
                      theme={heatmapTheme}
                      onThemeChange={handleThemeChange}
                   />
                </div>
                
              </div>
            </div>
          )}

          {currentView === ViewMode.TIMER && (
            <TimerPanel 
                onSaveSession={handleTimerSave} 
                projectId={currentProjectId} 
                projects={projects}
            />
          )}

          {currentView === ViewMode.STATISTICS && (
            <StatisticsPanel 
                logs={projectLogs} 
                goals={goals} 
                onUpdateGoals={handleUpdateGoals}
                onEditLog={handleEditLogFromStats}
                projectId={currentProjectId}
                totalHours={totalHours}
                streak={streaks.current}
            />
          )}

          {currentView === ViewMode.COUNTDOWN && (
            <CountdownPanel />
          )}

          {currentView === ViewMode.CALENDAR && (
            <CalendarPanel logs={projectLogs} />
          )}

          {currentView === ViewMode.INSIGHTS && (
            <InsightsPanel logs={projectLogs} />
          )}

          {currentView === ViewMode.SETTINGS && (
            <SettingsPanel 
                navConfig={navConfig} 
                onUpdateNavConfig={handleUpdateNavConfig}
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
            />
          )}
        </div>
      </MacWindow>
    </div>
  );
}

export default App;