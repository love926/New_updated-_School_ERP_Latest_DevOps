import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  Users,
  Wallet,
  GraduationCap,
  ChevronDown,
  TrendingUp,
  SlidersHorizontal,
  UserX,
  Home,
  Settings,
  Loader2,
  CheckCircle2,
  Calendar as CalendarIcon,
  ArrowLeft,
  AlertCircle,
  X,
  CheckCircle,
  Clock,
  Filter,
  Sparkles,
  Award,
} from 'lucide-react';

// Firebase Firestore & Auth Imports
import { collection, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Components & Types
import { StudentCaptureSection } from '../components/analytics/StudentCaptureSection';

// Fallback User ID
const FALLBACK_USER_ID = 'X1Q76ib1XXPwCp3FSQPLLaTzL83';

export type CaptureCriteria = 'Weighted Score' | 'Attendance Rate' | 'Quiz Marks' | 'overallScore' | 'manualTag';

// Helper: Calculate Dynamic Sliding Window (Max 2 months starting from class creation date)
const getMonthsForClass = (createdAtStrOrTimestamp: any) => {
  const months = [];
  const now = new Date();

  // 1. Standard sliding window of last 2 months relative to current date
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    months.push({ key: monthKey, label, dateObj: d });
  }

  if (!createdAtStrOrTimestamp) {
    return months.map(({ key, label }) => ({ key, label }));
  }

  // 2. Convert createdAt into Date object (handles ISO String or Firestore Timestamp)
  let createdDate: Date;
  if (typeof createdAtStrOrTimestamp === 'object' && createdAtStrOrTimestamp.toDate) {
    createdDate = createdAtStrOrTimestamp.toDate();
  } else {
    createdDate = new Date(createdAtStrOrTimestamp);
  }

  if (isNaN(createdDate.getTime())) {
    return months.map(({ key, label }) => ({ key, label }));
  }

  // 3. Get 1st day of the creation month
  const creationMonthStart = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);

  // 4. Filter out any months older than the creation month
  const validMonths = months.filter((m) => m.dateObj >= creationMonthStart);

  return validMonths.map(({ key, label }) => ({ key, label }));
};

// Helper: Standardize Date string to YYYY-MM-DD
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

// Interface for Fee Modal Data
interface FeeDetailStudent {
  id: string;
  name: string;
  rollNo: string;
  status: 'PAID' | 'UNPAID';
  amountPaid: number;
  date?: string;
}

// ==========================================
// SHOWPIECE CAPTURE SETTINGS MODAL
// ==========================================
interface CaptureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: CaptureCriteria;
  onSaveCriteria: (selected: CaptureCriteria) => void;
}

