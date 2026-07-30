import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  Users,
  Wallet,
  Home,
  GraduationCap,
  Settings,
  Upload,
  UserPlus,
  BookOpen,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Edit2,
  Trash2,
  MoreVertical,
  Loader2,
  Tag,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Camera
} from 'lucide-react';

// Firebase Imports
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

// Interfaces
interface Student {
  id: number;
  name: string;
  fatherName: string;
  phone: string;
  rollNo: string;
  avatar: string;
  gender: 'Male' | 'Female';
  feeStatus: 'Paid' | 'Unpaid';
  studentFee?: string;
}

interface ClassItem {
  id: string;
  name: string;
  code: string;
  monthlyFee: string;
  createdAt?: string; // 👈 Date timestamp field type added
  students: Student[];
}

interface CenterToast {
  isOpen: boolean;
  type: 'success' | 'delete';
  title: string;
  message: string;
}

export default function Classes() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('classes');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  
  // Real-time Firestore State
  const [classList, setClassList] = useState<ClassItem[]>([]);

  // Active View State
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  // Modal States
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [deleteConfirmClass, setDeleteConfirmClass] = useState<ClassItem | null>(null);

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);

  // Center Animated Glowing Toast State
  const [toast, setToast] = useState<CenterToast>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  // Form States for Create/Edit Class
  const [classNameInput, setClassNameInput] = useState('');
  const [classCodeInput, setClassCodeInput] = useState('');
  const [monthlyFeeInput, setMonthlyFeeInput] = useState('');

  const [editClassNameInput, setEditClassNameInput] = useState('');
  const [editClassCodeInput, setEditClassCodeInput] = useState('');
  const [editMonthlyFeeInput, setEditMonthlyFeeInput] = useState('');

  // Student Form States
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [whatsapp, setWhatsapp] = useState('+92 ');
  const [rollNo, setRollNo] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [studentFeeInput, setStudentFeeInput] = useState('');
  const [studentAvatar, setStudentAvatar] = useState<string>('');

  // Filter States for Class Detail View
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [feeFilter, setFeeFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Calculate WhatsApp Digits Count
  const rawWhatsappDigits = whatsapp.replace(/\D/g, '').replace(/^92/, '');
  const whatsappDigitCount = rawWhatsappDigits.length;
  const isWhatsappComplete = whatsappDigitCount === 10;
  const remainingWhatsappDigits = 10 - whatsappDigitCount;

  // Phone Number Formatting & Restriction Handler
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, "");

    if (digits.startsWith("0")) digits = digits.substring(1);
    if (digits.startsWith("92")) digits = digits.substring(2);

    digits = digits.slice(0, 10);

    if (!digits) {
      setWhatsapp("+92 ");
    } else if (digits.length <= 3) {
      setWhatsapp(`+92 ${digits}`);
    } else {
      setWhatsapp(`+92 ${digits.slice(0, 3)} ${digits.slice(3)}`);
    }
  };

  // Working Live Image Upload Handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setStudentAvatar(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Back Button & Browser History 404 Prevention
  useEffect(() => {
    const handlePopState = () => {
      if (activeClassId) {
        setActiveClassId(null);
      } else if (isAddStudentOpen || isCreateClassOpen || editingClass || deleteConfirmClass || deleteConfirmStudent) {
        setIsAddStudentOpen(false);
        setIsCreateClassOpen(false);
        setEditingClass(null);
        setDeleteConfirmClass(null);
        setDeleteConfirmStudent(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeClassId, isAddStudentOpen, isCreateClassOpen, editingClass, deleteConfirmClass, deleteConfirmStudent]);

  const handleSelectClass = (classId: string) => {
    window.history.pushState({ classId }, '', '#view-class');
    setActiveClassId(classId);
  };

  const handleBackToClasses = () => {
    if (window.location.hash) {
      window.history.back();
    } else {
      setActiveClassId(null);
    }
  };

  // Trigger Center Notification Popup
  const showCenterNotification = (type: 'success' | 'delete', title: string, message: string) => {
    setToast({ isOpen: true, type, title, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isOpen: false }));
    }, 2200);
  };

  // 1. Listen to Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Realtime Classes from Firestore
  useEffect(() => {
    const userId = currentUser ? currentUser.uid : 'test_user';

    const userClassesRef = collection(db, 'users', userId, 'classes');
    
    const unsubscribe = onSnapshot(userClassesRef, (snapshot) => {
      const fetchedClasses: ClassItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ClassItem, 'id'>)
      }));

      fetchedClasses.sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      setClassList(fetchedClasses);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const currentClass = useMemo(() => {
    return classList.find((c) => c.id === activeClassId) || null;
  }, [classList, activeClassId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [studentSearchQuery, genderFilter, feeFilter, activeClassId]);

  const filteredClasses = useMemo(() => {
    return classList
      .filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [classList, searchQuery]);

  const sortedAndFilteredStudents = useMemo(() => {
    if (!currentClass) return [];

    let list = [...(currentClass.students || [])];

    list.sort((a, b) => {
      const numA = parseInt(a.rollNo, 10) || 0;
      const numB = parseInt(b.rollNo, 10) || 0;
      return numA - numB;
    });

    return list.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(studentSearchQuery.toLowerCase());
      const matchesGender = genderFilter === 'All' || s.gender === genderFilter;
      const matchesFee = feeFilter === 'All' || s.feeStatus === feeFilter;
      return matchesSearch && matchesGender && matchesFee;
    });
  }, [currentClass, studentSearchQuery, genderFilter, feeFilter]);

  const totalPages = Math.ceil(sortedAndFilteredStudents.length / ITEMS_PER_PAGE) || 1;
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAndFilteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAndFilteredStudents, currentPage]);

  // CREATE CLASS FUNCTION WITH createdAt TIMESTAMP
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classNameInput || !classCodeInput) return;

    try {
      const userId = currentUser ? currentUser.uid : 'test_user';
      const userClassesRef = collection(db, 'users', userId, 'classes');
      await addDoc(userClassesRef, {
        name: classNameInput,
        code: classCodeInput.toUpperCase(),
        monthlyFee: monthlyFeeInput || '5000',
        createdAt: new Date().toISOString(), // 👈 YEH LINE ADD KAR DI HAI
        students: []
      });

      setClassNameInput('');
      setClassCodeInput('');
      setMonthlyFeeInput('');
      setIsCreateClassOpen(false);
      showCenterNotification('success', 'Class Created!', 'New academic class added successfully.');
    } catch (error) {
      console.error("Error creating class:", error);
    }
  };

  const handleOpenEditClass = (cls: ClassItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClass(cls);
    setEditClassNameInput(cls.name);
    setEditClassCodeInput(cls.code);
    setEditMonthlyFeeInput(cls.monthlyFee || '5000');
  };

  const handleSaveEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    try {
      const userId = currentUser ? currentUser.uid : 'test_user';
      const classDocRef = doc(db, 'users', userId, 'classes', editingClass.id);
      await updateDoc(classDocRef, {
        name: editClassNameInput,
        code: editClassCodeInput.toUpperCase(),
        monthlyFee: editMonthlyFeeInput || '5000'
      });

      setEditingClass(null);
      showCenterNotification('success', 'Class Updated!', `${editClassNameInput} details updated.`);
    } catch (error) {
      console.error("Error updating class:", error);
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!deleteConfirmClass) return;

    try {
      const userId = currentUser ? currentUser.uid : 'test_user';
      const classDocRef = doc(db, 'users', userId, 'classes', deleteConfirmClass.id);
      await deleteDoc(classDocRef);
      
      const deletedClassName = deleteConfirmClass.name;
      setDeleteConfirmClass(null);
      showCenterNotification('delete', 'Class Deleted', `${deletedClassName} removed from records.`);
    } catch (error) {
      console.error("Error deleting class:", error);
    }
  };

  const handleOpenAddStudent = (classId?: string) => {
    let targetClass = currentClass;
    if (classId) {
      handleSelectClass(classId);
      targetClass = classList.find((c) => c.id === classId) || null;
    }

    setEditingStudent(null);
    setFullName('');
    setFatherName('');
    setWhatsapp('+92 ');
    setGender('Male');
    setStudentAvatar('');
    setStudentFeeInput(targetClass?.monthlyFee || '5000');

    const existingRolls = (targetClass?.students || [])
      .map((s) => parseInt(s.rollNo, 10))
      .filter((num) => !isNaN(num));

    if (existingRolls.length > 0) {
      const maxRoll = Math.max(...existingRolls);
      setRollNo(String(maxRoll + 1));
    } else {
      setRollNo('1');
    }

    setIsAddStudentOpen(true);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setFullName(student.name);
    setFatherName(student.fatherName);
    setWhatsapp(student.phone || '+92 ');
    setRollNo(student.rollNo);
    setGender(student.gender || 'Male');
    setStudentAvatar(student.avatar || '');
    setStudentFeeInput(student.studentFee || currentClass?.monthlyFee || '5000');
    setIsAddStudentOpen(true);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deleteConfirmStudent || !activeClassId || !currentClass) return;

    try {
      const userId = currentUser ? currentUser.uid : 'test_user';
      const classDocRef = doc(db, 'users', userId, 'classes', activeClassId);
      const updatedStudents = (currentClass.students || []).filter((s) => s.id !== deleteConfirmStudent.id);
      await updateDoc(classDocRef, { students: updatedStudents });
      
      const deletedName = deleteConfirmStudent.name;
      setDeleteConfirmStudent(null);
      showCenterNotification('delete', 'Student Removed', `${deletedName} deleted successfully.`);
    } catch (error) {
      console.error("Error deleting student:", error);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassId || !fullName || !rollNo || !currentClass) return;

    try {
      const userId = currentUser ? currentUser.uid : 'test_user';
      const classDocRef = doc(db, 'users', userId, 'classes', activeClassId);
      let updatedStudents = [...(currentClass.students || [])];

      const finalFee = studentFeeInput || currentClass.monthlyFee || '5000';
      const defaultAvatar = gender === 'Female' 
        ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';

      const isEditMode = !!editingStudent;

      if (editingStudent) {
        updatedStudents = updatedStudents.map((s) =>
          s.id === editingStudent.id
            ? { 
                ...s, 
                name: fullName, 
                fatherName, 
                phone: whatsapp, 
                rollNo, 
                gender, 
                studentFee: finalFee,
                avatar: studentAvatar || s.avatar || defaultAvatar
              }
            : s
        );
      } else {
        const newStudentObj: Student = {
          id: Date.now(),
          name: fullName,
          fatherName: fatherName || 'N/A',
          phone: whatsapp,
          rollNo: rollNo,
          gender: gender,
          avatar: studentAvatar || defaultAvatar,
          feeStatus: 'Unpaid',
          studentFee: finalFee
        };
        updatedStudents.unshift(newStudentObj);
      }

      await updateDoc(classDocRef, { students: updatedStudents });

      setIsAddStudentOpen(false);
      setEditingStudent(null);

      showCenterNotification(
        'success',
        isEditMode ? 'Student Updated!' : 'Student Saved!',
        isEditMode ? `${fullName}'s details updated.` : `${fullName} registered successfully.`
      );
    } catch (error) {
      console.error("Error saving student:", error);
    }
  };

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'classes', label: 'Classes', icon: GraduationCap, href: '/departments' },
    { id: 'attendance', label: 'Attendance', icon: Users, href: '/attendance' },
    { id: 'fees', label: 'Fees', icon: Wallet, href: '/fees' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#070b13]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${isDark ? 'dark' : ''}`}>

      {/* TOP NAVBAR */}
      <div className="w-full bg-white/60 dark:bg-[#070b13]/60 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/80 sticky top-0 z-40 shadow-sm transition-all">
        <div className="mx-auto max-w-7xl flex h-14 items-center justify-between px-3 sm:px-6 lg:px-8 gap-2">
          
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={() => {
                if (activeClassId) {
                  handleBackToClasses();
                } else {
                  navigate('/');
                }
              }}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-orange-500/10 hover:bg-orange-500 text-orange-600 dark:text-orange-400 hover:text-white transition-all shadow-[0_0_12px_rgba(249,115,22,0.25)] hover:shadow-[0_0_20px_rgba(249,115,22,0.5)] active:scale-95 shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="relative w-full max-w-[200px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={activeClassId ? "Search in class..." : "Search classes..."}
                value={activeClassId ? studentSearchQuery : searchQuery}
                onChange={(e) => activeClassId ? setStudentSearchQuery(e.target.value) : setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#0c1222]/80 py-1.5 pl-9 pr-3 text-xs font-bold outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:focus:ring-orange-500/30 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-7 w-12 items-center rounded-full bg-slate-200/80 p-0.5 transition-all dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/50 hover:shadow-[0_0_12px_rgba(249,115,22,0.2)]"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-md transition-all ${isDark ? 'translate-x-5 bg-slate-950 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : ''}`}>
                {isDark ? <Moon className="h-3 w-3 fill-current" /> : <Sun className="h-3 w-3 fill-current" />}
              </div>
            </button>

            <Link
              to="/alerts"
              className="relative rounded-xl p-2 text-slate-500 hover:bg-orange-500/10 dark:text-slate-400 dark:hover:bg-[#0c1222] transition-all hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] active:scale-95 flex items-center justify-center"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#070b13] animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                3
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN VIEW SYSTEM */}
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

        {/* VIEW 1: MAIN CLASSES DIRECTORY */}
        {!activeClassId && (
          <>
            {/* HERO CARD */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-white via-orange-50/40 to-amber-50/20 dark:from-[#0c1222] dark:via-[#0c1222]/90 dark:to-[#070b13] p-6 sm:p-8 border-2 border-orange-500/40 dark:border-orange-500/50 shadow-[0_0_35px_rgba(249,115,22,0.25)] hover:shadow-[0_0_55px_rgba(249,115,22,0.45)] transition-all duration-500 group">
              
              <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-orange-500/25 blur-3xl animate-pulse pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-amber-500/20 blur-3xl animate-pulse pointer-events-none delay-700" />
              
              <div className="relative z-10 space-y-5">
                
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] backdrop-blur-md">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider">LIVE ENGINE ACTIVE</span>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold text-xs shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                    <span>Total {classList.length} Active Classes Fetched</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white drop-shadow-sm flex items-center gap-3">
                    EduTrack
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                      Academic Core
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                    Intelligent Management & Analytics System for Colleges and Universities.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={() => setIsCreateClassOpen(true)}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-xs px-5 py-3 shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Create New Class
                  </Button>
                </div>

              </div>
            </div>

            {/* CLASS CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-white/90 dark:bg-[#0c1222]/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm hover:shadow-[0_0_25px_rgba(249,115,22,0.22)] dark:hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] dark:hover:border-orange-500/40 transition-all duration-300 hover:-translate-y-1 space-y-4 group relative backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => handleSelectClass(cls.id)}
                      className="cursor-pointer flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="h-11 w-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black shrink-0 border border-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.15)] group-hover:scale-105 transition-transform">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-500 transition-colors truncate">
                          {cls.name}
                        </h3>
                        <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md inline-block mt-1 border border-slate-200 dark:border-slate-800">
                          Code: {cls.code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleOpenEditClass(cls, e)}
                        className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                        title="Edit Class"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmClass(cls);
                        }}
                        className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-[0_0_12px_rgba(244,63,94,0.4)] transition-all active:scale-95"
                        title="Delete Class"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="bg-slate-50 dark:bg-[#070b13] p-2.5 rounded-2xl text-center border border-slate-100 dark:border-slate-800/40">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Enrolled</span>
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 mt-0.5">
                        <Users className="h-3.5 w-3.5 text-orange-500" /> {(cls.students || []).length}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#070b13] p-2.5 rounded-2xl text-center border border-slate-100 dark:border-slate-800/40">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Monthly Fee</span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1 block drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                        PKR {Number(cls.monthlyFee || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenAddStudent(cls.id)}
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border border-orange-500/20 hover:shadow-[0_0_15px_rgba(249,115,22,0.25)] active:scale-95"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Add Student
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VIEW 2: CLASS DETAIL PAGE */}
        {activeClassId && currentClass && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200 max-w-4xl mx-auto">

            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToClasses}
                className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-black text-lg hover:text-orange-500 transition-colors group"
              >
                <div className="p-1 rounded-xl group-hover:bg-orange-500/10 group-hover:text-orange-500">
                  <ChevronLeft className="h-6 w-6" />
                </div>
                <span>{currentClass.name}</span>
              </button>

              <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>

            {/* SEARCH + ADD BUTTON */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student or roll..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0c1222] py-2.5 pl-9 pr-3 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <Button
                onClick={() => handleOpenAddStudent()}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs px-4 py-2.5 shadow-[0_0_15px_rgba(249,115,22,0.35)] shrink-0 active:scale-95 transition-all"
              >
                Add Student
              </Button>
            </div>

            {/* FILTER CARD */}
            <div className="bg-gradient-to-br from-white via-slate-50 to-orange-50/20 dark:from-[#0c1222] dark:via-[#0c1222] dark:to-orange-950/20 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-3 shadow-md space-y-2 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100">
                <SlidersHorizontal className="h-3.5 w-3.5 text-orange-500" />
                <span>Filters</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] font-black uppercase text-slate-400 px-1.5 hidden sm:inline">
                    Gender:
                  </span>
                  <div className="flex-1 grid grid-cols-3 gap-0.5">
                    {(['All', 'Male', 'Female'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGenderFilter(g)}
                        className={`py-1 rounded-lg font-black text-[10px] transition-all ${
                          genderFilter === g
                            ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {g === 'All' ? 'All' : g === 'Male' ? 'M' : 'F'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] font-black uppercase text-slate-400 px-1.5 hidden sm:inline">
                    Fee:
                  </span>
                  <div className="flex-1 grid grid-cols-3 gap-0.5">
                    {(['All', 'Paid', 'Unpaid'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFeeFilter(f)}
                        className={`py-1 rounded-lg font-black text-[10px] transition-all ${
                          feeFilter === f
                            ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SINGLE SCREEN TABLE */}
            <div className="bg-white dark:bg-[#0c1222] border border-slate-200/70 dark:border-slate-800/60 rounded-3xl p-3 shadow-sm space-y-2">
              
              {/* TABLE HEADER */}
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60 w-full">
                <div className="flex-1 min-w-0 pr-1">Student Name & Info</div>
                <div className="w-8 shrink-0 text-center">Roll</div>
                <div className="shrink-0 px-1 text-center min-w-[50px]">Fee</div>
                <div className="shrink-0 text-right pl-1 min-w-[55px]">Actions</div>
              </div>

              {/* TABLE BODY */}
              {paginatedStudents.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-slate-400">
                  No students found.
                </div>
              ) : (
                paginatedStudents.map((student) => {
                  const defaultClassFee = Number(currentClass.monthlyFee || 0);
                  const effectiveStudentFee = Number(student.studentFee || currentClass.monthlyFee || 0);
                  const isDeserving = effectiveStudentFee < defaultClassFee;

                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between gap-1 px-2 py-2.5 rounded-2xl hover:bg-orange-500/5 dark:hover:bg-slate-900/60 transition-colors border-b border-slate-100 dark:border-slate-800/40 last:border-0 w-full group"
                    >
                      {/* COLUMN 1: STUDENT NAME & INFO */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate max-w-[90px] sm:max-w-none group-hover:text-orange-500 transition-colors">
                              {student.name}
                            </p>
                            {isDeserving && (
                              <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30 text-[8px] font-black px-1.5 py-0.2 rounded-full shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                                <Tag className="h-2 w-2" /> Deserving
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">
                            {student.phone} • {student.gender || 'Male'} • PKR {effectiveStudentFee.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* COLUMN 2: ROLL NUMBER */}
                      <div className="w-8 shrink-0 text-center text-xs font-black text-slate-800 dark:text-slate-200">
                        {student.rollNo}
                      </div>

                      {/* COLUMN 3: FEE STATUS BADGE */}
                      <div className="shrink-0 px-1 text-center min-w-[50px]">
                        <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight ${
                          student.feeStatus === 'Paid'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                            : 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                        }`}>
                          {student.feeStatus}
                        </span>
                      </div>

                      {/* COLUMN 4: ACTION BUTTONS */}
                      <div className="shrink-0 flex items-center justify-end gap-1 pl-1 min-w-[55px]">
                        <button
                          onClick={() => handleOpenEditStudent(student)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                          title="Edit Student"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmStudent(student)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-[0_0_10px_rgba(244,63,94,0.4)] transition-all active:scale-95"
                          title="Delete Student"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* PAGINATION CONTROLS */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/60 px-1">
                  <span className="text-[10px] font-black text-slate-400">
                    Pg {currentPage}/{totalPages} ({sortedAndFilteredStudents.length})
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="flex items-center gap-0.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black disabled:opacity-40 hover:bg-orange-500 hover:text-white transition-all hover:shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                    >
                      <ChevronLeft className="h-3 w-3" /> Prev
                    </button>

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className="flex items-center gap-0.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black disabled:opacity-40 hover:bg-orange-500 hover:text-white transition-all hover:shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                    >
                      Next <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

      </main>

      {/* CENTER ANIMATED GLOWING NOTIFICATION TOAST */}
      {toast.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in zoom-in-90 duration-200">
          <div className={`bg-white dark:bg-[#0c1222] border rounded-3xl p-6 max-w-xs w-full text-center space-y-3 relative shadow-2xl transition-all duration-300 ${
            toast.type === 'success' 
              ? 'border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.4)]' 
              : 'border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.4)]'
          }`}>
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center animate-bounce ${
              toast.type === 'success' 
                ? 'bg-emerald-500/20 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                : 'bg-rose-500/20 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <Trash2 className="h-8 w-8" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {toast.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-snug">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CLASS CONFIRMATION MODAL */}
      {deleteConfirmClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-rose-500/40 rounded-3xl max-w-sm w-full p-6 shadow-[0_0_50px_rgba(244,63,94,0.3)] relative text-center space-y-4">
            
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Class?
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Are you sure you want to delete <span className="text-rose-500 font-extrabold">{deleteConfirmClass.name}</span>? All enrolled student records for this class will also be removed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                onClick={() => setDeleteConfirmClass(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs py-3 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeleteClass}
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs py-3 shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all active:scale-95"
              >
                Yes, Delete Class
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* DELETE STUDENT CONFIRMATION MODAL */}
      {deleteConfirmStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-rose-500/40 rounded-3xl max-w-sm w-full p-6 shadow-[0_0_50px_rgba(244,63,94,0.3)] relative text-center space-y-4">
            
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Confirm Deletion?
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Are you sure you want to remove <span className="text-rose-500 font-extrabold">{deleteConfirmStudent.name}</span>?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                onClick={() => setDeleteConfirmStudent(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs py-3 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeleteStudent}
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs py-3 shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all active:scale-95"
              >
                Yes, Delete
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: CREATE NEW CLASS */}
      {isCreateClassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] dark:shadow-[0_0_50px_rgba(249,115,22,0.15)] relative">
            <button
              onClick={() => setIsCreateClassOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Create New Class</h3>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Class Name</label>
                <input
                  type="text"
                  placeholder="e.g. Class 10 A"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Class Code</label>
                <input
                  type="text"
                  placeholder="e.g. 10A"
                  value={classCodeInput}
                  onChange={(e) => setClassCodeInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Monthly Fee (PKR)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={monthlyFeeInput}
                  onChange={(e) => setMonthlyFeeInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-black text-xs mt-2 shadow-[0_0_20px_rgba(249,115,22,0.35)] transition-all active:scale-95">
                Create Class
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT CLASS */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] dark:shadow-[0_0_50px_rgba(249,115,22,0.15)] relative">
            <button
              onClick={() => setEditingClass(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-orange-500" /> Edit Class Details
            </h3>

            <form onSubmit={handleSaveEditClass} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Class Name</label>
                <input
                  type="text"
                  placeholder="e.g. Class 10 A"
                  value={editClassNameInput}
                  onChange={(e) => setEditClassNameInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Class Code</label>
                <input
                  type="text"
                  placeholder="e.g. 10A"
                  value={editClassCodeInput}
                  onChange={(e) => setEditClassCodeInput(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-1">Monthly Fee (PKR)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={editMonthlyFeeInput}
                  onChange={(e) => setEditMonthlyFeeInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-black text-xs mt-2 shadow-[0_0_20px_rgba(249,115,22,0.35)] transition-all active:scale-95">
                Update Class Details
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD / EDIT STUDENT */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] dark:shadow-[0_0_50px_rgba(249,115,22,0.15)] relative space-y-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsAddStudentOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xs font-extrabold text-orange-500 uppercase tracking-wider">
                {editingStudent ? 'Edit Student' : 'Add Student'}
              </span>
            </div>

            {/* HIDDEN FILE INPUT FOR PHOTO UPLOAD */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoSelect} 
              accept="image/*" 
              className="hidden" 
            />

            {/* LIVE PHOTO PREVIEW & UPLOAD TRIGGER */}
            <div className="flex justify-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full border-2 border-dashed border-orange-400 bg-orange-50/30 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center cursor-pointer shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:scale-105 transition-all overflow-hidden group"
              >
                {studentAvatar ? (
                  <>
                    <img src={studentAvatar} alt="Live Avatar" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-orange-500 mb-0.5" />
                    <span className="text-[9px] font-black text-orange-600 dark:text-orange-400">Upload Photo</span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] px-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Father's Name</label>
                <input
                  type="text"
                  placeholder="Enter father's name"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] px-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('Male')}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                      gender === 'Male'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] text-slate-400'
                    }`}
                  >
                    👦 Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('Female')}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                      gender === 'Female'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b13] text-slate-400'
                    }`}
                  >
                    👧 Female
                  </button>
                </div>
              </div>

              {/* WHATSAPP NUMBER VALIDATION INPUT WITH RED -> GREEN EFFECT */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase">
                    CONTACT WHATSAPP
                  </label>
                  <span className={`text-[10px] font-black transition-colors ${
                    isWhatsappComplete 
                      ? 'text-emerald-500' 
                      : whatsappDigitCount > 0 
                      ? 'text-rose-500' 
                      : 'text-slate-400'
                  }`}>
                    {whatsappDigitCount}/10 Digits
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={whatsapp}
                    onChange={handlePhoneChange}
                    required
                    className={`w-full rounded-2xl px-4 py-2.5 text-xs font-bold outline-none transition-all pr-10 text-slate-900 dark:text-white ${
                      isWhatsappComplete
                        ? 'border-2 border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10 focus:ring-2 focus:ring-emerald-500/30'
                        : whatsappDigitCount > 0
                        ? 'border-2 border-rose-500 bg-rose-50/10 dark:bg-rose-950/10 focus:ring-2 focus:ring-rose-500/30'
                        : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] focus:border-orange-500'
                    }`}
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isWhatsappComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-in zoom-in-75 duration-200" />
                    ) : whatsappDigitCount > 0 ? (
                      <AlertCircle className="h-5 w-5 text-rose-500 animate-in zoom-in-75 duration-200" />
                    ) : null}
                  </div>
                </div>

                {/* WARNING / SUCCESS SUB-TEXT */}
                {!isWhatsappComplete && whatsappDigitCount > 0 && (
                  <p className="text-[10px] font-extrabold text-rose-500 mt-1.5 flex items-center gap-1 animate-in fade-in duration-200">
                    Please enter remaining {remainingWhatsappDigits} digits after +92.
                  </p>
                )}

                {isWhatsappComplete && (
                  <p className="text-[10px] font-extrabold text-emerald-500 mt-1.5 flex items-center gap-1 animate-in fade-in duration-200">
                    ✓ WhatsApp number verified successfully!
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Roll Number</label>
                <input
                  type="text"
                  placeholder="Enter roll number"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] px-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Monthly Fee (PKR)</label>
                  <span className="text-[10px] text-orange-500 font-bold">Default: PKR {currentClass?.monthlyFee || '5000'}</span>
                </div>
                <input
                  type="number"
                  placeholder="Enter monthly fee"
                  value={studentFeeInput}
                  onChange={(e) => setStudentFeeInput(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b13] px-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={!isWhatsappComplete}
                  className={`w-full py-5 rounded-2xl font-black text-xs transition-all active:scale-95 ${
                    isWhatsappComplete
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.35)]'
                      : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-70'
                  }`}
                >
                  {editingStudent ? 'Update Student' : 'Save Student'}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* FLOATING PREMIUM BOTTOM NAVBAR (Exact Match to Design) */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] px-6 py-3 flex items-center gap-6 sm:gap-10">
          {navigationTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                to={tab.href}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'classes') {
                    handleBackToClasses();
                  }
                }}
                className="flex flex-col items-center justify-center relative group outline-none"
              >
                {/* ICON CONTAINER */}
                <div
                  className={`flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'h-12 w-12 rounded-full bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.6)] scale-110 -translate-y-1'
                      : 'h-10 w-10 text-slate-400 group-hover:text-orange-500/80'
                  }`}
                >
                  <IconComponent className={isActive ? 'h-6 w-6' : 'h-5 w-5'} />
                </div>

                {/* LABEL */}
                <span
                  className={`text-[10px] font-bold mt-1 transition-colors ${
                    isActive ? 'text-orange-500 font-black' : 'text-slate-400'
                  }`}
                >
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
