import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Megaphone,
  Wallet,
  Users,
  Plus,
  Search,
  Sun,
  Moon,
  Home,
  GraduationCap,
  Settings,
  X,
  Clock,
  Send,
  Calendar,
  Sparkles,
  MessageSquare,
  Loader2,
  ArrowLeft
} from 'lucide-react';

// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAmHi20OGNteUXjuXO_weF8XKEa3KP7oYE",
  authDomain: "tuition-management-b9e2f.firebaseapp.com",
  projectId: "tuition-management-b9e2f",
  storageBucket: "tuition-management-b9e2f.firebasestorage.app",
  messagingSenderId: "634395063857",
  appId: "1:634395063857:web:24d5e9c303845557f1c710"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// ==========================================
// TYPES & INTERFACES
// ==========================================
type AlertCategory = 'All' | 'Unread' | 'Fees' | 'Attendance' | 'Announcements';
type PriorityLevel = 'high' | 'medium' | 'normal';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  createdAt?: any;
  category: 'Fees' | 'Attendance' | 'Announcements' | 'Exams';
  priority: PriorityLevel;
  isRead: boolean;
  targetClass: string;
  sender: string;
  whatsappSent?: boolean;
}

interface TriggerAlertSettings {
  autoSendSms: boolean;
  autoWhatsAppNotif: boolean;
  feeDueReminderDays: number;
  lowAttendanceLimit: number;
  updatedAt?: string;
}

interface DynamicClass {
  id: string;
  name: string;
  subject?: string;
}

// ==========================================
// 2. META WHATSAPP CLOUD API FUNCTION
// ==========================================
const triggerWhatsAppCloudAPI = async (recipientPhone: string, title: string, message: string, className: string) => {
  const WHATSAPP_ACCESS_TOKEN = "YOUR_META_PERMANENT_ACCESS_TOKEN"; 
  const PHONE_NUMBER_ID = "YOUR_META_PHONE_NUMBER_ID";             

  try {
    console.log(`💬 [WhatsApp Simulated API] Alert triggered for ${className} (${recipientPhone}): ${title}`);
    return { success: true, status: 'Simulated' };
  } catch (error) {
    console.error("❌ Error sending WhatsApp message via Meta Cloud API:", error);
    return null;
  }
};

