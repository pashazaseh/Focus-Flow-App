import React, { useState, useMemo, useEffect } from 'react';
import { StudyLog, CustomEvent, GoogleEvent } from '../types';
import * as storage from '../services/storageService';

declare const google: any;

interface CalendarPanelProps {
  logs: StudyLog[];
}

interface CalendarEventDisplay {
    id: string;
    originalId?: string; // For recurring events to link back to parent
    title: string;
    date: Date;
    type: 'study' | 'custom' | 'google';
    customType?: CustomEvent['type'];
    color: string;
    isCustom?: boolean;
    time?: string;
    description?: string;
    location?: string;
    link?: string;
    recurrence?: CustomEvent['recurrence'];
    calendar?: string;
    reminderMinutes?: number;
}

// Colors for custom event selection with picker colors
const EVENT_COLORS = [
    { name: 'Blue', value: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200 border-blue-200 dark:border-blue-500/30', picker: 'bg-blue-500' },
    { name: 'Red', value: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200 border-red-200 dark:border-red-500/30', picker: 'bg-red-500' },
    { name: 'Green', value: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200 border-green-200 dark:border-green-500/30', picker: 'bg-green-500' },
    { name: 'Purple', value: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200 border-purple-200 dark:border-purple-500/30', picker: 'bg-purple-500' },
    { name: 'Orange', value: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200 border-orange-200 dark:border-orange-500/30', picker: 'bg-orange-500' },
];

export const CalendarPanel: React.FC<CalendarPanelProps> = ({ logs }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    
    // Google Integration State
    const [isConnected, setIsConnected] = useState(false);
    const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
    const [googleClientId, setGoogleClientId] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('google_client_id') || '';
        }
        return '';
    });
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [tokenClient, setTokenClient] = useState<any>(null);

    const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
    
    // Calendar Visibility States
    const [calendars, setCalendars] = useState({
        studyLogs: true,
        personal: true,
        google: true,
    });

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // New: Details Modal State
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [viewEvent, setViewEvent] = useState<CalendarEventDisplay | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null); // If set, we are editing
    const [selectedDateForEvent, setSelectedDateForEvent] = useState(new Date().toISOString().split('T')[0]);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventTime, setNewEventTime] = useState('');
    const [newEventType, setNewEventType] = useState<CustomEvent['type']>('meeting');
    const [newEventColor, setNewEventColor] = useState(EVENT_COLORS[0].value);
    const [newEventDesc, setNewEventDesc] = useState('');
    const [newEventLoc, setNewEventLoc] = useState('');
    const [newEventRecurrence, setNewEventRecurrence] = useState<CustomEvent['recurrence']>('none');
    const [newEventCalendar, setNewEventCalendar] = useState<string>('Personal');
    const [newEventReminder, setNewEventReminder] = useState<number>(0);

    useEffect(() => {
        setCustomEvents(storage.getCustomEvents());
        
        // Only load script if we don't have google object yet
        if (typeof google === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (googleClientId) {
                    initTokenClient(googleClientId);
                }
            };
            document.body.appendChild(script);

            return () => {
                document.body.removeChild(script);
            };
        } else if (googleClientId) {
            initTokenClient(googleClientId);
        }
    }, []);

    const initTokenClient = (clientId: string) => {
        if (!clientId) return;
        
        try {
            if (typeof google !== 'undefined' && google.accounts) {
                const client = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
                    callback: async (tokenResponse: any) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            setIsConnected(true);
                            await fetchGoogleEvents(tokenResponse.access_token);
                        }
                    },
                });
                setTokenClient(client);
            }
        } catch (e) {
            console.error("Failed to initialize Google Token Client", e);
        }
    };

    const handleGoogleConnect = () => {
        if (!googleClientId) {
            setIsConfigOpen(true);
            return;
        }
        
        if (tokenClient) {
            try {
                tokenClient.requestAccessToken();
            } catch (e) {
                console.error("Error requesting token", e);
                initTokenClient(googleClientId);
                alert("Connection reset. Please try clicking Sync again.");
            }
        } else {
            initTokenClient(googleClientId);
            setTimeout(() => {
                if (tokenClient) {
                    tokenClient.requestAccessToken();
                } else {
                    alert("Google Services not ready. Please check your internet connection or Client ID.");
                    setIsConfigOpen(true);
                }
            }, 500);
        }
    };

    const fetchGoogleEvents = async (accessToken: string) => {
        try {
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfMonth}&timeMax=${endOfMonth}&singleEvents=true&orderBy=startTime`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            
            if (!response.ok) {
                throw new Error("Failed to fetch events");
            }

            const data = await response.json();
            if (data.items) {
                setGoogleEvents(data.items);
            }
        } catch (error) {
            console.error("Error fetching Google Calendar events:", error);
            alert("Failed to sync Google Calendar. Please check your Client ID and permissions.");
            setIsConnected(false);
        }
    };

    const handleSaveClientId = () => {
        if(!googleClientId.trim()) {
            alert("Please enter a valid Client ID");
            return;
        }
        localStorage.setItem('google_client_id', googleClientId);
        initTokenClient(googleClientId);
        setIsConfigOpen(false);
    };
    
    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const toggleCalendar = (key: keyof typeof calendars) => {
        setCalendars(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // --- Data merging ---
    const events = useMemo(() => {
        const allEvents: CalendarEventDisplay[] = [];

        // Study Logs
        if (calendars.studyLogs) {
            logs.forEach(log => {
                if (log.hours > 0) {
                    allEvents.push({
                        id: `log-${log.date}`,
                        title: `${log.hours}h Study`,
                        date: new Date(log.date),
                        type: 'study',
                        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 border-indigo-200 dark:border-indigo-500/30',
                        description: log.notes,
                        calendar: 'Study Logs'
                    });
                }
            });
        }

        // Custom Events with Recurrence Logic
        if (calendars.personal) {
            const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const viewEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 31);

            customEvents.forEach(evt => {
                let color = evt.color;
                if (!color) {
                    if (evt.type === 'meeting') color = EVENT_COLORS[3].value;
                    else if (evt.type === 'deadline') color = EVENT_COLORS[1].value;
                    else if (evt.type === 'reminder') color = EVENT_COLORS[4].value;
                    else color = EVENT_COLORS[2].value;
                }

                const displayCalendar = evt.calendar || 'Personal';

                if (!evt.recurrence || evt.recurrence === 'none') {
                    allEvents.push({
                        id: evt.id,
                        originalId: evt.id,
                        title: evt.title,
                        date: new Date(evt.date),
                        time: evt.time,
                        type: 'custom',
                        customType: evt.type,
                        color: color || 'bg-gray-100',
                        isCustom: true,
                        description: evt.description,
                        location: evt.location,
                        recurrence: evt.recurrence,
                        calendar: displayCalendar,
                        reminderMinutes: evt.reminderMinutes
                    });
                } else {
                    const startDate = new Date(evt.date);
                    // Normalize start date to midnight for comparison
                    const startMidnight = new Date(startDate);
                    startMidnight.setHours(0,0,0,0);

                    for (let d = new Date(viewStart); d <= viewEnd; d.setDate(d.getDate() + 1)) {
                         const currentMidnight = new Date(d);
                         currentMidnight.setHours(0,0,0,0);
                         
                        if (currentMidnight < startMidnight) continue;

                        let isMatch = false;
                        if (evt.recurrence === 'daily') isMatch = true;
                        if (evt.recurrence === 'weekly' && d.getDay() === startDate.getDay()) isMatch = true;
                        if (evt.recurrence === 'monthly' && d.getDate() === startDate.getDate()) isMatch = true;

                        if (isMatch) {
                            allEvents.push({
                                id: `${evt.id}-${d.toISOString().split('T')[0]}`,
                                originalId: evt.id,
                                title: evt.title,
                                date: new Date(d),
                                time: evt.time,
                                type: 'custom',
                                customType: evt.type,
                                color: color || 'bg-gray-100',
                                isCustom: true,
                                description: evt.description,
                                location: evt.location,
                                recurrence: evt.recurrence,
                                calendar: displayCalendar,
                                reminderMinutes: evt.reminderMinutes
                            });
                        }
                    }
                }
            });
        }

        if (calendars.google && googleEvents.length > 0) {
            googleEvents.forEach(evt => {
                const start = evt.start.dateTime || evt.start.date;
                if (start) {
                    const dateObj = new Date(start);
                    const timeStr = evt.start.dateTime 
                        ? dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) 
                        : undefined;

                    allEvents.push({
                        id: evt.id,
                        title: evt.summary,
                        date: dateObj,
                        time: timeStr,
                        type: 'google',
                        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 border-emerald-200 dark:border-emerald-500/30',
                        description: evt.description,
                        location: evt.location,
                        link: evt.htmlLink,
                        calendar: 'Google'
                    });
                }
            });
        }

        // Apply Search Filter
        let result = allEvents;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e => 
                e.title.toLowerCase().includes(q) || 
                (e.description && e.description.toLowerCase().includes(q)) || 
                (e.location && e.location.toLowerCase().includes(q))
            );
        }

        return result.sort((a,b) => {
             if (a.date.getTime() === b.date.getTime()) {
                 if (a.time && b.time) return a.time.localeCompare(b.time);
                 return 0;
             }
             return a.date.getTime() - b.date.getTime();
        });
    }, [logs, calendars, currentDate, customEvents, googleEvents, searchQuery]);

    // --- Handlers ---
    const handleDayClick = (dateStr: string) => {
        resetForm();
        setSelectedDateForEvent(dateStr);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setNewEventTitle('');
        setNewEventTime('');
        setNewEventDesc('');
        setNewEventLoc('');
        setNewEventType('meeting');
        setNewEventRecurrence('none');
        setNewEventColor(EVENT_COLORS[0].value);
        setNewEventCalendar('Personal');
        setNewEventReminder(0);
    };

    const handleEventClick = (event: CalendarEventDisplay) => {
        setViewEvent(event);
        setIsDetailsOpen(true);
    };

    const switchToEditMode = () => {
        if (!viewEvent || !viewEvent.isCustom || !viewEvent.originalId) return;
        
        const rawEvent = customEvents.find(e => e.id === viewEvent.originalId);
        if (!rawEvent) return;

        setEditingId(rawEvent.id);
        setNewEventTitle(rawEvent.title);
        setSelectedDateForEvent(rawEvent.date);
        setNewEventTime(rawEvent.time || '');
        setNewEventDesc(rawEvent.description || '');
        setNewEventLoc(rawEvent.location || '');
        setNewEventType(rawEvent.type);
        setNewEventRecurrence(rawEvent.recurrence || 'none');
        setNewEventColor(rawEvent.color || EVENT_COLORS[0].value);
        setNewEventCalendar(rawEvent.calendar || 'Personal');
        setNewEventReminder(rawEvent.reminderMinutes || 0);
        
        setIsDetailsOpen(false); // Close details modal
        setIsModalOpen(true); // Open form modal
    };

    const handleSaveEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventTitle) return;

        const eventData: CustomEvent = {
            id: editingId || Date.now().toString(),
            title: newEventTitle,
            date: selectedDateForEvent,
            time: newEventTime,
            type: newEventType,
            description: newEventDesc,
            location: newEventLoc,
            color: newEventColor,
            recurrence: newEventRecurrence,
            calendar: newEventCalendar,
            reminderMinutes: newEventReminder
        };
        
        const updatedEvents = storage.saveCustomEvent(eventData);
        setCustomEvents(updatedEvents);
        setIsModalOpen(false);
        resetForm();
    };

    const handleDeleteEvent = () => {
         // Can delete either from form (using editingId) or details view (using viewEvent.originalId)
         const idToDelete = editingId || viewEvent?.originalId;

         if (idToDelete && confirm('Are you sure you want to delete this event?')) {
             const updatedEvents = storage.deleteCustomEvent(idToDelete);
             setCustomEvents(updatedEvents);
             setIsModalOpen(false);
             setIsDetailsOpen(false);
             resetForm();
         }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    // Calendar Calculations
    const days = daysInMonth(currentDate);
    const startDay = firstDayOfMonth(currentDate); // 0 = Sun
    const offset = startDay; 
    const totalSlots = Math.ceil((days + offset) / 7) * 7;

    const renderEventsForDay = (day: number) => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dayStr = d.toDateString();
        const dayEvents = events.filter(e => e.date.toDateString() === dayStr);

        return dayEvents.slice(0, 4).map((evt, idx) => (
             <button 
                key={`${evt.id}-${idx}`}
                onClick={(e) => { e.stopPropagation(); handleEventClick(evt); }}
                className={`text-[10px] w-full text-left px-2 py-1 rounded-md truncate mb-1 border-l-[3px] transition-all hover:brightness-95 hover:scale-[1.02] shadow-sm ${evt.color}`}
                title={evt.title}
             >
                 {evt.time && <span className="mr-1.5 opacity-75 font-mono">{evt.time}</span>}
                 <span className="font-semibold">{evt.title}</span>
             </button>
        ));
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
             
             {/* Header */}
             <div className="flex flex-col md:flex-row justify-between items-center p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm shrink-0 z-10 relative">
                <div className="flex items-center space-x-4 mb-4 md:mb-0">
                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                        <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg text-gray-500 dark:text-gray-300 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg text-gray-500 dark:text-gray-300 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={goToToday} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800">
                        Today
                    </button>
                </div>

                {/* Search Bar */}
                <div className="flex-1 max-w-md mx-4 hidden md:block">
                    <div className="relative">
                        <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input 
                            type="text" 
                            placeholder="Search events..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700/50 border-none rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                     <button 
                        onClick={() => setIsConfigOpen(true)}
                        className={`p-2.5 rounded-xl transition-all border ${isConnected ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-100'}`}
                        title="Google Calendar Settings"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     </button>
                     <button 
                        onClick={handleGoogleConnect}
                        className="px-5 py-2.5 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm font-semibold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center"
                     >
                         <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                         Sync Google
                     </button>
                </div>
             </div>

             {/* Grid */}
             <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700/50 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700/50 shadow-sm">
                     {/* Week Days */}
                     {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                         <div key={day} className="bg-gray-50/80 dark:bg-[#252527] p-3 text-center text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest backdrop-blur-sm">
                             {day}
                         </div>
                     ))}

                     {/* Days */}
                     {Array.from({ length: totalSlots }).map((_, index) => {
                         const dayNumber = index - offset + 1;
                         const isCurrentMonth = dayNumber > 0 && dayNumber <= days;
                         const isToday = isCurrentMonth && dayNumber === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                         
                         if (!isCurrentMonth) {
                             return <div key={index} className="bg-gray-50/30 dark:bg-[#1a1a1c]/50 min-h-[120px]"></div>;
                         }

                         const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber).toISOString().split('T')[0];

                         return (
                             <div 
                                key={index} 
                                className={`group bg-white dark:bg-[#1c1c1e] min-h-[120px] p-2 hover:bg-blue-50/30 dark:hover:bg-[#252527] transition-all duration-200 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-900/30 ${isToday ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}`}
                                onClick={() => handleDayClick(dateStr)}
                             >
                                 <div className="flex justify-between items-start mb-2">
                                     <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-gray-700 dark:text-gray-300 group-hover:bg-gray-100 dark:group-hover:bg-gray-700'}`}>
                                         {dayNumber}
                                     </span>
                                     <button 
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-blue-500 transition-all"
                                        title="Add event"
                                     >
                                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                     </button>
                                 </div>
                                 <div className="space-y-1">
                                     {renderEventsForDay(dayNumber)}
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>

             {/* Details Modal */}
             {isDetailsOpen && viewEvent && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
                     <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-sm rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in flex flex-col">
                         {/* Details Header with dynamic color - Fixed visibility */}
                         <div className={`p-6 pb-8 ${viewEvent.color} relative border-b border-gray-100 dark:border-gray-700/50`}>
                             <div className="absolute top-4 right-4">
                                 <button onClick={() => setIsDetailsOpen(false)} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-current transition-colors">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                             </div>
                             <div className="mt-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 bg-white/30 backdrop-blur-sm text-current border border-white/20`}>
                                    {viewEvent.type === 'study' ? 'Study Log' : viewEvent.customType || viewEvent.type}
                                </span>
                                <h3 className="text-2xl font-bold leading-tight opacity-95">{viewEvent.title}</h3>
                             </div>
                         </div>
                         
                         <div className="p-6 -mt-4 bg-white dark:bg-[#1c1c1e] rounded-t-3xl flex-1">
                             <div className="space-y-5">
                                 {/* Time & Date */}
                                 <div className="flex items-center text-gray-700 dark:text-gray-300">
                                     <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3 shrink-0 text-gray-500">
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                     </div>
                                     <div>
                                         <p className="text-sm font-semibold">{viewEvent.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                         {viewEvent.time && <p className="text-xs text-gray-500 dark:text-gray-400">{viewEvent.time}</p>}
                                     </div>
                                 </div>

                                 {/* Location */}
                                 {viewEvent.location && (
                                     <div className="flex items-center text-gray-700 dark:text-gray-300">
                                         <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3 shrink-0 text-gray-500">
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                         </div>
                                         <p className="text-sm">{viewEvent.location}</p>
                                     </div>
                                 )}

                                 {/* Description */}
                                 {viewEvent.description && (
                                     <div className="flex items-start text-gray-700 dark:text-gray-300">
                                         <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3 shrink-0 text-gray-500 mt-0.5">
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                         </div>
                                         <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{viewEvent.description}</p>
                                     </div>
                                 )}

                                 {/* Google Link */}
                                 {viewEvent.link && (
                                     <a href={viewEvent.link} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 hover:underline text-sm">
                                         <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                         Open in Google Calendar
                                     </a>
                                 )}
                             </div>
                         </div>

                         {/* Footer Actions */}
                         <div className="p-4 bg-gray-50 dark:bg-[#252527] border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                             {viewEvent.isCustom ? (
                                 <>
                                     <button 
                                        onClick={handleDeleteEvent}
                                        className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors"
                                     >
                                         Delete
                                     </button>
                                     <button 
                                        onClick={switchToEditMode}
                                        className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-bold hover:shadow-lg transition-all"
                                     >
                                         Edit Event
                                     </button>
                                 </>
                             ) : (
                                <button 
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Close
                                </button>
                             )}
                         </div>
                     </div>
                 </div>
             )}

             {/* Google Config Modal */}
             {isConfigOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
                     <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in">
                         <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252527] flex justify-between items-center">
                             <h3 className="font-bold text-gray-900 dark:text-white">Google Calendar Setup</h3>
                             <button onClick={() => setIsConfigOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                         <div className="p-6">
                             <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                 To view your Google Calendar events, you need to provide a Google Cloud Client ID.
                                 <br/><br/>
                                 1. Go to Google Cloud Console.<br/>
                                 2. Create a project & enable Google Calendar API.<br/>
                                 3. Create OAuth 2.0 Client ID.<br/>
                                 4. Paste Client ID here.
                             </p>
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Client ID</label>
                             <input 
                                type="text" 
                                value={googleClientId}
                                onChange={(e) => setGoogleClientId(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="apps.googleusercontent.com"
                             />
                         </div>
                         <div className="px-6 py-4 bg-gray-50 dark:bg-[#252527] border-t border-gray-200 dark:border-gray-700 flex justify-end">
                             <button onClick={handleSaveClientId} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">Save & Connect</button>
                         </div>
                     </div>
                 </div>
             )}

             {/* Add/Edit Event Modal */}
             {isModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
                     <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in">
                         <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252527] flex justify-between items-center">
                             <h3 className="font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Event' : 'New Event'}</h3>
                             <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                         <form onSubmit={handleSaveEvent} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                                 <input type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" placeholder="Event Title" required />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                    <input type="date" value={selectedDateForEvent} onChange={(e) => setSelectedDateForEvent(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]" required />
                                 </div>
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Time (Optional)</label>
                                    <input type="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]" />
                                 </div>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Color</label>
                                 <div className="flex space-x-2">
                                     {EVENT_COLORS.map(c => (
                                         <button 
                                            key={c.name} 
                                            type="button"
                                            onClick={() => setNewEventColor(c.value)}
                                            className={`w-8 h-8 rounded-full ${c.picker} ${newEventColor === c.value ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : ''}`}
                                            title={c.name}
                                         />
                                     ))}
                                 </div>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Recurrence</label>
                                    <select value={newEventRecurrence} onChange={(e) => setNewEventRecurrence(e.target.value as any)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500">
                                        <option value="none">None</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                 </div>
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reminder (mins)</label>
                                    <input type="number" value={newEventReminder} onChange={(e) => setNewEventReminder(parseInt(e.target.value))} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" placeholder="0" />
                                 </div>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                                 <textarea rows={3} value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" placeholder="Notes..."></textarea>
                             </div>
                         </form>
                         <div className="px-6 py-4 bg-gray-50 dark:bg-[#252527] border-t border-gray-200 dark:border-gray-700 flex justify-between">
                             {editingId ? (
                                 <button onClick={handleDeleteEvent} className="text-red-500 hover:text-red-600 font-medium text-sm">Delete Event</button>
                             ) : <div></div>}
                             <div className="flex space-x-3">
                                 <button onClick={closeModal} className="px-4 py-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-sm font-medium">Cancel</button>
                                 <button onClick={handleSaveEvent} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow-md">Save Event</button>
                             </div>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};