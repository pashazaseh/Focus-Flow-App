import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as storage from '../services/storageService';
import { TimerSettings, SessionRecord, Project } from '../types';

interface TimerPanelProps {
    onSaveSession: (hours: number, note?: string, projectId?: string) => void;
    projectId: string; // The default/active project from App state
    projects: Project[]; // List of all projects
}

type TimerMode = 'POMO' | 'STOPWATCH';
type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

export const TimerPanel: React.FC<TimerPanelProps> = ({ onSaveSession, projectId, projects }) => {
  // State
  const [mode, setMode] = useState<TimerMode>('POMO');
  const [phase, setPhase] = useState<TimerPhase>('FOCUS');
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  const [initialTime, setInitialTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');
  
  // Project Selection State (Active session project)
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);

  // Settings & Sessions
  const [settings, setSettings] = useState<TimerSettings>(storage.getTimerSettings());
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [pomosCompleted, setPomosCompleted] = useState(0); // In current session/run

  // UI State
  const [showSidebar, setShowSidebar] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<TimerSettings>(settings);

  // Manual Entry Form State
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState('12:00');
  const [manualDuration, setManualDuration] = useState(25);
  const [manualType, setManualType] = useState<'POMO'|'STOPWATCH'>('POMO');
  const [manualProjectId, setManualProjectId] = useState(projectId);
  const [manualLabel, setManualLabel] = useState('');

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Init Data
  useEffect(() => {
      setSessions(storage.getSessions());
      // Initialize time based on saved settings
      setInitialTime(settings.pomoDuration * 60);
      setTimeLeft(settings.pomoDuration * 60);
      
      // Init Audio with saved volume
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      const savedVol = localStorage.getItem('focusflow_timer_volume');
      audioRef.current.volume = savedVol ? parseFloat(savedVol) : 0.5;

      const handleClickOutside = (event: MouseEvent) => {
          if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
              setIsMoreMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, []);

  // Sync selected project if global project changes (optional behavior, can be removed if we want timer to persist selection)
  useEffect(() => {
    setSelectedProjectId(projectId);
    setManualProjectId(projectId);
  }, [projectId]);

  // Timer Tick
  useEffect(() => {
    if (isActive) {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      
      timerRef.current = setInterval(() => {
        if (mode === 'POMO') {
            if (timeLeft > 0) {
                setTimeLeft(prev => prev - 1);
            } else {
                handleTimerComplete();
            }
        } else {
            // Stopwatch counts up
            setTimeLeft(prev => prev + 1); // Using timeLeft as elapsed time here
        }
      }, 1000);
    }
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, mode]);

  const handleTimerComplete = () => {
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      playAlarm();

      const now = new Date();
      const endTime = now.toISOString();
      const durationSecs = initialTime; 
      const startTime = new Date(now.getTime() - durationSecs * 1000).toISOString();

      if (phase === 'FOCUS') {
          // Log Session
          const labelText = sessionLabel.trim() || 'Focus Session';
          const newSession: SessionRecord = {
              id: Date.now().toString(),
              startTime,
              endTime,
              duration: durationSecs,
              type: 'POMO',
              label: labelText,
              projectId: selectedProjectId
          };
          const updatedSessions = storage.saveSessionRecord(newSession);
          setSessions(updatedSessions);
          
          // Update Global Stats
          const hours = Math.round((durationSecs / 3600) * 10) / 10;
          onSaveSession(hours, labelText, selectedProjectId);

          // Handle Cycle
          const newPomos = pomosCompleted + 1;
          setPomosCompleted(newPomos);

          // Next Phase Calculation
          if (newPomos % settings.pomosPerLongBreak === 0) {
              setPhase('LONG_BREAK');
              const duration = settings.longBreakDuration * 60;
              setInitialTime(duration);
              setTimeLeft(duration);
              if (settings.autoStartBreak) setIsActive(true);
          } else {
              setPhase('SHORT_BREAK');
              const duration = settings.shortBreakDuration * 60;
              setInitialTime(duration);
              setTimeLeft(duration);
              if (settings.autoStartBreak) setIsActive(true);
          }
      } else {
          // Break is over, back to focus
          setPhase('FOCUS');
          const duration = settings.pomoDuration * 60;
          setInitialTime(duration);
          setTimeLeft(duration);
          if (settings.autoStartNextPomo) setIsActive(true);
      }
  };

  const handleStopwatchFinish = () => {
      if (mode !== 'STOPWATCH' || !isActive) return;
      
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      const durationSecs = timeLeft; 
      if (durationSecs < 60) return; 

      const now = new Date();
      const endTime = now.toISOString();
      const startTime = new Date(now.getTime() - durationSecs * 1000).toISOString();

      const labelText = sessionLabel.trim() || 'Stopwatch Session';
      const newSession: SessionRecord = {
          id: Date.now().toString(),
          startTime,
          endTime,
          duration: durationSecs,
          type: 'STOPWATCH',
          label: labelText,
          projectId: selectedProjectId
      };
      
      const updatedSessions = storage.saveSessionRecord(newSession);
      setSessions(updatedSessions);
      
      const hours = Math.round((durationSecs / 3600) * 10) / 10;
      onSaveSession(hours, labelText, selectedProjectId);
      
      // Reset
      setTimeLeft(0);
      setInitialTime(0);
  };

  const toggleTimer = () => {
      setIsActive(!isActive);
  };

  const resetTimer = () => {
      setIsActive(false);
      if (mode === 'POMO') {
          // Reset to current phase duration
          let duration = settings.pomoDuration * 60;
          if (phase === 'SHORT_BREAK') duration = settings.shortBreakDuration * 60;
          if (phase === 'LONG_BREAK') duration = settings.longBreakDuration * 60;
          setTimeLeft(duration);
          setInitialTime(duration);
      } else {
          setTimeLeft(0);
          setInitialTime(0);
      }
  };

  const handleQuickDuration = (minutes: number) => {
      setIsActive(false);
      setInitialTime(minutes * 60);
      setTimeLeft(minutes * 60);
  };

  const playAlarm = () => {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
      }
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Settings Logic ---
  const openSettings = () => {
      setTempSettings(settings);
      setIsSettingsOpen(true);
  };
  
  const saveSettings = () => {
      storage.saveTimerSettings(tempSettings);
      setSettings(tempSettings);
      
      if (!isActive && mode === 'POMO') {
          if (phase === 'FOCUS') {
              setTimeLeft(tempSettings.pomoDuration * 60);
              setInitialTime(tempSettings.pomoDuration * 60);
          } else if (phase === 'SHORT_BREAK') {
              setTimeLeft(tempSettings.shortBreakDuration * 60);
              setInitialTime(tempSettings.shortBreakDuration * 60);
          } else {
              setTimeLeft(tempSettings.longBreakDuration * 60);
              setInitialTime(tempSettings.longBreakDuration * 60);
          }
      }
      setIsSettingsOpen(false);
  };

  const handleSettingChange = (key: keyof TimerSettings, value: any) => {
      setTempSettings(prev => ({
          ...prev,
          [key]: value
      }));
  };

  // --- Manual Add Logic ---
  const handleManualSubmit = () => {
      const startDateTime = new Date(`${manualDate}T${manualTime}`);
      const durationSecs = manualDuration * 60;
      const endDateTime = new Date(startDateTime.getTime() + durationSecs * 1000);
      
      const labelText = manualLabel.trim() || 'Manual Entry';
      const newSession: SessionRecord = {
          id: Date.now().toString(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          duration: durationSecs,
          type: manualType,
          label: labelText,
          projectId: manualProjectId
      };
      
      const updated = storage.saveSessionRecord(newSession);
      setSessions(updated);
      
      const hours = Math.round((durationSecs / 3600) * 10) / 10;
      onSaveSession(hours, labelText, manualProjectId);
      
      setIsAddSessionOpen(false);
      setManualLabel('');
  };

  const handleClearHistory = () => {
      if(confirm("Are you sure you want to clear all session history? This cannot be undone.")) {
          // Clear in storage
          localStorage.setItem('focusflow_sessions_v1', JSON.stringify([]));
          setSessions([]);
          setIsMoreMenuOpen(false);
      }
  };

  // --- Stats Calculation ---
  const stats = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = sessions.filter(s => s.startTime.startsWith(today) && s.type === 'POMO');
      
      const todayPomos = todaySessions.length;
      const todayFocusSeconds = sessions
        .filter(s => s.startTime.startsWith(today))
        .reduce((acc, curr) => acc + curr.duration, 0);
      
      const totalPomos = sessions.filter(s => s.type === 'POMO').length;
      const totalFocusSeconds = sessions.reduce((acc, curr) => acc + curr.duration, 0);

      const formatDuration = (totalSecs: number) => {
          const h = Math.floor(totalSecs / 3600);
          const m = Math.floor((totalSecs % 3600) / 60);
          if (h > 0) return `${h}h ${m}m`;
          return `${m}m`;
      };

      return {
          todayPomos,
          todayFocus: Math.round(todayFocusSeconds / 60),
          totalPomos,
          totalFocus: formatDuration(totalFocusSeconds)
      };
  }, [sessions]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
      const groups: { [key: string]: SessionRecord[] } = {};
      sessions.forEach(s => {
          const dateKey = new Date(s.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(s);
      });
      Object.keys(groups).forEach(k => {
          groups[k].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      });
      return groups;
  }, [sessions]);


  // Circular Progress
  const radius = 135;
  const circumference = 2 * Math.PI * radius;
  let progress = 0;
  if (mode === 'POMO') {
      progress = initialTime > 0 ? (initialTime - timeLeft) / initialTime : 0;
  } else {
      progress = (timeLeft % 60) / 60; 
  }
  const dashOffset = circumference * (1 - progress);
  
  const phaseLabel = phase === 'FOCUS' ? 'Focus Time' : phase === 'SHORT_BREAK' ? 'Short Break' : 'Long Break';
  
  // Theme colors based on mode/phase
  const getThemeColor = () => {
      if (mode === 'STOPWATCH') return 'text-orange-500';
      if (phase === 'FOCUS') return 'text-blue-500';
      return 'text-green-500';
  };

  const themeColor = getThemeColor();

  return (
    <div className="flex h-full w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden relative transition-colors duration-300">
        
        {/* Settings Modal */}
        {isSettingsOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-[#1c1c1e] w-[400px] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/50 p-6 animate-scale-in">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Timer Settings</h2>
                        <button onClick={saveSettings} className="text-blue-500 font-semibold text-sm hover:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors">Done</button>
                    </div>

                    <div className="space-y-6">
                        {/* Timer Options */}
                        <div>
                            <h3 className="text-gray-500 dark:text-gray-400 font-semibold mb-3 text-xs uppercase tracking-wider">Durations</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Focus Duration</label>
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="number" 
                                            value={tempSettings.pomoDuration}
                                            onChange={(e) => handleSettingChange('pomoDuration', parseInt(e.target.value))}
                                            className="w-16 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-right focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono"
                                        />
                                        <span className="text-xs text-gray-500 font-medium">min</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Short Break</label>
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="number" 
                                            value={tempSettings.shortBreakDuration}
                                            onChange={(e) => handleSettingChange('shortBreakDuration', parseInt(e.target.value))}
                                            className="w-16 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-right focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono"
                                        />
                                        <span className="text-xs text-gray-500 font-medium">min</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Long Break</label>
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="number" 
                                            value={tempSettings.longBreakDuration}
                                            onChange={(e) => handleSettingChange('longBreakDuration', parseInt(e.target.value))}
                                            className="w-16 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-right focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono"
                                        />
                                        <span className="text-xs text-gray-500 font-medium">min</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                         {/* Auto Start */}
                        <div>
                            <h3 className="text-gray-500 dark:text-gray-400 font-semibold mb-3 text-xs uppercase tracking-wider">Automation</h3>
                            <div className="space-y-1 bg-gray-50 dark:bg-[#252527] rounded-xl p-2 border border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-center p-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-start next Pomo</label>
                                    <button 
                                        onClick={() => handleSettingChange('autoStartNextPomo', !tempSettings.autoStartNextPomo)}
                                        className={`w-11 h-6 rounded-full transition-colors relative ${tempSettings.autoStartNextPomo ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform duration-200 ${tempSettings.autoStartNextPomo ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                    </button>
                                </div>
                                <div className="flex justify-between items-center p-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-start Break</label>
                                    <button 
                                        onClick={() => handleSettingChange('autoStartBreak', !tempSettings.autoStartBreak)}
                                        className={`w-11 h-6 rounded-full transition-colors relative ${tempSettings.autoStartBreak ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform duration-200 ${tempSettings.autoStartBreak ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Manual Add Session Modal */}
        {isAddSessionOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-[#1c1c1e] w-[350px] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/50 p-6 animate-scale-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Session</h2>
                        <button onClick={() => setIsAddSessionOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Project</label>
                            <select 
                                value={manualProjectId} 
                                onChange={(e) => setManualProjectId(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                            <input type="text" value={manualLabel} onChange={e => setManualLabel(e.target.value)} placeholder="e.g. Design Review" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Time</label>
                            <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Duration (minutes)</label>
                            <input type="number" min="1" value={manualDuration} onChange={e => setManualDuration(parseInt(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                            <div className="flex space-x-2">
                                <button onClick={() => setManualType('POMO')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${manualType === 'POMO' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:text-white'}`}>Pomodoro</button>
                                <button onClick={() => setManualType('STOPWATCH')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${manualType === 'STOPWATCH' ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:text-white'}`}>Stopwatch</button>
                            </div>
                        </div>
                        <button onClick={handleManualSubmit} className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black font-semibold rounded-lg mt-4 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-lg">
                            Save Session
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* LEFT COLUMN: Timer */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 pb-32 relative transition-colors duration-300">
             
             {/* Main Timer Display */}
             <div className="flex flex-col items-center justify-center w-full max-w-md">
                 
                 <div className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 py-1.5 px-4 rounded-full border bg-white/50 dark:bg-black/20 ${
                     mode === 'POMO' 
                     ? (phase === 'FOCUS' ? 'text-blue-500 border-blue-200 dark:border-blue-900/50' : 'text-green-500 border-green-200 dark:border-green-900/50') 
                     : 'text-orange-500 border-orange-200 dark:border-orange-900/50'
                 }`}>
                     {mode === 'POMO' ? phaseLabel : 'Stopwatch Mode'}
                 </div>

                 {/* Project Selector & Labeling */}
                 <div className="mb-6 w-64 z-20 flex flex-col gap-3">
                     <div className="relative">
                         <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            disabled={isActive}
                            className={`w-full appearance-none bg-gray-100 dark:bg-[#1c1c1e] text-gray-900 dark:text-white px-4 py-2 pr-8 rounded-xl border border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium transition-all ${isActive ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-[#2c2c2e] cursor-pointer'}`}
                         >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                         </select>
                         <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                         </div>
                     </div>
                     
                     <input 
                         type="text" 
                         value={sessionLabel}
                         onChange={(e) => setSessionLabel(e.target.value)}
                         placeholder="What are you working on?"
                         className="w-full bg-transparent border-b border-gray-200 dark:border-gray-700 text-center text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors py-1"
                         disabled={isActive}
                     />
                 </div>
                 
                 <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-6">
                     <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl">
                         <defs>
                            <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#60A5FA" />
                                <stop offset="100%" stopColor="#3B82F6" />
                            </linearGradient>
                            <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#34D399" />
                                <stop offset="100%" stopColor="#10B981" />
                            </linearGradient>
                            <linearGradient id="stopwatchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FBBF24" />
                                <stop offset="100%" stopColor="#F59E0B" />
                            </linearGradient>
                         </defs>
                         {/* Track */}
                         <circle cx="160" cy="160" r={radius} className="stroke-gray-100 dark:stroke-[#252527] transition-colors duration-300" strokeWidth="8" fill="transparent" />
                         {/* Progress */}
                         <circle 
                            cx="160" 
                            cy="160" 
                            r={radius} 
                            stroke={`url(#${mode === 'POMO' ? (phase === 'FOCUS' ? 'focusGradient' : 'breakGradient') : 'stopwatchGradient'})`}
                            strokeWidth="8" 
                            fill="transparent" 
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ease-linear ${isActive && 'drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`}
                         />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <div className={`text-7xl font-bold tracking-tighter tabular-nums font-mono transition-colors duration-300 ${themeColor}`}>
                             {formatTime(timeLeft)}
                         </div>
                         {mode === 'POMO' && !isActive && (
                             <p className="text-gray-400 text-sm mt-2 font-medium">
                                 {pomosCompleted} Sessions Completed
                             </p>
                         )}
                     </div>
                 </div>

                 {/* Quick Duration Pills */}
                 {mode === 'POMO' && !isActive && (
                     <div className="flex space-x-3 mb-6 animate-fade-in-up">
                         {phase === 'FOCUS' ? (
                             [25, 45, 60].map(mins => (
                                 <button
                                    key={mins}
                                    onClick={() => handleQuickDuration(mins)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all hover:scale-105 active:scale-95 ${
                                        timeLeft === mins * 60 
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                    }`}
                                 >
                                     {mins}m
                                 </button>
                             ))
                         ) : (
                             [5, 10, 15].map(mins => (
                                <button
                                   key={mins}
                                   onClick={() => handleQuickDuration(mins)}
                                   className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all hover:scale-105 active:scale-95 ${
                                       timeLeft === mins * 60 
                                       ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' 
                                       : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700'
                                   }`}
                                >
                                    {mins}m
                                </button>
                            ))
                         )}
                     </div>
                 )}

                 {/* Controls */}
                 <div className="flex items-center space-x-6">
                     {/* Reset Button */}
                     <button 
                        onClick={resetTimer}
                        className="p-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full transition-all active:scale-90"
                        title="Reset Timer"
                     >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </button>

                     <button 
                        onClick={toggleTimer}
                        className={`h-16 w-32 rounded-full font-bold text-lg text-white shadow-xl transition-all hover:shadow-2xl active:scale-95 flex items-center justify-center space-x-2 ${
                            mode === 'STOPWATCH' 
                            ? (isActive ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30')
                            : (phase === 'FOCUS' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-green-600 hover:bg-green-700 shadow-green-600/30')
                        }`}
                     >
                         {isActive ? (
                             <>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                <span>Pause</span>
                             </>
                         ) : (
                             <>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                <span>Start</span>
                             </>
                         )}
                     </button>

                     {/* Finish Stopwatch Button */}
                     {mode === 'STOPWATCH' && !isActive && timeLeft > 0 && (
                         <button 
                            onClick={handleStopwatchFinish}
                            className="p-4 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-600 dark:text-green-500 rounded-full transition-all active:scale-90"
                            title="Finish & Log"
                         >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                         </button>
                     )}
                 </div>
             </div>

             {/* Mode Toggle (Centered) */}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                 <div className="flex bg-gray-100 dark:bg-[#1c1c1e] p-1 rounded-xl shadow-inner">
                     <button 
                        onClick={() => { setMode('POMO'); resetTimer(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'POMO' ? 'bg-white dark:bg-[#3a3a3c] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                     >
                         Timer
                     </button>
                     <button 
                        onClick={() => { setMode('STOPWATCH'); setTimeLeft(0); setInitialTime(0); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'STOPWATCH' ? 'bg-white dark:bg-[#3a3a3c] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                     >
                         Stopwatch
                     </button>
                 </div>
             </div>

             {/* Settings & Sidebar Toggle (Moved to bottom right) */}
             <div className="absolute bottom-8 right-6 z-10">
                 <div className="flex bg-gray-100 dark:bg-[#1c1c1e] p-1 rounded-xl shadow-inner space-x-1">
                     <button onClick={openSettings} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hover:bg-white dark:hover:bg-[#3a3a3c] rounded-lg" title="Settings">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     </button>
                     <button 
                        onClick={() => setShowSidebar(!showSidebar)}
                        className={`p-2 transition-colors rounded-lg ${showSidebar ? 'text-blue-500 bg-white dark:bg-[#3a3a3c] shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#3a3a3c]'}`}
                        title="Toggle Sidebar"
                     >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" /></svg>
                     </button>
                 </div>
             </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Stats */}
        <div 
            className={`bg-gray-50 dark:bg-[#151516] flex flex-col overflow-hidden transition-all duration-300 border-l border-gray-200 dark:border-gray-800 ${showSidebar ? 'w-[360px] opacity-100' : 'w-0 opacity-0'}`}
        >
             <div className="p-6 h-full flex flex-col w-[360px]"> 
                {/* Overview Cards */}
                <div className="mb-8 shrink-0">
                    <h3 className="text-gray-900 dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Today's Overview</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-[#1c1c1e] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Sessions</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todayPomos}</div>
                        </div>
                        <div className="bg-white dark:bg-[#1c1c1e] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Focus Time</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todayFocus} <span className="text-sm font-medium text-gray-400">min</span></div>
                        </div>
                    </div>
                </div>

                {/* Focus Record */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* ... (Session history list remains the same) ... */}
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h3 className="text-gray-900 dark:text-white font-semibold text-sm uppercase tracking-wider">Session History</h3>
                        <div className="flex space-x-2 relative">
                            <button 
                                onClick={() => setIsAddSessionOpen(true)}
                                className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800"
                                title="Add Manual Record"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            </button>
                            <button 
                                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                                className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                            </button>
                            {/* More Menu */}
                            {isMoreMenuOpen && (
                                <div ref={moreMenuRef} className="absolute right-0 top-8 w-32 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20">
                                    <button 
                                        onClick={handleClearHistory}
                                        className="w-full text-left px-4 py-2 text-xs text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                                    >
                                        Clear History
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-6">
                            {Object.keys(groupedSessions).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 mt-10">
                                    <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-sm">No sessions yet</p>
                                </div>
                            ) : (
                                Object.keys(groupedSessions).sort((a,b) => new Date(groupedSessions[b][0].startTime).getTime() - new Date(groupedSessions[a][0].startTime).getTime()).map(dateLabel => (
                                    <div key={dateLabel}>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">{dateLabel}</h4>
                                        <div className="space-y-0 relative border-l-2 border-gray-100 dark:border-gray-800 ml-2">
                                            {groupedSessions[dateLabel].map((session, idx) => {
                                                const start = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                const end = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                const durationMins = Math.round(session.duration / 60);
                                                // Find project name
                                                const projName = projects.find(p => p.id === session.projectId)?.name || 'Unknown Project';

                                                return (
                                                    <div key={session.id} className="relative pl-6 py-3 hover:bg-white dark:hover:bg-white/5 rounded-r-xl transition-colors group cursor-default">
                                                        {/* Dot */}
                                                        <div className={`absolute -left-[5px] top-[18px] w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#151516] ${session.type === 'POMO' ? 'bg-blue-500' : 'bg-orange-500'} ring-2 ring-transparent group-hover:ring-gray-100 dark:group-hover:ring-gray-800 transition-all`}></div>
                                                        
                                                        <div className="flex justify-between items-center">
                                                            <div className="min-w-0 flex-1 mr-2">
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={session.label}>
                                                                    {session.label || 'No Description'}
                                                                </div>
                                                                <div className="flex items-center space-x-1 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                                    <span className={session.type === 'POMO' ? 'text-blue-500' : 'text-orange-500'}>
                                                                        {session.type === 'POMO' ? 'Focus' : 'Stopwatch'}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span className="truncate max-w-[80px]">{projName}</span>
                                                                    <span>•</span>
                                                                    <span className="font-mono opacity-80">{start} - {end}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-bold text-gray-700 dark:text-gray-300 shrink-0">
                                                                {durationMins}m
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
             </div>
        </div>
    </div>
  );
};