import React, { useState, useRef, useEffect } from 'react';
import { ViewMode, Project, HeatmapTheme } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  weeklyGoal: number;
  currentWeeklyHours: number;
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string, theme: HeatmapTheme) => void;
  onDeleteProject: (id: string) => void;
  navConfig: StoredNavConfig[];
}

// Configuration structure for navigation items
export interface StoredNavConfig {
    view: ViewMode;
    isVisible: boolean;
}

interface NavItemConfig {
    view: ViewMode;
    label: string;
    icon: React.ReactNode;
}

// Default items definition - Exported for SettingsPanel
export const NAV_ITEMS_DEF: NavItemConfig[] = [
    {
        view: ViewMode.DASHBOARD,
        label: 'Dashboard',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
    },
    {
        view: ViewMode.TIMER,
        label: 'Timer',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        view: ViewMode.CALENDAR,
        label: 'Calendar',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    },
    {
        view: ViewMode.STATISTICS,
        label: 'Profile & Stats',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00 2 2h2a2 2 0 00 2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 00 2 2h2a2 2 0 00 2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
        view: ViewMode.COUNTDOWN,
        label: 'Countdown',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        view: ViewMode.INSIGHTS,
        label: 'AI Coach',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
    }
];

interface NavItemProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}

const NavItem: React.FC<NavItemProps> = ({ 
  active, 
  onClick, 
  icon, 
  label 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
      active 
        ? 'bg-blue-500 text-white shadow-md' 
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    <div className={`${active ? 'text-white' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
      {icon}
    </div>
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const ThemeDot = ({ theme }: { theme: HeatmapTheme }) => {
    const colors = {
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        orange: 'bg-orange-500',
        purple: 'bg-purple-500'
    };
    return <div className={`w-2 h-2 rounded-full ${colors[theme] || 'bg-gray-400'}`}></div>;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    onChangeView, 
    weeklyGoal, 
    currentWeeklyHours,
    projects,
    currentProjectId,
    onSelectProject,
    onCreateProject,
    onDeleteProject,
    navConfig
}) => {
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTheme, setNewProjectTheme] = useState<HeatmapTheme>('green');
  
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Safe access to active project
  const activeProject = projects.find(p => p.id === currentProjectId) || projects[0] || {
    id: 'loading',
    name: 'Loading...',
    theme: 'green' as HeatmapTheme,
    createdAt: ''
  };

  const progressPercent = Math.min(100, (currentWeeklyHours / weeklyGoal) * 100);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsProjectMenuOpen(false);
            setIsCreating(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      if(newProjectName.trim()) {
          onCreateProject(newProjectName.trim(), newProjectTheme);
          setNewProjectName('');
          setIsCreating(false);
          setIsProjectMenuOpen(false);
      }
  };

  return (
    <div className="w-64 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-md border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 transition-colors duration-300 relative">
      
      {/* Project Selector */}
      <div className="mb-6 mt-2 relative" ref={menuRef}>
        <button 
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors group"
        >
            <div className="flex items-center space-x-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm ${
                    activeProject.theme === 'green' ? 'bg-green-500' :
                    activeProject.theme === 'blue' ? 'bg-blue-500' :
                    activeProject.theme === 'orange' ? 'bg-orange-500' : 'bg-purple-500'
                }`}>
                    <span className="font-bold text-sm">{activeProject.name.substring(0, 2).toUpperCase()}</span>
                </div>
                <div className="text-left truncate">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Project</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{activeProject.name}</p>
                </div>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isProjectMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {/* Dropdown Menu */}
        {isProjectMenuOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-fade-in-up">
                {!isCreating ? (
                    <>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {projects.map(project => (
                                <div key={project.id} className="group relative flex items-center">
                                    <button 
                                        onClick={() => {
                                            onSelectProject(project.id);
                                            setIsProjectMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${project.id === currentProjectId ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                    >
                                        <ThemeDot theme={project.theme} />
                                        <span className={`text-sm truncate ${project.id === currentProjectId ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                            {project.name}
                                        </span>
                                    </button>
                                    {projects.length > 1 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(confirm('Delete project? All logs will be lost.')) onDeleteProject(project.id); }}
                                            className="absolute right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-1 border-t border-gray-100 dark:border-gray-700">
                            <button 
                                onClick={() => setIsCreating(true)}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span>New Project</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Create Project</p>
                        <form onSubmit={handleCreate} className="space-y-3">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Project Name"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Theme</span>
                                <div className="flex space-x-1">
                                    {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setNewProjectTheme(t)}
                                            className={`w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600 ${t === 'green' ? 'bg-green-500' : t === 'blue' ? 'bg-blue-500' : t === 'orange' ? 'bg-orange-500' : 'bg-purple-500'} ${newProjectTheme === t ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex space-x-2 pt-1">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        {navConfig.map((item) => {
            if (!item.isVisible) return null;
            const def = NAV_ITEMS_DEF.find(d => d.view === item.view);
            if (!def) return null;

            return (
                <NavItem
                    key={item.view}
                    active={currentView === item.view}
                    onClick={() => onChangeView(item.view)}
                    icon={def.icon}
                    label={def.label}
                />
            );
        })}

        {/* Settings Button - Always visible at bottom of list */}
        <button
            onClick={() => onChangeView(ViewMode.SETTINGS)}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group mt-1 ${
                currentView === ViewMode.SETTINGS
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
        >
            <div className={`${currentView === ViewMode.SETTINGS ? 'text-white' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <span className="font-medium text-sm">Settings</span>
        </button>
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-blue-50 dark:bg-gray-800 rounded-xl p-4 border border-blue-100 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-end mb-2">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Weekly Goal</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 text-right">{currentWeeklyHours.toFixed(1)} / {weeklyGoal} hrs</p>
          </div>
          <div className="w-full bg-blue-200 dark:bg-gray-700 rounded-full h-2 mb-1 overflow-hidden">
            <div 
                className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};