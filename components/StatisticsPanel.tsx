import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StudyLog, UserGoals } from '../types';
import { 
    BarChart, Bar, LineChart, Line, AreaChart, Area, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { calculateLevel, getUnlockedAchievements } from '../services/gamificationService';

interface StatisticsPanelProps {
  logs: StudyLog[];
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
  onEditLog: (date: string) => void;
  projectId: string;
  totalHours: number;
  streak: number;
}

type SortField = 'date' | 'hours';
type FilterRange = 'all' | '7days' | '30days' | 'year';
type ChartType = 'bar' | 'line' | 'area';

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ logs, goals, onUpdateGoals, onEditLog, projectId, totalHours, streak }) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [filterRange, setFilterRange] = useState<FilterRange>('30days');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showChartSettings, setShowChartSettings] = useState(false);
  
  // Gamification UI State
  const [badgeView, setBadgeView] = useState<'all' | 'unlocked'>('all');
  const [isBadgesExpanded, setIsBadgesExpanded] = useState(true);
  
  const chartSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (chartSettingsRef.current && !chartSettingsRef.current.contains(event.target as Node)) {
              setShowChartSettings(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gamification Data
  const levelData = useMemo(() => calculateLevel(totalHours), [totalHours]);
  const achievements = useMemo(() => getUnlockedAchievements(logs, totalHours, streak), [logs, totalHours, streak]);
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  const filteredLogs = useMemo(() => {
    let filtered = [...logs];
    const now = new Date();
    
    // Filter
    if (filterRange === '7days') {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 7);
        filtered = filtered.filter(l => new Date(l.date) >= cutoff);
    } else if (filterRange === '30days') {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 30);
        filtered = filtered.filter(l => new Date(l.date) >= cutoff);
    } else if (filterRange === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filtered = filtered.filter(l => new Date(l.date) >= startOfYear);
    }

    // Sort for Table (User Interaction)
    filtered.sort((a, b) => {
        let valA = sortField === 'date' ? new Date(a.date).getTime() : a.hours;
        let valB = sortField === 'date' ? new Date(b.date).getTime() : b.hours;
        return sortDesc ? valB - valA : valA - valB;
    });

    return filtered;
  }, [logs, filterRange, sortField, sortDesc]);

  // Data prepared for charts (needs to be sorted chronologically)
  const chartData = useMemo(() => {
    const data = [...filteredLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return data.map(log => ({
        date: new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours: log.hours
    }));
  }, [filteredLogs]);

  // Statistics Calculation
  const stats = useMemo(() => {
      const weekdays = filteredLogs.filter(l => {
          const day = new Date(l.date).getDay();
          return day !== 0 && day !== 6;
      });
      const weekends = filteredLogs.filter(l => {
          const day = new Date(l.date).getDay();
          return day === 0 || day === 6;
      });

      const avgWeekday = weekdays.length ? weekdays.reduce((a, b) => a + b.hours, 0) / weekdays.length : 0;
      const avgWeekend = weekends.length ? weekends.reduce((a, b) => a + b.hours, 0) / weekends.length : 0;
      const totalHours = filteredLogs.reduce((acc, curr) => acc + curr.hours, 0);
      const avgHours = filteredLogs.length > 0 ? totalHours / filteredLogs.length : 0;

      return { totalHours, avgHours, avgWeekday, avgWeekend };
  }, [filteredLogs]);

  // Frequency Stats Calculation
  const frequencyStats = useMemo(() => {
      const counts = Array(7).fill(0);
      filteredLogs.forEach(l => {
          const dayIndex = new Date(l.date).getDay(); // 0 = Sun
          counts[dayIndex] += l.hours;
      });
      const maxVal = Math.max(...counts, 1);
      return counts.map((val, i) => ({ 
          dayIndex: i, 
          value: val, 
          percent: val / maxVal 
      }));
  }, [filteredLogs]);

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderChart = () => {
    const commonProps = {
        data: chartData,
        margin: { top: 10, right: 10, left: -20, bottom: 0 }
    };

    if (chartType === 'line') {
        return (
            <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} />
                <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)'}} 
                />
                <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
            </LineChart>
        );
    } else if (chartType === 'area') {
        return (
            <AreaChart {...commonProps}>
                <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} />
                <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ stroke: '#8b5cf6', strokeWidth: 1 }}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)'}} 
                />
                <Area type="monotone" dataKey="hours" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorHours)" strokeWidth={3} />
            </AreaChart>
        );
    }
    return (
        <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
            <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} />
            <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
            <Tooltip 
                cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} 
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)'}} 
            />
            <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
        </BarChart>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900">
      <div className="p-8 h-full overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* --- Hero Section (Level & XP) --- */}
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden group">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0 relative group/rank">
                        {/* Avatar Ring Container */}
                        <div className="w-36 h-36 rounded-full p-2 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-sm shadow-2xl flex items-center justify-center">
                            <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-5xl shadow-inner text-white font-black ring-4 ring-white dark:ring-gray-800 transform group-hover/rank:rotate-12 transition-transform duration-500 relative overflow-hidden">
                                {levelData.rank.title.charAt(0)}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                            </div>
                        </div>
                        
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white dark:border-gray-800 z-10 min-w-[60px] text-center">
                            Lvl {Math.floor(totalHours / 10) + 1}
                        </div>
                    </div>

                    <div className="flex-1 w-full text-center md:text-left">
                        <h3 className={`text-5xl font-black ${levelData.rank.color} mb-1 tracking-tight drop-shadow-sm`}>{levelData.rank.title}</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-6">
                            Total Focus Time: <span className="text-gray-900 dark:text-white font-bold">{totalHours.toFixed(1)} Hours</span>
                        </p>

                        {/* XP Bar */}
                        <div className="relative pt-1 max-w-xl mx-auto md:mx-0">
                            <div className="flex mb-2 items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                                        XP Progress
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold inline-block text-blue-600 dark:text-blue-400">
                                        {levelData.currentXP} / {levelData.nextLevelXP} XP
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-blue-100 dark:bg-gray-700 shadow-inner relative">
                                <div 
                                    style={{ width: `${levelData.progress}%` }} 
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out relative z-10"
                                >
                                    <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite]"></div>
                                </div>
                                {/* Segments */}
                                <div className="absolute inset-0 flex justify-between px-2 z-20">
                                    <div className="w-px h-full bg-white/20"></div>
                                    <div className="w-px h-full bg-white/20"></div>
                                    <div className="w-px h-full bg-white/20"></div>
                                    <div className="w-px h-full bg-white/20"></div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">
                                {levelData.hoursToNext > 0 
                                    ? `${levelData.hoursToNext.toFixed(1)} more hours to reach ${levelData.nextRank?.title}` 
                                    : 'Max Rank Achieved!'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Achievements Grid --- */}
            <div>
                <div 
                    className="flex items-center justify-between mb-4 cursor-pointer group select-none"
                    onClick={() => setIsBadgesExpanded(!isBadgesExpanded)}
                >
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                        Badges & Achievements
                        <svg className={`w-5 h-5 ml-2 text-gray-400 transition-transform ${isBadgesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </h3>
                    
                    <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gray-200 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-medium">
                            <button 
                                onClick={() => setBadgeView('all')}
                                className={`px-3 py-1 rounded-md transition-all ${badgeView === 'all' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                All
                            </button>
                            <button 
                                onClick={() => setBadgeView('unlocked')}
                                className={`px-3 py-1 rounded-md transition-all ${badgeView === 'unlocked' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                Unlocked
                            </button>
                        </div>
                        <div className="px-3 py-1.5 bg-blue-900/40 rounded-full border border-blue-800">
                            <span className="text-xs font-bold text-blue-300">
                                {unlockedCount} / {achievements.length}
                            </span>
                        </div>
                    </div>
                </div>
                
                {isBadgesExpanded && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in-up">
                        {achievements
                            .filter(a => badgeView === 'all' || a.isUnlocked)
                            .map((badge) => (
                            <div 
                                key={badge.id}
                                className={`relative p-4 rounded-2xl border flex flex-col items-center text-center transition-all duration-300 group overflow-hidden ${
                                    badge.isUnlocked 
                                    ? 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1' 
                                    : 'bg-gray-100 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-60 grayscale'
                                }`}
                            >
                                <div className={`w-14 h-14 flex items-center justify-center rounded-full text-2xl shadow-inner mb-3 transition-transform duration-500 group-hover:scale-110 ${
                                    badge.isUnlocked 
                                    ? 'bg-gradient-to-tr from-blue-100 to-white dark:from-gray-700 dark:to-gray-600 ring-2 ring-blue-500/20' 
                                    : 'bg-gray-200 dark:bg-gray-800 grayscale'
                                }`}>
                                    {badge.icon}
                                </div>
                                
                                <div className="w-full z-10">
                                    <h4 className={`font-bold text-xs truncate mb-1 ${badge.isUnlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'}`}>
                                        {badge.title}
                                    </h4>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight line-clamp-2 h-6">
                                        {badge.description}
                                    </p>
                                </div>

                                {badge.isUnlocked && (
                                    <div className="absolute top-2 right-2 text-blue-500">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* --- Charts Header & Filter --- */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Statistics</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Detailed breakdown of your study sessions.</p>
                </div>
                
                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    {(['all', 'year', '30days', '7days'] as FilterRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setFilterRange(range)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                filterRange === range 
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            {range === 'all' ? 'All' : range === 'year' ? 'Year' : range === '30days' ? '30d' : '7d'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Total Hours (Selected)</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.totalHours.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-gray-400 font-medium">hrs</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Daily Average</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.avgHours.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-gray-400 font-medium">hrs</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mb-2">Weekday Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">{stats.avgWeekday.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-blue-400/70 font-medium">hrs</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 font-bold uppercase tracking-wider mb-2">Weekend Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">{stats.avgWeekend.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-purple-400/70 font-medium">hrs</span>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Chart Section */}
                <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Activity Trend</h3>
                        
                        {/* Chart Settings Dropdown */}
                        <div className="relative" ref={chartSettingsRef}>
                            <button 
                                onClick={() => setShowChartSettings(!showChartSettings)}
                                className={`p-1.5 rounded-lg transition-all ${
                                    showChartSettings 
                                    ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' 
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            </button>
                            
                            {showChartSettings && (
                                <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700/50 p-2 z-20 animate-fade-in-up">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1.5 mb-1">Chart Type</div>
                                    <div className="space-y-1">
                                        <button 
                                            onClick={() => { setChartType('bar'); setShowChartSettings(false); }}
                                            className={`w-full text-left px-2 py-1.5 text-sm rounded-lg flex items-center transition-colors ${chartType === 'bar' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M4 20h16v2H4zM6 10h3v8H6zM11 5h3v13h-3zM16 12h3v6h-3z"/></svg>
                                            Bar Chart
                                        </button>
                                        <button 
                                            onClick={() => { setChartType('line'); setShowChartSettings(false); }}
                                            className={`w-full text-left px-2 py-1.5 text-sm rounded-lg flex items-center transition-colors ${chartType === 'line' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
                                            Line Chart
                                        </button>
                                        <button 
                                            onClick={() => { setChartType('area'); setShowChartSettings(false); }}
                                            className={`w-full text-left px-2 py-1.5 text-sm rounded-lg flex items-center transition-colors ${chartType === 'area' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/><path fillOpacity=".3" d="M3.5 18.49l6-6.01 4 4L22 6.92V21H2v-4.01z"/></svg>
                                            Area Chart
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {renderChart()}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Frequency Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-6">Activity by Day</h3>
                    <div className="flex flex-col space-y-4">
                        {weekDayLabels.map((dayLabel, index) => {
                            const stat = frequencyStats.find(s => s.dayIndex === index);
                            const percent = stat ? stat.percent : 0;
                            const value = stat ? stat.value : 0;
                            
                            return (
                                <div key={dayLabel} className="flex items-center group/freq">
                                    <span className="text-xs font-bold text-gray-400 w-8">{dayLabel}</span>
                                    <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mx-3 relative">
                                        <div 
                                            className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out relative group-hover/freq:bg-blue-400"
                                            style={{ width: `${percent * 100}%` }}
                                        >
                                            {percent > 0 && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 w-12 text-right">{value.toFixed(1)}h</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Log History</h3>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => {
                                    if (sortField === 'date') setSortDesc(!sortDesc);
                                    else { setSortField('date'); setSortDesc(true); }
                                }}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Date</span>
                                    {sortField === 'date' && (
                                        <span>{sortDesc ? '↓' : '↑'}</span>
                                    )}
                                </div>
                            </th>
                            <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => {
                                    if (sortField === 'hours') setSortDesc(!sortDesc);
                                    else { setSortField('hours'); setSortDesc(true); }
                                }}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Hours</span>
                                    {sortField === 'hours' && (
                                        <span>{sortDesc ? '↓' : '↑'}</span>
                                    )}
                                </div>
                            </th>
                            <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Notes
                            </th>
                            <th className="p-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No logs found for this period.
                                </td>
                            </tr>
                        ) : (
                            filteredLogs.map((log) => (
                                <tr key={log.date} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4 text-sm text-gray-900 dark:text-gray-200 font-medium">
                                        {log.date}
                                        <div className="text-xs text-gray-400 font-normal">
                                            {new Date(log.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-900 dark:text-gray-200">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                            log.hours >= 4 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                            log.hours >= 1 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                        }`}>
                                            {log.hours} hrs
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {log.notes || <span className="text-gray-300 dark:text-gray-600 italic">-</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => onEditLog(log.date)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all"
                                            title="Edit"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
      </div>
    </div>
  );
};