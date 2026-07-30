import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Users,
  Wallet,
  Home,
  GraduationCap,
  Settings,
  Save,
  DollarSign,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Calculator,
  PlusCircle,
  Layers
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

// ----------------------------------------------------------------------
// FIREBASE INITIALIZATION & EXACT DATABASE PATH
// ----------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAmHi20OGNTeUXjuXO_weF8XKEa3KP7oYE",
  authDomain: "tuition-management-b9e2f.firebaseapp.com",
  projectId: "tuition-management-b9e2f",
  storageBucket: "tuition-management-b9e2f.firebasestorage.app",
  messagingSenderId: "634395063857",
  appId: "1:634395063857:web:24d5e9c303845557f1c710",
  measurementId: "G-5SS0BVJWTK"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// EXACT USER ID MATCHING FIRESTORE SCREENSHOTS
const USER_ID = "X1Q76ib1XXPWcPp3FSQPLLaTzL83";

interface StudentFeeRecord {
  status: 'PAID' | 'UNPAID' | 'PARTIAL';
  paidAmount: number;
  remainingDues: number;
  previousMonthDues: number;
}

// Safely extracts YYYY-MM from student joining/admission date
const getStudentAdmissionMonth = (student: any): string | null => {
  const rawDate = student.joiningDate || student.admissionDate || student.createdAt || student.date;
  if (!rawDate) return null;
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  } catch {
    return null;
  }
};

// ----------------------------------------------------------------------
// Class Creation Date strict priority
// ----------------------------------------------------------------------
const getClassCreationMonth = (cls: any): string | null => {
  if (!cls) return null;
  const rawDate = cls.createdAt || cls.createdDate || cls.date || cls.createdMonth;
  
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      }
    } catch {}
  }

  // Fallback ONLY if Class createdAt is missing: Check student dates
  const students = cls.students || [];
  let earliestStudentMonth: string | null = null;
  students.forEach((st: any) => {
    const admMonth = getStudentAdmissionMonth(st);
    if (admMonth) {
      if (!earliestStudentMonth || admMonth < earliestStudentMonth) {
        earliestStudentMonth = admMonth;
      }
    }
  });

  return earliestStudentMonth || null;
};

// Formats raw date string into nice readable format (e.g. 15 Jul 2026)
const formatDisplayDate = (rawDate: string): string => {
  if (!rawDate) return 'N/A';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate;
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return rawDate;
  }
};

// ----------------------------------------------------------------------
// AUTOMATIC MONTH SYSTEM (Always Current Month & Previous Month)
// Automatically updates when date hits 1st of any new month
// ----------------------------------------------------------------------
const getDynamicTwoMonths = () => {
  const now = new Date();
  
  // Current Month (1st Date of current month)
  const currDate = new Date(now.getFullYear(), now.getMonth(), 1);
  // Previous Month
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const formatMonth = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { label, value: `${y}-${m}` };
  };

  return [formatMonth(currDate), formatMonth(prevDate)];
};

// Utility Function: Month Offset Calculator
const getMonthOffset = (monthStr: string, offset: number) => {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// HELPER TO SAFELY EXTRACT STUDENTS IN NUMERICAL SEQUENCE FROM CLASS DATA
const extractStudentsFromClass = (classData: any): any[] => {
  if (!classData) return [];
  
  if (Array.isArray(classData.students)) {
    return classData.students;
  }
  
  if (classData.students && typeof classData.students === 'object') {
    const keys = Object.keys(classData.students).sort((a, b) => Number(a) - Number(b));
    return keys.map(k => classData.students[k]);
  }
  
  const numericKeys = Object.keys(classData)
    .filter(k => !isNaN(Number(k)))
    .sort((a, b) => Number(a) - Number(b));

  if (numericKeys.length > 0) {
    return numericKeys.map(k => ({ ...classData[k], _seqKey: Number(k) }));
  }

  return [];
};

// HELPER: Calculates prorated daily fee for student's first month
const calculateProratedFee = (student: any, monthlyFee: number) => {
  const rawDate = student?.joiningDate || student?.admissionDate || student?.createdAt || student?.date;
  if (!rawDate) return null;
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return null;

    const totalDaysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dayOfJoining = d.getDate();
    const daysStudied = Math.max(1, totalDaysInMonth - dayOfJoining + 1);
    
    const dailyRate = Math.round(monthlyFee / totalDaysInMonth);
    const proratedFee = Math.round(daysStudied * (monthlyFee / totalDaysInMonth));

    return {
      joiningDay: dayOfJoining,
      totalDaysInMonth,
      daysStudied,
      dailyRate,
      proratedFee,
      joiningDateFormatted: formatDisplayDate(rawDate)
    };
  } catch {
    return null;
  }
};

