import React, { useState } from 'react';
import { UserGoals } from '../types';

interface GoalsPanelProps {
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
  currentWeeklyHours: number;
  currentMonthlyHours: number;
  currentYearlyHours: number;
}

export const GoalsPanel: React.FC<GoalsPanelProps> = ({ 
    goals, 
    onUpdateGoals, 
    currentWeeklyHours, 
    currentMonthlyHours, 
    currentYearlyHours 
}) => {
  const [weeklyInput, setWeeklyInput] = useState(goals.weekly.toString());
  const [monthlyInput, setMonthlyInput] = useState(goals.monthly.toString());
  const [yearlyInput, setYearlyInput] = useState(goals.yearly.toString());

  const handleWeeklySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(weeklyInput);
    if (!isNaN(val) && val > 0) {
      onUpdateGoals({ ...goals, weekly: val });
    }
  };

  const handleMonthlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(monthlyInput);
    if (!isNaN(val) && val > 0) {
      onUpdateGoals({ ...goals, monthly: val });
    }
  };

  const handleYearlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(yearlyInput);
    if (!isNaN(val) && val > 0) {
      onUpdateGoals({ ...goals, yearly: val });
    }
  };

  const weeklyPercent = Math.min(100, (currentWeeklyHours / goals.weekly) * 100);
  const monthlyPercent = Math.min(100, (currentMonthlyHours / goals.monthly) * 100);
  const yearlyPercent = Math.min(100, (currentYearlyHours / goals.yearly) * 100);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900">
      <div className="p-8 h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Goal Settings</h2>
            <p className="text-gray-500 dark:text-gray-400">Set ambitious targets to keep your momentum going.</p>
          </div>

          <div className="grid gap-6">
            {/* Weekly Goal Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Weekly Goal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours per week (Mon-Sun)</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>

              <div className="mb-6">
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Progress</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{currentWeeklyHours.toFixed(1)} / {goals.weekly} hrs</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                        className="bg-blue-500 h-4 rounded-full transition-all duration-700 ease-out relative"
                        style={{ width: `${weeklyPercent}%` }}
                    >
                         <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                 </div>
              </div>

              <form onSubmit={handleWeeklySubmit} className="flex items-center space-x-4">
                  <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target Hours</label>
                      <input 
                        type="number"
                        value={weeklyInput}
                        onChange={(e) => setWeeklyInput(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
                  <button type="submit" className="mt-5 px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-black dark:hover:bg-gray-200 transition-colors">
                      Update
                  </button>
              </form>
            </div>

            {/* Monthly Goal Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Monthly Goal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours per month</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              </div>

              <div className="mb-6">
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Progress</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">{currentMonthlyHours.toFixed(1)} / {goals.monthly} hrs</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                        className="bg-purple-500 h-4 rounded-full transition-all duration-700 ease-out relative"
                        style={{ width: `${monthlyPercent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                 </div>
              </div>

              <form onSubmit={handleMonthlySubmit} className="flex items-center space-x-4">
                  <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target Hours</label>
                      <input 
                        type="number"
                        value={monthlyInput}
                        onChange={(e) => setMonthlyInput(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                  </div>
                  <button type="submit" className="mt-5 px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-black dark:hover:bg-gray-200 transition-colors">
                      Update
                  </button>
              </form>
            </div>

            {/* Yearly Goal Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Yearly Goal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours per year</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
              </div>

              <div className="mb-6">
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Progress</span>
                    <span className="text-orange-600 dark:text-orange-400 font-bold">{currentYearlyHours.toFixed(1)} / {goals.yearly} hrs</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                        className="bg-orange-500 h-4 rounded-full transition-all duration-700 ease-out relative"
                        style={{ width: `${yearlyPercent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                 </div>
              </div>

              <form onSubmit={handleYearlySubmit} className="flex items-center space-x-4">
                  <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target Hours</label>
                      <input 
                        type="number"
                        value={yearlyInput}
                        onChange={(e) => setYearlyInput(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                  </div>
                  <button type="submit" className="mt-5 px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-black dark:hover:bg-gray-200 transition-colors">
                      Update
                  </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
