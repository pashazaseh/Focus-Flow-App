import React, { useRef, useState, useEffect } from 'react';
import * as storage from '../services/storageService';
import { StoredNavConfig, NAV_ITEMS_DEF } from './Sidebar';
import { TimerSettings, CountdownItem } from '../types';

interface SettingsPanelProps {
    navConfig: StoredNavConfig[];
    onUpdateNavConfig: (config: StoredNavConfig[]) => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ navConfig, onUpdateNavConfig, isDarkMode, onToggleTheme }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [copyStatus, setCopyStatus] = useState<string>('');

    // Timer Settings State
    const [timerSettings, setTimerSettings] = useState<TimerSettings>(storage.getTimerSettings());
    const [timerVolume, setTimerVolume] = useState<number>(() => {
        const v = localStorage.getItem('focusflow_timer_volume');
        return v ? parseFloat(v) : 0.5;
    });

    // Calendar Integration State
    const [googleClientId, setGoogleClientId] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('google_client_id') || '';
        return '';
    });
    const [isImportingBirthdays, setIsImportingBirthdays] = useState(false);
    const [tokenClient, setTokenClient] = useState<any>(null);

    // Init Google Script
    useEffect(() => {
        if (typeof (window as any).google === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (googleClientId) initTokenClient(googleClientId);
            };
            document.body.appendChild(script);
        } else if (googleClientId) {
            initTokenClient(googleClientId);
        }
    }, [googleClientId]);

    const initTokenClient = (clientId: string) => {
        if (typeof (window as any).google !== 'undefined') {
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                // Request broader scope for reading calendars
                scope: 'https://www.googleapis.com/auth/calendar.readonly', 
                callback: (resp: any) => {
                    if (resp.access_token) importBirthdays(resp.access_token);
                    else {
                        setIsImportingBirthdays(false);
                        console.error("OAuth error:", resp);
                    }
                },
            });
            setTokenClient(client);
        }
    };

    // --- Export Handlers ---

    const handleExportJSON = () => {
        const data = storage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportCSV = () => {
        const csv = storage.exportLogsToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportBirthdaysCSV = () => {
        const csv = storage.exportBirthdaysToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_birthdays_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopyToClipboard = () => {
        const data = storage.exportData();
        navigator.clipboard.writeText(data).then(() => {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            setCopyStatus('Failed');
        });
    };

    // --- Import Handlers ---

    const handleImportClick = () => {
        if (confirm("WARNING: Importing data will completely OVERWRITE your current logs, settings, and projects.\n\nAre you sure you want to proceed?")) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const result = storage.importData(content);
                if (result.success) {
                    alert('Data imported successfully. The application will now reload.');
                    window.location.reload();
                } else {
                    alert(`Import Failed: ${result.message}`);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // --- Timer Settings Handlers ---
    const handleTimerSettingChange = (key: keyof TimerSettings, value: any) => {
        const newSettings = { ...timerSettings, [key]: value };
        setTimerSettings(newSettings);
        storage.saveTimerSettings(newSettings);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setTimerVolume(val);
        localStorage.setItem('focusflow_timer_volume', val.toString());
    };

    // --- Notification Handler ---
    const handleNotificationRequest = () => {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
        } else if (Notification.permission === "granted") {
            alert("Notifications are already enabled!");
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(function (permission) {
                if (permission === "granted") {
                    new Notification("FocusFlow", { body: "Notifications enabled!" });
                }
            });
        }
    };

    // --- Danger Zone ---
    const handleFactoryReset = () => {
        if (confirm("DANGER: This will delete ALL your data, logs, projects, and settings. This action cannot be undone.\n\nType 'DELETE' to confirm.")) {
            const check = prompt("Type 'DELETE' to confirm factory reset:");
            if (check === 'DELETE') {
                storage.clearAllData();
                window.location.reload();
            }
        }
    };

    // --- Google Calendar Logic ---

    const handleSaveClientId = () => {
        localStorage.setItem('google_client_id', googleClientId);
        initTokenClient(googleClientId);
        alert("Client ID Saved.");
    };

    const handleImportBirthdaysClick = () => {
        if (!googleClientId) {
            alert("Please enter a Google Client ID first.");
            return;
        }
        setIsImportingBirthdays(true);
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
             // Fallback if client wasn't ready
             initTokenClient(googleClientId);
             setTimeout(() => {
                 if ((window as any).google && (window as any).google.accounts) {
                     alert("Google Services are initializing. Please try again.");
                 }
                 setIsImportingBirthdays(false);
             }, 1000);
        }
    };

    const importBirthdays = async (accessToken: string) => {
        try {
            let targetCalendarId = 'addressbook#contacts@group.v.calendar.google.com';
            let calendarFound = false;

            // 1. List Calendars
            const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (calListRes.ok) {
                const calList = await calListRes.json();
                const birthdayCal = calList.items.find((c: any) => 
                    c.id === 'addressbook#contacts@group.v.calendar.google.com' || 
                    c.id === '#contacts@group.v.calendar.google.com' ||
                    (c.summary && c.summary.toLowerCase().includes('birthday'))
                );
                if (birthdayCal) {
                    targetCalendarId = birthdayCal.id;
                    calendarFound = true;
                }
            }

            // 2. Fetch Events
            const now = new Date();
            const nextYear = new Date();
            nextYear.setFullYear(now.getFullYear() + 1);
            
            const eventsRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events?timeMin=${now.toISOString()}&timeMax=${nextYear.toISOString()}&singleEvents=true&orderBy=startTime`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            
            if (!eventsRes.ok) {
                throw new Error(calendarFound ? 'Failed to fetch events from Birthday calendar.' : 'Could not find Birthday calendar.');
            }
            
            const eventsData = await eventsRes.json();
            let importedCount = 0;
            
            if (eventsData.items) {
                const currentCountdowns = storage.getCountdowns();
                const newItems: CountdownItem[] = [];
                
                eventsData.items.forEach((evt: any) => {
                    if (!evt.start || !evt.start.date) return;
                    const cleanTitle = evt.summary.replace(/'s Birthday|’s Birthday/gi, "").trim();
                    
                    const exists = currentCountdowns.some(c => c.title === cleanTitle && c.type === 'birthday') || newItems.some(n => n.title === cleanTitle);
                    
                    if (!exists) {
                        newItems.push({
                            id: Date.now().toString() + Math.random().toString().slice(2, 8),
                            title: cleanTitle,
                            date: evt.start.date,
                            type: 'birthday',
                            color: 'orange',
                            recurrence: 'yearly',
                            isArchived: false
                        });
                        importedCount++;
                    }
                });
                
                newItems.forEach(item => storage.saveCountdown(item));
            }
            alert(`Successfully imported ${importedCount} birthdays.`);
        } catch (e: any) {
            console.error(e);
            alert(`Error importing: ${e.message}`);
        } finally {
            setIsImportingBirthdays(false);
        }
    };

    // --- Navigation Customization Handlers ---
    
    const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggingIndex(index);
      e.dataTransfer.effectAllowed = "move";
      const ghost = document.createElement('div');
      ghost.style.opacity = '0';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggingIndex === null || draggingIndex === index) return;
      
      const newConfig = [...navConfig];
      const draggedItem = newConfig[draggingIndex];
      newConfig.splice(draggingIndex, 1);
      newConfig.splice(index, 0, draggedItem);
      
      onUpdateNavConfig(newConfig);
      setDraggingIndex(index);
    };

    const handleDragEnd = () => {
      setDraggingIndex(null);
    };

    const toggleVisibility = (index: number) => {
      const newConfig = [...navConfig];
      newConfig[index].isVisible = !newConfig[index].isVisible;
      onUpdateNavConfig(newConfig);
    };

    const handleResetConfig = () => {
        const defaultConf = NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true }));
        onUpdateNavConfig(defaultConf);
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your preferences and application data.</p>
                    </div>
                    
                    {/* General Preferences */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center mb-6">
                            <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 mr-4">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">General</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">Dark Mode</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Toggle application appearance</p>
                                </div>
                                <button 
                                    onClick={onToggleTheme}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">Notifications</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Enable reminders for tasks & events</p>
                                </div>
                                <button 
                                    onClick={handleNotificationRequest}
                                    className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-200"
                                >
                                    Check Status
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Timer Configuration */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center mb-6">
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 mr-4">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Timer Defaults</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Durations (Minutes)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <span className="text-[10px] text-gray-400 block mb-1">Focus</span>
                                            <input type="number" value={timerSettings.pomoDuration} onChange={(e) => handleTimerSettingChange('pomoDuration', parseInt(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 block mb-1">Short Break</span>
                                            <input type="number" value={timerSettings.shortBreakDuration} onChange={(e) => handleTimerSettingChange('shortBreakDuration', parseInt(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 block mb-1">Long Break</span>
                                            <input type="number" value={timerSettings.longBreakDuration} onChange={(e) => handleTimerSettingChange('longBreakDuration', parseInt(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sound Volume</label>
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1" 
                                        value={timerVolume} 
                                        onChange={handleVolumeChange} 
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600" 
                                    />
                                    <span className="text-xs font-mono text-gray-500 w-8 text-right">{(timerVolume * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Customization */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400 mr-4">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Navigation</h3>
                            </div>
                            <button onClick={handleResetConfig} className="text-xs text-gray-500 hover:text-blue-500 underline">Reset Default</button>
                        </div>

                        <div className="space-y-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                             {navConfig.map((item, index) => {
                                  const def = NAV_ITEMS_DEF.find(d => d.view === item.view);
                                  if (!def) return null;
                                  
                                  return (
                                      <div 
                                        key={item.view}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`flex items-center p-3 rounded-xl bg-white dark:bg-[#252527] border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-move transition-all ${draggingIndex === index ? 'opacity-50' : 'opacity-100 shadow-sm'}`}
                                      >
                                          <div className="mr-3 text-gray-400 cursor-move">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                          </div>
                                          <div className={`p-1.5 rounded-lg mr-3 ${item.isVisible ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-50'}`}>
                                              {def.icon}
                                          </div>
                                          <span className={`flex-1 font-medium text-sm ${item.isVisible ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}>
                                              {def.label}
                                          </span>
                                          <div className="relative">
                                              <input 
                                                type="checkbox" 
                                                checked={item.isVisible} 
                                                onChange={() => toggleVisibility(index)}
                                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                              />
                                          </div>
                                      </div>
                                  );
                              })}
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center mb-6">
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 mr-4">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Data Management</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Backup, restore, or export your data.</p>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-8 flex items-start">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Backup & Restore (JSON)</strong> saves your entire application state (logs, projects, settings).
                                <br/>
                                <strong>Export Logs (CSV)</strong> creates a spreadsheet-compatible file of your study sessions only.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* JSON Column */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Full Backup (JSON)</h4>
                                
                                <button onClick={handleExportJSON} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                    <div className="text-left">
                                        <span className="block font-semibold text-gray-900 dark:text-white">Download Backup</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Save full state to file</span>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </button>

                                <button onClick={handleCopyToClipboard} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                    <div className="text-left">
                                        <span className="block font-semibold text-gray-900 dark:text-white">{copyStatus || 'Copy to Clipboard'}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Copy JSON for quick transfer</span>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                </button>

                                <button onClick={handleImportClick} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                    <div className="text-left">
                                        <span className="block font-semibold text-gray-900 dark:text-white">Restore Backup</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Overwrite current data</span>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                            </div>

                            {/* CSV Column */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Export Data (CSV)</h4>
                                <button onClick={handleExportCSV} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                    <div className="text-left">
                                        <span className="block font-semibold text-gray-900 dark:text-white">Export Logs</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Download study sessions as CSV</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-[10px] font-bold text-gray-600 dark:text-gray-300">.CSV</span>
                                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Sync */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center mb-6">
                            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 mr-4">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Calendar Sync</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Import/Export birthdays and events.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left: Client ID */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Google Client ID</label>
                                <div className="flex gap-2 mb-2">
                                    <input 
                                        type="text" 
                                        value={googleClientId}
                                        onChange={(e) => setGoogleClientId(e.target.value)}
                                        placeholder="apps.googleusercontent.com"
                                        className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all"
                                    />
                                    <button 
                                        onClick={handleSaveClientId}
                                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                                    >
                                        Save
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400">Required for importing from Google Calendar.</p>
                            </div>

                            {/* Right: Actions */}
                            <div className="space-y-3">
                                <button 
                                    onClick={handleImportBirthdaysClick}
                                    disabled={isImportingBirthdays}
                                    className={`w-full flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-xl group transition-all ${isImportingBirthdays ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="text-left">
                                        <span className="block font-semibold text-orange-700 dark:text-orange-300">Import Birthdays</span>
                                        <span className="text-xs text-orange-600/70 dark:text-orange-400/70">From Google Calendar</span>
                                    </div>
                                    {isImportingBirthdays ? (
                                        <svg className="w-5 h-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-orange-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                    )}
                                </button>

                                <button onClick={handleExportBirthdaysCSV} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                    <div className="text-left">
                                        <span className="block font-semibold text-gray-900 dark:text-white">Export Birthdays (CSV)</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Download list to file</span>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                                <p className="text-sm text-red-600/70 dark:text-red-400/70">Irreversible actions regarding your data.</p>
                            </div>
                            <button 
                                onClick={handleFactoryReset}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                            >
                                Factory Reset
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};