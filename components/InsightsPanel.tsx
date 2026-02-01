import React, { useState, useEffect } from 'react';
import { StudyLog, GeminiAnalysis } from '../types';
import { analyzeStudyHabits } from '../services/geminiService';

interface InsightsPanelProps {
  logs: StudyLog[];
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ logs }) => {
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeStudyHabits(logs);
      setAnalysis(result);
    } catch (err) {
      setError("Unable to generate insights. Check your API key or connection.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">AI Performance Coach</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Let Gemini analyze your study patterns and provide personalized feedback to improve your productivity.
          </p>
        </div>

        {!analysis && !loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to analyze your data?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-sm">
              We'll look at your last 90 days of logs to identify streaks, slumps, and opportunities.
            </p>
            <button
              onClick={runAnalysis}
              className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-black dark:hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Generate Insights
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 animate-pulse">Analyzing your study patterns...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800 flex items-center">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Summary
              </h3>
              <p className="text-blue-50 text-lg leading-relaxed">"{analysis.summary}"</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center">
                  <span className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </span>
                  Key Strengths
                </h3>
                <ul className="space-y-3">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="flex items-start text-gray-600 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 mr-3 shrink-0"></div>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvements */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center">
                  <span className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                  </span>
                  Areas to Improve
                </h3>
                <ul className="space-y-3">
                  {analysis.improvements.map((s, i) => (
                    <li key={i} className="flex items-start text-gray-600 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 mr-3 shrink-0"></div>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Pro Tip */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-6 border border-yellow-100 dark:border-yellow-800/30 flex items-start">
              <span className="text-2xl mr-4">💡</span>
              <div>
                <h3 className="text-yellow-800 dark:text-yellow-400 font-semibold mb-1">Pro Tip</h3>
                <p className="text-yellow-700 dark:text-yellow-300">{analysis.tip}</p>
              </div>
            </div>
            
            <div className="flex justify-end">
                <button onClick={() => setAnalysis(null)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">Reset Analysis</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};