import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { StudyLog, DayStats, HeatmapTheme } from '../types';

interface HeatmapProps {
  data: StudyLog[];
  year: number;
  onDayClick: (date: string) => void;
  isDarkMode: boolean;
  theme: HeatmapTheme;
  onThemeChange: (theme: HeatmapTheme) => void;
}

type Density = 'compact' | 'standard' | 'spacious';
type LayoutType = 'vertical' | 'horizontal' | 'frequency';

export const Heatmap: React.FC<HeatmapProps> = ({ data, year, onDayClick, isDarkMode, theme, onThemeChange }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // View Preferences
  const [density, setDensity] = useState<Density>(() => {
      if (typeof window === 'undefined') return 'standard';
      return (localStorage.getItem('heatmap_density') as Density) || 'standard';
  });
  
  const [showWeekends, setShowWeekends] = useState(() => {
      if (typeof window === 'undefined') return true;
      const s = localStorage.getItem('heatmap_weekends');
      return s !== null ? s === 'true' : true;
  });

  const [layout, setLayout] = useState<LayoutType>(() => {
      if (typeof window === 'undefined') return 'vertical';
      // Migrate old 'orientation' to 'layout' if needed, default to vertical
      const old = localStorage.getItem('heatmap_orientation');
      if (old === 'horizontal') return 'horizontal';
      return (localStorage.getItem('heatmap_layout') as LayoutType) || 'vertical';
  });

  useEffect(() => {
      localStorage.setItem('heatmap_density', density);
  }, [density]);

  useEffect(() => {
      localStorage.setItem('heatmap_weekends', String(showWeekends));
  }, [showWeekends]);

  useEffect(() => {
      localStorage.setItem('heatmap_layout', layout);
  }, [layout]);

  // Click outside to close settings
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
              setShowSettings(false);
          }
      };
      if (showSettings) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  // Configuration for Skins
  const config = useMemo(() => ({
      compact: { height: 10, gap: 2, radius: 2 },
      standard: { height: 14, gap: 4, radius: 3 },
      spacious: { height: 18, gap: 6, radius: 4 }
  })[density], [density]);
  
  // Layout Constants
  const MONTH_LABEL_SIZE = 30;
  const DAY_LABEL_SIZE = 30;
  const TOP_LABEL_HEIGHT = 20;
  
  // Generate full year of dates
  const days = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const dayArray: DayStats[] = [];

    const logMap = new Map<string, StudyLog>();
    data.forEach(log => logMap.set(log.date, log));

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const log = logMap.get(dateStr);
      dayArray.push({
        date: new Date(d),
        dateStr,
        value: log?.hours || 0,
        notes: log?.notes
      });
    }

    if (!showWeekends) {
        return dayArray.filter(d => {
            const day = d.date.getDay();
            return day !== 0 && day !== 6;
        });
    }

    return dayArray;
  }, [data, year, showWeekends]);

  // Color Scales
  const colorScale = useMemo(() => {
      let range: string[] = [];
      if (isDarkMode) {
          switch (theme) {
            case 'blue': range = ['#172554', '#3b82f6']; break; // Darker Blue 950 to Blue 500
            case 'orange': range = ['#431407', '#f97316']; break; // Darker Orange 950 to Orange 500
            case 'purple': range = ['#3b0764', '#d8b4fe']; break; // Darker Purple 950 to Purple 300
            case 'green': 
            default: range = ['#052e16', '#4ade80']; break; // Darker Green 950 to Green 400
          }
      } else {
           switch (theme) {
            case 'blue': range = ['#dbeafe', '#1e40af']; break;
            case 'orange': range = ['#ffedd5', '#9a3412']; break;
            case 'purple': range = ['#f3e8ff', '#7e22ce']; break;
            case 'green': 
            default: range = ['#dcfce7', '#166534']; break;
          }
      }
      
      return d3.scaleLinear<string>()
        .domain([0.1, 8])
        .range(range)
        .clamp(true);
  }, [theme, isDarkMode]);

  // Helpers for Layout
  const isHorizontal = layout === 'horizontal' || layout === 'frequency';
  const numDaysPerRow = showWeekends ? 7 : 5;
  const weeksCount = 53; // Approx weeks in year

  // Calculate Dimensions
  let graphWidth = 0;
  let graphHeight = 0;
  
  if (isHorizontal) {
      // X-axis: Weeks, Y-axis: Days
      graphWidth = DAY_LABEL_SIZE + weeksCount * (config.height + config.gap) + 20;
      graphHeight = TOP_LABEL_HEIGHT + numDaysPerRow * (config.height + config.gap) + 10;
  } else {
      // X-axis: Days, Y-axis: Weeks
      // Fixed width container logic for Vertical, but we scale SVG viewBox
      graphWidth = 800; // Logical width for viewBox
      // Calculate dynamic cell width to fill 800px
      const availableWidth = graphWidth - MONTH_LABEL_SIZE - 20;
      const verticalCellWidth = (availableWidth - ((numDaysPerRow - 1) * config.gap)) / numDaysPerRow;
      
      graphHeight = TOP_LABEL_HEIGHT + weeksCount * (config.height + config.gap) + 20;
  }

  // Calculate Cell Positions
  const cells = useMemo(() => days.map(day => {
    const dayOfWeek = day.date.getDay(); // 0 (Sun) ... 6 (Sat)
    const weekIndex = d3.timeMonday.count(d3.timeYear(day.date), day.date);
    
    // Adjust day index based on Monday start preference for Grid
    let gridDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Radius calculation for frequency layout
    const maxRadius = config.height / 2;
    // Scale: 0 -> 2px (tiny dot), Max -> maxRadius
    // Non-linear scale for better visibility of small values
    const radius = day.value === 0 
        ? 1.5 
        : Math.min(maxRadius, Math.max(2, Math.sqrt(day.value / 8) * maxRadius));

    if (isHorizontal) {
        return {
            ...day,
            x: DAY_LABEL_SIZE + weekIndex * (config.height + config.gap),
            y: TOP_LABEL_HEIGHT + gridDayIndex * (config.height + config.gap),
            width: config.height,
            height: config.height,
            color: day.value === 0 ? (isDarkMode ? '#2d3748' : '#ebedf0') : colorScale(day.value),
            radius: radius
        };
    } else {
        // Vertical: X = Day, Y = Week
        const availableWidth = 800 - MONTH_LABEL_SIZE - 20;
        const cellW = (availableWidth - ((numDaysPerRow - 1) * config.gap)) / numDaysPerRow;
        
        return {
            ...day,
            x: MONTH_LABEL_SIZE + gridDayIndex * (cellW + config.gap),
            y: TOP_LABEL_HEIGHT + weekIndex * (config.height + config.gap),
            width: cellW,
            height: config.height,
            color: day.value === 0 ? (isDarkMode ? '#2d3748' : '#ebedf0') : colorScale(day.value),
            radius: radius // Usually not used in vertical but kept for consistency
        };
    }
  }), [days, isHorizontal, config, numDaysPerRow, isDarkMode, colorScale]);

  // Labels
  const labels = useMemo(() => {
      const monthNodes = [];
      const months = d3.timeMonths(new Date(year, 0, 1), new Date(year, 11, 31));

      if (isHorizontal) {
          // Month labels on Top X-Axis
          months.forEach(d => {
              const weekIndex = d3.timeMonday.count(d3.timeYear(d), d);
              monthNodes.push({
                  x: DAY_LABEL_SIZE + weekIndex * (config.height + config.gap),
                  y: 12,
                  label: d3.timeFormat("%b")(d),
                  anchor: 'start'
              });
          });
          
          // Day labels on Left Y-Axis
          const dayNames = showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
          dayNames.forEach((name, i) => {
               monthNodes.push({
                   x: DAY_LABEL_SIZE - 6,
                   y: TOP_LABEL_HEIGHT + i * (config.height + config.gap) + config.height / 2 + 3,
                   label: name,
                   anchor: 'end',
                   isDay: true
               });
          });

      } else {
          // Vertical View
          // Month labels on Left Y-Axis
           months.forEach(d => {
              const weekIndex = d3.timeMonday.count(d3.timeYear(d), d);
              monthNodes.push({
                  x: 0,
                  y: TOP_LABEL_HEIGHT + weekIndex * (config.height + config.gap) + config.height / 2 + 4,
                  label: d3.timeFormat("%b")(d),
                  anchor: 'start'
              });
          });
          // Day labels on Top X-Axis
          const dayNames = showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
          const availableWidth = 800 - MONTH_LABEL_SIZE - 20;
          const cellW = (availableWidth - ((numDaysPerRow - 1) * config.gap)) / numDaysPerRow;
          
          dayNames.forEach((name, i) => {
               monthNodes.push({
                   x: MONTH_LABEL_SIZE + i * (cellW + config.gap) + cellW / 2,
                   y: 12,
                   label: name,
                   anchor: 'middle',
                   isDay: true
               });
          });
      }
      return monthNodes;
  }, [year, config, isHorizontal, showWeekends, numDaysPerRow]);

  return (
    <div className="w-full flex flex-col bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-1 shadow-sm relative group">
        
        {/* Settings Panel Overlay */}
        {showSettings && (
            <div 
                ref={settingsRef}
                className="absolute top-14 right-4 z-20 p-5 bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl animate-fade-in-up w-72 backdrop-blur-xl"
            >
                <div className="space-y-6">
                    {/* Theme Selector */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Theme</label>
                        </div>
                        <div className="flex justify-between bg-gray-100 dark:bg-[#2c2c2e] p-2 rounded-xl">
                            {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                <button 
                                    key={t}
                                    onClick={() => onThemeChange(t)}
                                    className={`relative w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                                        t === 'green' ? 'bg-green-500 border-green-300 dark:border-green-800' : 
                                        t === 'blue' ? 'bg-blue-500 border-blue-300 dark:border-blue-800' : 
                                        t === 'orange' ? 'bg-orange-500 border-orange-300 dark:border-orange-800' : 'bg-purple-500 border-purple-300 dark:border-purple-800'
                                    } ${theme === t ? 'scale-110 ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600 dark:ring-offset-[#1c1c1e]' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                                >
                                    {theme === t && (
                                        <div className="w-2 h-2 bg-white rounded-full shadow-sm"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Layout Selector */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Layout</label>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-[#2c2c2e] p-1 rounded-lg">
                            {(['vertical', 'horizontal', 'frequency'] as LayoutType[]).map(o => (
                                <button
                                    key={o}
                                    onClick={() => setLayout(o)}
                                    className={`flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                                        layout === o 
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                                >
                                    {o.charAt(0).toUpperCase() + o.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Density Selector */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Box Size</label>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-[#2c2c2e] p-1 rounded-lg">
                             {(['compact', 'standard', 'spacious'] as Density[]).map((d) => (
                                 <button
                                    key={d}
                                    onClick={() => setDensity(d)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                        density === d 
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                                 >
                                     {d.charAt(0).toUpperCase() + d.slice(1)}
                                 </button>
                             ))}
                        </div>
                    </div>

                    {/* Filters */}
                    <div>
                         <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">View Options</label>
                        </div>
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2c2e] cursor-pointer transition-colors group/opt">
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Show Weekends</span>
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    checked={showWeekends}
                                    onChange={(e) => setShowWeekends(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col bg-white dark:bg-[#1c1c1e] rounded-xl border border-gray-200 dark:border-gray-700/50 p-6 relative transition-colors">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Activity Map</h3>
                <div className="flex items-center space-x-4">
                    {/* Settings Button */}
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${showSettings ? 'text-gray-900 bg-gray-100 dark:text-white dark:bg-white/10' : ''}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </button>
                </div>
            </div>

            {/* Main Heatmap SVG */}
            <div className={`w-full flex ${isHorizontal ? 'overflow-x-auto pb-2' : 'justify-center'} min-h-[200px] custom-scrollbar`}>
                <svg 
                    viewBox={`0 0 ${graphWidth} ${graphHeight}`} 
                    className="w-full h-auto"
                    style={isHorizontal ? { minWidth: graphWidth, height: graphHeight } : { maxHeight: 'none' }} 
                >
                    {/* Labels */}
                    {labels.map((l, i) => (
                        <text
                            key={`label-${i}`}
                            x={l.x}
                            y={l.y}
                            className={`text-[10px] ${l.isDay ? 'fill-gray-400' : 'fill-gray-500 font-bold'}`}
                            textAnchor={l.anchor as any}
                            alignmentBaseline="middle"
                        >
                            {l.label}
                        </text>
                    ))}

                    {/* Cells */}
                    {cells.map((cell) => {
                        const cellProps = {
                            key: cell.dateStr,
                            className: "cursor-pointer transition-all duration-200 hover:opacity-80",
                            onClick: () => onDayClick(cell.dateStr),
                            onMouseEnter: (e: React.MouseEvent) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({
                                    x: rect.x + rect.width / 2,
                                    y: rect.y - 10,
                                    content: (
                                        <div className="text-center">
                                            <div className="font-semibold text-gray-200">{cell.dateStr}</div>
                                            <div className="text-gray-300">{cell.value > 0 ? `${cell.value} hours` : 'No study logged'}</div>
                                            {cell.notes && (
                                                <div className="text-[10px] text-gray-400 mt-1 max-w-[150px] italic border-t border-gray-600 pt-1">
                                                    "{cell.notes}"
                                                </div>
                                            )}
                                            <div className="text-[9px] text-gray-500 mt-1">Click to edit</div>
                                        </div>
                                    )
                                });
                            },
                            onMouseLeave: () => setTooltip(null)
                        };

                        if (layout === 'frequency') {
                            return (
                                <g key={cell.dateStr} onClick={() => onDayClick(cell.dateStr)}>
                                    {/* Optional Grid Background Circle */}
                                    <circle
                                        cx={cell.x + cell.width / 2}
                                        cy={cell.y + cell.height / 2}
                                        r={config.height / 4} // Small dot for empty/grid
                                        className="fill-gray-200 dark:fill-gray-700/50"
                                    />
                                    <circle
                                        cx={cell.x + cell.width / 2}
                                        cy={cell.y + cell.height / 2}
                                        r={cell.radius}
                                        fill={cell.color}
                                        {...cellProps}
                                    />
                                </g>
                            );
                        } else {
                            return (
                                <rect
                                    x={cell.x}
                                    y={cell.y}
                                    width={cell.width}
                                    height={cell.height}
                                    rx={config.radius}
                                    fill={cell.color}
                                    {...cellProps}
                                />
                            );
                        }
                    })}
                </svg>
            </div>
        </div>

        {/* Tooltip Portal */}
        {tooltip && (
            <div
                className="fixed z-50 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full border border-gray-700 backdrop-blur-sm bg-opacity-95"
                style={{ left: tooltip.x, top: tooltip.y }}
            >
                {tooltip.content}
                <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-1 border-r border-b border-gray-700"></div>
            </div>
        )}
    </div>
  );
};