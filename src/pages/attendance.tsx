import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Users,
  Home,
  GraduationCap,
  Settings,
  Wallet,
  Check,
  Save,
  Sparkles,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  SlidersHorizontal,
  Lock,
  AlertTriangle,
  X,
  ArrowLeft,
  CalendarDays
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const CLASS_MODAL_ITEMS_PER_PAGE = 7;

// Helper function to process class documents according to Firestore Schema
const processClassDoc = (docSnap: any) => {
  const data = docSnap.data();
  const rawStudents = data.students || [];

  // Parse and normalize student data dynamically from Firestore document
  const sortedStudents = rawStudents
    .map((s: any, idx: number) => {
      const rawGenderStr = String(s.gender || '').trim().toLowerCase();
      let normalizedGen: 'M' | 'F' = 'M';

      if (
        rawGenderStr.startsWith('f') || 
        rawGenderStr.includes('female') || 
        rawGenderStr.includes('girl')
      ) {
        normalizedGen = 'F';
      } else if (
        rawGenderStr.startsWith('m') || 
        rawGenderStr.includes('male') || 
        rawGenderStr.includes('boy')
      ) {
        normalizedGen = 'M';
      } else {
        normalizedGen = idx % 2 === 0 ? 'M' : 'F';
      }

      return {
        ...s,
        id: s.id || s.rollNo || String(idx + 1),
        name: s.name || `Student ${idx + 1}`,
        rollNo: s.rollNo ? String(s.rollNo) : String(idx + 1),
        gender: normalizedGen,
        feeStatus: s.feeStatus || 'Unpaid',
        avatar: s.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      };
    })
    .sort((a: any, b: any) => {
      const numA = parseInt(a.rollNo, 10);
      const numB = parseInt(b.rollNo, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.rollNo).localeCompare(String(b.rollNo));
    });

  return {
    id: docSnap.id,
    name: data.name || 'Unnamed Class',
    code: data.code || 'N/A',
    students: sortedStudents
  };
};