function CustomCaptureSettingsModal({
  isOpen,
  onClose,
  criteria,
  onSaveCriteria,
}: CaptureSettingsModalProps) {
  const [selected, setSelected] = useState<CaptureCriteria>(criteria);

  useEffect(() => {
    setSelected(criteria);
  }, [criteria]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#0c1222] border-2 border-orange-500/50 rounded-3xl p-6 shadow-[0_0_40px_rgba(249,115,22,0.25)] space-y-5 text-slate-900 dark:text-slate-100 relative">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black flex items-center gap-1.5">
                Capture Settings <Sparkles className="h-4 w-4 text-orange-500 fill-orange-500" />
              </h3>
              <p className="text-[10px] text-slate-400 font-bold">
                Choose evaluation rule for 4 student categories
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div
            onClick={() => setSelected('Weighted Score')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
              selected === 'Weighted Score' || selected === 'overallScore'
                ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 shadow-md shadow-orange-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-black">Weighted Score Formula</span>
                <span className="text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                  RECOMMENDED
                </span>
              </div>
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center border ${
                  selected === 'Weighted Score' || selected === 'overallScore'
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {(selected === 'Weighted Score' || selected === 'overallScore') && (
                  <CheckCircle2 className="h-3.5 w-3.5 fill-current" />
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed pl-6">
              Calculates top 4 representatives using 40% Attendance + 60% Quiz Marks weighting.
            </p>
          </div>

          <div
            onClick={() => setSelected('Quiz Marks')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
              selected === 'Quiz Marks'
                ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 shadow-md shadow-orange-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-black">Quiz Marks Priority</span>
                <span className="text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                  ACADEMIC
                </span>
              </div>
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center border ${
                  selected === 'Quiz Marks'
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {selected === 'Quiz Marks' && <CheckCircle2 className="h-3.5 w-3.5 fill-current" />}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed pl-6">
              Captures representative students strictly based on their total quiz performance.
            </p>
          </div>

          <div
            onClick={() => setSelected('Attendance Rate')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
              selected === 'Attendance Rate'
                ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 shadow-md shadow-orange-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-black">Attendance Priority</span>
                <span className="text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                  REGULARITY
                </span>
              </div>
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center border ${
                  selected === 'Attendance Rate'
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {selected === 'Attendance Rate' && <CheckCircle2 className="h-3.5 w-3.5 fill-current" />}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed pl-6">
              Filter student categories purely based on their overall attendance logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSaveCriteria(selected)}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-black text-xs shadow-lg shadow-orange-500/30 transition-all"
          >
            Save Criteria
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// BOTTOM NAVBAR COMPONENT
// ==========================================
function BottomNavbar() {
  const location = useLocation();

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    {
      id: 'classes',
      label: 'Classes',
      icon: GraduationCap,
      href: '/departments',
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: Users,
      href: '/attendance',
    },
    {
      id: 'fees',
      label: 'Fees',
      icon: Wallet,
      href: '/fees',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      href: '/settings',
    },
  ];

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.12)] rounded-full px-5 py-2 flex items-center justify-between gap-6 max-w-md w-full">
        {navigationTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.href ||
            (tab.id === 'fees' && location.pathname.includes('/fees'));

          return (
            <Link
              key={tab.id}
              to={tab.href}
              className="flex flex-col items-center relative transition-transform active:scale-95"
            >
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
              )}

              <div
                className={`flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'w-10 h-10 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/40 scale-105'
                    : 'w-10 h-10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-5 w-5 stroke-[2.2]" />
              </div>

              <span
                className={`text-[10px] font-bold mt-1 ${
                  isActive ? 'text-orange-500' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// ==========================================
// MAIN ANALYTICS PAGE COMPONENT
// ==========================================
export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchingMetrics, setFetchingMetrics] = useState(false);

  // Firestore Classes State
  const [classesList, setClassesList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // 🌟 DYNAMIC CLASS CREATION DATE BASED MONTHS
  const currentClass = useMemo(() => {
    return classesList.find((c) => c.id === selectedClassId) || null;
  }, [selectedClassId, classesList]);

  const availableMonths = useMemo(() => {
    return getMonthsForClass(currentClass?.createdAt);
  }, [currentClass]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');

  // Ensure selectedMonthKey updates when availableMonths changes
  useEffect(() => {
    if (availableMonths.length > 0) {
      const exists = availableMonths.some((m) => m.key === selectedMonthKey);
      if (!exists) {
        setSelectedMonthKey(availableMonths[0].key);
      }
    }
  }, [availableMonths, selectedMonthKey]);

  // Filter Mode: 'month' vs 'daily'
  const [analyticsType, setAnalyticsType] = useState<'month' | 'daily'>('month');

  // Selected Date for Daily Analytics
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Dynamic No-Data Notification State
  const [noDataNotification, setNoDataNotification] = useState<string | null>(null);

  // 4 Students Capture Settings
  const [captureCriteria, setCaptureCriteria] = useState<CaptureCriteria>('Weighted Score');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // SHOWPIECE GLOWING TOAST STATE
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Paid/Unpaid Fee Detail Modal State
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [feeModalFilter, setFeeModalFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [feeDetailedStudents, setFeeDetailedStudents] = useState<FeeDetailStudent[]>([]);

  // Live Weekly Trend Data Points
  const [trendDataPoints, setTrendDataPoints] = useState<number[]>([70, 65, 80, 75, 60, 85, 90]);

  // Dynamic Metrics State
  const [metrics, setMetrics] = useState({
    attendanceRate: 0,
    absentPercentage: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    absentToday: 0,
    feeRecoveryRate: 0,
    paidCount: 0,
    pendingCount: 0,
    totalRevenue: 0,
    dailyCollectedRevenue: 0,
    dailyPaidCount: 0,
    totalStudentsCount: 0,
  });

  // User ID Resolution
  const activeUserId = auth.currentUser?.uid || FALLBACK_USER_ID;

  // SHOWPIECE SAVE CRITERIA HANDLER
  const handleSaveCriteriaShowpiece = (selected: CaptureCriteria) => {
    setCaptureCriteria(selected);
    setIsSettingsOpen(false);

    setShowSuccessToast(true);

    setTimeout(() => {
      setShowSuccessToast(false);
    }, 2500);
  };

  // 1. LISTEN TO FIRESTORE CLASSES (EXTRACTING createdAt)
  useEffect(() => {
    setLoading(true);
    const classesRef = collection(db, 'users', activeUserId, 'classes');

    const unsubscribe = onSnapshot(
      classesRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedClasses: any[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedClasses.push({
              id: docSnap.id,
              name: data.name || data.className || 'Unnamed Class',
              code: data.code || '',
              monthlyFee: data.monthlyFee || data.fee || 1500,
              students: data.students || [],
              createdAt: data.createdAt || null, // 🌟 Fetched createdAt field
            });
          });

          loadedClasses.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          );

          setClassesList(loadedClasses);
          if (loadedClasses.length > 0 && !selectedClassId) {
            setSelectedClassId(loadedClasses[0].id);
          }
          setLoading(false);
        } else {
          getDocs(collection(db, 'classes'))
            .then((rootSnap) => {
              if (!rootSnap.empty) {
                const rootClasses: any[] = [];
                rootSnap.forEach((docSnap) => {
                  const data = docSnap.data();
                  rootClasses.push({
                    id: docSnap.id,
                    name: data.name || data.className || 'Unnamed Class',
                    code: data.code || '',
                    monthlyFee: data.monthlyFee || data.fee || 1500,
                    students: data.students || [],
                    createdAt: data.createdAt || null, // 🌟 Fetched createdAt field
                  });
                });

                rootClasses.sort((a, b) =>
                  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                );

                setClassesList(rootClasses);
                if (rootClasses.length > 0 && !selectedClassId) {
                  setSelectedClassId(rootClasses[0].id);
                }
              } else {
                setClassesList([]);
                setSelectedClassId('');
              }
            })
            .finally(() => setLoading(false));
        }
      },
      (error) => {
        console.warn('Firestore classes error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeUserId]);

  // Ensure selectedClassId stays valid
  useEffect(() => {
    if (classesList.length > 0) {
      const exists = classesList.some((c) => c.id === selectedClassId);
      if (!exists) {
        setSelectedClassId(classesList[0].id);
      }
    }
  }, [classesList, selectedClassId]);

  // 2. FIRESTORE ATTENDANCE & ACCURATE FEE CALCULATOR
  useEffect(() => {
    const calculateAnalytics = async () => {
      if (!selectedClassId || !selectedMonthKey) return;

      setFetchingMetrics(true);

      try {
        const activeClass = classesList.find((c) => c.id === selectedClassId);
        const classStudents = activeClass?.students || [];
        const totalStudents = classStudents.length || 0;
        const defaultClassFee = activeClass?.monthlyFee || 1500;

        const normalizedSelectedDate = normalizeDate(selectedDate);

        let hasDataForSelectedDate = false;

        // A. ATTENDANCE COLLECTION PROCESSING
        let attendanceRef = collection(db, 'users', activeUserId, 'attendance');
        let attendanceSnapshot = await getDocs(attendanceRef);

        if (attendanceSnapshot.empty) {
          attendanceSnapshot = await getDocs(collection(db, 'attendance'));
        }

        let totalPresent = 0;
        let totalLate = 0;
        let totalAbsent = 0;
        let dayAbsentees = 0;

        const weeklyScores = [0, 0, 0, 0, 0, 0, 0];
        const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];

        attendanceSnapshot.forEach((docSnap) => {
          const docId = docSnap.id;
          const data = docSnap.data();

          const isClassMatch =
            data.classId === selectedClassId ||
            docId.startsWith(selectedClassId) ||
            docId.includes(selectedClassId);

          if (!isClassMatch) return;

          const docDate = normalizeDate(data.date || docId.split('_').pop() || '');

          if (docDate === normalizedSelectedDate) {
            hasDataForSelectedDate = true;
          }

          const isDateMatch =
            docDate === normalizedSelectedDate || docId.includes(normalizedSelectedDate);

          const isMonthMatch =
            data.month === selectedMonthKey ||
            docId.includes(selectedMonthKey) ||
            docDate.startsWith(selectedMonthKey);

          if (docDate) {
            const d = new Date(docDate);
            const dayIdx = (d.getDay() + 6) % 7;
            if (dayIdx >= 0 && dayIdx < 7) {
              weeklyCounts[dayIdx]++;
              weeklyScores[dayIdx] += data.presentCount ? (data.presentCount / Math.max(1, totalStudents)) * 100 : 70;
            }
          }

          const processAttendanceDoc = (isForDailyCount: boolean) => {
            if (data.attendanceMap && typeof data.attendanceMap === 'object') {
              Object.values(data.attendanceMap).forEach((val: any) => {
                if (val === true || val === 'present' || val === 'Present') {
                  totalPresent++;
                } else if (val === false || val === 'absent' || val === 'Absent') {
                  totalAbsent++;
                  if (isForDailyCount) dayAbsentees++;
                } else if (val === 'late' || val === 'Late') {
                  totalLate++;
                }
              });
            } else if (typeof data.presentCount === 'number') {
              totalPresent += data.presentCount;
              totalLate += data.lateCount || 0;
              totalAbsent += data.absentCount || 0;
              if (isForDailyCount) dayAbsentees += data.absentCount || 0;
            } else if (Array.isArray(data.records) || Array.isArray(data.students)) {
              const list = data.records || data.students;
              list.forEach((item: any) => {
                if (item.status === 'present' || item.present === true) {
                  totalPresent++;
                } else if (item.status === 'late') {
                  totalLate++;
                } else if (item.status === 'absent' || item.present === false) {
                  totalAbsent++;
                  if (isForDailyCount) dayAbsentees++;
                }
              });
            }
          };

          if (analyticsType === 'daily') {
            if (isDateMatch) processAttendanceDoc(true);
          } else {
            if (isMonthMatch) processAttendanceDoc(false);
          }
        });

        const calculatedTrend = weeklyScores.map((score, idx) => {
          const count = weeklyCounts[idx];
          return count > 0 ? Math.min(100, Math.round(score / count)) : 50 + (idx * 5) % 35;
        });
        setTrendDataPoints(calculatedTrend);

        // B. DEEP FIRESTORE FEE PARSER
        let paidStudentsCount = 0;
        let monthTotalRevenue = 0;
        let dailyRevenue = 0;
        let dailyPaidStudentsCount = 0;

        const feeDetailList: FeeDetailStudent[] = [];

        const targetFeeDocId = `${selectedClassId}_${selectedMonthKey}`;

        let feeDocRef = doc(db, 'users', activeUserId, 'fees', targetFeeDocId);
        let feeDocSnap = await getDoc(feeDocRef);

        if (!feeDocSnap.exists()) {
          feeDocRef = doc(db, 'fees', targetFeeDocId);
          feeDocSnap = await getDoc(feeDocRef);
        }

        if (feeDocSnap.exists()) {
          const feeData = feeDocSnap.data() || {};
          const docUpdatedAt = feeData.updatedAt
            ? normalizeDate(feeData.updatedAt)
            : normalizedSelectedDate;

          const recordsSource =
            feeData.feeRecords && typeof feeData.feeRecords === 'object'
              ? feeData.feeRecords
              : feeData;

          Object.entries(recordsSource).forEach(([key, value]) => {
            if (['classId', 'month', 'updatedAt', 'feeRecords'].includes(key)) return;

            if (typeof value === 'object' && value !== null) {
              const studentRec: any = value;
              const isPaid =
                studentRec.status === 'PAID' ||
                studentRec.status === 'paid' ||
                (typeof studentRec.paidAmount === 'number' && studentRec.paidAmount > 0);

              const paidAmt = Number(studentRec.paidAmount || defaultClassFee);
              const paymentDate = normalizeDate(
                studentRec.paidDate || studentRec.date || studentRec.paidAt || docUpdatedAt
              );

              if (paymentDate === normalizedSelectedDate && isPaid) {
                hasDataForSelectedDate = true;
              }

              const foundStudent = classStudents.find(
                (s: any) =>
                  String(s.id) === String(key) ||
                  String(s.rollNo) === String(key) ||
                  s.name?.toLowerCase() === key.toLowerCase()
              );

              const studentName = foundStudent?.name || `Student (${key.slice(-4)})`;
              const studentRoll = foundStudent?.rollNo || key;

              if (isPaid) {
                paidStudentsCount++;
                monthTotalRevenue += paidAmt;

                if (paymentDate === normalizedSelectedDate) {
                  dailyRevenue += paidAmt;
                  dailyPaidStudentsCount++;
                }

                feeDetailList.push({
                  id: key,
                  name: studentName,
                  rollNo: studentRoll,
                  status: 'PAID',
                  amountPaid: paidAmt,
                  date: paymentDate || normalizedSelectedDate,
                });
              } else {
                feeDetailList.push({
                  id: key,
                  name: studentName,
                  rollNo: studentRoll,
                  status: 'UNPAID',
                  amountPaid: 0,
                });
              }
            }
          });
        }

        classStudents.forEach((st: any) => {
          const exists = feeDetailList.some(
            (f) => String(f.id) === String(st.id) || String(f.rollNo) === String(st.rollNo)
          );
          if (!exists) {
            feeDetailList.push({
              id: st.id || st.rollNo,
              name: st.name || 'Unknown Student',
              rollNo: st.rollNo || 'N/A',
              status: 'UNPAID',
              amountPaid: 0,
            });
          }
        });

        if (analyticsType === 'daily' && !hasDataForSelectedDate) {
          setNoDataNotification(`No attendance or fee records found for ${selectedDate}. Showing default zero state.`);
        } else {
          setNoDataNotification(null);
        }

        const totalEntries = totalPresent + totalLate + totalAbsent;
        const calcAttendanceRate =
          totalEntries > 0
            ? Math.round(((totalPresent + totalLate) / totalEntries) * 100)
            : 0;
        const calculatedAbsentPercentage =
          totalEntries > 0 ? 100 - calcAttendanceRate : 0;

        const recoveryRate =
          totalStudents > 0
            ? Math.round((paidStudentsCount / totalStudents) * 100)
            : paidStudentsCount > 0
            ? 100
            : 0;

        const pendingStudentsCount = Math.max(0, totalStudents - paidStudentsCount);

        setFeeDetailedStudents(feeDetailList);

        setMetrics({
          attendanceRate: calcAttendanceRate,
          absentPercentage: calculatedAbsentPercentage,
          presentCount: totalPresent,
          lateCount: totalLate,
          absentCount: totalAbsent,
          absentToday: dayAbsentees,
          feeRecoveryRate: recoveryRate,
          paidCount: paidStudentsCount,
          pendingCount: pendingStudentsCount,
          totalRevenue: monthTotalRevenue,
          dailyCollectedRevenue: dailyRevenue,
          dailyPaidCount: dailyPaidStudentsCount,
          totalStudentsCount: totalStudents,
        });
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setFetchingMetrics(false);
      }
    };

    calculateAnalytics();
  }, [
    selectedClassId,
    selectedMonthKey,
    selectedDate,
    analyticsType,
    classesList,
    activeUserId,
  ]);

  const filteredFeeStudents = useMemo(() => {
    if (feeModalFilter === 'PAID') return feeDetailedStudents.filter((s) => s.status === 'PAID');
    if (feeModalFilter === 'UNPAID') return feeDetailedStudents.filter((s) => s.status === 'UNPAID');
    return feeDetailedStudents;
  }, [feeDetailedStudents, feeModalFilter]);

  const capturedStudents = useMemo(() => {
    const students = [...(currentClass?.students || [])];
    if (!students.length) return {};

    if (captureCriteria === 'manualTag') {
      return {
        excellent: students.find((s) => s.tag === 'Excellent') || students[0],
        good: students.find((s) => s.tag === 'Good') || students[1],
        average: students.find((s) => s.tag === 'Average') || students[2],
        poor: students.find((s) => s.tag === 'Poor') || students[3],
      };
    }

    const key = captureCriteria;
    students.sort((a, b) => (b[key] || 0) - (a[key] || 0));

    const len = students.length;
    return {
      excellent: students[0],
      good: students[Math.floor(len * 0.25)] || students[0],
      average: students[Math.floor(len * 0.55)] || students[len - 2] || students[0],
      poor: students[len - 1] || students[0],
    };
  }, [currentClass, captureCriteria]);

  const svgPathD = useMemo(() => {
    const points = trendDataPoints;
    const xStep = 380 / (points.length - 1);
    const coords = points.map((p, idx) => {
      const x = 10 + idx * xStep;
      const y = 110 - (p / 100) * 90;
      return { x, y };
    });

    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      path += ` L ${coords[i].x} ${coords[i].y}`;
    }
    return { path, coords };
  }, [trendDataPoints]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
          <p className="text-xs font-black tracking-wide text-orange-400">
            Syncing Database Analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${
        isDark ? 'dark' : ''
      }`}
    >
      {showSuccessToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-6 fade-in duration-300 w-[90%] max-w-sm">
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-black text-xs px-5 py-3.5 rounded-2xl shadow-[0_0_35px_rgba(249,115,22,0.85)] border-2 border-orange-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-yellow-200 animate-spin" />
              <span className="tracking-wide">✨ Successfully Updated!</span>
            </div>
            <CheckCircle2 className="h-5 w-5 text-white stroke-[3] shrink-0" />
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="w-full bg-white/60 dark:bg-[#070b13]/60 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="h-10 w-10 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 transition-all border-2 border-orange-400/50"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.8]" />
            </button>
            <h1 className="text-xl font-black tracking-tight">Analytics</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-2xl bg-slate-100 dark:bg-[#0c1222] border border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-500 transition-colors"
              title="Settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-7 w-12 items-center rounded-full bg-slate-200/60 p-0.5 transition-all dark:bg-slate-800 border border-slate-300/30"
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm transition-all ${
                  isDark ? 'translate-x-5 bg-slate-950 text-yellow-400' : ''
                }`}
              >
                {isDark ? (
                  <Moon className="h-3 w-3 fill-current" />
                ) : (
                  <Sun className="h-3 w-3 fill-current" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN BODY */}
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        {/* ACTIVE DATA SELECTION */}
        <div className="relative overflow-hidden bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-4 shadow-lg shadow-orange-500/5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-orange-500" /> ACTIVE DATA SELECTION
            </span>
            {fetchingMetrics ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Live Connected
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* Class Selector */}
            <div className="relative">
              <label className="block text-[11px] font-black text-slate-400 mb-1 ml-1">
                Select Class ({classesList.length} Available)
              </label>
              <div className="relative">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full appearance-none rounded-2xl bg-slate-100 dark:bg-[#070b13] px-4 py-3 pr-10 text-xs font-black text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                >
                  {classesList.length === 0 ? (
                    <option value="">No Classes Found</option>
                  ) : (
                    classesList.map((cls) => (
                      <option key={cls.id} value={cls.id} className="bg-slate-900 text-white py-1">
                        🎓 {cls.name} — PKR {cls.monthlyFee}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500 pointer-events-none" />
              </div>
            </div>

            {/* Dynamic Month Selector (Filtered by Class Creation Date) */}
            <div className="relative">
              <label className="block text-[11px] font-black text-slate-400 mb-1 ml-1">
                Record Month
              </label>
              <div className="relative">
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="w-full appearance-none rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 px-4 py-3 pr-10 text-xs font-black text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-900/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m.key} value={m.key} className="bg-slate-900 text-white py-1">
                      🗓️ {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500 pointer-events-none" />
              </div>
            </div>

            {/* FULL MONTH vs DAILY ANALYTICS TOGGLE */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
              <div className="flex bg-slate-100 dark:bg-[#070b13] p-1 rounded-2xl">
                <button
                  onClick={() => setAnalyticsType('month')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                    analyticsType === 'month'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Full Month Analytics
                </button>
                <button
                  onClick={() => setAnalyticsType('daily')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                    analyticsType === 'daily'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Daily Analytics
                </button>
              </div>

              {/* DATE PICKER */}
              {analyticsType === 'daily' && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <label className="block text-[11px] font-black text-orange-500 mb-1 ml-1 flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" /> Select Specific Date:
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full rounded-2xl bg-slate-100 dark:bg-[#070b13] px-4 py-2.5 text-xs font-black border border-orange-500/40 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                    />
                  </div>

                  {noDataNotification && (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-500 animate-in fade-in duration-300">
                      <AlertCircle className="h-4 w-4 shrink-0 animate-pulse" />
                      <p className="text-[11px] font-bold leading-tight">
                        {noDataNotification}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* METRICS CARDS GRID */}
        <div
          className={`grid grid-cols-2 gap-3 transition-opacity duration-300 ${
            fetchingMetrics ? 'opacity-70' : 'opacity-100'
          }`}
        >
          {/* Attendance Rate */}
          <div className="relative overflow-hidden bg-white dark:bg-[#0c1222] border border-emerald-500/30 rounded-3xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.2)] transition-all hover:scale-[1.02] space-y-2 group">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">Attendance Rate</p>
              <h2 className="text-2xl font-black text-emerald-500">
                {metrics.attendanceRate}%
              </h2>
            </div>
          </div>

          {/* Fee Recovery Card */}
          <div
            onClick={() => setIsFeeModalOpen(true)}
            className="relative overflow-hidden bg-white dark:bg-[#0c1222] border border-orange-500/40 rounded-3xl p-4 shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.03] active:scale-95 cursor-pointer group space-y-2"
          >
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-500/15 rounded-full blur-xl pointer-events-none animate-pulse" />

            <div className="flex items-center justify-between relative z-10">
              <div className="h-9 w-9 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-black uppercase text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20 shadow-sm animate-pulse">
                Tap to view 👁️
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-slate-400">
                {analyticsType === 'month' ? 'Fee Recovery (Month)' : 'Fee Collected (Today)'}
              </p>
              {analyticsType === 'month' ? (
                <div className="flex items-baseline gap-1.5">
                  <h2 className="text-2xl font-black text-orange-500">
                    {metrics.feeRecoveryRate}%
                  </h2>
                  <span className="text-[10px] font-extrabold text-slate-400">
                    ({metrics.paidCount}/{metrics.totalStudentsCount})
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <h2 className="text-lg font-black text-orange-500">
                    PKR {metrics.dailyCollectedRevenue.toLocaleString()}
                  </h2>
                  <p className="text-[10px] font-extrabold text-emerald-500">
                    {metrics.dailyPaidCount} Paid Today
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Enrolled Students */}
          <div className="relative overflow-hidden bg-white dark:bg-[#0c1222] border border-blue-500/30 rounded-3xl p-4 shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:shadow-[0_0_25px_rgba(59,130,246,0.2)] transition-all hover:scale-[1.02] space-y-2 group">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/20 transition-all" />
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">Enrolled Students</p>
              <h2 className="text-2xl font-black text-blue-500">
                {metrics.totalStudentsCount}
              </h2>
            </div>
          </div>

          {/* Absent Count */}
          <div className="relative overflow-hidden bg-white dark:bg-[#0c1222] border border-rose-500/30 rounded-3xl p-4 shadow-[0_0_20px_rgba(244,63,94,0.1)] hover:shadow-[0_0_25px_rgba(244,63,94,0.2)] transition-all hover:scale-[1.02] space-y-2 group">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/20 transition-all" />
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <UserX className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400">
                {analyticsType === 'daily' ? 'Absent Selected Day' : 'Absent Records'}
              </p>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-rose-500">
                  {analyticsType === 'daily' ? metrics.absentToday : metrics.absentCount}
                </h2>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  ({metrics.absentPercentage}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PERFORMANCE TREND GRAPH */}
        <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black">Performance Trend</h3>
            <span className="text-[10px] font-black text-emerald-500 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> Live Calculations
            </span>
          </div>

          <div className="relative pt-2">
            <svg viewBox="0 0 400 120" className="w-full h-28 overflow-visible">
              <defs>
                <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <path
                d={`${svgPathD.path} L 390 120 L 10 120 Z`}
                fill="url(#orangeGradient)"
              />

              <path
                d={svgPathD.path}
                fill="none"
                stroke="#f97316"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {svgPathD.coords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="4" fill="#f97316" className="transition-all duration-300" />
              ))}
            </svg>

            <div className="flex justify-between text-[10px] font-black text-slate-400 mt-1 px-1">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>

        {/* 4 REPRESENTATIVE STUDENTS CAPTURE SECTION */}
        <StudentCaptureSection
          classes={classesList}
          selectedClassId={selectedClassId}
          onSelectClassId={setSelectedClassId}
          captureCriteria={captureCriteria}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          capturedStudents={capturedStudents}
        />

        {/* ATTENDANCE & FEE OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-black">Attendance Overview</h3>
            <div className="flex items-center justify-around">
              <div className="relative h-24 w-24 flex items-center justify-center">
                <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500"
                    strokeDasharray={`${metrics.attendanceRate}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">
                    {metrics.attendanceRate}%
                  </p>
                  <p className="text-[9px] font-bold text-slate-400">Present</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs font-black">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-extrabold">Present</span>
                  <span className="ml-auto font-black">{metrics.presentCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                  <span className="text-slate-500 dark:text-slate-400 font-extrabold">Late</span>
                  <span className="ml-auto font-black">{metrics.lateCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-extrabold">Absent</span>
                  <span className="ml-auto font-black">{metrics.absentCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black">Fee Collection Summary</h3>
              <span className="text-xs font-black text-orange-500">
                {metrics.feeRecoveryRate}%
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-900 h-3.5 rounded-full overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${metrics.feeRecoveryRate}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-50 dark:bg-[#070b13] p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400">Paid Students</p>
                <p className="text-xs font-black text-emerald-500">{metrics.paidCount}</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#070b13] p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400">Pending</p>
                <p className="text-xs font-black text-orange-500">{metrics.pendingCount}</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#070b13] p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400">Month Revenue</p>
                <p className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                  PKR {metrics.totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* POPUP MODAL: PAID VS UNPAID STUDENTS */}
      {isFeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100 relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Fee Payment Breakdown</h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Class: {currentClass?.name} | {selectedMonthKey}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFeeModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* PAID / UNPAID FILTER TABS */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#070b13] p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/60">
              <button
                onClick={() => setFeeModalFilter('ALL')}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                  feeModalFilter === 'ALL'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Filter className="h-3 w-3" /> All ({feeDetailedStudents.length})
              </button>
              <button
                onClick={() => setFeeModalFilter('PAID')}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                  feeModalFilter === 'PAID'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                <CheckCircle className="h-3 w-3" /> Paid ({feeDetailedStudents.filter((s) => s.status === 'PAID').length})
              </button>
              <button
                onClick={() => setFeeModalFilter('UNPAID')}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                  feeModalFilter === 'UNPAID'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <Clock className="h-3 w-3" /> Unpaid ({feeDetailedStudents.filter((s) => s.status === 'UNPAID').length})
              </button>
            </div>

            {/* Student List */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredFeeStudents.length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-bold space-y-1">
                  <p className="text-xs">
                    No {feeModalFilter !== 'ALL' ? feeModalFilter.toLowerCase() : ''} records found.
                  </p>
                </div>
              ) : (
                filteredFeeStudents.map((st) => (
                  <div
                    key={st.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-[#070b13] border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-xs ${
                          st.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {st.status === 'PAID' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black">{st.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">Roll: {st.rollNo}</p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          st.status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                        }`}
                      >
                        {st.status === 'PAID' ? `PKR ${st.amountPaid}` : 'UNPAID'}
                      </span>
                      {st.status === 'PAID' && st.date && (
                        <span className="text-[9px] font-bold text-slate-400 mt-1 flex items-center gap-0.5">
                          📅 {st.date}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsFeeModalOpen(false)}
              className="w-full py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs shadow-lg shadow-orange-500/30 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM NAVBAR */}
      <BottomNavbar />

      {/* CUSTOM SHOWPIECE CAPTURE SETTINGS MODAL */}
      <CustomCaptureSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        criteria={captureCriteria}
        onSaveCriteria={handleSaveCriteriaShowpiece}
      />
    </div>
  );
}
