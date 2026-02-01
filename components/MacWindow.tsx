import React from 'react';

interface MacWindowProps {
  children: React.ReactNode;
  title?: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const MacWindow: React.FC<MacWindowProps> = ({ children, title, isDarkMode, onToggleTheme }) => {
  return (
    <div className={`w-full max-w-6xl h-[85vh] transition-all duration-500 rounded-xl shadow-2xl border flex flex-col overflow-hidden animate-fade-in-up ${isDarkMode ? 'dark bg-gray-900/80 border-gray-700/50 shadow-black/50' : 'bg-white/80 border-white/60 shadow-xl'} backdrop-blur-2xl`}>
      {/* Window Title Bar */}
      <div 
        className="h-10 bg-gray-100/50 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between px-4 shrink-0 select-none transition-colors duration-300 backdrop-blur-sm"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div 
            className="flex space-x-2 group"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="w-3 h-3 rounded-full bg-red-500 border border-red-600/20 group-hover:bg-red-600 transition-colors shadow-sm cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-600/20 group-hover:bg-yellow-600 transition-colors shadow-sm cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-green-500 border border-green-600/20 group-hover:bg-green-600 transition-colors shadow-sm cursor-pointer" />
        </div>
        <div className="text-sm font-medium text-gray-500/80 dark:text-gray-400">
          {title || "FocusFlow"}
        </div>
        <div 
            className="flex items-center"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <button 
                onClick={onToggleTheme}
                className="p-1 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-700/50 text-gray-400 dark:text-gray-500 transition-colors"
                aria-label="Toggle Dark Mode"
            >
                {isDarkMode ? (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
            </button>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>
    </div>
  );
};