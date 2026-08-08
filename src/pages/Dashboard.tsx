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
  Download,
  X,
  Smartphone,
  Share,
  MoreVertical,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Check,
  LogOut
} from 'lucide-react';

// Firebase Firestore & Auth Imports
import { collection, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

// Fallback User ID / Email Identifiers
const FALLBACK_USER_EMAIL = 'alitahir243715@gmail.com';
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
  const navigate = useNavigate();
  const { departments } = useApp();
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Logout Overlay & Loading State
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Profile Data State
  const [profileData, setProfileData] = useState<{ name: string; avatarUrl: string }>({
    name: 'Teacher',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'
  });

  // Live Database States
  const [classesList, setClassesList] = useState<any[]>([]);
  const [metricsData, setMetricsData] = useState({
    totalClasses: 0,
    attendanceRate: 0,
    feesCollected: 0,
    pendingStudents: 0,
  });

  // Dynamic user identifier prioritize Email (matches Firestore screenshot users/alitahir243715@gmail.com)
  const userEmail = auth.currentUser?.email || FALLBACK_USER_EMAIL;
  const activeUserId = auth.currentUser?.uid || FALLBACK_USER_ID;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const monthKeyStr = useMemo(() => getCurrentMonthKey(), []);

  // Logout Handler
  const handleLogoutConfirm = async () => {
    try {
      setIsLoggingOut(true);
      await signOut(auth);
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  // 0. PWA LISTENERS & DETECT STANDALONE MODE
  useEffect(() => {
    const isAppStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(isAppStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Handle Download App Click
  const handleDownloadApp = async () => {
    setShowPwaModal(true);
  };

  const executeInstallPrompt = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallSuccess(true);
        setDeferredPrompt(null);
        setTimeout(() => {
          setShowPwaModal(false);
          setInstallSuccess(false);
        }, 2000);
      }
    }
  };

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

  // 1. FETCH USER PROFILE & TEACHER NAME FROM FIRESTORE
  useEffect(() => {
    let unsubscribeUser = () => {};

    const docKey = userEmail || activeUserId;
    if (docKey) {
      const emailDocRef = doc(db, 'users', docKey);
      unsubscribeUser = onSnapshot(emailDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfileData({
            name: data.teacherName || data.name || docKey.split('@')[0],
            avatarUrl: data.profileImage || data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
          });
        } else {
          const uidDocRef = doc(db, 'users', activeUserId);
          getDoc(uidDocRef).then((uidSnap) => {
            if (uidSnap.exists()) {
              const data = uidSnap.data();
              setProfileData({
                name: data.teacherName || data.name || 'Teacher',
                avatarUrl: data.profileImage || data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
              });
            }
          });
        }
      }, (err) => {
        console.error("Error fetching user profile by email:", err);
      });
    }

    return () => unsubscribeUser();
  }, [activeUserId, userEmail]);

  // 2. LIVE FIRESTORE DATA SYNC FOR CLASSES & METRICS
  useEffect(() => {
    setLoading(true);

    // Primary target identifier path matching users/alitahir243715@gmail.com/classes
    const userDocKey = userEmail || activeUserId;
    const classesRef = collection(db, 'users', userDocKey, 'classes');

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
              monthlyFee: Number(data.monthlyFee || data.fee || 1500),
              students: Array.isArray(data.students) ? data.students : (typeof data.students === 'object' && data.students !== null ? Object.values(data.students) : []),
              present: 0,
              absent: 0,
            });
          });
        } else {
          // Fallback to checking by activeUserId path or root classes collection
          let uidSnap = await getDocs(collection(db, 'users', activeUserId, 'classes'));
          if (uidSnap.empty) {
            uidSnap = await getDocs(collection(db, 'classes'));
          }
          
          uidSnap.forEach((docSnap) => {
            const data = docSnap.data();
            loadedClasses.push({
              id: docSnap.id,
              name: data.name || data.className || 'Unnamed Class',
              code: data.code || '',
              monthlyFee: Number(data.monthlyFee || data.fee || 1500),
              students: Array.isArray(data.students) ? data.students : (typeof data.students === 'object' && data.students !== null ? Object.values(data.students) : []),
              present: 0,
              absent: 0,
            });
          });
        }

        loadedClasses.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        try {
          let attendanceRef = collection(db, 'users', userDocKey, 'attendance');
          let attendanceSnap = await getDocs(attendanceRef);
          if (attendanceSnap.empty) {
            attendanceSnap = await getDocs(collection(db, 'users', activeUserId, 'attendance'));
          }
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
            let feeDocRef = doc(db, 'users', userDocKey, 'fees', feeDocId);
            let feeDocSnap = await getDoc(feeDocRef);

            if (!feeDocSnap.exists()) {
              feeDocRef = doc(db, 'users', activeUserId, 'fees', feeDocId);
              feeDocSnap = await getDoc(feeDocRef);
            }

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
  }, [userEmail, activeUserId, todayStr, monthKeyStr]);

  // Dynamic Metrics Array
  const overviewMetrics = [
    { title: 'Total Active Classes', value: String(metricsData.totalClasses), change: 'Live from DB', positive: true, icon: Flame, bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', glow: 'hover:border-indigo-500/80 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]' },
    { title: 'Attendance Rate', value: `${metricsData.attendanceRate}%`, change: 'Realtime record', positive: true, icon: Users, bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', glow: 'hover:border-emerald-500/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
    { title: 'Fees Collected', value: `PKR ${metricsData.feesCollected.toLocaleString()}`, change: 'Current Month', positive: true, icon: Wallet, bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', glow: 'hover:border-amber-500/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]' },
    { title: 'Pending Fee Students', value: String(metricsData.pendingStudents), change: 'Awaiting payment', positive: false, icon: CheckSquare, bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', glow: 'hover:border-rose-500/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]' },
  ];

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${isDark ? 'dark' : ''}`}>
      
      {/* MINIMAL PREMIUM UTILITY HEADER WITH COMBINED GLOWING CARD */}
      <div className="w-full bg-white/40 dark:bg-[#070b13]/40 backdrop-blur-sm border-b border-slate-200/40 dark:border-slate-900/40 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex h-16 items-center justify-end px-4 sm:px-6 lg:px-8">
          
          {/* ANIMATED & GLOWING SINGLE UTILITIES CARD */}
          <div className="relative group">
            {/* Pulsing Glowing Background Gradient Border */}
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 opacity-75 blur transition-all duration-500 group-hover:opacity-100 animate-pulse" />
            
            {/* Card Content Wrapper */}
            <div className="relative flex items-center gap-3 rounded-2xl bg-white/90 dark:bg-[#0c1222]/90 backdrop-blur-md px-3.5 py-1.5 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.25)]">
              
              {/* Light/Dark Toggle Pill */}
              <button 
                onClick={() => setIsDark(!isDark)}
                className="flex h-7 w-12 items-center rounded-full bg-slate-200/60 p-0.5 transition-all dark:bg-slate-800 border border-slate-300/30 cursor-pointer"
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm transition-all ${isDark ? 'translate-x-5 bg-slate-950 text-yellow-400' : ''}`}>
                  {isDark ? <Moon className="h-3 w-3 fill-current" /> : <Sun className="h-3 w-3 fill-current" />}
                </div>
              </button>

              {/* Notification Bell Badge */}
              <Link 
                to="/alerts" 
                className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#070b13] transition-all hover:scale-105 active:scale-95"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#070b13] animate-pulse">
                  3
                </span>
              </Link>

              {/* GLOWING ANIMATED LOGOUT BUTTON */}
              <button
                onClick={() => setShowLogoutModal(true)}
                title="Logout"
                className="relative group/btn p-2 rounded-xl text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-600 transition-all duration-300 hover:shadow-[0_0_15px_rgba(244,63,94,0.6)] hover:scale-105 active:scale-95 cursor-pointer border border-rose-500/20"
              >
                <LogOut className="h-4 w-4 transition-transform group-hover/btn:-translate-x-0.5" />
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
      </div>

      {/* CORE WORKSPACE MAIN CONTENT */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
        
        {/* BANNER GREETING ROW */}
        <div className="space-y-0.5">
          <h2 className="text-xl font-extrabold tracking-tight md:text-2xl flex items-center gap-2">
            Welcome back, <span className="text-orange-500 dark:text-orange-400">{profileData.name}</span> ! 
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Here&apos;s a high-fidelity lookup of your institutional framework today.
          </p>
        </div>

        {/* HERO BANNER - EDUTRACK CARD WITH PWA DOWNLOAD TRIGGER */}
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

              {/* EDUTRACK HEADER WITH GLOWING DOWNLOAD BUTTON */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  EduTrack
                </h1>
                
                <button
                  type="button"
                  onClick={handleDownloadApp}
                  className="relative group inline-flex items-center gap-2 px-4 py-1.5 text-xs font-black text-white bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.6)] hover:shadow-[0_0_30px_rgba(249,115,22,0.9)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer overflow-hidden border border-orange-300/50"
                >
                  <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                  <Download className="h-3.5 w-3.5 animate-bounce" />
                  <span>Download</span>
                </button>
              </div>

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

            {/* Outside Border Glow Box */}
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

      {/* STICKY BOTTOM NAVIGATION POOL */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent dark:from-[#070b13] dark:via-[#070b13]/90">
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

      {/* ULTRA UNIQUE GLOWING & ANIMATED CENTERED LOGOUT NOTIFICATION */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm">
            <div className="absolute -inset-1.5 rounded-[38px] bg-gradient-to-r from-rose-600 via-orange-500 to-rose-600 opacity-80 blur-xl animate-pulse" />

            <div className="relative overflow-hidden rounded-[32px] bg-slate-900/95 dark:bg-[#090d16]/95 border border-rose-500/40 p-6 shadow-[0_0_60px_rgba(244,63,94,0.4)] text-white backdrop-blur-2xl animate-in zoom-in-95 duration-300 text-center space-y-5">
              
              <button
                disabled={isLoggingOut}
                onClick={() => setShowLogoutModal(false)}
                className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-rose-600 via-orange-500 to-rose-600 animate-spin [animation-duration:8s] blur-md opacity-70" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-orange-500 text-white shadow-xl ring-2 ring-rose-300/40">
                  {isLoggingOut ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <LogOut className="h-8 w-8 animate-pulse" />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-2xl font-black tracking-tight text-white">
                  {isLoggingOut ? 'Logging Out...' : 'Logging Out?'}
                </h3>
                <p className="text-xs text-slate-300 font-medium leading-relaxed px-2">
                  {isLoggingOut 
                    ? 'Redirecting you securely to the login screen...' 
                    : 'Are you sure you want to end your current dashboard session?'}
                </p>
              </div>

              {!isLoggingOut && (
                <div className="pt-2 flex flex-col gap-2.5">
                  <button
                    onClick={handleLogoutConfirm}
                    className="w-full relative group py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-orange-500 to-rose-600 text-white font-black text-xs shadow-[0_0_25px_rgba(244,63,94,0.6)] hover:shadow-[0_0_35px_rgba(244,63,94,0.9)] hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer overflow-hidden border border-rose-300/40 flex items-center justify-center gap-2"
                  >
                    <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <LogOut className="h-4 w-4" /> Confirm Logout
                  </button>

                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer border border-white/10"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ULTRA UNIQUE GLOWING & ANIMATED CENTERED PWA POPUP NOTIFICATION */}
      {showPwaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          
          {/* Animated Glow Background Ring */}
          <div className="relative w-full max-w-md">
            <div className="absolute -inset-1.5 rounded-[38px] bg-gradient-to-r from-orange-500 via-amber-400 to-rose-500 opacity-80 blur-xl animate-pulse" />

            {/* Glassmorphic Main Card Container */}
            <div className="relative overflow-hidden rounded-[32px] bg-slate-900/95 dark:bg-[#090d16]/95 border border-orange-500/40 p-6 md:p-7 shadow-[0_0_60px_rgba(249,115,22,0.4)] text-white backdrop-blur-2xl animate-in zoom-in-95 duration-300">
              
              {/* Background Ambient Light Orbs */}
              <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

              {/* Top Close Button */}
              <button
                onClick={() => setShowPwaModal(false)}
                className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {installSuccess ? (
                /* Success Animated View */
                <div className="py-8 text-center space-y-4 animate-in zoom-in-90 duration-300">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-bounce">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white">App Installed Successfully!</h3>
                    <p className="text-xs text-slate-300 font-medium">EduTrack is now ready on your device home screen.</p>
                  </div>
                </div>
              ) : (
                /* Standard Animated Modal View */
                <div className="space-y-5 text-center relative z-10">
                  
                  {/* Floating Glowing App Icon Badge */}
                  <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-orange-500 via-amber-500 to-rose-500 animate-spin [animation-duration:8s] blur-md opacity-70" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-xl ring-2 ring-orange-300/40">
                      <Smartphone className="h-8 w-8 animate-pulse" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-black shadow-lg">
                      <Zap className="h-3.5 w-3.5 fill-current" />
                    </span>
                  </div>

                  {/* Header Title */}
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-orange-400/40 bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                      <Sparkles className="h-3 w-3 animate-spin" /> Next-Gen Mobile App
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white">
                      Install <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">EduTrack PWA</span>
                    </h3>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed px-2">
                      Get lightning-fast offline access, desktop shortcuts & native app experience directly on your device.
                    </p>
                  </div>

                  {/* Features Highlight Pill Row */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-extrabold text-slate-200">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1 hover:border-orange-500/50 transition-colors">
                      <ShieldCheck className="h-4 w-4 text-orange-400" />
                      <span>100% Secure</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1 hover:border-amber-400/50 transition-colors">
                      <Zap className="h-4 w-4 text-amber-400" />
                      <span>Instant Sync</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1 hover:border-emerald-400/50 transition-colors">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>No Store Req.</span>
                    </div>
                  </div>

                  {/* Dynamic Action Section based on Prompt availability */}
                  {deferredPrompt ? (
                    <div className="pt-2 space-y-2">
                      <button
                        onClick={executeInstallPrompt}
                        className="w-full relative group py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-black text-sm shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:shadow-[0_0_45px_rgba(249,115,22,0.9)] hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer overflow-hidden border border-orange-300/40"
                      >
                        <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        <span className="flex items-center justify-center gap-2">
                          <Download className="h-4 w-4" /> Click To Install App Now
                        </span>
                      </button>
                    </div>
                  ) : isStandalone ? (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-left">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-300">App Active</div>
                        <div className="text-[11px] text-slate-300">You are already running EduTrack in Standalone App Mode!</div>
                      </div>
                    </div>
                  ) : (
                    /* Manual Installation Guide if standard browser prompt is unavailable */
                    <div className="text-left space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-white/10 text-xs">
                      <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mb-1">How to Install Manually:</div>
                      
                      <div className="flex items-start gap-2 text-slate-300">
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500/30 text-orange-400 font-bold text-[10px] mt-0.5">1</div>
                        <span>Tap browser menu <MoreVertical className="h-3.5 w-3.5 inline text-orange-400" /> or Share <Share className="h-3.5 w-3.5 inline text-orange-400" /></span>
                      </div>

                      <div className="flex items-start gap-2 text-slate-300">
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500/30 text-orange-400 font-bold text-[10px] mt-0.5">2</div>
                        <span>Select <strong className="text-white">&quot;Add to Home Screen&quot;</strong> or <strong className="text-white">&quot;Install App&quot;</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Dismiss Button */}
                  <button
                    onClick={() => setShowPwaModal(false)}
                    className="w-full text-xs font-bold text-slate-400 hover:text-white transition-colors pt-1 cursor-pointer"
                  >
                    Dismiss & Continue Web Version
                  </button>

                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