export default function Attendance() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('attendance');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingClasses, setIsLoadingClasses] = useState<boolean>(true);
  
  // Class Selection Modal States
  const [isClassModalOpen, setIsClassModalOpen] = useState<boolean>(false);
  const [classModalPage, setClassModalPage] = useState<number>(1);
  const [classModalSearch, setClassModalSearch] = useState<string>('');

  // Filters
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [feeFilter, setFeeFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  
  // Confirmation Checkbox before save
  const [isReadyToSave, setIsReadyToSave] = useState(false);
  const [showReadyToast, setShowReadyToast] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // States for Lock & Duplicate Save Control
  const [isAlreadySaved, setIsAlreadySaved] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [showTickOverlay, setShowTickOverlay] = useState(false);

  // Dynamic Date Setup
  const [selectedDate, setSelectedDate] = useState('');
  const [yesterdayDate, setYesterdayDate] = useState('');

  // Skipped Dates Modal States
  const [lastSavedDate, setLastSavedDate] = useState<string | null>(null);
  const [skippedDates, setSkippedDates] = useState<string[]>([]);
  const [holidaySelections, setHolidaySelections] = useState<Record<string, boolean>>({});
  const [showSkipModal, setShowSkipModal] = useState<boolean>(false);
  const [isSavingSkipped, setIsSavingSkipped] = useState<boolean>(false);

  // 1. LISTEN TO FIREBASE AUTH & CAPTURE LOGGED IN USER CREDENTIALS
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.email) {
          setCurrentUserEmail(user.email);
          localStorage.setItem('userEmail', user.email);
        }
        if (user.uid) {
          setCurrentUserUid(user.uid);
          localStorage.setItem('userUid', user.uid);
        }
      } else {
        const savedEmail = localStorage.getItem('userEmail');
        const savedUid = localStorage.getItem('userUid');
        if (savedEmail) setCurrentUserEmail(savedEmail);
        if (savedUid) setCurrentUserUid(savedUid);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yday = new Date(today);
    yday.setDate(yday.getDate() - 1);
    const yesterdayStr = yday.toISOString().split('T')[0];

    setSelectedDate(todayStr);
    setYesterdayDate(yesterdayStr);
  }, []);

  // Update yesterdayDate automatically whenever selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() - 1);
    setYesterdayDate(curr.toISOString().split('T')[0]);
  }, [selectedDate]);

  // 2. REAL-TIME FETCHING OF CLASSES & STUDENTS FROM FIREBASE
  useEffect(() => {
    if (!db) {
      setIsLoadingClasses(false);
      return;
    }

    setIsLoadingClasses(true);
    let activeUnsubscribe: (() => void) | null = null;

    const email = currentUserEmail || auth?.currentUser?.email || localStorage.getItem('userEmail');
    const uid = currentUserUid || auth?.currentUser?.uid || localStorage.getItem('userUid');

    const handleSnapshot = (snapshot: any) => {
      if (snapshot && !snapshot.empty) {
        let fetchedClasses = snapshot.docs.map(processClassDoc);
        fetchedClasses = fetchedClasses.sort((a: any, b: any) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        setClasses(fetchedClasses);
        setSelectedClassId((prev) => {
          if (prev && fetchedClasses.some((c: any) => c.id === prev)) {
            return prev;
          }
          return fetchedClasses.length > 0 ? fetchedClasses[0].id : '';
        });
        setIsLoadingClasses(false);
        return true;
      }
      return false;
    };

    const tryAttachListener = () => {
      const targets: Array<any> = [];

      if (email) {
        targets.push(collection(db, 'users', email, 'classes'));
      }
      if (uid && uid !== email) {
        targets.push(collection(db, 'users', uid, 'classes'));
      }
      targets.push(collection(db, 'classes'));

      const subscribeToTarget = (idx: number) => {
        if (idx >= targets.length) {
          setClasses([]);
          setSelectedClassId('');
          setIsLoadingClasses(false);
          return;
        }

        const ref = targets[idx];
        activeUnsubscribe = onSnapshot(
          ref,
          (snapshot) => {
            if (snapshot && !snapshot.empty) {
              handleSnapshot(snapshot);
            } else {
              if (activeUnsubscribe) activeUnsubscribe();
              if (idx + 1 < targets.length) {
                subscribeToTarget(idx + 1);
              } else {
                setClasses([]);
                setSelectedClassId('');
                setIsLoadingClasses(false);
              }
            }
          },
          (error) => {
            console.warn(`Target ${idx} snapshot error, falling back:`, error);
            if (activeUnsubscribe) activeUnsubscribe();
            if (idx + 1 < targets.length) {
              subscribeToTarget(idx + 1);
            } else {
              setClasses([]);
              setSelectedClassId('');
              setIsLoadingClasses(false);
            }
          }
        );
      };

      subscribeToTarget(0);
    };

    tryAttachListener();

    return () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, [currentUserEmail, currentUserUid]);

  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || { id: '', name: '', code: '', students: [] };
  }, [classes, selectedClassId]);

  const [attendanceMap, setAttendanceMap] = useState<Record<string | number, boolean>>({});
  const [yesterdayAttendanceMap, setYesterdayAttendanceMap] = useState<Record<string | number, boolean>>({});

  // 3. FETCH ATTENDANCE RECORD IN REAL-TIME FROM FIREBASE
  useEffect(() => {
    if (!db) return;
    const activeIdentifier = currentUserEmail || currentUserUid || auth?.currentUser?.email || auth?.currentUser?.uid || 'default';
    if (!selectedClassId || !selectedDate || !currentClass.students) return;

    let unsubToday: (() => void) | null = null;
    let unsubYday: (() => void) | null = null;

    try {
      const todayDocId = `${selectedClassId}_${selectedDate}`;
      const todayRef = doc(db, 'users', activeIdentifier, 'attendance', todayDocId);

      unsubToday = onSnapshot(todayRef, (todaySnap) => {
        if (todaySnap.exists() && todaySnap.data().attendanceMap) {
          setAttendanceMap(todaySnap.data().attendanceMap);
          setIsAlreadySaved(true);
        } else {
          const initialMap: Record<string | number, boolean> = {};
          currentClass.students.forEach((student: any) => {
            initialMap[student.id] = true;
          });
          setAttendanceMap(initialMap);
          setIsAlreadySaved(false);
        }
      });

      // Fetch Yesterday's Attendance
      if (yesterdayDate) {
        const ydayDocId = `${selectedClassId}_${yesterdayDate}`;
        const ydayRef = doc(db, 'users', activeIdentifier, 'attendance', ydayDocId);
        unsubYday = onSnapshot(ydayRef, (ydaySnap) => {
          if (ydaySnap.exists() && ydaySnap.data().attendanceMap) {
            setYesterdayAttendanceMap(ydaySnap.data().attendanceMap);
          } else {
            setYesterdayAttendanceMap({});
          }
        });
      }

      // Fetch Last Saved Attendance Date for Skipped Dates Detection
      const fetchLastSavedDate = async () => {
        try {
          const attCol = collection(db, 'users', activeIdentifier, 'attendance');
          const q = query(
            attCol,
            where('classId', '==', selectedClassId),
            where('date', '<', selectedDate),
            orderBy('date', 'desc'),
            limit(1)
          );
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            setLastSavedDate(querySnap.docs[0].data().date);
          } else {
            setLastSavedDate(null);
          }
        } catch (e) {
          console.warn("Could not query last saved date:", e);
        }
      };

      fetchLastSavedDate();

    } catch (error) {
      console.error("Error setting up real-time attendance listeners:", error);
    }

    setIsReadyToSave(false);

    return () => {
      if (unsubToday) unsubToday();
      if (unsubYday) unsubYday();
    };
  }, [currentUserEmail, currentUserUid, selectedClassId, selectedDate, yesterdayDate, currentClass]);

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setCurrentPage(1);
    setIsReadyToSave(false);
  };

  // Class Selection Modal Filtered List & Pagination
  const filteredModalClasses = useMemo(() => {
    return classes.filter(cls => 
      cls.name.toLowerCase().includes(classModalSearch.toLowerCase()) ||
      cls.code.toLowerCase().includes(classModalSearch.toLowerCase())
    );
  }, [classes, classModalSearch]);

  const classModalTotalPages = Math.ceil(filteredModalClasses.length / CLASS_MODAL_ITEMS_PER_PAGE) || 1;
  
  const paginatedModalClasses = useMemo(() => {
    const start = (classModalPage - 1) * CLASS_MODAL_ITEMS_PER_PAGE;
    return filteredModalClasses.slice(start, start + CLASS_MODAL_ITEMS_PER_PAGE);
  }, [filteredModalClasses, classModalPage]);

  useEffect(() => {
    setClassModalPage(1);
  }, [classModalSearch]);

  const toggleStudentStatus = (studentId: string | number) => {
    if (isAlreadySaved) {
      triggerErrorToast("Attendance for this date is locked!");
      return;
    }
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const markAllPresent = () => {
    if (isAlreadySaved) {
      triggerErrorToast("Attendance is locked!");
      return;
    }
    const updated = { ...attendanceMap };
    currentClass.students.forEach((s: any) => { updated[s.id] = true; });
    setAttendanceMap(updated);
  };

  const markAllAbsent = () => {
    if (isAlreadySaved) {
      triggerErrorToast("Attendance is locked!");
      return;
    }
    const updated = { ...attendanceMap };
    currentClass.students.forEach((s: any) => { updated[s.id] = false; });
    setAttendanceMap(updated);
  };

  const triggerErrorToast = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorToast(true);
    setTimeout(() => {
      setShowErrorToast(false);
    }, 3500);
  };

  const handleToggleReady = () => {
    if (isAlreadySaved) {
      triggerErrorToast("Attendance is locked.");
      return;
    }

    const nextState = !isReadyToSave;
    setIsReadyToSave(nextState);

    if (nextState) {
      setShowReadyToast(true);
      setTimeout(() => setShowReadyToast(false), 3000);
    }
  };

  const calculateSkippedDates = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startStr);
    const end = new Date(endStr);

    const curr = new Date(start);
    curr.setDate(curr.getDate() + 1);

    while (curr < end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const getDayDetails = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const isSunday = d.getDay() === 0;
    const isSaturday = d.getDay() === 6;

    return { dayName, formattedDate, isSunday, isSaturday, isWeekend: isSunday || isSaturday };
  };

  // Metrics Calculation
  const totalStudents = currentClass.students ? currentClass.students.length : 0;
  
  const presentCount = useMemo(() => {
    if (!currentClass.students) return 0;
    return currentClass.students.filter((s: any) => attendanceMap[s.id] !== false).length;
  }, [currentClass, attendanceMap]);

  const absentCount = totalStudents - presentCount;

  const absentYesterdayCount = useMemo(() => {
    if (!currentClass.students) return 0;
    return currentClass.students.filter((s: any) => yesterdayAttendanceMap[s.id] === false).length;
  }, [currentClass, yesterdayAttendanceMap]);

  // FILTERED STUDENTS LIST
  const filteredStudents = useMemo(() => {
    if (!currentClass.students) return [];
    
    return currentClass.students.filter((student: any) => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            student.rollNo.includes(searchQuery);
      
      let matchesGender = true;
      if (genderFilter !== 'ALL') {
        matchesGender = student.gender === genderFilter;
      }

      let matchesFee = true;
      if (feeFilter === 'PAID') matchesFee = student.feeStatus?.toLowerCase() === 'paid';
      if (feeFilter === 'UNPAID') matchesFee = student.feeStatus?.toLowerCase() === 'unpaid';

      const isPresent = attendanceMap[student.id] !== false;
      let matchesAttendance = true;
      if (attendanceFilter === 'PRESENT') matchesAttendance = isPresent;
      if (attendanceFilter === 'ABSENT') matchesAttendance = !isPresent;

      return matchesSearch && matchesGender && matchesFee && matchesAttendance;
    });
  }, [currentClass, searchQuery, genderFilter, feeFilter, attendanceFilter, attendanceMap]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, genderFilter, feeFilter, attendanceFilter]);

  const toggleHolidaySelection = (dateStr: string) => {
    setHolidaySelections((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const handleSaveAttendance = async () => {
    if (isAlreadySaved) {
      triggerErrorToast("Attendance is ALREADY saved for this date!");
      return;
    }

    if (!isReadyToSave) {
      triggerErrorToast("Please check the verification box below before saving!");
      return;
    }

    if (lastSavedDate) {
      const skipped = calculateSkippedDates(lastSavedDate, selectedDate);
      if (skipped.length > 0) {
        setSkippedDates(skipped);
        const initialSelections: Record<string, boolean> = {};
        skipped.forEach((d) => { initialSelections[d] = true; });
        setHolidaySelections(initialSelections);
        setShowSkipModal(true);
        return;
      }
    }

    executeFinalSave();
  };

  const executeFinalSave = async () => {
    if (!db) {
      triggerErrorToast("Firebase DB is not initialized.");
      return;
    }

    const activeIdentifier = currentUserEmail || currentUserUid || auth?.currentUser?.email || auth?.currentUser?.uid || 'default';

    try {
      setIsSavingSkipped(true);
      setIsSaved(true);

      for (const skippedDate of skippedDates) {
        if (holidaySelections[skippedDate]) {
          const { dayName } = getDayDetails(skippedDate);
          const holidayDocId = `${selectedClassId}_${skippedDate}`;
          const holidayRef = doc(db, 'users', activeIdentifier, 'attendance', holidayDocId);
          await setDoc(holidayRef, {
            classId: selectedClassId,
            className: currentClass.name,
            date: skippedDate,
            isHoliday: true,
            status: 'Holiday',
            note: `Marked as Holiday (${dayName})`,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }

      const recordDocId = `${selectedClassId}_${selectedDate}`;
      const attDocRef = doc(db, 'users', activeIdentifier, 'attendance', recordDocId);

      await setDoc(attDocRef, {
        classId: selectedClassId,
        className: currentClass.name,
        date: selectedDate,
        attendanceMap: attendanceMap,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setShowSkipModal(false);
      setShowTickOverlay(true);
      setIsAlreadySaved(true);

      setTimeout(() => {
        setShowTickOverlay(false);
        setIsSaved(false);
        setIsSavingSkipped(false);

        const currDateObj = new Date(selectedDate);
        currDateObj.setDate(currDateObj.getDate() + 1);
        const nextDateStr = currDateObj.toISOString().split('T')[0];
        
        setSelectedDate(nextDateStr);
        setIsReadyToSave(false);
        setSkippedDates([]);
      }, 2200);

    } catch (error) {
      console.error("Error saving attendance to Firebase:", error);
      setIsSaved(false);
      setShowTickOverlay(false);
      setIsSavingSkipped(false);
      triggerErrorToast("Database error! Could not save attendance.");
    }
  };

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'classes', label: 'Classes', icon: GraduationCap, href: '/departments' },
    { id: 'attendance', label: 'Attendance', icon: Users, href: '/attendance' },
    { id: 'fees', label: 'Fees', icon: Wallet, href: '/fees' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-32 ${isDark ? 'dark' : ''}`}>
      
      {/* ERROR TOAST NOTIFICATION */}
      {showErrorToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-rose-600 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(225,29,72,0.5)] flex items-center gap-3 border border-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
          <button onClick={() => setShowErrorToast(false)} className="ml-2 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* GLOWING ACTIVATION NOTIFICATION TOAST */}
      {showReadyToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow-[0_0_30px_rgba(249,115,22,0.6)] flex items-center gap-3 border border-orange-300">
          <Sparkles className="h-5 w-5 shrink-0 animate-bounce" />
          <span>Verification Confirmed! Save Register button is now ACTIVE.</span>
        </div>
      )}

      {/* GLOWING SUCCESS TICK OVERLAY */}
      {showTickOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c1222] p-8 rounded-3xl shadow-[0_0_80px_rgba(16,185,129,0.5)] flex flex-col items-center justify-center animate-bounce border border-emerald-500/40">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-4 ring-4 ring-emerald-500/30">
              <CheckCircle2 className="h-14 w-14 text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.9)]" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">Attendance Saved!</h2>
            <p className="text-sm font-medium text-slate-500 mt-2">{selectedDate} record updated successfully.</p>
            <p className="text-xs font-bold text-orange-500 mt-1">Advancing to Next Day...</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="w-full bg-white/70 dark:bg-[#070b13]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:scale-105 active:scale-95 transition-all"
              title="Back to Home"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
            </Link>
            <span className="font-black text-lg tracking-tight hidden sm:block bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              EduTrack
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-8 w-14 items-center rounded-full bg-slate-200/80 p-1 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700/50"
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${isDark ? 'translate-x-6 bg-slate-900 text-yellow-400' : 'text-orange-500'}`}>
                {isDark ? <Moon className="h-3.5 w-3.5 fill-current" /> : <Sun className="h-3.5 w-3.5 fill-current" />}
              </div>
            </button>

            <Link
              to="/"
              className="relative rounded-2xl p-2.5 text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 transition-all"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* HERO CONTAINER */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-[#0c1222] dark:via-[#0e162a] dark:to-[#070b13] p-6 md:p-8 border-2 border-orange-500/80 shadow-[0_0_25px_rgba(249,115,22,0.25)]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
            <div className="space-y-4 w-full max-w-md">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider">LIVE ATTENDANCE</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Select Class
              </h1>

              {/* CUSTOM ANIMATED CLASS TRIGGER BUTTON */}
              <div className="relative pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setClassModalPage(1);
                    setIsClassModalOpen(true);
                  }}
                  disabled={isLoadingClasses}
                  className="w-full flex items-center justify-between rounded-2xl border-2 border-orange-500/80 bg-white/95 dark:bg-[#070b13] px-5 py-3.5 text-sm font-extrabold text-slate-800 dark:text-slate-100 shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:border-orange-500 hover:shadow-[0_0_25px_rgba(249,115,22,0.3)] transition-all duration-300 active:scale-[0.99] group text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="h-8 w-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 border border-orange-500/20 group-hover:scale-110 transition-transform">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <span className="truncate">
                      {isLoadingClasses 
                        ? 'Fetching classes from Firebase...' 
                        : currentClass.name 
                          ? `${currentClass.name} (${currentClass.code})` 
                          : 'No Classes Found'}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-orange-500 shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-[#070b13]/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2 w-full md:w-auto shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Date</span>
                {isAlreadySaved && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    <Lock className="h-3 w-3" /> Saved & Locked
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#0c1222] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                <CalendarIcon className="h-4 w-4 text-orange-500" />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800/60 rounded-3xl p-4 text-center">
            <span className="text-[10px] sm:text-xs font-extrabold text-slate-400 block tracking-wide uppercase">Total</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 block">{totalStudents}</span>
          </div>
          <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-3xl p-4 text-center">
            <span className="text-[10px] sm:text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block tracking-wide uppercase">Present</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{presentCount}</span>
          </div>
          <div className="bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-3xl p-4 text-center">
            <span className="text-[10px] sm:text-xs font-extrabold text-rose-600 dark:text-rose-400 block tracking-wide uppercase">Absent</span>
            <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{absentCount}</span>
          </div>
          <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-3xl p-4 text-center">
            <span className="text-[10px] sm:text-xs font-extrabold text-amber-600 dark:text-amber-400 block tracking-wide uppercase truncate">Absent Yesterday</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{absentYesterdayCount}</span>
          </div>
        </div>

        {/* ALREADY SAVED BANNER */}
        {isAlreadySaved && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
              <Lock className="h-5 w-5 text-amber-500 shrink-0" />
              <span>Attendance for <strong>{selectedDate}</strong> is already saved and locked.</span>
            </div>
            <button 
              onClick={() => {
                const nextDate = new Date(selectedDate);
                nextDate.setDate(nextDate.getDate() + 1);
                setSelectedDate(nextDate.toISOString().split('T')[0]);
              }}
              className="text-xs font-black bg-amber-500 text-white px-3.5 py-2 rounded-xl hover:bg-amber-600 transition-all shrink-0"
            >
              Go to Next Day &rarr;
            </button>
          </div>
        )}

        {/* FILTER CONTROL CARD */}
        <div className="bg-white dark:bg-[#0c1222] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/60 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-extrabold text-base">
            <SlidersHorizontal className="h-5 w-5 text-orange-500" />
            <span>Filters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or roll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500"
              />
            </div>

            {/* Gender Filters Pill */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#070b13] p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400 uppercase px-2">Gender:</span>
              {(['ALL', 'M', 'F'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenderFilter(g)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                    genderFilter === g
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {g === 'ALL' ? 'All' : g === 'M' ? 'Male ' : 'Female '}
                </button>
              ))}
            </div>

            {/* Fee Status Filter Pill */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#070b13] p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400 uppercase px-2">Fee:</span>
              {(['ALL', 'PAID', 'UNPAID'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFeeFilter(f)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                    feeFilter === f
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f === 'PAID' ? 'Paid' : 'Unpaid'}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* BULK ACTIONS */}
        <div className="flex items-center gap-2 justify-end">
          <button onClick={markAllPresent} className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400">
            <UserCheck className="h-3.5 w-3.5" /> Mark All Present
          </button>
          <button onClick={markAllAbsent} className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400">
            <UserX className="h-3.5 w-3.5" /> Mark All Absent
          </button>
        </div>

        {/* STUDENT LIST */}
        <div className="space-y-3">
          {isLoadingClasses ? (
            <div className="text-center py-16 bg-white dark:bg-[#0c1222] rounded-3xl border border-slate-200/60 dark:border-slate-800/40">
              <p className="text-sm font-bold text-orange-500 animate-pulse">Fetching class data from Firebase database...</p>
            </div>
          ) : paginatedStudents.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#0c1222] rounded-3xl border border-slate-200/60 dark:border-slate-800/40">
              <p className="text-sm font-bold text-slate-400">No students found matching your selected filters or class.</p>
            </div>
          ) : (
            paginatedStudents.map((student: any) => {
              const isPresent = attendanceMap[student.id] !== false;
              const wasAbsentYesterday = yesterdayAttendanceMap[student.id] === false;
              const isPaid = student.feeStatus?.toLowerCase() === 'paid';

              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudentStatus(student.id)}
                  className={`group bg-white dark:bg-[#0c1222] border p-3.5 sm:p-4 rounded-[1.25rem] flex items-center justify-between gap-3 shadow-sm transition-all duration-300 cursor-pointer ${
                    isPresent
                      ? 'border-slate-200/70 dark:border-slate-800/50 hover:border-emerald-400'
                      : 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative">
                      <img
                        src={student.avatar}
                        alt={student.name}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shrink-0"
                      />
                      <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-[#0c1222] flex items-center justify-center ${isPresent ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {isPresent ? <Check className="h-2.5 w-2.5 text-white" /> : <UserX className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          {student.name}
                        </h4>

                        {wasAbsentYesterday && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="h-2.5 w-2.5" /> Absent Yesterday
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#070b13] px-2 py-0.5 rounded-md">
                          Roll #{student.rollNo}
                        </span>
                        
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                          student.gender === 'F'
                            ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {student.gender === 'F' ? 'Female' : 'Male'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl ${
                      isPaid 
                        ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' 
                        : 'bg-rose-100/70 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                    }`}>
                      {isPaid ? 'Paid' : 'Unpaid'}
                    </span>

                    <button
                      type="button"
                      disabled={isAlreadySaved}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStudentStatus(student.id);
                      }}
                      className={`relative inline-flex h-7 w-12 sm:h-8 sm:w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ${
                        isAlreadySaved ? 'opacity-60 cursor-not-allowed' : ''
                      } ${isPresent ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 sm:h-7 sm:w-7 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                          isPresent ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-[#0c1222] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-[#070b13] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            <span className="text-xs font-black text-slate-500">
              Page <span className="text-orange-500">{currentPage}</span> of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-[#070b13] disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* VERIFICATION CHECKBOX CONTAINER */}
        <div 
          onClick={handleToggleReady}
          className={`cursor-pointer transition-all duration-300 p-5 rounded-[1.75rem] border-2 flex items-center gap-4 select-none ${
            isReadyToSave
              ? 'bg-gradient-to-r from-orange-50/90 to-amber-50/70 dark:from-orange-950/30 dark:to-amber-950/20 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.25)]'
              : 'bg-white/90 dark:bg-[#0c1222]/90 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border-2 ${
            isReadyToSave 
              ? 'bg-orange-500 border-orange-500 text-white' 
              : 'border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/80'
          }`}>
            <Check className="h-5 w-5 stroke-[3]" />
          </div>

          <div className="flex items-center gap-2.5">
            <ShieldCheck className={`h-5 w-5 shrink-0 ${isReadyToSave ? 'text-orange-500' : 'text-slate-400'}`} />
            <span className={`text-xs sm:text-sm font-black ${isReadyToSave ? 'text-orange-950 dark:text-orange-200' : 'text-slate-700 dark:text-slate-300'}`}>
              I confirm that all student records for today are verified and ready to submit.
            </span>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div>
          <button
            onClick={handleSaveAttendance}
            disabled={!isReadyToSave || isAlreadySaved}
            className={`w-full py-4 sm:py-5 rounded-full font-black text-sm sm:text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
              isAlreadySaved
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-80'
                : !isReadyToSave
                ? 'bg-[#6f7682] dark:bg-[#333a48] text-slate-200 cursor-not-allowed opacity-90'
                : 'bg-gradient-to-r from-[#ff6c00] to-[#f97316] text-white shadow-[0_10px_30px_rgba(255,108,0,0.4)] hover:scale-[1.01]'
            }`}
          >
            {isAlreadySaved ? (
              <>
                <Lock className="h-5 w-5 text-amber-500" />
                Attendance Already Saved for {selectedDate}
              </>
            ) : isSaved ? (
              <>
                <CheckCircle2 className="h-6 w-6 animate-pulse" /> 
                Record Saved Successfully!
              </>
            ) : (
              <>
                <Save className="h-5 w-5" /> 
                Save Register for {selectedDate}
              </>
            )}
          </button>
        </div>
      </main>

      {/* CLASS SELECTION MODAL CARD WITH 7 ITEMS PAGINATION */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative bg-white/95 dark:bg-[#0c1222]/95 border-2 border-orange-500/60 rounded-[2.5rem] p-6 max-w-md w-full shadow-[0_0_50px_rgba(249,115,22,0.35)] space-y-5 transform transition-all duration-300 scale-100 overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-orange-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 ring-2 ring-orange-500/20">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Select Class
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Choose class to load roster ({classes.length} Available)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsClassModalOpen(false)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
              <input
                type="text"
                placeholder="Filter classes by name or code..."
                value={classModalSearch}
                onChange={(e) => setClassModalSearch(e.target.value)}
                className="w-full bg-orange-50/40 dark:bg-[#070b13] border border-orange-500/30 dark:border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
              {classModalSearch && (
                <button 
                  onClick={() => setClassModalSearch('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2 min-h-[350px]">
              {paginatedModalClasses.length === 0 ? (
                <div className="text-center py-12 text-xs font-bold text-slate-400">
                  No classes match "{classModalSearch}"
                </div>
              ) : (
                paginatedModalClasses.map((cls) => {
                  const isSelected = cls.id === selectedClassId;

                  return (
                    <button
                      key={cls.id}
                      onClick={() => {
                        handleClassChange(cls.id);
                        setIsClassModalOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between group active:scale-[0.98] ${
                        isSelected
                          ? 'bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border-orange-500 text-orange-950 dark:text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                          : 'bg-white dark:bg-[#070b13]/60 border-slate-200 dark:border-slate-800 hover:border-orange-500/50 text-slate-800 dark:text-slate-200 hover:bg-orange-50/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'border-orange-500 bg-orange-500 text-white ring-4 ring-orange-500/20' 
                            : 'border-slate-300 dark:border-slate-600 bg-transparent'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>

                        <div className="text-left">
                          <h4 className="text-sm font-black tracking-tight leading-tight">
                            {cls.name}
                          </h4>
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500">
                            Code: {cls.code}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-orange-500/20 group-hover:text-orange-600'
                        }`}>
                          {cls.students ? cls.students.length : 0} Students
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {classModalTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-orange-500/20 pt-4">
                <button
                  onClick={() => setClassModalPage((p) => Math.max(p - 1, 1))}
                  disabled={classModalPage === 1}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-orange-500 hover:text-white transition-all"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>

                <div className="flex items-center gap-1 text-xs font-black text-slate-500">
                  <span>Page</span>
                  <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    {classModalPage}
                  </span>
                  <span>of {classModalTotalPages}</span>
                </div>

                <button
                  onClick={() => setClassModalPage((p) => Math.min(p + 1, classModalTotalPages))}
                  disabled={classModalPage === classModalTotalPages}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-orange-500 hover:text-white transition-all"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SKIPPED DATES MODAL */}
      {showSkipModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-[2.5rem] p-6 max-w-md w-full shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-5 text-center transform transition-all scale-100">
            
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/40 ring-4 ring-orange-500/20">
              <CalendarDays className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Skipped Dates Notification
              </h3>
              <p className="text-xs font-extrabold text-slate-600 dark:text-slate-300 leading-relaxed">
                Aap <span className="text-orange-500 font-black">{selectedDate}</span> ki attendance save kar rahe hain. 
                System ne missing date(s) detect ki hain:
              </p>
            </div>

            <div className="space-y-2.5 text-left bg-slate-50 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-52 overflow-y-auto">
              {skippedDates.map((dateStr) => {
                const { dayName, formattedDate, isSunday, isWeekend } = getDayDetails(dateStr);
                const isHoliday = holidaySelections[dateStr] ?? true;

                return (
                  <div
                    key={dateStr}
                    onClick={() => toggleHolidaySelection(dateStr)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isHoliday
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-950 dark:text-orange-200'
                        : 'bg-white dark:bg-[#0c1222] border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-xs font-black">
                        <span className={`w-2.5 h-2.5 rounded-full ${isHoliday ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        <span>{formattedDate} ({dayName})</span>
                      </div>
                      
                      {isSunday && (
                        <span className="text-[10px] font-black text-rose-500 ml-4">
                          * Sunday (Weekend Off)
                        </span>
                      )}
                      {isWeekend && !isSunday && (
                        <span className="text-[10px] font-black text-amber-500 ml-4">
                          * Saturday (Weekend)
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all ${
                      isHoliday
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {isHoliday ? 'Save as Holiday' : 'Ignore'}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
              System missing date(s) par automatically <strong className="text-orange-500">Holiday Record</strong> save karega.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={executeFinalSave}
                disabled={isSavingSkipped}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-black rounded-2xl shadow-xl shadow-orange-500/30 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isSavingSkipped ? 'Saving Missing Records...' : 'Confirm Holiday & Proceed'}
              </button>

              <button
                onClick={() => setShowSkipModal(false)}
                disabled={isSavingSkipped}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-extrabold rounded-2xl transition-all"
              >
                Cancel & Change Date
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION NAVBAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pt-2 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent dark:from-[#070b13] dark:via-[#070b13]/90 pointer-events-none">
        <nav className="mx-auto max-w-md bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-[2.5rem] shadow-2xl px-4 py-3 flex items-center justify-around pointer-events-auto">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                to={tab.href}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center flex-1 relative group"
              >
                <div className={`p-2.5 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isActive 
                    ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.6)] scale-110' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <span className={`text-[10px] font-black mt-1 transition-all ${
                  isActive ? 'text-orange-500' : 'text-slate-400'
                }`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
