import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Save, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  MessageSquareText, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { db } from "../../lib/firebase"; // Path as per your project setup
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';

export interface RatingPriority {
  level: 'Excellent' | 'Good' | 'Average' | 'Poor';
  color: string;
  bgColor: string;
  borderColor: string;
  badgeText: string;
}

export interface RemarkPreset {
  id: string;
  category: 'Homework' | 'Behavior' | 'Participation' | 'Performance' | 'Remarks';
  remarkText: string;
}

interface GradingTabProps {
  userId?: string;
}

const ALL_CATEGORIES: RemarkPreset['category'][] = [
  'Homework',
  'Behavior',
  'Participation',
  'Performance',
  'Remarks'
];

const DEFAULT_RATING_PRIORITIES: RatingPriority[] = [
  {
    level: 'Excellent',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    badgeText: 'Top Performer',
  },
  {
    level: 'Good',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    badgeText: 'Above Average',
  },
  {
    level: 'Average',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    badgeText: 'Needs Consistency',
  },
  {
    level: 'Poor',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500/10 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
    badgeText: 'Requires Attention',
  },
];

// Helper function to get category unique glow styling
const getCategoryStyles = (category: RemarkPreset['category']) => {
  switch (category) {
    case 'Homework':
      return {
        badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800',
        card: 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-900/50 shadow-[0_0_12px_rgba(99,102,241,0.08)]'
      };
    case 'Behavior':
      return {
        badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
        card: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
      };
    case 'Participation':
      return {
        badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
        card: 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50 shadow-[0_0_12px_rgba(245,158,11,0.08)]'
      };
    case 'Performance':
      return {
        badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
        card: 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/50 shadow-[0_0_12px_rgba(244,63,94,0.08)]'
      };
    case 'Remarks':
      return {
        badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
        card: 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-900/50 shadow-[0_0_12px_rgba(168,85,247,0.08)]'
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-600 border border-slate-200',
        card: 'bg-white border-slate-200'
      };
  }
};

