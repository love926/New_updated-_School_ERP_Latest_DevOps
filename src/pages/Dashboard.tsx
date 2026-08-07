import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ArrowRight,
  ChevronRight,
  Users,
  BookOpen,
  PieChart,
  FileText,
  AlertCircle,
  Wallet,
  CheckSquare,
  Sparkles,
  Home,
  GraduationCap,
  Settings,
  Flame,
  Loader2,
  Plus,
  HelpCircle,
  UserPlus,
  LogOut,
  ThumbsUp,
  Download
} from 'lucide-react';

// Firebase Firestore & Auth Imports
import { collection, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

// Fallback User ID
const FALLBACK_USER_ID = 'X1Q76ib1XXPwCp3FSQPLLaTzL83';

// Helper: Get Current Month Key (YYYY-MM)
const getCurrentMonthKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// Helper: Normalize Date string to YYYY-MM-DD
const normalizeDate = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const m = parts[0].padStart(2, '0');
      const d = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr.trim();
};

export default function Dashboard() {
  const { departments } = useApp();
  const navigate = useNavigate();

  // Logout Flow States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // PWA Deferred Prompt State (For App Download/Install)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // 1. PERSISTENT THEME INITIALIZATION
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);

  // 2. KEEP LOCALSTORAGE AND HTML ROOT SYNCED WITH THEME STATE
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Profile Data State
  const [profileData, setProfileData] = useState<{ name: string; avatarUrl: string }>({
    name: 'User',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'
  });

  // Current Auth User ID State
  const [activeUserId, setActiveUserId] = useState<string>(auth.currentUser?.uid || FALLBACK_USER_ID);

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setActiveUserId(user.uid);
        if (user.displayName) {
          setProfileData((prev) => ({
            ...prev,
            name: user.displayName || 'User'
          }));
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Capture PWA Install Event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Trigger App Download / Install Prompt
  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setDeferredPrompt(null);
    } else {
      alert('App is already installed or your browser does not support standard PWA prompt.');
    }
  };

  // Live Database States
  const [classesList, setClassesList] = useState<any[]>([]);
  const [metricsData, setMetricsData] = useState({
    totalClasses: 0,
    attendanceRate: 0,
    feesCollected: 0,
    pendingStudents: 0,
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const monthKeyStr = useMemo(() => getCurrentMonthKey(), []);

  // Bottom Navigation App Items
  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'classes', label: 'Classes', icon: GraduationCap, href: '/departments' },
    { id: 'attendance', label: 'Attendance', icon: Users, href: '/attendance' },
    { id: 'fees', label: 'Fees', icon: Wallet, href: '/fees' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  // Quick Access Configurations
  const quickAccessItems = [
    { title: 'Attendance', icon: Users, color: 'bg-white dark:bg-[#0c1222] text-emerald-600 dark:text-emerald-400 border-emerald-400/80 dark:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]', href: '/attendance' },
    { title: 'Fees', icon: Wallet, color: 'bg-white dark:bg-[#0c1222] text-purple-600 dark:text-purple-400 border-purple-400/80 dark:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.35)]', href: '/fees' },
    { title: 'Quiz Management', icon: HelpCircle, color: 'bg-white dark:bg-[#0c1222] text-violet-600 dark:text-violet-400 border-violet-400/80 dark:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)]', href: '/quiz' },
    { title: 'Add Student', icon: UserPlus, color: 'bg-white dark:bg-[#0c1222] text-amber-600 dark:text-amber-400 border-amber-400/80 dark:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]', href: '/departments' },
    { title: 'Reports', icon: FileText, color: 'bg-white dark:bg-[#0c1222] text-orange-600 dark:text-orange-400 border-orange-400/80 dark:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.35)]', href: '/reports' },
    { title: 'Analytics', icon: PieChart, color: 'bg-white dark:bg-[#0c1222] text-blue-600 dark:text-blue-400 border-blue-400/80 dark:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]', href: '/analytics' },
    { title: 'Notes Library', icon: BookOpen, color: 'bg-white dark:bg-[#0c1222] text-teal-600 dark:text-teal-400 border-teal-400/80 dark:border-teal-500/50 hover:shadow-[0_0_20px_rgba(20,184,166,0.35)]', href: '/notes' },
    { title: 'Alerts', icon: AlertCircle, color: 'bg-white dark:bg-[#0c1222] text-rose-600 dark:text-rose-400 border-rose-400/80 dark:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.35)]', href: '/alerts' },
  ];

  // 1. FETCH USER PROFILE DATA FROM FIRESTORE
  useEffect(() => {
    if (!activeUserId) return;
    const profileDocRef = doc(db, 'users', activeUserId, 'settings', 'profile_data');
    const unsubscribeProfile = onSnapshot(profileDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.profile) {
          setProfileData({
            name: data.profile.name || auth.currentUser?.displayName || 'User',
            avatarUrl: data.profile.avatarUrl && data.profile.avatarUrl.trim() !== ''
              ? data.profile.avatarUrl
              : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
          });
        }
      } else if (auth.currentUser?.displayName) {
        setProfileData((prev) => ({
          ...prev,
          name: auth.currentUser?.displayName || 'User',
        }));
      }
    }, (err) => {
      console.error("Error fetching profile_data:", err);
    });

    return () => unsubscribeProfile();
  }, [activeUserId]);

  // 2. LIVE FIRESTORE DATA SYNC FOR CLASSES & METRICS
  useEffect(() => {
    setLoading(true);
    const classesRef = collection(db, 'users', activeUserId, 'classes');

    const unsubscribe = onSnapshot(
      classesRef,
      async (snapshot) => {
        let loadedClasses: any[] = [];

        if (!snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedClasses.push({
              id: docSnap.id,
              name: data.name || data.className || 'Unnamed Class',
              code: data.code || '',
              monthlyFee: data.monthlyFee || data.fee || 1500,
              students: data.students || [],
              present: 0,
              absent: 0,
            });
          });
        } else {
          const rootSnap = await getDocs(collection(db, 'classes'));
          rootSnap.forEach((docSnap) => {
            const data = docSnap.data();
            loadedClasses.push({
              id: docSnap.id,
              name: data.name || data.className || 'Unnamed Class',
              code: data.code || '',
              monthlyFee: data.monthlyFee || data.fee || 1500,
              students: data.students || [],
              present: 0,
              absent: 0,
            });
          });
        }

        loadedClasses.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        try {
          let attendanceRef = collection(db, 'users', activeUserId, 'attendance');
          let attendanceSnap = await getDocs(attendanceRef);
          if (attendanceSnap.empty) {
            attendanceSnap = await getDocs(collection(db, 'attendance'));
          }

          let overallPresent = 0;
          let overallAbsent = 0;
          let overallLate = 0;

          attendanceSnap.forEach((docSnap) => {
            const docId = docSnap.id;
            const data = docSnap.data();
            const docDate = normalizeDate(data.date || docId.split('_').pop() || '');

            const matchingClass = loadedClasses.find(
              (c) => c.id === data.classId || docId.startsWith(c.id) || docId.includes(c.id)
            );

            const isToday = docDate === todayStr;

            if (data.attendanceMap && typeof data.attendanceMap === 'object') {
              Object.values(data.attendanceMap).forEach((val: any) => {
                if (val === true || val === 'present' || val === 'Present') {
                  overallPresent++;
                  if (matchingClass && isToday) matchingClass.present++;
                } else if (val === false || val === 'absent' || val === 'Absent') {
                  overallAbsent++;
                  if (matchingClass && isToday) matchingClass.absent++;
                } else if (val === 'late' || val === 'Late') {
                  overallLate++;
                }
              });
            } else if (typeof data.presentCount === 'number') {
              overallPresent += data.presentCount;
              overallAbsent += data.absentCount || 0;
              overallLate += data.lateCount || 0;
              if (matchingClass && isToday) {
                matchingClass.present += data.presentCount;
                matchingClass.absent += data.absentCount || 0;
              }
            }
          });

          let totalFeesCollected = 0;
          let totalPendingStudents = 0;

          for (const cls of loadedClasses) {
            const feeDocId = `${cls.id}_${monthKeyStr}`;
            let feeDocRef = doc(db, 'users', activeUserId, 'fees', feeDocId);
            let feeDocSnap = await getDoc(feeDocRef);

            if (!feeDocSnap.exists()) {
              feeDocRef = doc(db, 'fees', feeDocId);
              feeDocSnap = await getDoc(feeDocRef);
            }

            if (feeDocSnap.exists()) {
              const feeData = feeDocSnap.data() || {};
              const recordsSource = feeData.feeRecords || feeData;
              let paidCountInClass = 0;

              Object.entries(recordsSource).forEach(([key, value]) => {
                if (['classId', 'month', 'updatedAt', 'feeRecords'].includes(key)) return;
                if (typeof value === 'object' && value !== null) {
                  const studentRec: any = value;
                  const isPaid =
                    studentRec.status === 'PAID' ||
                    studentRec.status === 'paid' ||
                    (typeof studentRec.paidAmount === 'number' && studentRec.paidAmount > 0);

                  if (isPaid) {
                    paidCountInClass++;
                    totalFeesCollected += Number(studentRec.paidAmount || cls.monthlyFee);
                  }
                }
              });

              const studentTotal = cls.students?.length || 0;
              totalPendingStudents += Math.max(0, studentTotal - paidCountInClass);
            } else {
              totalPendingStudents += cls.students?.length || 0;
            }
          }

          const totalEntries = overallPresent + overallLate + overallAbsent;
          const calculatedRate =
            totalEntries > 0
              ? Math.round(((overallPresent + overallLate) / totalEntries) * 100)
              : 0;

          setClassesList(loadedClasses);
          setMetricsData({
            totalClasses: loadedClasses.length,
            attendanceRate: calculatedRate,
            feesCollected: totalFeesCollected,
            pendingStudents: totalPendingStudents,
          });
        } catch (err) {
          console.error('Error computing dashboard live metrics:', err);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching classes stream:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeUserId, todayStr, monthKeyStr]);

  // Handle Firebase Sign Out Execution
  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut(auth);
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const handleRedirectToLogin = () => {
    setShowSuccessModal(false);
    navigate('/login');
  };

  // Dynamic Metrics Array
  const overviewMetrics = [
    { title: 'Total Active Classes', value: String(metricsData.totalClasses), change: 'Live from DB', positive: true, icon: Flame, bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', glow: 'hover:border-indigo-500/80 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]' },
    { title: 'Attendance Rate', value: `${metricsData.attendanceRate}%`, change: 'Realtime record', positive: true, icon: Users, bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', glow: 'hover:border-emerald-500/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
    { title: 'Fees Collected', value: `PKR ${metricsData.feesCollected.toLocaleString()}`, change: 'Current Month', positive: true, icon: Wallet, bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', glow: 'hover:border-amber-500/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]' },
    { title: 'Pending Fee Students', value: String(metricsData.pendingStudents), change: 'Awaiting payment', positive: false, icon: CheckSquare, bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', glow: 'hover:border-rose-500/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]' },
  ];

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${isDark ? 'dark' : ''}`}>
      
      {/* MINIMAL PREMIUM UTILITY HEADER */}
      <div className="w-full bg-white/40 dark:bg-[#070b13]/40 backdrop-blur-sm border-b border-slate-200/40 dark:border-slate-900/40 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Quick search..."
              className="w-full rounded-xl border border-slate-200/60 bg-white/60 py-1.5 pl-9 pr-4 text-xs outline-none transition-all focus:border-orange-500 focus:bg-white dark:border-slate-800 dark:bg-[#0c1222] dark:focus:bg-[#0c1222]"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Install App / Download Button */}
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-xs transition-all duration-300 hover:bg-orange-500 hover:text-white shadow-[0_0_12px_rgba(249,115,22,0.25)] active:scale-95"
              title="Download / Install App"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Smooth Light/Dark Toggle Pill */}
            <button 
              onClick={() => setIsDark((prev) => !prev)}
              className="flex h-7 w-12 items-center rounded-full bg-slate-200/60 p-0.5 transition-all dark:bg-slate-800 border border-slate-300/30"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm transition-all ${isDark ? 'translate-x-5 bg-slate-950 text-yellow-400' : ''}`}>
                {isDark ? <Moon className="h-3 w-3 fill-current" /> : <Sun className="h-3 w-3 fill-current" />}
              </div>
            </button>

            {/* Notification Bell Badge */}
            <Link 
              to="/alerts" 
              className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#0c1222] transition-all hover:scale-105 active:scale-95"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#070b13] animate-pulse">
                3
              </span>
            </Link>

            {/* PREMIUM GLOWING LOGOUT BUTTON */}
            <button
              onClick={() => setShowConfirmModal(true)}
              className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs transition-all duration-300 hover:bg-rose-600 hover:text-white hover:border-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_22px_rgba(244,63,94,0.6)] active:scale-95"
              title="Logout from system"
            >
              <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Dynamic Profile Avatar */}
            <Link
              to="/settings"
              title="View Profile / Settings"
              className="h-8 w-8 overflow-hidden rounded-full ring-2 ring-orange-500/70 shadow-[0_0_12px_rgba(249,115,22,0.4)] transition-all hover:scale-110 active:scale-95 cursor-pointer block"
            >
              <img
                src={profileData.avatarUrl}
                alt={profileData.name}
                className="h-full w-full object-cover"
              />
            </Link>
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE MAIN CONTENT */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
        
        {/* BANNER GREETING ROW */}
        <div className="space-y-0.5">
          <h2 className="text-xl font-extrabold tracking-tight md:text-2xl flex items-center gap-2">
            Welcome back, <span className="text-slate-950 dark:text-white">{profileData.name}</span>! 
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Here&apos;s a high-fidelity lookup of your institutional framework today.
          </p>
        </div>

        {/* HERO BANNER */}
        <div className="relative rounded-3xl bg-white dark:bg-[#0c1222] p-6 md:p-8 border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)] transition-all duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-orange-500/60 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Live Engine Active</span>
              </div>

              {/* EDUTRACK HEADER */}
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                EduTrack
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Intelligent Management & Analytics System for Colleges and Universities
              </p>
              
              <div className="pt-1 flex flex-wrap gap-3">
                <Button asChild size="sm" className="rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-white shadow-md shadow-orange-500/30 hover:scale-[1.02] active:scale-95 transition-all duration-200 px-4 py-4 text-xs">
                  <Link to="/attendance" className="flex items-center gap-1.5">
                    Attendance
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>

                <Button asChild variant="outline" size="sm" className="rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 shadow-sm text-xs px-4 py-4 dark:border-slate-800 dark:bg-[#070b13] dark:text-slate-300 dark:hover:bg-[#0c1222]">
                  <Link to="/settings">
                    Configure Settings
                  </Link>
                </Button>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center w-52 h-36 bg-white dark:bg-[#070b13] border-2 border-orange-500/50 rounded-2xl shadow-[0_0_15px_rgba(249,115,22,0.25)] group transition-all hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]">
              <div className="text-center p-4 space-y-1.5">
                <div className="mx-auto w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30 transition-transform duration-300 group-hover:scale-110">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Database Engine</div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Active Departments: {departments?.length || classesList.length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: QUICK ACCESS PANEL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">Quick Access</h3>
            <Link to="/modules" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">View All</Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {quickAccessItems.map((item) => (
              <Link 
                key={item.title} 
                to={item.href}
                className={`group flex flex-col items-center justify-center p-6 rounded-[22px] border transition-all duration-300 hover:-translate-y-1 hover:scale-105 active:scale-95 ${item.color}`}
              >
                <item.icon className="h-7 w-7 mb-3 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-[13px] font-bold tracking-tight text-center text-slate-800 dark:text-slate-200">
                  {item.title}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* SECTION 2: MY CLASSES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              My Classes {loading && <Loader2 className="inline h-3 w-3 animate-spin text-orange-500 ml-1" />}
            </h3>
            <Link to="/departments" className="text-xs font-bold text-orange-500 hover:underline flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Class
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white dark:bg-[#0c1222] rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-400">Loading Classes from Database...</p>
            </div>
          ) : classesList.length === 0 ? (
            <div className="p-6 text-center bg-white dark:bg-[#0c1222] rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-xs font-bold text-slate-400">
              No active classes found in Firestore database.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {classesList.slice(0, 6).map((cls, idx) => {
                const totalStudentsCount = cls.students?.length || 0;
                const glowStyles = [
                  'hover:border-purple-500/80 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] border-l-purple-500',
                  'hover:border-indigo-500/80 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] border-l-indigo-500',
                  'hover:border-amber-500/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] border-l-amber-500',
                  'hover:border-emerald-500/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] border-l-emerald-500',
                ];
                const glow = glowStyles[idx % glowStyles.length];

                return (
                  <Link 
                    key={cls.id}
                    to="/departments"
                    className={`group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800/80 border-l-4 shadow-sm hover:-translate-y-0.5 transition-all duration-300 cursor-pointer ${glow}`}
                  >
                    <div className="space-y-2">
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">
                        {cls.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <span className="bg-slate-100 dark:bg-slate-900/60 px-1.5 py-0.5 rounded">
                          Students: {totalStudentsCount}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">
                          P: {cls.present}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded">
                          A: {cls.absent}
                        </span>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#070b13] border border-slate-200/40 dark:border-slate-800 group-hover:bg-slate-100 dark:group-hover:bg-slate-900 transition-colors">
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: TODAY'S METRICS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Today&apos;s Metrics
            </h3>
            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Live Firestore
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {overviewMetrics.map((metric, i) => (
              <div 
                key={i} 
                className={`border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0c1222] rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-1 ${metric.glow}`}
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block tracking-wide uppercase">{metric.title}</span>
                  <span className="text-xl font-black text-slate-950 dark:text-white block tracking-tight">{metric.value}</span>
                  <span className={`text-[10px] font-bold block ${metric.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {metric.change}
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl ${metric.bg} bg-opacity-15`}>
                  <metric.icon className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* ULTRA-PREMIUM STICKY BOTTOM NAVIGATION POOL */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent dark:from-[#070b13] dark:via-[#070b13]/90">
        <nav className="mx-auto max-w-md bg-white/80 dark:bg-[#0c1222]/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/40 rounded-3xl shadow-[0_15px_35px_-5px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)] px-3 py-2 flex items-center justify-between">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <Link
                key={tab.id}
                to={tab.href}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center flex-1 py-1 relative group"
              >
                <div className={`p-2 rounded-2xl transition-all duration-300 relative ${isActive ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                <span className={`text-[9px] font-bold tracking-tight mt-1 transition-colors ${isActive ? 'text-orange-600 dark:text-orange-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
                  {tab.label}
                </span>
                
                {isActive && (
                  <div className="absolute top-0 h-1 w-1 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 1. PREMIUM LOGOUT CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-[#0c1222] p-6 shadow-[0_0_35px_rgba(244,63,94,0.3)] border border-rose-500/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <LogOut className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Oh no! You&apos;re leaving...
              </h3>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                Are you sure?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isLoggingOut}
                className="w-full rounded-2xl bg-red-600 py-3 text-xs font-black text-white shadow-md shadow-red-500/30 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
              >
                Nah, Just Kidding
              </button>
              <button
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="w-full rounded-2xl border-2 border-red-500/80 bg-transparent py-2.5 text-xs font-black text-red-600 dark:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggingOut && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Yes, Log Me Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. PREMIUM LOGOUT SUCCESS NOTIFICATION MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-[#0c1222] p-6 shadow-[0_0_35px_rgba(34,197,94,0.3)] border border-emerald-500/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white shadow-inner">
              <ThumbsUp className="h-8 w-8 fill-current" />
            </div>

            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-snug">
                You&apos;ve successfully Logged out.
              </h3>
            </div>

            <div className="pt-2">
              <button
                onClick={handleRedirectToLogin}
                className="w-full rounded-2xl bg-red-600 py-3 text-xs font-black text-white shadow-md shadow-red-500/30 transition-all hover:bg-red-700 active:scale-95"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