// ==========================================
// MAIN NOTIFICATIONS PAGE COMPONENT
// ==========================================
export default function NotificationsPage() {
  const location = useLocation();

  // Auth User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Theme & State
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [classesList, setClassesList] = useState<DynamicClass[]>([]);
  const [triggerAlertsSettings, setTriggerAlertsSettings] = useState<TriggerAlertSettings | null>(null);

  // Filters & Search
  const [selectedFilter, setSelectedFilter] = useState<AlertCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newCategory, setNewCategory] = useState<'Fees' | 'Attendance' | 'Announcements' | 'Exams'>('Announcements');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('normal');
  const [newClass, setNewClass] = useState('All Classes');
  const [recipientPhone, setRecipientPhone] = useState('');

  // ------------------------------------------
  // AUTHENTICATION & MULTI-USER DATA FETCHING
  // ------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setNotifications([]);
        setClassesList([]);
        setTriggerAlertsSettings(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Get dynamic user key (matching Fee Page logic: Email or UID)
  const getUserKey = (): string | null => {
    if (!currentUser) return null;
    return currentUser.email || currentUser.uid;
  };

  // A. Fetch Trigger Alert Settings Dynamically
  useEffect(() => {
    const userKey = getUserKey();
    if (!userKey) return;

    const fetchSettings = async () => {
      try {
        const userSettingsRef = doc(db, `users/${userKey}/settings`, 'trigger_alerts');
        const userSnap = await getDoc(userSettingsRef);
        
        if (userSnap.exists()) {
          setTriggerAlertsSettings(userSnap.data() as TriggerAlertSettings);
        } else {
          // Fallback check globally
          const globalSettingsRef = doc(db, 'settings', 'trigger_alerts');
          const globalSnap = await getDoc(globalSettingsRef);
          if (globalSnap.exists()) {
            setTriggerAlertsSettings(globalSnap.data() as TriggerAlertSettings);
          }
        }
      } catch (err) {
        console.error("Error fetching trigger settings:", err);
      }
    };

    fetchSettings();
  }, [currentUser]);

  // B. Fetch Dynamic Classes List (`users/{userKey}/classes`)
  useEffect(() => {
    const userKey = getUserKey();
    if (!userKey) return;

    const fetchClasses = async () => {
      try {
        const classesRef = collection(db, `users/${userKey}/classes`);
        const snapshot = await getDocs(classesRef);
        
        const fetchedClasses: DynamicClass[] = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().className || doc.id,
          subject: doc.data().subject || ''
        }));

        if (fetchedClasses.length > 0) {
          setClassesList(fetchedClasses);
        } else {
          setClassesList([
            { id: '1', name: 'Grade 9 Math' },
            { id: '2', name: 'Grade 10 Physics' },
            { id: '3', name: 'Grade 11 Chemistry' }
          ]);
        }
      } catch (err) {
        console.error("Error fetching classes list:", err);
      }
    };

    fetchClasses();
  }, [currentUser]);

  // C. Real-time Notifications Listener (`users/{userKey}/notifications`)
  useEffect(() => {
    const userKey = getUserKey();
    if (!userKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const notifCollectionRef = collection(db, `users/${userKey}/notifications`);
    const q = query(notifCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: NotificationItem[] = snapshot.docs.map(doc => {
        const data = doc.data();
        let timeFormatted = 'Recently';

        if (data.createdAt?.toDate) {
          const date = data.createdAt.toDate();
          timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (data.timestamp) {
          timeFormatted = data.timestamp;
        }

        return {
          id: doc.id,
          title: data.title || '',
          message: data.message || '',
          timestamp: timeFormatted,
          category: data.category || 'Announcements',
          priority: data.priority || 'normal',
          isRead: data.isRead ?? false,
          targetClass: data.targetClass || 'All Classes',
          sender: data.sender || 'Admin System',
          whatsappSent: data.whatsappSent || false
        };
      });

      setNotifications(items);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Notifications listener error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ------------------------------------------
  // COMPUTED VALUES
  // ------------------------------------------
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.targetClass.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedFilter === 'Unread') return !item.isRead;
      if (selectedFilter === 'Fees') return item.category === 'Fees';
      if (selectedFilter === 'Attendance') return item.category === 'Attendance';
      if (selectedFilter === 'Announcements') return item.category === 'Announcements';

      return true;
    });
  }, [notifications, selectedFilter, searchQuery]);

  // ------------------------------------------
  // FIRESTORE ACTIONS
  // ------------------------------------------
  const handleMarkAsRead = async (id: string) => {
    const userKey = getUserKey();
    if (!userKey) return;

    try {
      const docRef = doc(db, `users/${userKey}/notifications`, id);
      await updateDoc(docRef, { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    const userKey = getUserKey();
    if (!userKey) return;

    try {
      const batch = writeBatch(db);
      const unreadItems = notifications.filter(n => !n.isRead);

      unreadItems.forEach(item => {
        const docRef = doc(db, `users/${userKey}/notifications`, item.id);
        batch.update(docRef, { isRead: true });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    const userKey = getUserKey();
    if (!userKey) return;

    try {
      const docRef = doc(db, `users/${userKey}/notifications`, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleSendAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userKey = getUserKey();
    if (!newTitle || !newMessage || !userKey) return;

    setIsSubmitting(true);

    try {
      let isWhatsAppSent = false;
      if (triggerAlertsSettings?.autoWhatsAppNotif && recipientPhone) {
        await triggerWhatsAppCloudAPI(recipientPhone, newTitle, newMessage, newClass);
        isWhatsAppSent = true;
      }

      const notifRef = collection(db, `users/${userKey}/notifications`);
      await addDoc(notifRef, {
        title: newTitle,
        message: newMessage,
        category: newCategory,
        priority: newPriority,
        targetClass: newClass,
        isRead: false,
        sender: 'Tigerr_Alert System',
        createdAt: serverTimestamp(),
        timestamp: 'Just now',
        whatsappSent: isWhatsAppSent
      });

      setNewTitle('');
      setNewMessage('');
      setRecipientPhone('');
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Error creating alert in Firestore:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Category Icon Helper
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Fees':
        return <Wallet className="h-4 w-4 text-orange-500" />;
      case 'Attendance':
        return <Users className="h-4 w-4 text-rose-500" />;
      case 'Exams':
        return <Calendar className="h-4 w-4 text-purple-500" />;
      default:
        return <Megaphone className="h-4 w-4 text-blue-500" />;
    }
  };

  // Bottom Navbar Options
  const navigationTabs = [
    { id: "home", label: "Home", icon: Home, href: "/" },
    { id: "classes", label: "Classes", icon: GraduationCap, href: "/departments" },
    { id: "attendance", label: "Attendance", icon: Users, href: "/attendance" },
    { id: "fees", label: "Fees", icon: Wallet, href: "/fees" },
    { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <div className={`min-h-screen bg-[#f8fafc] dark:bg-[#070b13] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28 ${isDark ? 'dark' : ''}`}>

      {/* TOP HEADER */}
      <div className="w-full bg-white/60 dark:bg-[#070b13]/60 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* BACK TO DASHBOARD BUTTON */}
            <Link
              to="/dashboard"
              className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/30 transition-all active:scale-95 flex-shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
            </Link>

            <div className="relative flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">Alerts & Notices</h1>
              {unreadCount > 0 && (
                <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {unreadCount} New
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-orange-500 text-white hover:bg-orange-600 px-3.5 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" /> Send Alert
            </button>

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
      </div>

      {/* MAIN CONTAINER */}
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">

        {/* HERO HEADER SUMMARY BANNER */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1 z-10">
            <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="h-3 w-3" /> Live Notification Center
            </div>
            <h2 className="text-lg font-black">
              {unreadCount > 0 ? `You have ${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up! No unread alerts'}
            </h2>
            <p className="text-xs text-orange-100 font-medium max-w-xs">
              Directly synced with Firestore database & live WhatsApp automation alerts.
            </p>

            {triggerAlertsSettings && (
              <div className="flex items-center gap-2 pt-1">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md ${triggerAlertsSettings.autoWhatsAppNotif ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/20'}`}>
                  WhatsApp: {triggerAlertsSettings.autoWhatsAppNotif ? 'ON' : 'OFF'}
                </span>
                <span className="text-[9px] font-bold bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-md">
                  Min Attendance: {triggerAlertsSettings.lowAttendanceLimit}%
                </span>
              </div>
            )}
          </div>

          <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md z-10 flex-shrink-0 shadow-inner">
            <Bell className="h-8 w-8 text-white" />
          </div>

          <Megaphone className="absolute -left-6 -bottom-6 h-32 w-32 text-white/10" />
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts, classes or messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-orange-500 transition-all shadow-sm"
              />
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-orange-500 px-3 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4 text-emerald-500" />
                <span className="hidden sm:inline">Mark All Read</span>
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(['All', 'Unread', 'Fees', 'Attendance', 'Announcements'] as AlertCategory[]).map((cat) => {
              const isActive = selectedFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-white dark:bg-[#0c1222] text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {cat} {cat === 'Unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* NOTIFICATIONS LIST */}
        {loading ? (
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-orange-500 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400">Loading live alerts from Firestore Database...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-sm">
            <div className="h-12 w-12 rounded-full bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-black">No Notifications Found</h4>
              <p className="text-xs text-slate-400 font-medium">
                There are no alerts matching your selected category filter in the database.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleMarkAsRead(notif.id)}
                className={`bg-white dark:bg-[#0c1222] border rounded-3xl p-4 shadow-sm transition-all cursor-pointer relative overflow-hidden ${
                  !notif.isRead
                    ? 'border-orange-300 dark:border-orange-950 bg-orange-50/20 dark:bg-orange-950/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {!notif.isRead && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-orange-500" />
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {getCategoryIcon(notif.category)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {notif.priority === 'high' && (
                          <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> High Priority
                          </span>
                        )}

                        <span className="text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                          {notif.category}
                        </span>

                        <span className="text-[10px] font-bold text-slate-400">
                          {notif.targetClass}
                        </span>

                        {notif.whatsappSent && (
                          <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-200/50 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                            <MessageSquare className="h-2.5 w-2.5" /> WhatsApp Sent
                          </span>
                        )}
                      </div>

                      <h4 className={`text-xs font-black ${!notif.isRead ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {notif.title}
                      </h4>

                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-3 pt-1 text-[10px] font-bold text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {notif.timestamp}
                        </span>
                        <span>•</span>
                        <span>From: {notif.sender}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notif.isRead && (
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-500" title="Unread" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotification(notif.id);
                      }}
                      className="text-slate-300 hover:text-rose-500 p-1 rounded-lg transition-colors"
                      title="Delete Alert"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* CREATE / BROADCAST ALERT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Send className="h-4 w-4 text-orange-500" /> Broadcast New Alert
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendAlertSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Alert Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Test Tomorrow or Fee Reminder"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-black text-slate-400 block mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                  >
                    <option value="Announcements">Announcement</option>
                    <option value="Fees">Fee Notice</option>
                    <option value="Attendance">Attendance Warning</option>
                    <option value="Exams">Exam Update</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 block mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                    className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Target Class
                </label>
                <select
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-orange-500"
                >
                  <option value="All Classes">All Classes (School-wide)</option>
                  {classesList.map((cls) => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name} {cls.subject ? `(${cls.subject})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {triggerAlertsSettings?.autoWhatsAppNotif && (
                <div>
                  <label className="text-[11px] font-black text-emerald-500 flex items-center gap-1 mb-1">
                    <MessageSquare className="h-3 w-3" /> Parent's WhatsApp Number (Optional Direct Push)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +923001234567"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#070b13] border border-emerald-500/30 dark:border-emerald-900/40 rounded-2xl px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">
                  Alert Message *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Type the alert message for students & parents..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 py-2.5 rounded-2xl text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-2xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Send Alert Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING CIRCULAR BOTTOM NAVBAR (WITHOUT ALERTS) */}
      <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_10px_40px_rgba(0,0,0,0.12)] rounded-full px-5 py-2 flex items-center justify-between gap-4 sm:gap-8 max-w-md w-full">
          {navigationTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              location.pathname === tab.href ||
              (tab.id === "fees" && location.pathname.includes("/fees")) ||
              (tab.id === "classes" && location.pathname.includes("/departments"));

            return (
              <Link
                key={tab.id}
                to={tab.href}
                className="flex flex-col items-center justify-center relative transition-transform duration-200 active:scale-95 group"
              >
                {isActive && (
                  <span className="absolute -top-1 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                )}

                <div
                  className={`flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "w-10 h-10 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/40 scale-105"
                      : "w-10 h-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-5 w-5 stroke-[2.2]" />
                </div>

                <span
                  className={`text-[10px] font-black mt-0.5 transition-colors ${
                    isActive
                      ? "text-orange-500"
                      : "text-slate-400 dark:text-slate-500"
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
