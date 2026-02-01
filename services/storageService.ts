import { StudyLog, UserGoals, CountdownItem, SessionRecord, TimerSettings, Project, CustomEvent } from '../types';

const STORAGE_KEY = 'focusflow_logs_v1';
const GOALS_KEY = 'focusflow_goals_v1';
const COUNTDOWNS_KEY = 'focusflow_countdowns_v1';
const SESSIONS_KEY = 'focusflow_sessions_v1';
const TIMER_SETTINGS_KEY = 'focusflow_timer_settings_v1';
const PROJECTS_KEY = 'focusflow_projects_v1';
const CUSTOM_EVENTS_KEY = 'focusflow_custom_events_v1';
const DEFAULT_PROJECT_ID = 'default-project';

// Helper for safe parsing
const safeParse = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (error) {
        console.error(`Error parsing key "${key}":`, error);
        return fallback;
    }
};

// --- Data Management (Export/Import) ---

export const exportData = (): string => {
    const data: Record<string, string | null> = {};
    // Collect all keys related to the app
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('focusflow_') || key.startsWith('heatmap_'))) {
            data[key] = localStorage.getItem(key);
        }
    }
    return JSON.stringify(data, null, 2);
};

export const exportLogsToCSV = (): string => {
    const logs = getLogs();
    const projects = getProjects();
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const header = ['Date', 'Hours', 'Project', 'Notes'];
    const rows = logs.map(log => {
        const projectName = projectMap.get(log.projectId) || 'Unknown Project';
        // CSV escaping: wrap in quotes, escape existing quotes with double quotes
        const cleanProject = `"${projectName.replace(/"/g, '""')}"`;
        const cleanNotes = log.notes ? `"${log.notes.replace(/"/g, '""')}"` : '""';
        return [log.date, log.hours, cleanProject, cleanNotes].join(',');
    });

    return [header.join(','), ...rows].join('\n');
};

export const exportBirthdaysToCSV = (): string => {
    const items = getCountdowns();
    const header = ['Title', 'Date', 'Type', 'Recurrence'];
    const rows = items.map(item => {
        const cleanTitle = `"${item.title.replace(/"/g, '""')}"`;
        return [cleanTitle, item.date, item.type, item.recurrence || 'none'].join(',');
    });
    return [header.join(','), ...rows].join('\n');
};

export const validateBackupData = (data: any): boolean => {
    if (typeof data !== 'object' || data === null) return false;
    // Check if it contains at least one known critical key to verify it's a valid backup
    const keys = Object.keys(data);
    const validKeys = [STORAGE_KEY, PROJECTS_KEY, GOALS_KEY, 'focusflow_theme'];
    return keys.some(k => k.startsWith('focusflow_') || k.startsWith('heatmap_'));
};

export const importData = (jsonString: string): { success: boolean; message: string } => {
    try {
        const data = JSON.parse(jsonString);
        
        if (!validateBackupData(data)) {
            return { success: false, message: "Invalid backup file: Missing FocusFlow data." };
        }

        clearAllData();

        // Restore data
        Object.keys(data).forEach(key => {
            if (data[key] !== null) {
                localStorage.setItem(key, data[key]);
            }
        });
        return { success: true, message: "Data restored successfully." };
    } catch (e) {
        console.error("Import failed", e);
        return { success: false, message: "Failed to parse JSON data." };
    }
};

export const clearAllData = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('focusflow_') || key.startsWith('heatmap_'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
};

// --- Projects ---

export const getProjects = (): Project[] => {
    const defaultProject: Project = {
        id: DEFAULT_PROJECT_ID,
        name: 'Main Project',
        theme: 'green',
        createdAt: new Date().toISOString()
    };
    
    const projects = safeParse<Project[]>(PROJECTS_KEY, [defaultProject]);
    
    if (!Array.isArray(projects) || projects.length === 0) {
        // Repair state if invalid
        localStorage.setItem(PROJECTS_KEY, JSON.stringify([defaultProject]));
        return [defaultProject];
    }
    return projects;
};

export const saveProject = (project: Project): Project[] => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === project.id);
  let newProjects;
  if (index >= 0) {
    newProjects = [...projects];
    newProjects[index] = project;
  } else {
    newProjects = [...projects, project];
  }
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(newProjects));
  return newProjects;
};

export const deleteProject = (id: string): Project[] => {
    // Prevent deleting the last project
    const projects = getProjects();
    if (projects.length <= 1) return projects;
    
    const newProjects = projects.filter(p => p.id !== id);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(newProjects));
    return newProjects;
};

// --- Logs ---

export const getLogs = (): StudyLog[] => {
    let logs = safeParse<StudyLog[]>(STORAGE_KEY, []);
    
    // Migration: If logs exist but have no projectId, assign them to default
    let needsMigration = false;
    logs = logs.map(log => {
        if (!log.projectId) {
            needsMigration = true;
            return { ...log, projectId: DEFAULT_PROJECT_ID };
        }
        return log;
    });

    if (needsMigration) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }

    return logs;
};