export default function GradingTab({ userId = "X1Q76ib1XXPWcPp3FSQPLLaTzL83" }: GradingTabProps) {
  // States
  const [ratingPriorities] = useState<RatingPriority[]>(DEFAULT_RATING_PRIORITIES);
  const [remarksMap, setRemarksMap] = useState<Record<string, RemarkPreset[]>>({
    Excellent: [],
    Good: [],
    Average: [],
    Poor: [],
  });

  // Modal & Loading States
  const [activeModalLevel, setActiveModalLevel] = useState<RatingPriority['level'] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string>('');

  // Delete Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Preset Form States
  const [newCategory, setNewCategory] = useState<RemarkPreset['category']>('Homework');
  const [newRemarkText, setNewRemarkText] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Calculate available categories dynamically for current modal level
  const availableCategories = useMemo(() => {
    if (!activeModalLevel) return ALL_CATEGORIES;
    const currentPresets = remarksMap[activeModalLevel] || [];
    
    return ALL_CATEGORIES.filter(cat => {
      // If editing, keep the category of the item currently being edited visible in dropdown
      if (editingId) {
        const editingPreset = currentPresets.find(p => p.id === editingId);
        if (editingPreset && editingPreset.category === cat) return true;
      }
      return !currentPresets.some(p => p.category === cat);
    });
  }, [activeModalLevel, remarksMap, editingId]);

  // Keep dropdown selected state synced whenever available categories update
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(newCategory)) {
      setNewCategory(availableCategories[0]);
    }
  }, [availableCategories, newCategory]);

  // Load Saved Data from Firestore on Mount
  useEffect(() => {
    const fetchGradingRules = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const docRef = doc(db, 'users', userId, 'settings', 'grading_rules');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.remarksMap) setRemarksMap(data.remarksMap);
        }
      } catch (error) {
        console.error('Error fetching grading rules:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGradingRules();
  }, [userId]);

  // Add or Edit Preset Remark
  const handleSaveRemarkPreset = () => {
    if (!activeModalLevel || !newRemarkText.trim() || availableCategories.length === 0 && !editingId) return;

    const currentList = remarksMap[activeModalLevel] || [];

    if (editingId) {
      const updatedList = currentList.map(item => 
        item.id === editingId 
          ? { ...item, category: newCategory, remarkText: newRemarkText.trim() } 
          : item
      );
      setRemarksMap({ ...remarksMap, [activeModalLevel]: updatedList });
    } else {
      const newPreset: RemarkPreset = {
        id: Date.now().toString(),
        category: newCategory,
        remarkText: newRemarkText.trim(),
      };
      setRemarksMap({ ...remarksMap, [activeModalLevel]: [...currentList, newPreset] });
    }

    setNewRemarkText('');
    setEditingId(null);
  };

  // Confirm and Execute Delete Preset Remark
  const confirmDeleteRemark = () => {
    if (!activeModalLevel || !deleteTargetId) return;
    const updatedList = (remarksMap[activeModalLevel] || []).filter(item => item.id !== deleteTargetId);
    setRemarksMap({ ...remarksMap, [activeModalLevel]: updatedList });
    setDeleteTargetId(null);
    
    // Glowing notification for delete
    setNotificationMsg("Preset remark deleted successfully!");
    setShowNotification(true);
  };

  // Start Edit Mode
  const handleStartEdit = (preset: RemarkPreset) => {
    setEditingId(preset.id);
    setNewCategory(preset.category);
    setNewRemarkText(preset.remarkText);
  };

  // Save ONLY remarksMap To Firestore and DELETE ratingPriorities from Database
  const handleSaveAllToFirestore = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'grading_rules');
      
      await setDoc(docRef, {
        remarksMap,
        updatedAt: new Date().toISOString(),
        ratingPriorities: deleteField() // Cleans ratingPriorities from firestore
      }, { merge: true });

      setNotificationMsg("Data saved successfully!");
      setShowNotification(true);
    } catch (error) {
      console.error('Error saving rules:', error);
      alert('Failed to save rules!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-2 sm:p-4">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Loading Grading Rules...</p>
        </div>
      ) : (
        <>
          {/* MAIN CARD CONTAINER WITH PROMINENT SOLID ORANGE BORDER & GLOW */}
          <div className="bg-white dark:bg-[#0c1222] border-2 border-orange-500 dark:border-orange-500 rounded-[30px] p-6 shadow-[0_10px_30px_rgba(249,115,22,0.18)] space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <Award className="h-6 w-6 text-orange-500" /> Performance Rating Rules
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  Click any level below to configure automated remarks for monthly reports.
                </p>
              </div>
            </div>

            {/* CLICKABLE CARDS LIST */}
            <div className="space-y-3">
              {ratingPriorities.map((item) => {
                const remarksCount = remarksMap[item.level]?.length || 0;
                return (
                  <div
                    key={item.level}
                    className={`p-4 rounded-2xl border ${item.bgColor} ${item.borderColor} transition-all duration-200 hover:scale-[1.01] flex items-center justify-between gap-4 cursor-pointer`}
                    onClick={() => {
                      setActiveModalLevel(item.level);
                      setEditingId(null);
                      setNewRemarkText('');
                    }}
                  >
                    {/* Left Details */}
                    <div className="flex items-center gap-3">
                      <div className={`text-xs font-black px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm ${item.color}`}>
                        {item.level}
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {item.badgeText}
                      </span>
                    </div>

                    {/* Right Details */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-extrabold bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                        <MessageSquareText className="w-3 h-3 text-orange-500" />
                        {remarksCount} Presets
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SAVE BUTTON */}
            <div className="pt-2">
              <button
                onClick={handleSaveAllToFirestore}
                disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 px-6 rounded-full shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>Save Grading Rules</span>
              </button>
            </div>

          </div>
        </>
      )}

      {/* ================= STATIC SOLID ORANGE GLOWING MODAL CARD ================= */}
      {activeModalLevel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          
          {/* STATIC ORANGE BORDER (NO BLINK / NO ANIMATION) */}
          <div className="relative w-full max-w-md rounded-[32px] p-[2.5px] bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.3)]">
            
            {/* INNER MODAL CARD */}
            <div className="bg-white dark:bg-[#0c1222] w-full rounded-[30px] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-black px-3.5 py-1.5 rounded-xl bg-orange-500/10 text-orange-600 border border-orange-500/20 shadow-sm">
                  {activeModalLevel} Level Remarks
                </span>
                <button
                  onClick={() => setActiveModalLevel(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Input Form Box */}
              <div className="bg-slate-50/80 dark:bg-[#070b13] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  {editingId ? 'Edit Preset Remark' : 'Add New Preset Remark'}
                </span>

                <div className="flex gap-2">
                  {/* Category Dropdown with dynamic filtering */}
                  <select
                    value={newCategory}
                    disabled={availableCategories.length === 0 && !editingId}
                    onChange={(e) => setNewCategory(e.target.value as RemarkPreset['category'])}
                    className="bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 border border-orange-500/30 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500 shadow-sm disabled:opacity-50"
                  >
                    {availableCategories.length === 0 && !editingId ? (
                      <option value="">All Added</option>
                    ) : (
                      availableCategories.map((cat) => (
                        <option key={cat} value={cat} className="bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100">
                          {cat}
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    onClick={handleSaveRemarkPreset}
                    disabled={availableCategories.length === 0 && !editingId}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs px-4 rounded-xl flex items-center gap-1.5 shrink-0 shadow-md shadow-orange-500/20 active:scale-95 transition-all ml-auto disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {editingId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingId ? 'Update' : 'Add'}</span>
                  </button>
                </div>

                {/* Textarea with fixed high-contrast text color in dark mode */}
                <textarea
                  value={newRemarkText}
                  disabled={availableCategories.length === 0 && !editingId}
                  onChange={(e) => setNewRemarkText(e.target.value)}
                  placeholder={availableCategories.length === 0 && !editingId ? "All categories have preset remarks added." : "Write preset auto-response remark here..."}
                  rows={2}
                  className="w-full bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-orange-500 font-medium shadow-inner disabled:opacity-50"
                />
              </div>

              {/* Saved Presets List with Unique Colored Glowing Cards */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                <span className="text-xs font-black text-slate-400">
                  Saved Presets ({remarksMap[activeModalLevel]?.length || 0})
                </span>
                
                {(!remarksMap[activeModalLevel] || remarksMap[activeModalLevel].length === 0) && (
                  <p className="text-xs text-slate-400 text-center py-6 italic font-medium">
                    No preset remarks saved yet.
                  </p>
                )}

                {remarksMap[activeModalLevel]?.map((preset) => {
                  const style = getCategoryStyles(preset.category);
                  return (
                    <div
                      key={preset.id}
                      className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 text-xs ${style.card}`}
                    >
                      <div className="space-y-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg ${style.badge}`}>
                          {preset.category}
                        </span>
                        <p className="text-slate-800 dark:text-slate-200 font-semibold pl-0.5">
                          {preset.remarkText}
                        </p>
                      </div>

                      {/* Green Edit & Red Delete Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* GREEN EDIT BUTTON */}
                        <button
                          onClick={() => handleStartEdit(preset)}
                          title="Edit Preset"
                          className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 transition-colors shadow-sm"
                        >
                          <Edit3 className="w-4 h-4 stroke-[2.2]" />
                        </button>

                        {/* RED DELETE BUTTON (Triggers Permission Modal) */}
                        <button
                          onClick={() => setDeleteTargetId(preset.id)}
                          title="Delete Preset"
                          className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl border border-rose-200/60 dark:border-rose-800/60 transition-colors shadow-sm"
                        >
                          <Trash2 className="w-4 h-4 stroke-[2.2]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setActiveModalLevel(null)}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-2xl text-xs transition-all active:scale-[0.99]"
              >
                Done & Close
              </button>

            </div>
          </div>

        </div>
      )}

      {/* ================= DELETE CONFIRMATION PERMISSION MODAL ================= */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-xs rounded-[28px] p-[2px] bg-gradient-to-r from-rose-500 via-red-500 to-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.35)]">
            <div className="bg-white dark:bg-[#0c1222] rounded-[26px] p-5 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  Delete Preset Remark?
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Are you sure you want to remove this preset? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDeleteTargetId(null)}
                  className="w-1/2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRemark}
                  className="w-1/2 bg-rose-500 hover:bg-rose-600 text-white font-black py-2.5 rounded-xl text-xs shadow-md shadow-rose-500/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUCCESS POPUP GLOWING NOTIFICATION ================= */}
      {showNotification && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-xs rounded-[28px] p-[2px] bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.4)]">
            <div className="bg-white dark:bg-[#0c1222] rounded-[26px] p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Success!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {notificationMsg}
                </p>
              </div>

              <button
                onClick={() => setShowNotification(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl text-xs transition-colors shadow-md shadow-orange-500/20"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
