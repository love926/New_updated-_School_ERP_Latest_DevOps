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
  ArrowLeft,
  Sparkles,
  Calculator,
  PlusCircle,
  Layers,
  Search,
  Check
} from 'lucide-react';

// Firebase Imports (Direct import from lib/firebase - No hardcoded config)
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs
} from 'firebase/firestore';

interface StudentFeeRecord {
  status: 'PAID' | 'UNPAID' | 'PARTIAL';
  paidAmount: number;
  remainingDues: number;
  previousMonthDues: number;
}

// Extract YYYY-MM from student joining/admission date
const getStudentAdmissionMonth = (student: any): string | null => {
  const rawDate = student?.joiningDate || student?.admissionDate || student?.createdAt || student?.date;
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

// Format raw date into readable string
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

// Month Offset Calculator
const getMonthOffset = (monthStr: string, offset: number) => {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// EXTRACT STUDENTS FROM ANY DATA FORMAT
const extractStudentsFromClass = (classData: any): any[] => {
  if (!classData) return [];
  
  if (Array.isArray(classData.students)) {
    return classData.students;
  }
  
  if (classData.students && typeof classData.students === 'object') {
    const keys = Object.keys(classData.students).sort((a, b) => Number(a) - Number(b));
    return keys.map(k => classData.students[k]);
  }
  
  const reservedKeys = ['id', 'name', 'monthlyFee', 'className', 'fee', 'createdAt', 'createdDate', 'date', 'updatedAt'];
  const numericKeys = Object.keys(classData)
    .filter(k => !reservedKeys.includes(k) && typeof classData[k] === 'object' && classData[k] !== null)
    .sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

  if (numericKeys.length > 0) {
    return numericKeys.map(k => ({ ...classData[k], _seqKey: k }));
  }

  return [];
};

// PRORATED FEE CALCULATOR
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
  const [isDark, setIsDark] = useState(false);

  // Dynamic Auth State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Data States
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [feeMap, setFeeMap] = useState<Record<string, StudentFeeRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasPrevMonthRecords, setHasPrevMonthRecords] = useState(false);

  // Selector Modal States
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [classSearchQuery, setClassSearchQuery] = useState('');

  // Filters & Pagination States
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'PARTIAL'>('ALL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Payment Modal State
  const [activeModalStudent, setActiveModalStudent] = useState<any | null>(null);
  const [modalPaidInput, setModalPaidInput] = useState<string>('');
  const [modalPrevDuesInput, setModalPrevDuesInput] = useState<string>('0');

  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || { id: '', name: 'Select Class', students: [], monthlyFee: 0 };
  }, [selectedClassId, classes]);

  // DYNAMIC 2-MONTH DROPDOWN LOGIC
  const monthOptions = useMemo(() => {
    const now = new Date();
    const currDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const formatMonth = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { label, value: `${y}-${m}` };
    };

    const currentMonthObj = formatMonth(currDate);
    const prevMonthObj = formatMonth(prevDate);

    const rawStudents = currentClass?.students || [];
    const hasStudentInOrBeforePrevMonth = rawStudents.some((s: any) => {
      const adm = getStudentAdmissionMonth(s);
      return adm && adm <= prevMonthObj.value;
    });

    // August 2026: If no record or admission for July, show only August
    if (!hasPrevMonthRecords && !hasStudentInOrBeforePrevMonth) {
      return [currentMonthObj];
    }

    // September/October: Show 2 months
    return [currentMonthObj, prevMonthObj];
  }, [currentClass.students, hasPrevMonthRecords]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthOptions[0]?.value);

  useEffect(() => {
    if (monthOptions.length > 0 && !monthOptions.some(m => m.value === selectedMonth)) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth]);

  // ----------------------------------------------------------------------
  // AUTH LISTENER
  // ----------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userIdentifier = user.email || user.uid;
        setCurrentUserEmail(userIdentifier);
      } else {
        setCurrentUserEmail(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // ----------------------------------------------------------------------
  // FETCH CLASSES FROM FIREBASE
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!currentUserEmail) {
      setClasses([]);
      setSelectedClassId('');
      return;
    }

    setIsLoading(true);
    const classesRef = collection(db, 'users', currentUserEmail, 'classes');
    
    const unsubscribe = onSnapshot(classesRef, (snapshot) => {
      const fetchedClasses = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const className = data.name || data.className || data.title || docSnap.id;
        const feeValue = data.monthlyFee || data.fee || data.classFee || 0;
        
        return {
          id: docSnap.id,
          name: className,
          monthlyFee: Number(feeValue),
          ...data,
          students: extractStudentsFromClass(data)
        };
      });

      fetchedClasses.sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      );

      setClasses(fetchedClasses);

      if (fetchedClasses.length > 0) {
        setSelectedClassId(prev => {
          if (prev && fetchedClasses.some(c => c.id === prev)) {
            return prev;
          }
          return fetchedClasses[0].id;
        });
      } else {
        setSelectedClassId('');
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching classes:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserEmail]);

  // AUTOMATIC DATABASE CLEANUP FOR OLDER RECORDS (e.g. October deletes August)
  useEffect(() => {
    if (!selectedClassId || !currentUserEmail) return;

    const cleanupOldRecords = async () => {
      try {
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonthNum = String(prevDate.getMonth() + 1).padStart(2, '0');
        const prevMonthCutoff = `${prevYear}-${prevMonthNum}`;

        const feesCollectionRef = collection(db, 'users', currentUserEmail, 'fees');
        const snapshot = await getDocs(feesCollectionRef);

        snapshot.docs.forEach(async (docSnap) => {
          const id = docSnap.id;
          if (id.startsWith(`${selectedClassId}_`)) {
            const docMonth = id.replace(`${selectedClassId}_`, '');
            if (docMonth.length === 7 && docMonth < prevMonthCutoff) {
              await deleteDoc(doc(db, 'users', currentUserEmail, 'fees', id));
            }
          }
        });
      } catch (err) {
        console.error("Error cleaning up old fee records:", err);
      }
    };

    cleanupOldRecords();
  }, [selectedClassId, currentUserEmail]);

  const selectedMonthObj = useMemo(() => {
    return monthOptions.find(m => m.value === selectedMonth) || monthOptions[0];
  }, [selectedMonth, monthOptions]);

  // SYNC FEE STATUS DIRECTLY TO FIRESTORE CLASS DOC
  const syncFeeStatusToClassesDoc = async (classId: string, currentFeeMap: Record<string, StudentFeeRecord>) => {
    if (!classId || !currentUserEmail) return;
    try {
      const classRef = doc(db, 'users', currentUserEmail, 'classes', classId);
      const classSnap = await getDoc(classRef);
      if (classSnap.exists()) {
        const classData = classSnap.data();
        const reservedKeys = ['id', 'name', 'monthlyFee', 'className', 'fee', 'createdAt', 'createdDate', 'date', 'updatedAt'];
        const numericKeys = Object.keys(classData).filter(k => !reservedKeys.includes(k) && typeof classData[k] === 'object' && classData[k] !== null);
        
        if (numericKeys.length > 0) {
          const updatedData: any = { ...classData };
          numericKeys.forEach(key => {
            const st = classData[key];
            const record = currentFeeMap[st.id || st.studentId || key];
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
            const record = currentFeeMap[st.id || st.studentId];
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

  // ELIGIBLE STUDENTS & ADMISSION MONTH LOGIC (Students start from their joining month only)
  const eligibleStudentsForMonth = useMemo(() => {
    const rawStudents = currentClass.students || [];
    return rawStudents.filter((student: any) => {
      const studentName = (student?.name || '').trim();
      if (!studentName || studentName.toLowerCase() === 'unnamed student') {
        return false;
      }

      const admissionMonth = getStudentAdmissionMonth(student);
      if (admissionMonth && selectedMonth < admissionMonth) {
        return false;
      }

      return true;
    });
  }, [currentClass.students, selectedMonth]);

  const docKey = `${selectedClassId}_${selectedMonth}`;
  const monthlyFee = Number(currentClass.monthlyFee || 0);

  // REALTIME FEE LISTENER WITH AUTOMATIC FEE MERGE & CARRYOVER LOGIC
  useEffect(() => {
    if (!selectedClassId || !currentUserEmail) {
      setFeeMap({});
      return;
    }
    setIsLoading(true);

    const currentFeeRef = doc(db, 'users', currentUserEmail, 'fees', docKey);
    const prevMonthStr = getMonthOffset(selectedMonth, -1);
    const prevFeeRef = doc(db, 'users', currentUserEmail, 'fees', `${selectedClassId}_${prevMonthStr}`);

    let isMounted = true;
    let prevDataMap: Record<string, any> = {};
    let currentDataMap: Record<string, any> = {};

    const processFeeMergeAndCarryover = async (activeMap: Record<string, StudentFeeRecord>, rawPrevMap: Record<string, any>) => {
      let prevUpdateNeeded = false;
      const updatedPrevFeeRecords = { ...rawPrevMap };

      for (const studentKey of Object.keys(activeMap)) {
        const prevRec = rawPrevMap[studentKey];
        if (prevRec && Number(prevRec.remainingDues || 0) > 0) {
          const carryOverDues = Number(prevRec.remainingDues || 0);
          activeMap[studentKey].previousMonthDues = carryOverDues;
          activeMap[studentKey].remainingDues = monthlyFee + carryOverDues - activeMap[studentKey].paidAmount;

          // Pichle month ka status update ho kar PAID ho jayega taake double calculation na ho
          updatedPrevFeeRecords[studentKey] = {
            ...prevRec,
            remainingDues: 0,
            status: 'PAID'
          };
          prevUpdateNeeded = true;
        }
      }

      if (prevUpdateNeeded) {
        try {
          await setDoc(prevFeeRef, {
            classId: selectedClassId,
            month: prevMonthStr,
            feeRecords: updatedPrevFeeRecords,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Error updating previous month dues status:", err);
        }
      }
    };

    const recalculateFeeMap = async () => {
      if (!isMounted) return;
      const isOldestMonth = selectedMonth === monthOptions[monthOptions.length - 1]?.value;
      const activeMap: Record<string, StudentFeeRecord> = {};

      eligibleStudentsForMonth.forEach((s: any) => {
        const studentKey = s.id || s.studentId || s._seqKey;
        let carryOverDues = 0;

        const admissionMonth = getStudentAdmissionMonth(s);
        const wasAdmittedBeforeThisMonth = !admissionMonth || prevMonthStr >= admissionMonth;

        if (!isOldestMonth && wasAdmittedBeforeThisMonth) {
          const prevRecord = prevDataMap[studentKey];
          if (prevRecord !== undefined) {
            carryOverDues = Number(prevRecord.remainingDues || 0);
          }
        }

        const existingCurrent = currentDataMap[studentKey];
        const paidAmt = existingCurrent ? Number(existingCurrent.paidAmount || 0) : 0;
        const totalPayable = monthlyFee + carryOverDues;
        const remaining = Math.max(0, totalPayable - paidAmt);

        let calculatedStatus: 'PAID' | 'UNPAID' | 'PARTIAL' = 'UNPAID';
        if (paidAmt >= totalPayable && totalPayable > 0) {
          calculatedStatus = 'PAID';
        } else if (paidAmt > 0) {
          calculatedStatus = 'PARTIAL';
        }

        activeMap[studentKey] = {
          status: calculatedStatus,
          paidAmount: paidAmt,
          remainingDues: remaining,
          previousMonthDues: carryOverDues
        };
      });

      setFeeMap(activeMap);
      setIsLoading(false);

      if (Object.keys(prevDataMap).length > 0) {
        await processFeeMergeAndCarryover(activeMap, prevDataMap);
      }
    };

    const unsubPrev = onSnapshot(prevFeeRef, (snap) => {
      const exists = snap.exists();
      prevDataMap = exists ? (snap.data()?.feeRecords || {}) : {};
      setHasPrevMonthRecords(exists && Object.keys(prevDataMap).length > 0);
      recalculateFeeMap();
    });

    const unsubCurrent = onSnapshot(currentFeeRef, (snap) => {
      currentDataMap = snap.exists() ? (snap.data()?.feeRecords || {}) : {};
      recalculateFeeMap();
    });

    return () => {
      isMounted = false;
      unsubPrev();
      unsubCurrent();
    };
  }, [selectedClassId, selectedMonth, eligibleStudentsForMonth, monthlyFee, monthOptions, currentUserEmail]);

  useEffect(() => setCurrentPage(1), [statusFilter, genderFilter, selectedClassId, selectedMonth]);

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
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [eligibleStudentsForMonth]);

  // METRICS CALCULATIONS
  const totalStudents = sortedStudentsList.length;
  const paidCount = useMemo(() => sortedStudentsList.filter((s: any) => feeMap[s.id || s.studentId || s._seqKey]?.status === 'PAID').length, [sortedStudentsList, feeMap]);
  const unpaidCount = useMemo(() => sortedStudentsList.filter((s: any) => !feeMap[s.id || s.studentId || s._seqKey] || feeMap[s.id || s.studentId || s._seqKey]?.status === 'UNPAID').length, [sortedStudentsList, feeMap]);
  const partialCount = useMemo(() => sortedStudentsList.filter((s: any) => feeMap[s.id || s.studentId || s._seqKey]?.status === 'PARTIAL').length, [sortedStudentsList, feeMap]);

  const totalCollectedPKR = useMemo(() => sortedStudentsList.reduce((sum: number, s: any) => sum + (feeMap[s.id || s.studentId || s._seqKey]?.paidAmount || 0), 0), [sortedStudentsList, feeMap]);
  const totalPendingDuesPKR = useMemo(() => sortedStudentsList.reduce((sum: number, s: any) => sum + (feeMap[s.id || s.studentId || s._seqKey]?.remainingDues || 0), 0), [sortedStudentsList, feeMap]);
  const totalPrevMonthDuesPKR = useMemo(() => sortedStudentsList.reduce((sum: number, s: any) => sum + (feeMap[s.id || s.studentId || s._seqKey]?.previousMonthDues || 0), 0), [sortedStudentsList, feeMap]);

  // FILTERING & PAGINATION
  const filteredStudents = useMemo(() => {
    return sortedStudentsList.filter((student: any) => {
      const key = student.id || student.studentId || student._seqKey;
      const record = feeMap[key];
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

  const filteredClassesList = useMemo(() => {
    return classes.filter(c => (c.name || '').toLowerCase().includes(classSearchQuery.toLowerCase()));
  }, [classes, classSearchQuery]);

  // PAYMENT MODAL HANDLERS
  const openPaymentModal = (student: any) => {
    const key = student.id || student.studentId || student._seqKey;
    const currentRecord = feeMap[key] || {
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

  const handleSaveModalPayment = async () => {
    if (!activeModalStudent || !selectedClassId || !currentUserEmail) return;

    const studentId = activeModalStudent.id || activeModalStudent.studentId || activeModalStudent._seqKey;
    const totalPaidVal = Number(modalPaidInput) || 0;
    const currentClassMonthlyFee = Number(currentClass.monthlyFee || 0);

    const prevMonthStr = getMonthOffset(selectedMonth, -1);
    const prevFeeRef = doc(db, 'users', currentUserEmail, 'fees', `${selectedClassId}_${prevMonthStr}`);
    const currentFeeRef = doc(db, 'users', currentUserEmail, 'fees', docKey);

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
      console.error("Error processing payment:", err);
    }

    closeModal();
  };

  const markAllPaid = async () => {
    if (!selectedClassId || !currentUserEmail) return;
    const updated: Record<string, StudentFeeRecord> = {};
    sortedStudentsList.forEach((s: any) => {
      const key = s.id || s.studentId || s._seqKey;
      const prevDues = feeMap[key]?.previousMonthDues || 0;
      const totalPayable = Number(currentClass.monthlyFee || 0) + prevDues;
      updated[key] = {
        status: 'PAID',
        paidAmount: totalPayable,
        remainingDues: 0,
        previousMonthDues: prevDues
      };
    });
    setFeeMap(updated);

    try {
      const docRef = doc(db, 'users', currentUserEmail, 'fees', docKey);
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
    if (!selectedClassId || !currentUserEmail) return;
    const updated: Record<string, StudentFeeRecord> = {};
    sortedStudentsList.forEach((s: any) => {
      const key = s.id || s.studentId || s._seqKey;
      const prevDues = feeMap[key]?.previousMonthDues || 0;
      const totalPayable = Number(currentClass.monthlyFee || 0) + prevDues;
      updated[key] = {
        status: 'UNPAID',
        paidAmount: 0,
        remainingDues: totalPayable,
        previousMonthDues: prevDues
      };
    });
    setFeeMap(updated);

    try {
      const docRef = doc(db, 'users', currentUserEmail, 'fees', docKey);
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

      {/* TOP HEADER */}
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

        {/* HEADER GLOW CARD */}
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

        {/* CLASS & MONTH SELECTOR SECTION */}
        <div className="relative overflow-hidden rounded-3xl p-[2px] border-2 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)]">
          <div className="rounded-[22px] bg-white dark:bg-[#0a1020] p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="max-w-xl space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.2)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Filtered Dynamic Fee Engine</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  Select Class & Month
                </h1>
                
                <div className="flex flex-col sm:flex-row gap-3 max-w-lg pt-1">
                  
                  {/* SELECT CLASS TRIGGER CARD */}
                  <div 
                    onClick={() => classes.length > 0 && setIsClassModalOpen(true)}
                    className="relative flex-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full rounded-2xl border-2 border-orange-500/80 bg-white dark:bg-[#070d1a] px-4 py-3 shadow-[0_0_15px_rgba(249,115,22,0.25)] hover:border-orange-500 transition-all">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        {currentClass.name ? `${currentClass.name} — PKR ${currentClass.monthlyFee}` : 'Select Class'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-orange-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                  
                  {/* SELECT MONTH TRIGGER CARD */}
                  <div 
                    onClick={() => setIsMonthModalOpen(true)}
                    className="relative flex-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full rounded-2xl border-2 border-orange-500/80 bg-white dark:bg-[#070d1a] px-4 py-3 shadow-[0_0_15px_rgba(249,115,22,0.25)] hover:border-orange-500 transition-all">
                      <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400 truncate">
                        🗓️ {selectedMonthObj?.label || 'Select Month'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-orange-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                </div>
              </div>

              <div className="hidden md:flex items-center justify-center w-60 h-32 bg-white/80 dark:bg-[#070d1a]/80 border-2 border-orange-500/50 rounded-2xl backdrop-blur-md shadow-[0_0_20px_rgba(249,115,22,0.25)] relative overflow-hidden group">
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

        {/* NO CLASS NOTICE */}
        {classes.length === 0 && !isLoading && (
          <div className="relative overflow-hidden rounded-2xl p-[2px] border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)]">
            <div className="bg-white dark:bg-[#0a1020] p-6 rounded-[14px] text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/40 flex items-center justify-center text-orange-500">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                No Classes Found
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Fees load karne ke liye sab se pehle classes create karein.
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

        {/* METRICS GRID */}
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
            <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 block tracking-wide uppercase">Collected</span>
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

        {/* STUDENT FEE CARDS LIST */}
        <div className="space-y-3.5">
          {paginatedStudents.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#0a1020] rounded-2xl border-2 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
              <p className="text-xs font-bold text-slate-400">
                {classes.length === 0 ? 'No classes available to load students.' : 'No students found for this month/filters.'}
              </p>
            </div>
          ) : (
            paginatedStudents.map((student: any, index: number) => {
              const studentKey = student.id || student.studentId || student._seqKey;
              const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
              const record: StudentFeeRecord = feeMap[studentKey] || {
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
                  key={studentKey || globalIndex}
                  className={`group relative overflow-hidden rounded-2xl p-[2px] transition-all duration-300 ${
                    isPaid
                      ? 'border-2 border-slate-300 dark:border-slate-800 shadow-sm'
                      : isPartial
                      ? 'border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                      : 'border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)]'
                  }`}
                >
                  <div className="relative bg-white dark:bg-[#0a1020] p-4 rounded-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 backdrop-blur-md">
                    
                    {/* Left: Student Profile */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={student.avatar || student.image || 'https://via.placeholder.com/150'}
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
                            {student.name}
                          </h4>

                          {isFirstAdmissionMonth && joiningDateDisplay && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/40 text-orange-600 dark:text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)] animate-pulse">
                              <Sparkles className="h-3 w-3 text-orange-500" />
                              Joined: {formatDisplayDate(joiningDateDisplay)}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>{student.gender === 'Male' ? 'Male' : 'Female'} | Fee: PKR {currentClass.monthlyFee}</span>
                          
                          {isFirstAdmissionMonth && prorated && (
                            <span className="text-amber-600 dark:text-amber-400 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                              <Calculator className="h-3 w-3 text-amber-500" />
                              1st Month Dues ({prorated.daysStudied} Days @ {prorated.dailyRate}/day): PKR {prorated.proratedFee}
                            </span>
                          )}

                          {record.previousMonthDues > 0 && (
                            <span className="text-purple-600 dark:text-purple-400 font-extrabold bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                              Merged Unpaid Dues: PKR {record.previousMonthDues}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Payment Status */}
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

      {/* SELECT CLASS MODAL */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative overflow-hidden bg-white dark:bg-[#0a1020] rounded-3xl p-6 w-full max-w-md border-2 border-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.4)]">
            
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Select Class Product</h3>
                  <p className="text-[11px] font-extrabold text-slate-400">Choose class to load items ({classes.length} Available)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsClassModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
              <input
                type="text"
                placeholder="Filter products by name or code..."
                value={classSearchQuery}
                onChange={(e) => setClassSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#070d1a] border-2 border-orange-500/40 rounded-full pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-orange-500 transition-all shadow-inner"
              />
            </div>

            {/* Options List */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {filteredClassesList.map((cls) => {
                const isSelected = selectedClassId === cls.id;
                return (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/20 dark:bg-orange-500/10 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-orange-400 bg-white dark:bg-[#070d1a]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">{cls.name}</h4>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">STUDENTS: {cls.students?.length || 0} UNITS</span>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-md">
                      Rs. {cls.monthlyFee}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Confirm Button */}
            <button
              onClick={() => setIsClassModalOpen(false)}
              className="w-full mt-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black py-3 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center gap-2 text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Check className="h-4 w-4 stroke-[3]" /> OK
            </button>

          </div>
        </div>
      )}

      {/* SELECT MONTH MODAL */}
      {isMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative overflow-hidden bg-white dark:bg-[#0a1020] rounded-3xl p-6 w-full max-w-md border-2 border-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.4)]">
            
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Select Month</h3>
                  <p className="text-[11px] font-extrabold text-slate-400">Choose fee month ({monthOptions.length} Active Months)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMonthModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Month Cards Options List */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {monthOptions.map((m) => {
                const isSelected = selectedMonth === m.value;
                return (
                  <div
                    key={m.value}
                    onClick={() => setSelectedMonth(m.value)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/20 dark:bg-orange-500/10 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-orange-400 bg-white dark:bg-[#070d1a]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">🗓️ {m.label}</h4>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">DYNAMIC 2-MONTH SYSTEM RECORD</span>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-md">
                      ACTIVE
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Confirm Button */}
            <button
              onClick={() => setIsMonthModalOpen(false)}
              className="w-full mt-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black py-3 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center gap-2 text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Check className="h-4 w-4 stroke-[3]" /> OK
            </button>

          </div>
        </div>
      )}

      {/* GLOWING PAYMENT MODAL */}
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
                    <p>Daily Rate: <strong>PKR {modalProratedDetails.dailyRate}/day</strong></p>
                    <p>Classes Taken: <strong>{modalProratedDetails.daysStudied} Days</strong></p>
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

              <div className="grid grid-cols-2 gap-2 bg-slate-100/70 dark:bg-[#070d1a] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Merged Prev Dues</span>
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
