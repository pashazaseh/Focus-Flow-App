import React, { useMemo, useState } from 'react';
import { StudyLog, UserGoals } from '../types';
import { calculateLevel, getUnlockedAchievements } from '../services/gamificationService';

interface ProfilePanelProps {
    logs: StudyLog[];
    streak: number;
    totalHours: number;
    goals: UserGoals;
    onUpdateGoals: (goals: UserGoals) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ logs, streak, totalHours, goals, onUpdateGoals }) => {
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    const [tempGoals, setTempGoals] = useState<UserGoals>(goals);

    const levelData = useMemo(() => calculateLevel(totalHours), [totalHours]);
    const achievements = useMemo(() => getUnlockedAchievements(logs, totalHours, streak), [logs, totalHours, streak]);
    const unlockedCount = achievements.filter(a => a.isUnlocked).length;

    // Calculate Goal Progress
    const currentWeeklyHours = useMemo(() => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.getTime());
        monday.setDate(diff);
        monday.setHours(0,0,0,0);
        return logs.filter(l => new Date(l.date) >= monday).reduce((acc, curr) => acc + curr.hours, 0);
    }, [logs]);

    const currentMonthlyHours = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return logs.filter(l => new Date(l.date) >= startOfMonth).reduce((acc, curr) => acc + curr.hours, 0);
    }, [logs]);
    
    const currentYearlyHours = useMemo(() => {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        return logs.filter(l => new Date(l.date) >= startOfYear).reduce((acc, curr) => acc + curr.hours, 0);
    }, [logs]);

    const weeklyPercent = Math.min(100, (currentWeeklyHours / goals.weekly) * 100);
    const monthlyPercent = Math.min(100, (currentMonthlyHours / goals.monthly) * 100);
    const yearlyPercent = Math.min(100, (currentYearlyHours / goals.yearly) * 100);

    const handleSaveGoals = () => {
        onUpdateGoals(tempGoals);
        setIsEditingGoals(false);
    };

    const RingProgress = ({ percent, color, label, value, target }: { percent: number, color: string, label: string, value: number, target: number }) => {
        const radius = 30;
        const stroke = 6;
        const normalizedRadius = radius - stroke * 2;
        const circumference = normalizedRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (percent / 100) * circumference;

        return (
            <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 flex items-center justify-center">
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
                        <span className={`text-sm font-bold ${color.replace('text-', 'text-opacity-80 ')}`}>{Math.round(percent)}%</span>
                    </div>
                </div>
                <div className="text-center mt-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{value.toFixed(0)} <span className="text-gray-400 text-xs">/ {target}</span></p>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900">
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
                    
                    {/* Top Hero Section: Level & XP */}
                    <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden group">
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                            <div className="shrink-0 relative group/rank">
                                <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-5xl shadow-2xl text-white font-black ring-4 ring-white dark:ring-gray-700 transform group-hover/rank:rotate-12 transition-transform duration-500">
                                    {levelData.rank.title.charAt(0)}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white dark:border-gray-800 z-10">
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
                                    <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-blue-100 dark:bg-gray-700 shadow-inner">
                                        <div 
                                            style={{ width: `${levelData.progress}%` }} 
                                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out relative"
                                        >
                                            <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite]"></div>
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

                    {/* Goals Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Goals & Activity
                                </h3>
                                <button 
                                    onClick={() => setIsEditingGoals(!isEditingGoals)}
                                    className="text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    {isEditingGoals ? 'Cancel' : 'Edit Targets'}
                                </button>
                            </div>

                            {isEditingGoals ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Weekly</label>
                                            <input type="number" value={tempGoals.weekly} onChange={e => setTempGoals({...tempGoals, weekly: parseInt(e.target.value)})} className="w-full p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Monthly</label>
                                            <input type="number" value={tempGoals.monthly} onChange={e => setTempGoals({...tempGoals, monthly: parseInt(e.target.value)})} className="w-full p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Yearly</label>
                                            <input type="number" value={tempGoals.yearly} onChange={e => setTempGoals({...tempGoals, yearly: parseInt(e.target.value)})} className="w-full p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-white" />
                                        </div>
                                    </div>
                                    <button onClick={handleSaveGoals} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">Save Targets</button>
                                </div>
                            ) : (
                                <div className="flex justify-around items-center py-4">
                                    <RingProgress 
                                        percent={weeklyPercent} 
                                        color="text-blue-500" 
                                        label="Weekly" 
                                        value={currentWeeklyHours}
                                        target={goals.weekly}
                                    />
                                    <div className="w-px h-24 bg-gray-100 dark:bg-gray-700"></div>
                                    <RingProgress 
                                        percent={monthlyPercent} 
                                        color="text-purple-500" 
                                        label="Monthly" 
                                        value={currentMonthlyHours}
                                        target={goals.monthly}
                                    />
                                    <div className="w-px h-24 bg-gray-100 dark:bg-gray-700"></div>
                                    <RingProgress 
                                        percent={yearlyPercent} 
                                        color="text-orange-500" 
                                        label="Yearly" 
                                        value={currentYearlyHours}
                                        target={goals.yearly}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Streak Card */}
                         <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 shadow-lg text-white flex flex-col justify-between transform transition-transform hover:scale-[1.02]">
                            <div>
                                <h3 className="text-lg font-bold opacity-90 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                                    Current Streak
                                </h3>
                            </div>
                            <div className="text-center py-4">
                                <span className="text-6xl font-black">{streak}</span>
                                <span className="text-xl font-medium opacity-80 ml-2">Days</span>
                            </div>
                            <div className="bg-white/20 rounded-xl p-3 text-sm text-center font-medium backdrop-blur-sm">
                                Keep it up! Consistency is key.
                            </div>
                         </div>
                    </div>

                    {/* Achievements Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Badges & Achievements</h3>
                            <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800">
                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                    {unlockedCount} / {achievements.length} Unlocked
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                            {achievements.map((badge) => (
                                <div 
                                    key={badge.id}
                                    className={`relative p-5 rounded-2xl border flex flex-col items-center text-center transition-all duration-300 group overflow-hidden ${
                                        badge.isUnlocked 
                                        ? 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1' 
                                        : 'bg-gray-100 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-60'
                                    }`}
                                >
                                    
                                    <div className={`w-20 h-20 flex items-center justify-center rounded-full text-4xl shadow-inner mb-4 transition-transform duration-500 group-hover:scale-110 ${
                                        badge.isUnlocked 
                                        ? 'bg-gradient-to-tr from-blue-100 to-white dark:from-gray-700 dark:to-gray-600 ring-2 ring-blue-500/20' 
                                        : 'bg-gray-200 dark:bg-gray-800 grayscale'
                                    }`}>
                                        {badge.icon}
                                    </div>
                                    
                                    <div className="w-full z-10">
                                        <div className="flex items-center justify-center gap-1.5 mb-2">
                                            <h4 className={`font-bold text-base truncate ${badge.isUnlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'}`}>
                                                {badge.title}
                                            </h4>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug px-1 h-8 line-clamp-2">
                                            {badge.description}
                                        </p>
                                    </div>

                                    {/* Unlocked Effect */}
                                    {badge.isUnlocked && (
                                        <>
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/20 to-transparent -mr-8 -mt-8 rounded-full blur-xl pointer-events-none"></div>
                                            <div className="absolute top-3 right-3 bg-blue-500 text-white p-1 rounded-full shadow-lg transform scale-90 group-hover:scale-110 transition-transform">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}