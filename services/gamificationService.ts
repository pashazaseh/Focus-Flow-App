import { StudyLog, UserRank, Achievement } from '../types';

export const RANKS: UserRank[] = [
    { title: 'Novice I', minHours: 0, color: 'text-gray-500' },
    { title: 'Novice II', minHours: 2, color: 'text-gray-600' },
    { title: 'Novice III', minHours: 5, color: 'text-gray-700' },
    { title: 'Initiate', minHours: 10, color: 'text-stone-500' },
    { title: 'Apprentice I', minHours: 20, color: 'text-emerald-500' },
    { title: 'Apprentice II', minHours: 35, color: 'text-emerald-600' },
    { title: 'Student', minHours: 50, color: 'text-teal-500' },
    { title: 'Scholar I', minHours: 75, color: 'text-cyan-500' },
    { title: 'Scholar II', minHours: 100, color: 'text-cyan-600' },
    { title: 'Researcher', minHours: 150, color: 'text-sky-500' },
    { title: 'Specialist', minHours: 200, color: 'text-blue-500' },
    { title: 'Expert I', minHours: 300, color: 'text-indigo-500' },
    { title: 'Expert II', minHours: 400, color: 'text-indigo-600' },
    { title: 'Elite', minHours: 500, color: 'text-violet-500' },
    { title: 'Master', minHours: 750, color: 'text-purple-500' },
    { title: 'Grandmaster', minHours: 1000, color: 'text-fuchsia-500' },
    { title: 'Virtuoso', minHours: 1500, color: 'text-pink-500' },
    { title: 'Visionary', minHours: 2000, color: 'text-rose-500' },
    { title: 'Luminary', minHours: 3000, color: 'text-red-500' },
    { title: 'Oracle', minHours: 4000, color: 'text-orange-500' },
    { title: 'Sage', minHours: 5000, color: 'text-amber-500' },
    { title: 'Titan', minHours: 7500, color: 'text-yellow-500' },
    { title: 'Demigod', minHours: 10000, color: 'text-lime-500' },
    { title: 'Time Lord', minHours: 15000, color: 'text-green-500' },
    { title: 'Grand Architect', minHours: 20000, color: 'text-emerald-400' },
    { title: 'Eternal', minHours: 30000, color: 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' }
];

// Base Achievements
const STATIC_ACHIEVEMENTS: Achievement[] = [
    // --- Starting Out ---
    {
        id: 'first_step',
        title: 'First Step',
        description: 'Log your first study session',
        icon: '🌱',
        condition: (logs) => logs.length > 0
    },
    // --- Streaks ---
    {
        id: 'streak_3',
        title: 'Hat Trick',
        description: 'Maintain a 3-day streak',
        icon: '⚡',
        condition: (_, __, streak) => streak >= 3
    },
    {
        id: 'streak_7',
        title: 'Unstoppable',
        description: 'Maintain a 7-day streak',
        icon: '🚀',
        condition: (_, __, streak) => streak >= 7
    },
    {
        id: 'streak_14',
        title: 'On Fire',
        description: 'Maintain a 14-day streak',
        icon: '☄️',
        condition: (_, __, streak) => streak >= 14
    },
    {
        id: 'streak_30',
        title: 'Habitual',
        description: 'Maintain a 30-day streak',
        icon: '📅',
        condition: (_, __, streak) => streak >= 30
    },
    // --- Intensity ---
    {
        id: 'marathoner',
        title: 'Marathoner',
        description: 'Study for more than 6 hours in a single day',
        icon: '🏃',
        condition: (logs) => logs.some(l => l.hours >= 6)
    },
    {
        id: 'iron_mind',
        title: 'Iron Mind',
        description: 'Study for more than 10 hours in a single day',
        icon: '🧠',
        condition: (logs) => logs.some(l => l.hours >= 10)
    },
    // --- Timing ---
    {
        id: 'weekend_warrior',
        title: 'Weekender',
        description: 'Log a session on a Saturday or Sunday',
        icon: '🎉',
        condition: (logs) => logs.some(l => {
            const d = new Date(l.date).getDay();
            return d === 0 || d === 6;
        })
    },
    {
        id: 'early_bird',
        title: 'Early Bird',
        description: 'Log a study session before 8 AM', 
        icon: '🌅',
        condition: (logs) => logs.some(l => l.notes && l.notes.toLowerCase().includes("morning"))
    },
    {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Log a study session with "Night" in notes',
        icon: '🦉',
        condition: (logs) => logs.some(l => l.notes && l.notes.toLowerCase().includes("night"))
    }
];

// Generate Rank-based Badges
const RANK_ICONS: Record<string, string> = {
    'Novice': '👶',
    'Initiate': '🕯️',
    'Apprentice': '🔨',
    'Student': '🎒',
    'Scholar': '📜',
    'Researcher': '⚗️',
    'Specialist': '🔬',
    'Expert': '👓',
    'Elite': '⚜️',
    'Master': '🥋',
    'Grandmaster': '🧘',
    'Virtuoso': '🎻',
    'Visionary': '🔮',
    'Luminary': '💡',
    'Oracle': '👁️',
    'Sage': '🧙',
    'Titan': '🗿',
    'Demigod': '⚡',
    'Time Lord': '⏳',
    'Grand Architect': '🏛️',
    'Eternal': '🌌'
};

const RANK_ACHIEVEMENTS: Achievement[] = RANKS.filter(r => r.minHours > 0).map(rank => {
    // Find best matching icon
    // Sort keys by length descending to ensure "Grandmaster" matches before "Master"
    let icon = '🎖️';
    const sortedKeys = Object.keys(RANK_ICONS).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
        if (rank.title.includes(key)) {
            icon = RANK_ICONS[key];
            break;
        }
    }

    return {
        id: `rank_badge_${rank.title.replace(/\s+/g, '_').toLowerCase()}`,
        title: rank.title,
        description: `Reach ${rank.minHours} total study hours`,
        icon: icon,
        condition: (_, totalHours) => totalHours >= rank.minHours
    };
});