export default function Fees() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);

  // Data States
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [feeMap, setFeeMap] = useState<Record<string, StudentFeeRecord>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Filters & Pagination States
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'PARTIAL'>('ALL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modal State
  const [activeModalStudent, setActiveModalStudent] = useState<any | null>(null);
  const [modalPaidInput, setModalPaidInput] = useState<string>('');
  const [modalPrevDuesInput, setModalPrevDuesInput] = useState<string>('0');

  // ----------------------------------------------------------------------
  // 1. FETCH CLASSES FROM FIREBASE WITH SEQUENTIAL SORTING
  // ----------------------------------------------------------------------
  useEffect(() => {
    setIsLoading(true);
    const classesRef = collection(db, 'users', USER_ID, 'classes');
    
    const unsubscribe = onSnapshot(classesRef, (snapshot) => {
      const fetchedClasses = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          students: extractStudentsFromClass(data)
        };
      });

      // Sequential Alphabetical/Numerical Sorting for Classes
      fetchedClasses.sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      );

      setClasses(fetchedClasses);

      if (fetchedClasses.length > 0) {
        if (!selectedClassId || !fetchedClasses.some(c => c.id === selectedClassId)) {
          setSelectedClassId(fetchedClasses[0].id);
        }
      } else {
        setSelectedClassId('');
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching classes:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || { students: [], monthlyFee: 0 };
  }, [selectedClassId, classes]);

  // ----------------------------------------------------------------------
  // DYNAMIC 2-MONTH DROPDOWN LOGIC BOUNDED STRICTLY BY CLASS CREATION DATE
  // ----------------------------------------------------------------------
  const monthOptions = useMemo(() => {
    const baseMonths = getDynamicTwoMonths(); // [CurrentMonth (Index 0), PrevMonth (Index 1)]
    const creationMonth = getClassCreationMonth(currentClass);

    if (creationMonth) {
      const filtered = baseMonths.filter(m => m.value >= creationMonth);
      return filtered.length > 0 ? filtered : [baseMonths[0]];
    }

    return baseMonths;
  }, [currentClass]);

  // Default to current Month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthOptions[0]?.value || getDynamicTwoMonths()[0].value);

  // AUTO-SYNC / AUTO-SWITCH MONTH ON 1ST DATE OF EVERY MONTH
  useEffect(() => {
    if (monthOptions.length > 0) {
      const isValidOption = monthOptions.some(m => m.value === selectedMonth);
      const isLatestMonthSelected = selectedMonth === monthOptions[0].value;

      // If selectedMonth is no longer valid or month rolled over to 1st of month, switch to current month
      if (!isValidOption || (!isLatestMonthSelected && !monthOptions.some(m => m.value === selectedMonth))) {
        setSelectedMonth(monthOptions[0].value);
      }
    }
  }, [monthOptions, selectedMonth]);

  // SYNC FEE STATUS DIRECTLY TO FIRESTORE 'classes' DOCUMENT
  const syncFeeStatusToClassesDoc = async (classId: string, currentFeeMap: Record<string, StudentFeeRecord>) => {
    if (!classId) return;
    try {
      const classRef = doc(db, 'users', USER_ID, 'classes', classId);
      const classSnap = await getDoc(classRef);
      if (classSnap.exists()) {
        const classData = classSnap.data();
        const numericKeys = Object.keys(classData).filter(k => !isNaN(Number(k)));
        
        if (numericKeys.length > 0) {
          const updatedData: any = { ...classData };
          numericKeys.forEach(key => {
            const st = classData[key];
            const record = currentFeeMap[st.id];
            let formattedStatus = 'Unpaid';
            if (record?.status === 'PAID') formattedStatus = 'Paid';
            else if (record?.status === 'PARTIAL') formattedStatus = 'Partial';

            updatedData[key] = {
              ...st,
              feeStatus: formattedStatus
            };
          });
          await setDoc(classRef, updatedData, { merge: true });
        } else if (Array.isArray(classData.students)) {
          const updatedStudents = classData.students.map((st: any) => {
            const record = currentFeeMap[st.id];
            let formattedStatus = 'Unpaid';
            if (record?.status === 'PAID') formattedStatus = 'Paid';
            else if (record?.status === 'PARTIAL') formattedStatus = 'Partial';

            return {
              ...st,
              feeStatus: formattedStatus
            };
          });
          await setDoc(classRef, { students: updatedStudents }, { merge: true });
        }
      }
    } catch (err) {
      console.error("Error syncing student feeStatus into classes collection:", err);
    }
  };

  // ADMISSION MONTH FILTERING
  const eligibleStudentsForMonth = useMemo(() => {
    const rawStudents = currentClass.students || [];
    return rawStudents.filter((student: any) => {
      const admissionMonth = getStudentAdmissionMonth(student);
      if (admissionMonth && selectedMonth < admissionMonth) {
        return false;
      }
      return true;
    });
  }, [currentClass.students, selectedMonth]);

  const docKey = `${selectedClassId}_${selectedMonth}`;
  const monthlyFee = Number(currentClass.monthlyFee || 0);

  // ----------------------------------------------------------------------
  // 2. REALTIME DUAL FEE LISTENER
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!selectedClassId) {
      setFeeMap({});
      return;
    }
    setIsLoading(true);

    const currentFeeRef = doc(db, 'users', USER_ID, 'fees', docKey);
    const prevMonthStr = getMonthOffset(selectedMonth, -1);
    const prevFeeRef = doc(db, 'users', USER_ID, 'fees', `${selectedClassId}_${prevMonthStr}`);

    let isMounted = true;
    let prevDataMap: Record<string, any> = {};
    let currentDataMap: Record<string, any> = {};

    const recalculateFeeMap = () => {
      if (!isMounted) return;
      const isOldestMonth = selectedMonth === monthOptions[monthOptions.length - 1]?.value;
      const activeMap: Record<string, StudentFeeRecord> = {};

      eligibleStudentsForMonth.forEach((s: any) => {
        let carryOverDues = 0;

        const admissionMonth = getStudentAdmissionMonth(s);
        const wasAdmittedBeforeThisMonth = !admissionMonth || prevMonthStr >= admissionMonth;

        if (!isOldestMonth && wasAdmittedBeforeThisMonth) {
          const prevRecord = prevDataMap[s.id];
          if (prevRecord !== undefined) {
            carryOverDues = Number(prevRecord.remainingDues || 0);
          }
        }

        const existingCurrent = currentDataMap[s.id];
        const paidAmt = existingCurrent ? Number(existingCurrent.paidAmount || 0) : 0;
        const totalPayable = monthlyFee + carryOverDues;
        const remaining = Math.max(0, totalPayable - paidAmt);

        let calculatedStatus: 'PAID' | 'UNPAID' | 'PARTIAL' = 'UNPAID';
        if (paidAmt >= totalPayable && totalPayable > 0) {
          calculatedStatus = 'PAID';
        } else if (paidAmt > 0) {
          calculatedStatus = 'PARTIAL';
        }

        activeMap[s.id] = {
          status: calculatedStatus,
          paidAmount: paidAmt,
          remainingDues: remaining,
          previousMonthDues: carryOverDues
        };
      });

      setFeeMap(activeMap);
      setIsLoading(false);
    };

    const unsubPrev = onSnapshot(prevFeeRef, (snap) => {
      prevDataMap = snap.exists() ? (snap.data()?.feeRecords || {}) : {};
      recalculateFeeMap();
    });

    const unsubCurrent = onSnapshot(currentFeeRef, (snap) => {
      currentDataMap = snap.exists() ? (snap.data()?.feeRecords || {}) : {};
      recalculateFeeMap();
    });

    // Clean old fee docs older than allowed window
    const oldestAllowedMonth = monthOptions[monthOptions.length - 1]?.value || selectedMonth;
    const feesCollection = collection(db, 'users', USER_ID, 'fees');
    const q = query(feesCollection, where('classId', '==', selectedClassId));
    getDocs(q).then((allFeeDocs) => {
      allFeeDocs.forEach((feeDoc) => {
        const docData = feeDoc.data();
        if (docData.month && docData.month < oldestAllowedMonth) {
          deleteDoc(doc(db, 'users', USER_ID, 'fees', feeDoc.id));
        }
      });
    }).catch(err => console.error("Purge error:", err));

    return () => {
      isMounted = false;
      unsubPrev();
      unsubCurrent();
    };
  }, [selectedClassId, selectedMonth, eligibleStudentsForMonth, monthlyFee, monthOptions]);

  // RESET TO PAGE 1 ON FILTER CHANGE
  useEffect(() => setCurrentPage(1), [statusFilter, genderFilter, selectedClassId, selectedMonth]);

  // ----------------------------------------------------------------------
  // 3. STRICT SEQUENTIAL SORTING (1, 2, 3...)
  // ----------------------------------------------------------------------
  const sortedStudentsList = useMemo(() => {
    const list = [...eligibleStudentsForMonth];
    return list.sort((a: any, b: any) => {
      const seqA = a.rollNo ?? a.roll_no ?? a.seq ?? a._seqKey ?? a.id;
      const seqB = b.rollNo ?? b.roll_no ?? b.seq ?? b._seqKey ?? b.id;

      const numA = parseFloat(String(seqA).replace(/\D/g, ''));
      const numB = parseFloat(String(seqB).replace(/\D/g, ''));

      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return 0;
    });
  }, [eligibleStudentsForMonth]);

  // METRICS CALCULATIONS
  const totalStudents = sortedStudentsList.length;
  const paidCount = useMemo(() => sortedStudentsList.filter((s: any) => feeMap[s.id]?.status === 'PAID').length, [sortedStudentsList, feeMap]);
  const unpaidCount = useMemo(() => sortedStudentsList.filter((s: any) => !feeMap[s.id] || feeMap[s.id]?.status === 'UNPAID').length, [sortedStudentsList, feeMap]);
  const partialCount = useMemo(() => sortedStudentsList.filter((s: any) => feeMap[s.id]?.status === 'PARTIAL').length, [sortedStudentsList, feeMap]);

  const totalCollectedPKR = useMemo(() => sortedStudentsList.reduce((sum: number, s: any) => sum + (feeMap[s.id]?.paidAmount || 0), 0), [sortedStudentsList, feeMap]);
  const totalPendingDuesPKR = useMemo(() => sortedStudentsList.reduce((sum: number, s: any) => sum + (feeMap[s.id]?.remainingDues || 0), 0), [sortedStudentsList, feeMap]);
  const totalPrevMonthDuesPKR = useMemo(() => sortedStudentsList.reduce((sum: number, s: any) => sum + (feeMap[s.id]?.previousMonthDues || 0), 0), [sortedStudentsList, feeMap]);

  // FILTERING & PAGINATION
  const filteredStudents = useMemo(() => {
    return sortedStudentsList.filter((student: any) => {
      const record = feeMap[student.id];
      const matchesGender = genderFilter === 'ALL' || student.gender === genderFilter;

      if (!matchesGender) return false;
      if (statusFilter === 'PAID') return record?.status === 'PAID';
      if (statusFilter === 'UNPAID') return !record || record?.status === 'UNPAID';
      if (statusFilter === 'PARTIAL') return record?.status === 'PARTIAL';
      return true;
    });
  }, [sortedStudentsList, statusFilter, genderFilter, feeMap]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredStudents.length / ITEMS_PER_PAGE) || 1;
  }, [filteredStudents.length]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  // MODAL HANDLERS
  const openPaymentModal = (student: any) => {
    const currentRecord = feeMap[student.id] || {
      status: 'UNPAID',
      paidAmount: 0,
      remainingDues: Number(currentClass.monthlyFee || 0),
      previousMonthDues: 0
    };

    setActiveModalStudent(student);

    const prevDues = currentRecord.previousMonthDues || 0;
    const classFee = Number(currentClass.monthlyFee || student.classFee || 0);
    const totalPayableDefault = classFee + prevDues;

    const defaultPaidAmount = currentRecord.paidAmount > 0
      ? currentRecord.paidAmount.toString()
      : totalPayableDefault.toString();

    setModalPaidInput(defaultPaidAmount);
    setModalPrevDuesInput(prevDues.toString());
  };

  const closeModal = () => {
    setActiveModalStudent(null);
  };

  // CASCADING PAYMENT SAVE LOGIC
  const handleSaveModalPayment = async () => {
    if (!activeModalStudent || !selectedClassId) return;

    const studentId = activeModalStudent.id;
    const totalPaidVal = Number(modalPaidInput) || 0;
    const currentClassMonthlyFee = Number(currentClass.monthlyFee || 0);

    const prevMonthStr = getMonthOffset(selectedMonth, -1);
    const prevFeeRef = doc(db, 'users', USER_ID, 'fees', `${selectedClassId}_${prevMonthStr}`);
    const currentFeeRef = doc(db, 'users', USER_ID, 'fees', docKey);

    try {
      const prevSnap = await getDoc(prevFeeRef);
      let prevFeeMap = prevSnap.exists() ? (prevSnap.data()?.feeRecords || {}) : {};
      let prevStudentRec = prevFeeMap[studentId];

      let prevRemainingDues = prevStudentRec ? Number(prevStudentRec.remainingDues || 0) : 0;
      let prevPaidAmount = prevStudentRec ? Number(prevStudentRec.paidAmount || 0) : 0;

      let amountAllocatedToPrev = 0;
      let updatedPrevRemaining = prevRemainingDues;

      if (prevRemainingDues > 0) {
        amountAllocatedToPrev = Math.min(totalPaidVal, prevRemainingDues);
        const newPrevPaid = prevPaidAmount + amountAllocatedToPrev;
        updatedPrevRemaining = Math.max(0, prevRemainingDues - amountAllocatedToPrev);

        let newPrevStatus: 'PAID' | 'UNPAID' | 'PARTIAL' = 'UNPAID';
        if (updatedPrevRemaining === 0) {
          newPrevStatus = 'PAID';
        } else if (newPrevPaid > 0) {
          newPrevStatus = 'PARTIAL';
        }

        prevFeeMap[studentId] = {
          ...prevStudentRec,
          paidAmount: newPrevPaid,
          remainingDues: updatedPrevRemaining,
          status: newPrevStatus
        };

        await setDoc(prevFeeRef, {
          classId: selectedClassId,
          month: prevMonthStr,
          feeRecords: prevFeeMap,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      const amountForCurrent = Math.max(0, totalPaidVal - amountAllocatedToPrev);
      const currentTotalPayable = currentClassMonthlyFee + updatedPrevRemaining;
      const currentRemaining = Math.max(0, currentTotalPayable - amountForCurrent);

      let newCurrentStatus: 'PAID' | 'UNPAID' | 'PARTIAL' = 'UNPAID';
      if (currentRemaining === 0 && currentTotalPayable > 0) {
        newCurrentStatus = 'PAID';
      } else if (amountForCurrent > 0) {
        newCurrentStatus = 'PARTIAL';
      }

      const updatedCurrentRecord: StudentFeeRecord = {
        status: newCurrentStatus,
        paidAmount: amountForCurrent,
        remainingDues: currentRemaining,
        previousMonthDues: updatedPrevRemaining
      };

      const newCurrentMap = { ...feeMap, [studentId]: updatedCurrentRecord };
      setFeeMap(newCurrentMap);

      await setDoc(currentFeeRef, {
        classId: selectedClassId,
        month: selectedMonth,
        feeRecords: newCurrentMap,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await syncFeeStatusToClassesDoc(selectedClassId, newCurrentMap);

    } catch (err) {
      console.error("Error processing cascading payment:", err);
    }

    closeModal();
  };

  // BATCH ACTIONS
  const markAllPaid = async () => {
    if (!selectedClassId) return;
    const updated: Record<string, StudentFeeRecord> = {};
    sortedStudentsList.forEach((s: any) => {
      const prevDues = feeMap[s.id]?.previousMonthDues || 0;
      const totalPayable = Number(currentClass.monthlyFee || 0) + prevDues;
      updated[s.id] = {
        status: 'PAID',
        paidAmount: totalPayable,
        remainingDues: 0,
        previousMonthDues: prevDues
      };
    });
    setFeeMap(updated);

    try {
      const docRef = doc(db, 'users', USER_ID, 'fees', docKey);
      await setDoc(docRef, {
        classId: selectedClassId,
        month: selectedMonth,
        feeRecords: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await syncFeeStatusToClassesDoc(selectedClassId, updated);
    } catch (e) {
      console.error(e);
    }
  };

  const markAllUnpaid = async () => {
    if (!selectedClassId) return;
    const updated: Record<string, StudentFeeRecord> = {};
    sortedStudentsList.forEach((s: any) => {
      const prevDues = feeMap[s.id]?.previousMonthDues || 0;
      const totalPayable = Number(currentClass.monthlyFee || 0) + prevDues;
      updated[s.id] = {
        status: 'UNPAID',
        paidAmount: 0,
        remainingDues: totalPayable,
        previousMonthDues: prevDues
      };
    });
    setFeeMap(updated);

    try {
      const docRef = doc(db, 'users', USER_ID, 'fees', docKey);
      await setDoc(docRef, {
        classId: selectedClassId,
        month: selectedMonth,
        feeRecords: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await syncFeeStatusToClassesDoc(selectedClassId, updated);
    } catch (e) {
      console.error(e);
    }
  };

  const navigationTabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'classes', label: 'Classes', icon: GraduationCap, href: '/departments' },
    { id: 'attendance', label: 'Attendance', icon: Users, href: '/attendance' },
    { id: 'fees', label: 'Fees', icon: Wallet, href: '/fees' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  const modalClassFee = Number(currentClass.monthlyFee || activeModalStudent?.classFee || 0);
  const modalPrevDues = Number(modalPrevDuesInput || 0);
  const modalTotalPayable = modalClassFee + modalPrevDues;
  const modalPaidVal = Number(modalPaidInput) || 0;
  const modalRemainingVal = Math.max(0, modalTotalPayable - modalPaidVal);

  const activeModalStudentAdmissionMonth = activeModalStudent ? getStudentAdmissionMonth(activeModalStudent) : null;
  const isModalStudentInFirstMonth = activeModalStudentAdmissionMonth === selectedMonth;
  const modalProratedDetails = activeModalStudent ? calculateProratedFee(activeModalStudent, modalClassFee) : null;

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070c18] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-36 ${isDark ? 'dark' : ''}`}>

      {/* TOP HEADER WITH BACK ARROW & EXTRA CHARGES ONLY */}
      <div className="w-full bg-white/60 dark:bg-[#080e1e]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/80 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="group flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)] hover:shadow-[0_0_22px_rgba(249,115,22,0.8)] transition-all hover:scale-105 active:scale-95 shrink-0"
              title="Move Back To Dashboard"
            >
              <ArrowLeft className="h-4 w-4 stroke-[2.5] group-hover:-translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            
            {/* EXTRA CHARGES CARD / BUTTON */}
            <Link
              to="/extra-fee"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:scale-105 transition-all shrink-0"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Extra Charges</span>
            </Link>

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-7 w-12 items-center rounded-full bg-slate-200/80 p-0.5 transition-all dark:bg-slate-800/90 border border-slate-300/40 dark:border-slate-700/50 shrink-0 shadow-inner"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-500 shadow-md transition-all ${isDark ? 'translate-x-5 bg-slate-950 text-amber-400' : ''}`}>
                {isDark ? <Moon className="h-3 w-3 fill-current" /> : <Sun className="h-3 w-3 fill-current" />}
              </div>
            </button>
            <button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#0d1527] transition-colors shrink-0">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#070c18] shadow-[0_0_8px_rgba(249,115,22,0.8)]">3</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-500">

        {/* GLOWING HEADER CARD */}
        <div className="relative group w-full overflow-hidden rounded-2xl p-[2px] transition-all duration-300 border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)]">
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 rounded-[14px] bg-white dark:bg-[#0a1020]">
            
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)] shrink-0">
                <Wallet className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-xl font-black tracking-tight md:text-2xl flex items-center gap-2 text-slate-900 dark:text-white">
                  Fees Register
                  {isLoading && (
                    <RefreshCw className="h-4 w-4 animate-spin text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] ml-1" />
                  )}
                </h2>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600" />
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Live Engine Active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-[#060b16]/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 self-start sm:self-auto backdrop-blur-md shadow-inner">
              <button
                onClick={markAllPaid}
                disabled={classes.length === 0}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark All Paid
              </button>
              <button
                onClick={markAllUnpaid}
                disabled={classes.length === 0}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="h-3.5 w-3.5" /> Mark All Unpaid
              </button>
            </div>

          </div>
        </div>

        {/* SELECTOR CARD WITH CLASS & AUTOMATIC BOUNDED MONTH DROPDOWN */}
        <div className="relative overflow-hidden rounded-3xl p-[2px] border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)]">
          <div className="rounded-[22px] bg-white dark:bg-[#0a1020] p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="max-w-xl space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.2)]">
                  <span className="text-[10px] font-black uppercase tracking-wider">Filtered Fee Engine</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  Select Class & Month
                </h1>
                
                <div className="flex flex-col sm:flex-row gap-3 max-w-lg pt-1">
                  
                  {/* DYNAMIC CLASS DROPDOWN */}
                  <div className="relative flex-1">
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      disabled={classes.length === 0}
                      className="w-full appearance-none rounded-2xl border-2 border-orange-500/80 dark:border-orange-500/60 bg-white dark:bg-[#070d1a] px-4 py-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-100 shadow-[0_0_15px_rgba(249,115,22,0.2)] outline-none focus:border-orange-500 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {classes.length === 0 ? (
                        <option value="" disabled className="bg-[#0a1020] text-amber-400 font-bold">
                          ⚠️ No Classes Created Yet
                        </option>
                      ) : (
                        classes.map((cls) => (
                          <option key={cls.id} value={cls.id} className="bg-white dark:bg-[#0a1020] text-slate-800 dark:text-slate-100">
                            {cls.name || 'Unnamed Class'} — PKR {cls.monthlyFee}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 h-4 w-4 text-orange-400 pointer-events-none" />
                  </div>
                  
                  {/* AUTOMATIC DYNAMIC 2-MONTH DROPDOWN */}
                  <div className="relative flex-1">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      disabled={classes.length === 0}
                      className="w-full appearance-none rounded-2xl border-2 border-orange-500/80 dark:border-orange-500/60 bg-white dark:bg-[#070d1a] px-4 py-2.5 text-xs font-extrabold text-orange-600 dark:text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)] outline-none focus:border-orange-500 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {monthOptions.map((m) => (
                        <option key={m.value} value={m.value} className="bg-white dark:bg-[#0a1020] text-slate-800 dark:text-slate-100">
                          🗓️ {m.label}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 h-4 w-4 text-orange-400 pointer-events-none" />
                  </div>

                </div>
              </div>

              <div className="hidden md:flex items-center justify-center w-60 h-32 bg-white/80 dark:bg-[#070d1a]/80 border-2 border-orange-500/50 rounded-2xl backdrop-blur-md shadow-[0_0_20px_rgba(249,115,22,0.2)] relative overflow-hidden group">
                <div className="text-center p-4 space-y-1 relative z-10">
                  <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-2">
                    PKR {totalCollectedPKR.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider">Collected This Month</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION ALERT WHEN NO CLASSES ARE CREATED IN ACADEMY */}
        {classes.length === 0 && !isLoading && (
          <div className="relative overflow-hidden rounded-2xl p-[2px] border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)]">
            <div className="bg-white dark:bg-[#0a1020] p-6 rounded-[14px] text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/40 flex items-center justify-center text-orange-500">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                No Classes Found in Academy
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Fees calculate hone aur dikhne ke liye pehle kam az kam ek Class create honi chahiye.
              </p>
              <button
                onClick={() => navigate('/departments')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:scale-105 transition-all"
              >
                <PlusCircle className="h-4 w-4" /> Create Class Now
              </button>
            </div>
          </div>
        )}

        {/* METRICS DASHBOARD GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-[#0a1020] border-2 border-orange-500/60 rounded-2xl p-3.5 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
            <span className="text-[10px] font-extrabold text-slate-400 block tracking-wide uppercase">Students</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 block">{totalStudents}</span>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-500/40 rounded-2xl p-3.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 block tracking-wide uppercase">Paid Count</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{paidCount}</span>
          </div>
          <div className="bg-rose-50/70 dark:bg-rose-950/20 border-2 border-rose-500/40 rounded-2xl p-3.5 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
            <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 block tracking-wide uppercase">Unpaid Count</span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{unpaidCount}</span>
          </div>
          <div className="bg-blue-50/70 dark:bg-blue-950/20 border-2 border-blue-500/40 rounded-2xl p-3.5 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 block tracking-wide uppercase">Collected Dues</span>
            <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 mt-1 block truncate">PKR {totalCollectedPKR.toLocaleString()}</span>
          </div>
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-500/40 rounded-2xl p-3.5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 block tracking-wide uppercase">Pending Dues</span>
            <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-1 block truncate">PKR {totalPendingDuesPKR.toLocaleString()}</span>
          </div>
          <div className="bg-purple-50/70 dark:bg-purple-950/20 border-2 border-purple-500/40 rounded-2xl p-3.5 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 block tracking-wide uppercase">Prev Month Dues</span>
            <span className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 mt-1 block truncate">PKR {totalPrevMonthDuesPKR.toLocaleString()}</span>
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1 bg-slate-200/60 dark:bg-[#0d1527] p-1 rounded-full border border-slate-300/50 dark:border-slate-800/80 shrink-0 shadow-inner">
            {['ALL', 'Male', 'Female'].map(g => (
              <button 
                key={g} 
                onClick={() => setGenderFilter(g as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-300 whitespace-nowrap ${
                  genderFilter === g 
                    ? 'bg-slate-900 text-white shadow-md dark:bg-slate-700' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {g === 'ALL' ? 'All Genders' : g}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 bg-slate-200/60 dark:bg-[#0d1527] p-1 rounded-full border border-slate-300/50 dark:border-slate-800/80 shrink-0 shadow-inner">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-300 whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Students
            </button>

            <button
              onClick={() => setStatusFilter('PAID')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-300 whitespace-nowrap ${
                statusFilter === 'PAID'
                  ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Paid ({paidCount})
            </button>

            <button
              onClick={() => setStatusFilter('UNPAID')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-300 whitespace-nowrap ${
                statusFilter === 'UNPAID'
                  ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Unpaid ({unpaidCount})
            </button>

            <button
              onClick={() => setStatusFilter('PARTIAL')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-300 whitespace-nowrap ${
                statusFilter === 'PARTIAL'
                  ? 'bg-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Partial ({partialCount})
            </button>
          </div>
        </div>

        {/* STUDENT FEE CARD LIST */}
        <div className="space-y-3.5">
          {paginatedStudents.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#0a1020] rounded-2xl border-2 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
              <p className="text-xs font-bold text-slate-400">
                {classes.length === 0 ? 'No classes available to render students.' : 'No students found for this month/filters.'}
              </p>
            </div>
          ) : (
            paginatedStudents.map((student: any, index: number) => {
              const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
              const record: StudentFeeRecord = feeMap[student.id] || {
                status: 'UNPAID',
                paidAmount: 0,
                remainingDues: Number(currentClass.monthlyFee),
                previousMonthDues: 0
              };

              const isPaid = record.status === 'PAID';
              const isPartial = record.status === 'PARTIAL';
              const hasRemaining = record.remainingDues > 0;

              const studentAdmissionMonth = getStudentAdmissionMonth(student);
              const isFirstAdmissionMonth = studentAdmissionMonth === selectedMonth;
              const joiningDateDisplay = student.joiningDate || student.admissionDate || student.createdAt;
              const prorated = isFirstAdmissionMonth ? calculateProratedFee(student, monthlyFee) : null;

              return (
                <div
                  key={student.id}
                  className={`group relative overflow-hidden rounded-2xl p-[2px] transition-all duration-300 ${
                    isPaid
                      ? 'border-2 border-slate-300 dark:border-slate-800 shadow-sm'
                      : isPartial
                      ? 'border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                      : 'border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)]'
                  }`}
                >
                  <div className="relative bg-white dark:bg-[#0a1020] p-4 rounded-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 backdrop-blur-md">
                    
                    {/* Left: Student Profile & Joining Badge */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={student.avatar || 'https://via.placeholder.com/150'}
                          alt={student.name}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-orange-500/40 shadow-md"
                        />
                        <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-md">
                          #{globalIndex}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                            {student.name || 'Unnamed Student'}
                          </h4>

                          {/* JOINING DATE BADGE - ONLY IN THE FIRST MONTH */}
                          {isFirstAdmissionMonth && joiningDateDisplay && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/40 text-orange-600 dark:text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)] animate-pulse">
                              <Sparkles className="h-3 w-3 text-orange-500" />
                              Joined: {formatDisplayDate(joiningDateDisplay)}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>{student.gender === 'Male' ? 'Male' : 'Female'} | Fee: PKR {currentClass.monthlyFee}</span>
                          
                          {/* SHOW PRORATED SUGGESTION IN FIRST MONTH */}
                          {isFirstAdmissionMonth && prorated && (
                            <span className="text-amber-600 dark:text-amber-400 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                              <Calculator className="h-3 w-3 text-amber-500" />
                              1st Month Dues ({prorated.daysStudied} Days @ {prorated.dailyRate}/day): PKR {prorated.proratedFee}
                            </span>
                          )}

                          {record.previousMonthDues > 0 && (
                            <span className="text-purple-600 dark:text-purple-400 font-extrabold bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                              Prev Unpaid: PKR {record.previousMonthDues}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Payment Status & Actions */}
                    <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                      {hasRemaining ? (
                        <button
                          onClick={() => openPaymentModal(student)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-400/40 text-amber-800 dark:text-amber-300 hover:scale-105 transition-all text-start flex items-center gap-2 shadow-sm"
                          title="Click to process payment"
                        >
                          <div>
                            <span className="text-[9px] font-black uppercase block tracking-wider text-amber-600 dark:text-amber-400">Total Dues</span>
                            <span className="text-xs font-extrabold block">PKR {record.remainingDues.toLocaleString()}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        </button>
                      ) : (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold flex items-center gap-1 shadow-sm">
                          <span>Paid Fully</span> ✨
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => openPaymentModal(student)}
                        className={`text-xs font-black px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 shrink-0 hover:scale-105 active:scale-95 ${
                          isPaid
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.35)] hover:shadow-[0_0_22px_rgba(249,115,22,0.6)]'
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        {isPaid ? 'Edit' : 'Pay Dues'}
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        {filteredStudents.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#0a1020] border-2 border-orange-500/40 rounded-2xl p-4 shadow-[0_0_15px_rgba(249,115,22,0.15)] mt-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Showing <span className="text-orange-500 font-extrabold">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredStudents.length)}</span> to <span className="text-orange-500 font-extrabold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)}</span> of <span className="text-slate-800 dark:text-slate-200 font-extrabold">{filteredStudents.length}</span> Students
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 ${
                  currentPage === 1
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-800'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.35)] hover:scale-105 active:scale-95'
                }`}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>

              <div className="px-3.5 py-2 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs font-black shadow-inner">
                {currentPage} / {totalPages}
              </div>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 ${
                  currentPage >= totalPages
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-800'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.35)] hover:scale-105 active:scale-95'
                }`}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ANIMATED GLOWING PAYMENT MODAL */}
      {activeModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative overflow-hidden bg-white dark:bg-[#0a1020] rounded-3xl p-6 w-full max-w-md border-2 border-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.4)]">
            
            <div className="flex justify-between items-center mb-5 relative z-10">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-wide flex items-center gap-2">
                  Process Payment
                </h3>
                {activeModalStudent?.name && (
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                    Student: <span className="text-orange-500 font-extrabold">{activeModalStudent.name}</span>
                  </p>
                )}
              </div>
              <button 
                onClick={closeModal} 
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-500 dark:text-slate-400 transition-all hover:scale-105"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 relative z-10">
              
              {/* FIRST MONTH PRORATED ASSISTANT */}
              {isModalStudentInFirstMonth && modalProratedDetails && (
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/40 rounded-2xl p-3.5 space-y-2 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                  <div className="flex items-center justify-between text-xs font-black text-amber-600 dark:text-amber-400">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4" /> 1st Month Joining Fee Assistant
                    </span>
                    <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Joined: {modalProratedDetails.joiningDateFormatted}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold space-y-1">
                    <p>Daily Rate: <strong>PKR {modalProratedDetails.dailyRate}/day</strong> ({modalClassFee} ÷ {modalProratedDetails.totalDaysInMonth} Days)</p>
                    <p>Classes Taken: <strong>{modalProratedDetails.daysStudied} Days</strong> (From {modalProratedDetails.joiningDay}th to end of month)</p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalPaidInput((modalProratedDetails.proratedFee + modalPrevDues).toString())}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-orange-500 text-white font-black text-[11px] shadow-md hover:bg-orange-600 transition-all text-center"
                    >
                      Apply Prorated Fee (PKR {modalProratedDetails.proratedFee})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalPaidInput(modalTotalPayable.toString())}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-[11px] hover:bg-slate-300 transition-all text-center"
                    >
                      Apply Full Fee (PKR {modalClassFee})
                    </button>
                  </div>
                </div>
              )}

              {/* DUES SUMMARY GRID */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100/70 dark:bg-[#070d1a] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Prev Unpaid Dues</span>
                  <span className="text-sm font-black text-purple-600 dark:text-purple-400">PKR {modalPrevDues}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Month Fee</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200">PKR {modalClassFee}</span>
                </div>
                <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">Total Payable Dues:</span>
                  <span className="text-sm font-black text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">PKR {modalTotalPayable}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">
                  Paid Amount (PKR)
                </label>
                <input 
                  type="number"
                  value={modalPaidInput}
                  onChange={(e) => setModalPaidInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-[#070d1a] border-2 border-orange-500/60 rounded-2xl px-4 py-3 text-base font-black focus:outline-none focus:border-orange-500 transition-all text-slate-800 dark:text-white shadow-inner"
                />
              </div>

              <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.12)]">
                <div>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Total Received
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Remaining After Payment: <strong className="text-rose-500">PKR {modalRemainingVal}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                    PKR {modalPaidVal.toLocaleString()}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleSaveModalPayment}
                className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black py-3.5 rounded-2xl transition-all duration-200 shadow-[0_4px_25px_rgba(249,115,22,0.4)] flex justify-center items-center gap-2 text-sm tracking-wide"
              >
                <Save className="h-5 w-5" /> Save Record
              </button>

            </div>
          </div>
        </div>
      )}

      {/* FLOATING CIRCULAR BOTTOM NAVBAR */}
      <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto bg-white/95 dark:bg-[#0a1020]/95 backdrop-blur-xl border-2 border-orange-500/40 shadow-[0_10px_40px_rgba(0,0,0,0.4)] rounded-full px-5 py-2 flex items-center justify-between gap-4 sm:gap-8 max-w-md w-full">
          {navigationTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.href || (tab.id === 'fees' && location.pathname.includes('/fees'));
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className="flex flex-col items-center justify-center relative transition-transform duration-200 active:scale-95 group"
              >
                {isActive && (
                  <span className="absolute -top-1 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                )}

                <div
                  className={`flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)] scale-105'
                      : 'w-10 h-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-5 w-5 stroke-[2.2]" />
                </div>

                <span
                  className={`text-[10px] font-black mt-0.5 transition-colors ${
                    isActive ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500'
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
