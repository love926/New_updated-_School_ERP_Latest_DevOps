import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Award, GraduationCap, Plus, ArrowLeft, Sun, Moon, Home, Users, Wallet,
  Settings, Sparkles, X, Save, Trash2, Edit3, BarChart2, ChevronDown,
  SlidersHorizontal, Calendar, Eye, Search, ChevronLeft, ChevronRight,
  Check, AlertTriangle
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { db, auth } from '../lib/firebase';

// Interfaces
interface StudentScore {
  id: string;
  rollNo?: number | string;
  name: string;
  gender: 'Male' | 'Female';
  marksObtained: number | '';
}

interface QuizRecord {
  id: string;
  topic: string;
  totalMarks: number;
  date: string;
  monthKey: string;
  createdAt: number;
  studentScores: StudentScore[];
  averageScore?: number;
}

interface ClassItem {
  id: string;
  className: string;
  classCode: string;
  students: { id: string; rollNo?: number | string; name: string; gender: 'Male' | 'Female' }[];
}

// Helper: Get Current & Previous Month Keys
const getCurrentAndPrevMonthKeys = () => {
  const now = new Date();
  const currentMonthKey = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = prevDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return { currentMonthKey, prevMonthKey };
};

// Helper: Calculate Performance Breakdown
const getCategoryPerformers = (scores: StudentScore[]) => {
  const valid = [...scores]
    .filter((s) => s.marksObtained !== '')
    .map((s) => ({ ...s, marks: Number(s.marksObtained) }))
    .sort((a, b) => b.marks - a.marks);

  if (valid.length === 0) return [];

  if (valid.length <= 4) {
    const labels = ['Excellent', 'Good', 'Average', 'Poor'];
    return valid.map((item, idx) => ({
      ...item,
      category: labels[idx] || 'Participant',
    }));
  }

  const excellent = { ...valid[0], category: 'Excellent' };
  const goodIdx = Math.floor(valid.length * 0.33);
  const averageIdx = Math.floor(valid.length * 0.66);
  const poorIdx = valid.length - 1;

  const good = { ...valid[goodIdx], category: 'Good' };
  const average = { ...valid[averageIdx], category: 'Average' };
  const poor = { ...valid[poorIdx], category: 'Poor' };

  const selected: Array<StudentScore & { marks: number; category: string }> = [excellent];
  if (!selected.some((s) => s.id === good.id)) selected.push(good);
  if (!selected.some((s) => s.id === average.id)) selected.push(average);
  if (!selected.some((s) => s.id === poor.id)) selected.push(poor);

  return selected;
};