export const ACHIEVEMENTS_LIST: Achievement[] = [
    ...STATIC_ACHIEVEMENTS,
    ...RANK_ACHIEVEMENTS
];

export const calculateLevel = (totalHours: number) => {
    // Find the highest rank achieved
    let currentRankIndex = 0;
    for (let i = 0; i < RANKS.length; i++) {
        if (totalHours >= RANKS[i].minHours) {
            currentRankIndex = i;
        } else {
            break;
        }
    }

    const currentRank = RANKS[currentRankIndex];
    const nextRank = RANKS[currentRankIndex + 1];
    
    let progress = 100;
    let nextRankHours = totalHours; // Maxed out
    let hoursToNext = 0;

    if (nextRank) {
        const range = nextRank.minHours - currentRank.minHours;
        const currentInRank = totalHours - currentRank.minHours;
        progress = (currentInRank / range) * 100;
        nextRankHours = nextRank.minHours;
        hoursToNext = nextRank.minHours - totalHours;
    }

    // XP Logic: 1 Hour = 100 XP
    const currentXP = Math.floor(totalHours * 100);
    const nextLevelXP = nextRank ? nextRank.minHours * 100 : currentXP;

    return {
        rank: currentRank,
        nextRank,
        progress: Math.min(100, Math.max(0, progress)),
        hoursToNext,
        currentXP,
        nextLevelXP
    };
};

export const getUnlockedAchievements = (logs: StudyLog[], totalHours: number, currentStreak: number): Achievement[] => {
    return ACHIEVEMENTS_LIST.map(achievement => ({
        ...achievement,
        isUnlocked: achievement.condition(logs, totalHours, currentStreak)
    }));
};