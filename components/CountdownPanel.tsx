import React, { useState, useEffect, useRef } from 'react';
import { CountdownItem, CountdownType } from '../types';
import * as storage from '../services/storageService';

const ICONS: Record<CountdownType, React.ReactNode> = {
    countdown: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    anniversary: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    birthday: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>,
    holiday: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
};

const COLORS: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
};

const TYPES_CONFIG: Record<CountdownType, { label: string; defaultColor: string; iconColor: string }> = {
    countdown: { label: 'Countdown', defaultColor: 'blue', iconColor: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300' },
    anniversary: { label: 'Anniversary', defaultColor: 'pink', iconColor: 'bg-pink-100 dark:bg-pink-900/40 text-pink-500' },
    birthday: { label: 'Birthday', defaultColor: 'orange', iconColor: 'bg-orange-100 dark:bg-orange-900/40 text-orange-500' },
    holiday: { label: 'Holiday', defaultColor: 'green', iconColor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-500' }
};

type ViewStatus = 'active' | 'archived';
type FilterType = 'all' | CountdownType;

export const CountdownPanel: React.FC = () => {
    const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewStatus, setViewStatus] = useState<ViewStatus>('active');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [showFilters, setShowFilters] = useState(true);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    
    // Form State
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [type, setType] = useState<CountdownType>('countdown');
    const [recurrence, setRecurrence] = useState<CountdownItem['recurrence']>('none');

    // Google Import State
    const [googleClientId, setGoogleClientId] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('google_client_id') || '';
        return '';
    });
    const [tokenClient, setTokenClient] = useState<any>(null);
    const [isImporting, setIsImporting] = useState(false);

    const headerMenuRef = useRef<HTMLDivElement>(null);

    // Initialize Google Scripts
    useEffect(() => {
        if (typeof (window as any).google === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (googleClientId) initTokenClient(googleClientId);
            };
            document.body.appendChild(script);
        } else if (googleClientId) {
            initTokenClient(googleClientId);
        }
    }, [googleClientId]);

    useEffect(() => {
        setCountdowns(storage.getCountdowns());
        
        const interval = setInterval(() => {
            setCountdowns(prev => [...prev]); 
        }, 60000);

        const handleClickOutside = (event: MouseEvent) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
                setIsHeaderMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const initTokenClient = (clientId: string) => {
        if (typeof (window as any).google !== 'undefined') {
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                // Request broader scope to ensure we can list calendars to find 'Birthdays'
                scope: 'https://www.googleapis.com/auth/calendar.readonly', 
                callback: (resp: any) => {
                    if (resp.access_token) importBirthdays(resp.access_token);
                    else {
                        setIsImporting(false);
                        console.error("OAuth response missing access token:", resp);
                    }
                },
            });
            setTokenClient(client);
        }
    };

    const importBirthdays = async (accessToken: string) => {
        setIsImporting(true);
        try {
            let targetCalendarId = 'addressbook#contacts@group.v.calendar.google.com'; // Default Google Birthdays ID
            let calendarFound = false;

            // 1. Get List of Calendars to find correct Birthday calendar ID
            const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (calListRes.ok) {
                const calList = await calListRes.json();
                
                // Find Birthday Calendar (check common IDs and name)
                const birthdayCal = calList.items.find((c: any) => 
                    c.id === 'addressbook#contacts@group.v.calendar.google.com' || 
                    c.id === '#contacts@group.v.calendar.google.com' ||
                    (c.summary && c.summary.toLowerCase().includes('birthday'))
                );

                if (birthdayCal) {
                    targetCalendarId = birthdayCal.id;
                    calendarFound = true;
                }
            } else {
                console.warn('Could not fetch calendar list, attempting default birthday calendar ID.');
            }

            // 3. Fetch Events (Next 365 days)
            const now = new Date();
            const nextYear = new Date();
            nextYear.setFullYear(now.getFullYear() + 1);
            
            const eventsRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events?timeMin=${now.toISOString()}&timeMax=${nextYear.toISOString()}&singleEvents=true&orderBy=startTime`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            
            if (!eventsRes.ok) {
                if (!calendarFound) {
                    throw new Error('Could not find the "Birthdays" calendar. Please ensure "Birthdays" is enabled in your Google Calendar settings.');
                }
                throw new Error('Failed to fetch events from the Birthday calendar.');
            }
            
            const eventsData = await eventsRes.json();

            // 4. Process and Save
            let importedCount = 0;
            const currentCountdowns = storage.getCountdowns();
            
            if (eventsData.items) {
                const newItems: CountdownItem[] = [];
                eventsData.items.forEach((evt: any) => {
                    // Birthday events usually are all-day, thus have start.date
                    if (!evt.start || !evt.start.date) return; 

                    // Clean title (e.g., "John Doe's Birthday" -> "John Doe")
                    const cleanTitle = evt.summary.replace(/'s Birthday|’s Birthday/gi, "").trim();
                    
                    // Check duplicate
                    const exists = currentCountdowns.some(c => c.title === cleanTitle && c.type === 'birthday') || newItems.some(n => n.title === cleanTitle);
                    
                    if (!exists) {
                        const newItem: CountdownItem = {
                            id: Date.now().toString() + Math.random().toString().slice(2, 8),
                            title: cleanTitle,
                            date: evt.start.date,
                            type: 'birthday',
                            color: 'orange',
                            recurrence: 'yearly',
                            isArchived: false
                        };
                        newItems.push(newItem);
                        importedCount++;
                    }
                });
                
                // Save batch
                if (newItems.length > 0) {
                    newItems.forEach(item => storage.saveCountdown(item));
                    setCountdowns(storage.getCountdowns());
                }
            }

            if (importedCount > 0) {
                alert(`Successfully imported ${importedCount} birthdays!`);
            } else {
                alert('No new birthdays found to import.');
            }

        } catch (e: any) {
            console.error(e);
            alert(`Error: ${e.message || 'An unexpected error occurred.'}`);
        } finally {
            setIsImporting(false);
        }
    };

    const handleGoogleImportClick = () => {
        if (!googleClientId) {
            const id = prompt("To import birthdays, please enter your Google Cloud Client ID:");
            if (id) {
                localStorage.setItem('google_client_id', id);
                setGoogleClientId(id);
                // Init client will run in useEffect
                alert("Client ID saved. Please click Import again to authorize.");
            }
            return;
        }

        if (tokenClient) {
            setIsImporting(true);
            tokenClient.requestAccessToken();
        } else {
            alert("Google Services are initializing. Please try again in a few seconds.");
            initTokenClient(googleClientId);
        }
    };

    // Set default recurrence when type changes for new events
    useEffect(() => {
        if (!editId) {
            if (type === 'birthday' || type === 'anniversary' || type === 'holiday') {
                setRecurrence('yearly');
            } else {
                setRecurrence('none');
            }
        }
    }, [type, editId]);

    const calculateDiff = (targetDate: string, recurrenceRule: CountdownItem['recurrence'] = 'none') => {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        let target = new Date(targetDate);
        target.setHours(0,0,0,0);
        
        // Handle recurrence adjustment
        if (recurrenceRule && recurrenceRule !== 'none' && target.getTime() < now.getTime()) {
            if (recurrenceRule === 'yearly') {
                target.setFullYear(now.getFullYear());
                if (target.getTime() < now.getTime()) {
                    target.setFullYear(now.getFullYear() + 1);
                }
            } else if (recurrenceRule === 'monthly') {
                target.setMonth(now.getMonth());
                if (target.getTime() < now.getTime()) {
                    target.setMonth(now.getMonth() + 1);
                }
            } else if (recurrenceRule === 'weekly') {
                // Advance by weeks until future
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                const diff = now.getTime() - target.getTime();
                const weeksToAdd = Math.ceil(diff / oneWeek);
                target = new Date(target.getTime() + weeksToAdd * oneWeek);
            } else if (recurrenceRule === 'daily') {
                target = new Date(now); // It's today or tomorrow technically, let's say it's always "today" or "tomorrow"
            }
        }

        const diff = target.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        return {
            days: Math.abs(days),
            isFuture: days >= 0,
            displayDate: target
        };
    };

    const handleSave = () => {
        if (!title || !date) return;
        
        const item: CountdownItem = {
            id: editId || Date.now().toString(),
            title,
            date,
            type,
            color: TYPES_CONFIG[type].defaultColor,
            isArchived: editId ? countdowns.find(c => c.id === editId)?.isArchived : false,
            recurrence
        };
        
        const newItems = storage.saveCountdown(item);
        setCountdowns(newItems);
        closeModal();
    };

    const handleDelete = (id: string) => {
        if (confirm('Permanently delete this countdown?')) {
            const newItems = storage.deleteCountdown(id);
            setCountdowns(newItems);
        }
    };

    const toggleArchive = (id: string, archive: boolean) => {
        const item = countdowns.find(c => c.id === id);
        if (item) {
            const updatedItem = { ...item, isArchived: archive };
            const newItems = storage.saveCountdown(updatedItem);
            setCountdowns(newItems);
        }
    };

    const openModal = (item?: CountdownItem) => {
        if (item) {
            setEditId(item.id);
            setTitle(item.title);
            setDate(item.date);
            setType(item.type);
            setRecurrence(item.recurrence || 'none');
        } else {
            setEditId(null);
            setTitle('');
            setDate('');
            setType('countdown');
            setRecurrence('none');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditId(null);
    };

    const filteredCountdowns = countdowns.filter(item => {
        const matchesStatus = viewStatus === 'active' ? !item.isArchived : item.isArchived;
        const matchesType = filterType === 'all' || item.type === filterType;
        return matchesStatus && matchesType;
    });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
            <div className="p-8 h-full overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="relative" ref={headerMenuRef}>
                            <button 
                                onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                                className="text-3xl font-bold text-gray-900 dark:text-white flex items-center hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                Countdown
                                <svg className={`w-6 h-6 ml-2 text-gray-400 transition-transform ${isHeaderMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {/* Dropdown */}
                            {isHeaderMenuOpen && (
                                <div className="absolute top-full left-0 mt-2 w-48 bg-[#2c2c2e] rounded-xl shadow-xl border border-gray-700 py-1 z-30 animate-fade-in-up">
                                    <button 
                                        onClick={() => { setViewStatus('active'); setIsHeaderMenuOpen(false); }}
                                        className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors"
                                    >
                                        <span>Active</span>
                                        {viewStatus === 'active' && <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                    <button 
                                        onClick={() => { setViewStatus('archived'); setIsHeaderMenuOpen(false); }}
                                        className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors"
                                    >
                                        <span>Archived</span>
                                        {viewStatus === 'archived' && <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex space-x-2">
                            <button 
                                onClick={handleGoogleImportClick}
                                disabled={isImporting}
                                className={`flex items-center space-x-2 px-3 py-2 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 rounded-lg text-sm text-orange-700 dark:text-orange-400 transition-colors ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Import Birthdays from Google Calendar"
                            >
                                {isImporting ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                )}
                                <span className="text-xs font-medium hidden sm:inline">Import</span>
                            </button>

                            <button 
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center space-x-2 px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                <span className="text-xs font-medium">{showFilters ? 'Hide Group' : 'Show Group'}</span>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); openModal(); }}
                                className="p-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    {showFilters && (
                        <div className="flex justify-between items-center mb-6 animate-fade-in-up origin-top">
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => setFilterType('all')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                                >
                                    All
                                </button>
                                {(Object.keys(TYPES_CONFIG) as CountdownType[]).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setFilterType(t)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${filterType === t ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                                    >
                                        {TYPES_CONFIG[t].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                        {filteredCountdowns.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
                                No {viewStatus} items found.
                            </div>
                        ) : (
                            filteredCountdowns.map((item) => {
                                const { days, isFuture, displayDate } = calculateDiff(item.date, item.recurrence);
                                const dateString = displayDate.toLocaleDateString('en-GB'); 
                                
                                return (
                                    <div 
                                        key={item.id} 
                                        className="relative group bg-gray-900 dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-800 dark:border-gray-700 shadow-lg flex flex-col items-center justify-center text-center min-h-[220px] transition-transform hover:-translate-y-1"
                                    >
                                        <div className="flex items-center space-x-2 mb-4">
                                            <div className={`p-1.5 rounded-full ${COLORS[item.color] || COLORS.blue}`}>
                                                {ICONS[item.type]}
                                            </div>
                                            <span className="text-gray-300 font-medium">{item.title}</span>
                                        </div>
                                        
                                        <div className="text-6xl font-bold text-blue-500 dark:text-blue-400 mb-4 tracking-tighter">
                                            {days}
                                        </div>
                                        
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {isFuture ? 'Days until' : 'Days since'} {dateString}
                                            {item.recurrence && item.recurrence !== 'none' && (
                                                <div className="text-xs text-gray-600 mt-1 capitalize flex items-center justify-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    {item.recurrence}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Actions (Hover) */}
                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openModal(item); }}
                                                className="p-1.5 text-gray-500 hover:text-white bg-gray-800 rounded-lg mr-1"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleArchive(item.id, !item.isArchived); }}
                                                className="p-1.5 text-gray-500 hover:text-blue-400 bg-gray-800 rounded-lg mr-1"
                                                title={item.isArchived ? "Restore" : "Archive"}
                                            >
                                                {item.isArchived ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                                )}
                                            </button>

                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                className="p-1.5 text-gray-500 hover:text-red-400 bg-gray-800 rounded-lg"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#151516] rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-[#1c1c1e]">
                            <h3 className="font-bold text-white">{editId ? 'Edit Event' : 'New Countdown'}</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 pl-1">Title</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. New Year's Day"
                                    className="w-full px-4 py-3 bg-[#2c2c2e] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 pl-1">Date</label>
                                <input 
                                    type="date" 
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#2c2c2e] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white [color-scheme:dark]"
                                />
                            </div>
                            
                            <div className="border-2 border-dashed border-gray-700/50 rounded-xl p-4 pt-6 relative mt-6">
                                <label className="absolute -top-3 left-3 px-2 bg-[#151516] text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.keys(TYPES_CONFIG) as CountdownType[]).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setType(t)}
                                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-all text-left group ${
                                                type === t 
                                                ? 'border-blue-500 bg-blue-500/10' 
                                                : 'border-gray-700 bg-[#2c2c2e] hover:bg-[#3a3a3c]'
                                            }`}
                                        >
                                            <div className={`p-2 rounded-full shrink-0 ${type === t ? 'bg-blue-500 text-white' : TYPES_CONFIG[t].iconColor}`}>
                                                {ICONS[t]}
                                            </div>
                                            <span className={`text-sm font-medium ${type === t ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                {TYPES_CONFIG[t].label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                             <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 pl-1">Recurrence</label>
                                <div className="relative">
                                    <select 
                                        value={recurrence || 'none'}
                                        onChange={(e) => setRecurrence(e.target.value as any)}
                                        className="w-full px-4 py-3 bg-[#2c2c2e] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white appearance-none"
                                    >
                                        <option value="none">None</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-[#1c1c1e] border-t border-gray-700 flex justify-end space-x-3">
                            <button onClick={closeModal} className="px-5 py-2.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                            <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-colors">Save Event</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};