// --- BOTTOM NAVBAR ---
function BottomNavbar() {
  const location = useLocation();
  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'classes', label: 'Classes', icon: GraduationCap, href: '/departments' },
    { id: 'attendance', label: 'Attendance', icon: Users, href: '/attendance' },
    { id: 'fees', label: 'Fees', icon: Wallet, href: '/fees' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.12)] rounded-full px-5 py-2 flex items-center justify-between gap-6 max-w-md w-full">
        {navigationTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.href;
          return (
            <Link
              key={tab.id}
              to={tab.href}
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all group"
            >
              <div
                className={`p-2.5 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md scale-110'
                    : 'text-slate-400 bg-transparent group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-[10px] font-bold mt-1 transition-colors ${
                  isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
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

// --- MAIN PAGE ---
export default function QuizManagementPage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Class & Month Modal Selectors State
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classSearchText, setClassSearchText] = useState('');
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);

  // Month Filtering & Available Options
  const { currentMonthKey, prevMonthKey } = useMemo(() => getCurrentAndPrevMonthKeys(), []);
  const [availableMonths, setAvailableMonths] = useState<string[]>([currentMonthKey]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Quizzes State
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);

  // View & Form States
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  // Form Inputs
  const [quizTopic, setQuizTopic] = useState('');
  const [totalMarks, setTotalMarks] = useState<number>(10);
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);

  // Refs array for auto-moving cursor down student inputs
  const scoreInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Form Filters & Dynamic Pagination (Page 1 = 7 Students, Page 2+ = 9 Students)
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [belowThreshold, setBelowThreshold] = useState<string>('');
  const [formPage, setFormPage] = useState(1);
  const PAGE_1_SIZE = 7;
  const PAGE_SUBSEQUENT_SIZE = 9;
  const [isSaving, setIsSaving] = useState(false);

  // Modal State for Viewing Full Quiz Details (5 per page)
  const [detailModalQuiz, setDetailModalQuiz] = useState<QuizRecord | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailGenderFilter, setDetailGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [detailPage, setDetailPage] = useState(1);
  const DETAIL_PAGE_SIZE = 5;

  // Confirmation Modal for Deleting Quiz Card
  const [deleteConfirmQuiz, setDeleteConfirmQuiz] = useState<QuizRecord | null>(null);

  // Glowing Notification State
  const [centerNotification, setCenterNotification] = useState<string | null>(null);

  const showCenterNotification = (msg: string) => {
    setCenterNotification(msg);
    setTimeout(() => {
      setCenterNotification(null);
    }, 3500);
  };

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Classes dynamically based on Logged-In User Email
  useEffect(() => {
    if (!currentUser?.email) return;

    const fetchClasses = async () => {
      try {
        setLoading(true);
        const userEmail = currentUser.email;
        const classesRef = collection(db, 'users', userEmail!, 'classes');
        const querySnapshot = await getDocs(classesRef);
        const fetchedClasses: ClassItem[] = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const rawStudents = (data.students && Array.isArray(data.students)) ? data.students : [];
          
          const sortedStudents = [...rawStudents].sort((a, b) => {
            const rA = Number(a.rollNo) || 0;
            const rB = Number(b.rollNo) || 0;
            return rA - rB;
          });

          fetchedClasses.push({
            id: docSnap.id,
            className: data.className || data.name || 'Unnamed Class',
            classCode: data.classCode || data.code || 'N/A',
            students: sortedStudents,
          });
        });

        fetchedClasses.sort((a, b) => a.className.localeCompare(b.className));
        setClasses(fetchedClasses);
        if (fetchedClasses.length > 0) {
          setSelectedClassId(fetchedClasses[0].id);
        }
      } catch (error) {
        console.error("Error fetching classes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, [currentUser]);

  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Filtered Classes for Selection Modal
  const filteredClassesModal = useMemo(() => {
    return classes.filter(
      (c) =>
        c.className.toLowerCase().includes(classSearchText.toLowerCase()) ||
        c.classCode.toLowerCase().includes(classSearchText.toLowerCase())
    );
  }, [classes, classSearchText]);

  // 3. Fetch Quizzes dynamically & Manage Rolling Months Database Logic
  useEffect(() => {
    if (!selectedClassId || !currentUser?.email) return;

    const fetchAndCleanupQuizzes = async () => {
      try {
        const userEmail = currentUser.email;
        const quizzesRef = collection(db, 'users', userEmail!, 'classes', selectedClassId, 'quizzes');
        const querySnapshot = await getDocs(quizzesRef);
        const fetchedQuizzes: QuizRecord[] = [];

        let hasPrevMonthData = false;

        for (const docSnap of querySnapshot.docs) {
          const quizData = docSnap.data() as QuizRecord;

          // Delete quizzes older than Previous Month (keep only current & previous month)
          if (quizData.monthKey && quizData.monthKey !== currentMonthKey && quizData.monthKey !== prevMonthKey) {
            await deleteDoc(doc(db, 'users', userEmail!, 'classes', selectedClassId, 'quizzes', docSnap.id));
          } else {
            if (quizData.monthKey === prevMonthKey) {
              hasPrevMonthData = true;
            }
            if (quizData.studentScores) {
              quizData.studentScores.sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0));
            }
            fetchedQuizzes.push(quizData);
          }
        }

        // Set Available Dropdown Months
        if (hasPrevMonthData) {
          setAvailableMonths([currentMonthKey, prevMonthKey]);
        } else {
          setAvailableMonths([currentMonthKey]);
          setSelectedMonth(currentMonthKey);
        }

        fetchedQuizzes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setQuizzes(fetchedQuizzes);
      } catch (error) {
        console.error("Error fetching quizzes:", error);
      }
    };

    fetchAndCleanupQuizzes();
    setIsCreatingQuiz(false);
    setEditingQuizId(null);
  }, [selectedClassId, currentUser, currentMonthKey, prevMonthKey]);

  // Filter quizzes by selected month
  const filteredQuizzesByMonth = useMemo(() => {
    return quizzes.filter((q) => q.monthKey === selectedMonth);
  }, [quizzes, selectedMonth]);

  // Open Form for NEW QUIZ
  const handleOpenNewQuiz = () => {
    if (!currentClass) return;
    setQuizTopic('');
    setTotalMarks(10);
    setGenderFilter('All');
    setBelowThreshold('');
    setFormPage(1);
    setEditingQuizId(null);

    const initialScores: StudentScore[] = [...(currentClass.students || [])]
      .sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0))
      .map((st, idx) => ({
        id: st.id,
        rollNo: st.rollNo || idx + 1,
        name: st.name,
        gender: st.gender || 'Male',
        marksObtained: '',
      }));

    setStudentScores(initialScores);
    setIsCreatingQuiz(true);
  };

  // Open Form for EDITING QUIZ
  const handleOpenEditQuiz = (quiz: QuizRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingQuizId(quiz.id);
    setQuizTopic(quiz.topic);
    setTotalMarks(quiz.totalMarks);

    const sortedScores = [...quiz.studentScores].sort(
      (a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0)
    );
    setStudentScores(sortedScores);

    setGenderFilter('All');
    setBelowThreshold('');
    setFormPage(1);
    setIsCreatingQuiz(true);
  };

  // Score Input Change
  const handleScoreChange = (studentId: string, val: string) => {
    const numericVal = val === '' ? '' : Math.min(Number(totalMarks), Math.max(0, Number(val)));
    setStudentScores((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, marksObtained: numericVal } : s))
    );
  };

  // Key Down Handler for Auto-Focus Next Student Input Field
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = scoreInputRefs.current[currentIndex + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = scoreInputRefs.current[currentIndex - 1];
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    }
  };

  // Filtered Students inside Edit/Create form
  const filteredStudentsInForm = useMemo(() => {
    return studentScores.filter((st) => {
      const matchesGender = genderFilter === 'All' || st.gender === genderFilter;
      let matchesMarks = true;
      if (belowThreshold !== '') {
        const thresholdNum = Number(belowThreshold);
        if (st.marksObtained !== '') {
          matchesMarks = Number(st.marksObtained) < thresholdNum;
        }
      }
      return matchesGender && matchesMarks;
    });
  }, [studentScores, genderFilter, belowThreshold]);

  // Dynamic Pagination Logic (Page 1 = 7 items, Page 2+ = 9 items)
  const totalFormPages = useMemo(() => {
    const total = filteredStudentsInForm.length;
    if (total <= PAGE_1_SIZE) return 1;
    return 1 + Math.ceil((total - PAGE_1_SIZE) / PAGE_SUBSEQUENT_SIZE);
  }, [filteredStudentsInForm]);

  const paginatedFormStudents = useMemo(() => {
    if (formPage === 1) {
      return filteredStudentsInForm.slice(0, PAGE_1_SIZE);
    }
    const start = PAGE_1_SIZE + (formPage - 2) * PAGE_SUBSEQUENT_SIZE;
    return filteredStudentsInForm.slice(start, start + PAGE_SUBSEQUENT_SIZE);
  }, [filteredStudentsInForm, formPage]);

  // Reset form page when filter changes
  useEffect(() => {
    setFormPage(1);
  }, [genderFilter, belowThreshold]);

  // Save / Update Quiz
  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTopic.trim() || !selectedClassId || !currentUser?.email) return;

    setIsSaving(true);
    try {
      const userEmail = currentUser.email;
      const now = new Date();
      const todayDate = now.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });

      const validScores = studentScores.filter((s) => s.marksObtained !== '');
      const totalSum = validScores.reduce((acc, curr) => acc + Number(curr.marksObtained), 0);
      const avg = validScores.length > 0 ? Number((totalSum / validScores.length).toFixed(1)) : 0;

      const quizId = editingQuizId || `quiz-${Date.now()}`;

      const orderedScores = [...studentScores].sort(
        (a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0)
      );

      const newQuizData: QuizRecord = {
        id: quizId,
        topic: quizTopic,
        totalMarks: Number(totalMarks),
        date: todayDate,
        monthKey: currentMonthKey,
        createdAt: Date.now(),
        studentScores: orderedScores,
        averageScore: avg,
      };

      const quizDocRef = doc(db, 'users', userEmail, 'classes', selectedClassId, 'quizzes', quizId);
      await setDoc(quizDocRef, newQuizData, { merge: true });

      if (editingQuizId) {
        setQuizzes((prev) => prev.map((q) => (q.id === quizId ? newQuizData : q)));
        showCenterNotification(" Quiz Marks Updated Successfully ");
      } else {
        setQuizzes((prev) => [newQuizData, ...prev]);
        showCenterNotification(" Quiz Saved Successfully ");
      }

      setIsCreatingQuiz(false);
      setEditingQuizId(null);
    } catch (error) {
      console.error("Error saving quiz:", error);
      alert("Failed to save quiz marks.");
    } finally {
      setIsSaving(false);
    }
  };

  // Open Custom Confirmation Permission Modal
  const handleRequestDeleteQuiz = (quiz: QuizRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmQuiz(quiz);
  };

  // Execute Confirmed Delete
  const handleConfirmDeleteQuiz = async () => {
    if (!deleteConfirmQuiz || !currentUser?.email) return;

    try {
      const userEmail = currentUser.email;
      const quizDocRef = doc(db, 'users', userEmail, 'classes', selectedClassId, 'quizzes', deleteConfirmQuiz.id);
      await deleteDoc(quizDocRef);
      setQuizzes((prev) => prev.filter((q) => q.id !== deleteConfirmQuiz.id));
      setDeleteConfirmQuiz(null);
      showCenterNotification(" Quiz Record Deleted Successfully!");
    } catch (error) {
      console.error("Error deleting quiz:", error);
    }
  };

  // Open Modal
  const handleOpenDetailModal = (quiz: QuizRecord) => {
    setDetailModalQuiz(quiz);
    setDetailSearch('');
    setDetailGenderFilter('All');
    setDetailPage(1);
  };

  // Modal Students Filter
  const allFilteredModalStudents = useMemo(() => {
    if (!detailModalQuiz) return [];
    return [...detailModalQuiz.studentScores]
      .sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0))
      .filter((st) => {
        const matchesSearch = st.name.toLowerCase().includes(detailSearch.toLowerCase());
        const matchesGender = detailGenderFilter === 'All' || st.gender === detailGenderFilter;
        return matchesSearch && matchesGender;
      });
  }, [detailModalQuiz, detailSearch, detailGenderFilter]);

  // Modal Paginated Students
  const totalModalPages = Math.ceil(allFilteredModalStudents.length / DETAIL_PAGE_SIZE) || 1;
  const paginatedModalStudents = useMemo(() => {
    const start = (detailPage - 1) * DETAIL_PAGE_SIZE;
    return allFilteredModalStudents.slice(start, start + DETAIL_PAGE_SIZE);
  }, [allFilteredModalStudents, detailPage]);

  useEffect(() => {
    setDetailPage(1);
  }, [detailSearch, detailGenderFilter]);

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${isDark ? 'dark' : ''}`}>

      {/* GLOWING NOTIFICATION */}
      {centerNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-md animate-in fade-in zoom-in duration-300 pointer-events-none">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_15px_40px_rgba(249,115,22,0.3)] dark:shadow-[0_0_50px_rgba(249,115,22,0.6)] space-y-3 transform animate-bounce">
            <div className="h-16 w-16 bg-orange-500/10 dark:bg-orange-500/20 text-orange-500 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto border border-orange-500/30 dark:border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
              <Sparkles className="h-8 w-8 animate-pulse text-orange-500 dark:text-yellow-300" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-wide">
              {centerNotification}
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Class: <span className="text-orange-500 dark:text-orange-400">{currentClass?.className}</span>
            </p>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="w-full bg-white/80 dark:bg-[#070b13]/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-orange-500" /> Quiz Portal
              </h1>
              <p className="text-[10px] font-bold text-slate-400">
                Manage Quiz Marks & Monthly Records
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className="flex h-7 w-12 items-center rounded-full bg-slate-200/60 p-0.5 transition-all dark:bg-slate-800 border border-slate-300/30"
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm transition-all ${isDark ? 'translate-x-5 bg-slate-950 text-yellow-400' : ''}`}>
              {isDark ? <Moon className="h-3 w-3 fill-current" /> : <Sun className="h-3 w-3 fill-current" />}
            </div>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4"></div>
            <p className="text-sm font-bold">Fetching Classes & Quizzes...</p>
          </div>
        ) : (
          <>
            {/* CLASS SELECTOR CARD BUTTON */}
            <div 
              onClick={() => setIsClassModalOpen(true)}
              className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/40 hover:border-orange-500 rounded-3xl p-4 shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.25)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 cursor-pointer transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-all">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    SELECT ACTIVE CLASS, MERE JAAN
                  </label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-black text-slate-900 dark:text-white text-base">
                      {currentClass ? `${currentClass.className} (${currentClass.classCode})` : 'Select Class'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-orange-500 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>

              {!isCreatingQuiz && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenNewQuiz();
                  }}
                  className="bg-orange-500 text-white hover:bg-orange-600 px-4 py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all active:scale-95"
                >
                  <Plus className="h-4 w-4" /> New Quiz
                </button>
              )}
            </div>

            {/* MONTH SELECTOR CARD BUTTON */}
            {!isCreatingQuiz && (
              <div 
                onClick={() => setIsMonthModalOpen(true)}
                className="bg-white dark:bg-[#0c1222] border-2 border-orange-500/40 hover:border-orange-500 rounded-3xl p-4 shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.25)] flex items-center justify-between gap-3 cursor-pointer transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      SELECT MONTH RECORD
                    </label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-black text-slate-900 dark:text-white text-base">
                        {selectedMonth}
                      </span>
                      <ChevronDown className="h-4 w-4 text-orange-500 group-hover:translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider block">
                    {selectedMonth === currentMonthKey ? 'CURRENT MONTH' : 'PREVIOUS MONTH'}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {filteredQuizzesByMonth.length} Quizzes Found
                  </span>
                </div>
              </div>
            )}

            {/* MODE 1: CREATE OR EDIT QUIZ FORM */}
            {isCreatingQuiz ? (
              <form onSubmit={handleSaveQuiz} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500 rounded-3xl p-5 shadow-[0_0_30px_rgba(249,115,22,0.25)] space-y-4">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-orange-500" />
                      {editingQuizId ? 'Edit Quiz Record' : 'Create New Quiz Form'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsCreatingQuiz(false)}
                      className="text-xs font-bold text-slate-400 hover:text-orange-500 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* QUIZ TOPIC & TOTAL MARKS (SHOWN ONLY ON PAGE 1 FOR UNIFORM CARD SIZING) */}
                  {formPage === 1 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-300">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-black text-slate-400 block mb-1">
                          Quiz Topic / Chapter Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Chapter 10 A"
                          value={quizTopic}
                          onChange={(e) => setQuizTopic(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 transition-all shadow-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-black text-slate-400 block mb-1">
                          Total Marks *
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={totalMarks}
                          onChange={(e) => setTotalMarks(Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* FILTERS BAR */}
                  <div className="bg-slate-50 dark:bg-[#070b13] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-orange-500">
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-1">
                        {(['All', 'Male', 'Female'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGenderFilter(g)}
                            className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all ${
                              genderFilter === g
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">Show Marks Below:</span>
                        <input
                          type="number"
                          placeholder="e.g. 8"
                          value={belowThreshold}
                          onChange={(e) => setBelowThreshold(e.target.value)}
                          className="w-20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs font-bold outline-none focus:border-orange-500"
                        />
                        {belowThreshold && (
                          <button
                            type="button"
                            onClick={() => setBelowThreshold('')}
                            className="text-[10px] font-black text-rose-500"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* STUDENTS MARKS INPUT LIST (PAGE 1: 7 STUDENTS | PAGE 2+: 9 STUDENTS) */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs font-black text-slate-400">
                      <span>STUDENTS IN SEQUENCE ({filteredStudentsInForm.length})</span>
                      <span>ENTER MARKS OUT OF {totalMarks}</span>
                    </div>

                    {filteredStudentsInForm.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-bold">
                        No students match the current filter.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {paginatedFormStudents.map((st, idx) => (
                          <div
                            key={st.id}
                            className="bg-slate-50/90 dark:bg-[#070b13]/90 border border-slate-200 dark:border-slate-800 hover:border-orange-500/50 p-3 rounded-2xl flex items-center justify-between gap-3 transition-all animate-in fade-in slide-in-from-right-2 duration-300"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-xs border border-orange-500/20 shadow-sm">
                                {st.rollNo}
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                  {st.name}
                                </h4>
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500">
                                  {st.gender}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                ref={(el) => (scoreInputRefs.current[idx] = el)}
                                type="number"
                                min={0}
                                max={totalMarks}
                                placeholder="0"
                                value={st.marksObtained}
                                onChange={(e) => handleScoreChange(st.id, e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, idx)}
                                className={`w-16 text-center font-black text-sm rounded-xl py-1.5 border outline-none transition-all ${
                                  st.marksObtained !== '' && Number(st.marksObtained) < 8
                                    ? 'bg-rose-500/10 border-rose-500 text-rose-500'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-orange-500'
                                }`}
                              />
                              <span className="text-[10px] font-bold text-slate-400">/{totalMarks}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* FORM PAGINATION CONTROLS */}
                    {totalFormPages > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          disabled={formPage === 1}
                          onClick={() => setFormPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center gap-1 disabled:opacity-40 transition-all hover:bg-orange-500 hover:text-white"
                        >
                          <ChevronLeft className="h-4 w-4" /> Previous
                        </button>

                        <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                          Page <span className="text-orange-500">{formPage}</span> of {totalFormPages}
                        </span>

                        <button
                          type="button"
                          disabled={formPage >= totalFormPages}
                          onClick={() => setFormPage((p) => Math.min(totalFormPages, p + 1))}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center gap-1 disabled:opacity-40 transition-all hover:bg-orange-500 hover:text-white"
                        >
                          Next <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SAVE BUTTON */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Saving to Database...' : editingQuizId ? 'Update Quiz Record' : 'Save Quiz Marks'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* MODE 2: SAVED QUIZZES LIST */
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <BarChart2 className="h-4 w-4 text-orange-500" /> Quizzes in {selectedMonth} ({filteredQuizzesByMonth.length})
                  </h3>
                  <span className="text-[11px] font-bold text-orange-500">Class: {currentClass?.className}</span>
                </div>

                {filteredQuizzesByMonth.length === 0 ? (
                  <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-sm">
                    <div className="h-12 w-12 rounded-full bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center animate-pulse">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">No Quizzes Recorded in {selectedMonth}</h4>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        Click "New Quiz" to add marks for this month, mere jaan.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenNewQuiz}
                      className="bg-orange-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-[0_0_15px_rgba(249,115,22,0.3)] inline-flex items-center gap-1.5 hover:bg-orange-600 transition-all"
                    >
                      <Plus className="h-4 w-4" /> Create First Quiz
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredQuizzesByMonth.map((quiz, index) => {
                      const topFourCategoryPerformers = getCategoryPerformers(quiz.studentScores);

                      return (
                        <div
                          key={quiz.id}
                          onClick={() => handleOpenDetailModal(quiz)}
                          style={{ animationDelay: `${index * 50}ms` }}
                          className="relative bg-white dark:bg-[#0c1222] border-2 border-orange-500/40 dark:border-orange-500/50 rounded-3xl p-4 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.3)] hover:border-orange-500 transition-all duration-300 space-y-3 cursor-pointer group animate-in fade-in"
                        >
                          {/* CARD HEADER */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                                <Award className="h-5 w-5" />
                              </div>
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-md">
                                  TOTAL MARKS: {quiz.totalMarks}
                                </span>
                                <h4 className="text-sm font-black mt-1 text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors">
                                  {quiz.topic}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                  Date: {quiz.date} • Avg Score: {quiz.averageScore}/{quiz.totalMarks}
                                </p>
                              </div>
                            </div>

                            {/* EDIT & DELETE BUTTONS */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleOpenEditQuiz(quiz, e)}
                                className="text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 p-1.5 rounded-xl transition-colors"
                                title="Edit Quiz"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => handleRequestDeleteQuiz(quiz, e)}
                                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 p-1.5 rounded-xl transition-colors"
                                title="Delete Quiz"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* 4 CATEGORY PERFORMANCE BREAKDOWN */}
                          <div className="bg-slate-50 dark:bg-[#070b13] p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                              <span>KEY PERFORMERS BREAKDOWN:</span>
                              <span className="text-orange-500 flex items-center gap-1 group-hover:underline font-bold">
                                <Eye className="h-3 w-3" /> View All ({quiz.studentScores.length})
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {topFourCategoryPerformers.map((st) => {
                                let badgeStyle = "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
                                if (st.category === 'Good') badgeStyle = "bg-blue-500/10 text-blue-600 border-blue-500/30";
                                else if (st.category === 'Average') badgeStyle = "bg-amber-500/10 text-amber-600 border-amber-500/30";
                                else if (st.category === 'Poor') badgeStyle = "bg-rose-500/10 text-rose-600 border-rose-500/30";

                                return (
                                  <div
                                    key={st.id}
                                    className={`p-2 rounded-xl border text-center space-y-0.5 ${badgeStyle}`}
                                  >
                                    <span className="text-[8px] font-black uppercase tracking-wider block opacity-80">
                                      {st.category}
                                    </span>
                                    <div className="text-[11px] font-black truncate">{st.name}</div>
                                    <div className="text-xs font-black">{st.marksObtained}/{quiz.totalMarks}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* SELECT CLASS BEAUTIFUL CARD MODAL */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500 rounded-3xl p-5 max-w-md w-full flex flex-col shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500 text-white rounded-2xl shadow-md">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select Class
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400">
                    Choose class to load items ({classes.length} Available)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsClassModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 text-orange-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Filter classes by name or code..."
                value={classSearchText}
                onChange={(e) => setClassSearchText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 transition-all shadow-sm"
              />
            </div>

            {/* List of Class Items */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {filteredClassesModal.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 font-bold">
                  No classes found matching search.
                </div>
              ) : (
                filteredClassesModal.map((cls) => {
                  const isSelected = selectedClassId === cls.id;
                  return (
                    <div
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`p-3.5 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                          : 'border-slate-200 dark:border-slate-800 hover:border-orange-500/50 bg-slate-50 dark:bg-[#070b13]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected ? 'bg-orange-500 text-white' : 'border-2 border-slate-300 dark:border-slate-700'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {cls.className}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            STUDENTS: {cls.students?.length || 0} UNITS • CODE: {cls.classCode}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-black px-3 py-1 rounded-full bg-orange-500/10 text-orange-500">
                        Select
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action OK Button */}
            <button
              onClick={() => setIsClassModalOpen(false)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all active:scale-95"
            >
              <Check className="h-4 w-4" /> OK
            </button>
          </div>
        </div>
      )}

      {/* SELECT MONTH BEAUTIFUL CARD MODAL */}
      {isMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500 rounded-3xl p-5 max-w-md w-full flex flex-col shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500 text-white rounded-2xl shadow-md">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select Month Record
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400">
                    Choose month to filter quiz data ({availableMonths.length} Available)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMonthModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List of Available Months */}
            <div className="space-y-2.5">
              {availableMonths.map((m) => {
                const isSelected = selectedMonth === m;
                return (
                  <div
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-orange-500/50 bg-slate-50 dark:bg-[#070b13]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected ? 'bg-orange-500 text-white' : 'border-2 border-slate-300 dark:border-slate-700'
                      }`}>
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {m}
                        </h4>
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                          {m === currentMonthKey ? 'CURRENT ACTIVE MONTH' : 'PREVIOUS RECORDED MONTH'}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-black px-3 py-1 rounded-full bg-orange-500/10 text-orange-500">
                      Select
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Action OK Button */}
            <button
              onClick={() => setIsMonthModalOpen(false)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all active:scale-95"
            >
              <Check className="h-4 w-4" /> OK
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION PERMISSION MODAL */}
      {deleteConfirmQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-rose-500 rounded-3xl p-6 max-w-sm w-full flex flex-col items-center text-center shadow-[0_0_50px_rgba(244,63,94,0.3)] space-y-4">
            
            <div className="h-16 w-16 bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="h-8 w-8 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Quiz Card?
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <span className="text-orange-500 font-black">"{deleteConfirmQuiz.topic}"</span>, Please Make Sure?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full pt-2">
              <button
                onClick={() => setDeleteConfirmQuiz(null)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black py-2.5 rounded-2xl text-xs hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDeleteQuiz}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-2.5 rounded-2xl text-xs shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all active:scale-95"
              >
                Yes, Delete Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHAPTER DETAILS WITH 5-STUDENT PAGINATION & ANIMATION */}
      {detailModalQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500 rounded-3xl p-5 max-w-lg w-full flex flex-col shadow-[0_0_50px_rgba(249,115,22,0.3)] space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-md">
                  TOTAL MARKS: {detailModalQuiz.totalMarks}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  {detailModalQuiz.topic}
                </h3>
                <p className="text-[10px] font-bold text-slate-400">
                  Date: {detailModalQuiz.date} • Class Average: {detailModalQuiz.averageScore}/{detailModalQuiz.totalMarks}
                </p>
              </div>

              <button
                onClick={() => setDetailModalQuiz(null)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search & Gender Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student by name..."
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-black text-slate-400">
                <div className="flex items-center gap-1">
                  {(['All', 'Male', 'Female'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setDetailGenderFilter(g)}
                      className={`px-3 py-1 rounded-xl text-[10px] font-black transition-all ${
                        detailGenderFilter === g
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <span>TOTAL STUDENTS: {allFilteredModalStudents.length}</span>
              </div>
            </div>

            {/* Modal Paginated Students List (5 per page with animation) */}
            <div className="space-y-2 min-h-[280px]">
              {paginatedModalStudents.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 font-bold">
                  No students found matching search/filter.
                </div>
              ) : (
                paginatedModalStudents.map((st, idx) => (
                  <div
                    key={st.id}
                    className="bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-right-2 duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-xs border border-orange-500/20">
                        {st.rollNo || (detailPage - 1) * DETAIL_PAGE_SIZE + idx + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          {st.name}
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400">
                          Gender: {st.gender}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-orange-500">
                        {st.marksObtained === '' ? 'N/A' : st.marksObtained}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">/{detailModalQuiz.totalMarks}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* MODAL PAGINATION CONTROLS */}
            {totalModalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  disabled={detailPage === 1}
                  onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center gap-1 disabled:opacity-40 transition-all hover:bg-orange-500 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                  Page <span className="text-orange-500">{detailPage}</span> of {totalModalPages}
                </span>

                <button
                  disabled={detailPage >= totalModalPages}
                  onClick={() => setDetailPage((p) => Math.min(totalModalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center gap-1 disabled:opacity-40 transition-all hover:bg-orange-500 hover:text-white"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => setDetailModalQuiz(null)}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black py-2.5 rounded-2xl text-xs hover:bg-orange-500 hover:text-white transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      <BottomNavbar />
    </div>
  );
}