export const saveLog = (log: StudyLog): StudyLog[] => {
  const logs = getLogs();
  
  // Check if entry exists for this date AND this project
  const existingIndex = logs.findIndex(l => l.date === log.date && l.projectId === log.projectId);
  
  let newLogs;
  if (existingIndex >= 0) {
    newLogs = [...logs];
    newLogs[existingIndex] = log;
  } else {
    newLogs = [...logs, log];
  }
  
  // Sort logs by date
  newLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  return newLogs;
};

export const deleteLog = (date: string, projectId: string): StudyLog[] => {
  const logs = getLogs();
  // Only delete log for specific project and date
  const newLogs = logs.filter(l => !(l.date === date && l.projectId === projectId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  return newLogs;
};

export const getGoals = (): UserGoals => {
    const defaultGoals = { weekly: 40, monthly: 160, yearly: 2000 };
    const saved = safeParse<any>(GOALS_KEY, {});
    return {
        weekly: saved.weekly || defaultGoals.weekly,
        monthly: saved.monthly || defaultGoals.monthly,
        yearly: saved.yearly || defaultGoals.yearly
    };
};

export const saveGoals = (goals: UserGoals): UserGoals => {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  return goals;
};

// Countdowns
export const getCountdowns = (): CountdownItem[] => {
    const items = safeParse<CountdownItem[]>(COUNTDOWNS_KEY, []);
    if (items.length === 0) return seedCountdowns();
    return items;
};

export const saveCountdown = (item: CountdownItem): CountdownItem[] => {
  const items = getCountdowns();
  const index = items.findIndex(i => i.id === item.id);
  let newItems;
  if (index >= 0) {
    newItems = [...items];
    newItems[index] = item;
  } else {
    newItems = [...items, item];
  }
  localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(newItems));
  return newItems;
};

export const deleteCountdown = (id: string): CountdownItem[] => {
  const items = getCountdowns();
  const newItems = items.filter(i => i.id !== id);
  localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(newItems));
  return newItems;
};

const seedCountdowns = (): CountdownItem[] => {
    const nextYear = new Date().getFullYear() + 1;
    const items: CountdownItem[] = [
        {
            id: '1',
            title: "New Year's Day",
            date: `${nextYear}-01-01`,
            type: 'holiday',
            color: 'blue'
        }
    ];
    localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(items));
    return items;
}

// Session Records
export const getSessions = (): SessionRecord[] => {
    return safeParse<SessionRecord[]>(SESSIONS_KEY, []);
};

export const saveSessionRecord = (session: SessionRecord): SessionRecord[] => {
  const sessions = getSessions();
  const newSessions = [session, ...sessions];
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));
  return newSessions;
};

export const deleteSessionRecord = (id: string): SessionRecord[] => {
    const sessions = getSessions();
    const newSessions = sessions.filter(s => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));
    return newSessions;
};

// Timer Settings
export const getTimerSettings = (): TimerSettings => {
    return safeParse<TimerSettings>(TIMER_SETTINGS_KEY, {
        pomoDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        pomosPerLongBreak: 4,
        autoStartNextPomo: false,
        autoStartBreak: false
    });
};

export const saveTimerSettings = (settings: TimerSettings): TimerSettings => {
    localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(settings));
    return settings;
};

// Custom Events (Calendar)
export const getCustomEvents = (): CustomEvent[] => {
    return safeParse<CustomEvent[]>(CUSTOM_EVENTS_KEY, []);
};

export const saveCustomEvent = (event: CustomEvent): CustomEvent[] => {
    const events = getCustomEvents();
    // Check if updating
    const idx = events.findIndex(e => e.id === event.id);
    let newEvents;
    if (idx >= 0) {
        newEvents = [...events];
        newEvents[idx] = event;
    } else {
        newEvents = [...events, event];
    }
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(newEvents));
    return newEvents;
};

export const deleteCustomEvent = (id: string): CustomEvent[] => {
    const events = getCustomEvents();
    const newEvents = events.filter(e => e.id !== id);
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(newEvents));
    return newEvents;
};


// Seed some data for visualization purposes if empty
export const seedData = (): StudyLog[] => {
  const logs: StudyLog[] = [];
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    
    // Simulate some randomness: 30% chance of 0 hours, else 1-8 hours
    if (Math.random() > 0.3) {
      logs.push({
        date: d.toISOString().split('T')[0],
        hours: Math.round((Math.random() * 6 + 1) * 10) / 10,
        notes: Math.random() > 0.8 ? "Focused study session" : undefined,
        projectId: DEFAULT_PROJECT_ID
      });
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  return logs;
};