import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  Clock,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Archive,
  RefreshCw,
  AlertCircle,
  BookOpen,
  Tag,
  Check,
  X,
  Layers,
  ListTodo,
  ExternalLink,
  Flame,
  Filter
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db, getCurrentUserIdToken } from '../lib/firebase';
import { sanitizePayload } from '../lib/sanitize';
import type {
  UserProfile,
  GoalItem,
  GoalTask,
  GoalStatus,
  ProposedGoalPlan,
  JournalInteraction,
} from '../types';

interface GoalsViewProps {
  user: UserProfile;
  onOpenEntry?: (interactionId: string) => void;
  onNavigateToJournal?: () => void;
  initialPrompt?: string;
  initialSourceEntry?: { id: string; title: string; text: string };
}

const CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  learning: { label: 'Learning', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  project: { label: 'Project', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  productivity: { label: 'Productivity', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  career: { label: 'Career', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  creativity: { label: 'Creativity', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  wellness: { label: 'Wellness', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  general: { label: 'General', bg: 'bg-stone-50', text: 'text-stone-800', border: 'border-stone-200' },
};

const STATUS_CONFIG: Record<GoalStatus, { label: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  not_started: { label: 'Not Started', badgeBg: 'bg-[#f4f1ea]', badgeText: 'text-[#8e8a82]', badgeBorder: 'border-[#e0ddd5]' },
  in_progress: { label: 'In Progress', badgeBg: 'bg-[#eef5ef]', badgeText: 'text-[#4a5d4e]', badgeBorder: 'border-[#c8ddcb]' },
  completed: { label: 'Completed', badgeBg: 'bg-[#e8f4fd]', badgeText: 'text-[#205493]', badgeBorder: 'border-[#b9dbf8]' },
  archived: { label: 'Archived', badgeBg: 'bg-[#f0eeea]', badgeText: 'text-[#a09c94]', badgeBorder: 'border-[#dedad3]' },
};

export const GoalsView: React.FC<GoalsViewProps> = ({
  user,
  onOpenEntry,
  onNavigateToJournal,
  initialPrompt,
  initialSourceEntry,
}) => {
  // Goal Collections State
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Planner Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planGoalPrompt, setPlanGoalPrompt] = useState(initialPrompt || '');
  const [selectedEntryId, setSelectedEntryId] = useState<string>(initialSourceEntry?.id || '');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [proposedPlan, setProposedPlan] = useState<ProposedGoalPlan | null>(null);
  const [isEditingProposedPlan, setIsEditingProposedPlan] = useState(false);

  // Manual Goal Creation / Edit Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<GoalItem['category']>('general');
  const [formStatus, setFormStatus] = useState<GoalStatus>('in_progress');
  const [formTimeline, setFormTimeline] = useState('');
  const [formMilestones, setFormMilestones] = useState<string[]>([]);
  const [formMilestoneInput, setFormMilestoneInput] = useState('');
  const [formTasks, setFormTasks] = useState<Array<{ id: string; title: string; priority: 'high' | 'medium' | 'low' }>>([]);
  const [formTaskInput, setFormTaskInput] = useState('');
  const [formTaskPriority, setFormTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');

  // Expanded Goals map
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});

  // Inline Add Task state per goal card
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({});
  const [newTaskPriority, setNewTaskPriority] = useState<Record<string, 'high' | 'medium' | 'low'>>({});

  // Inline editing task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');

  // Auto-trigger plan generation modal if initialPrompt or initialSourceEntry provided
  useEffect(() => {
    if (initialPrompt || initialSourceEntry) {
      setPlanGoalPrompt(initialPrompt || (initialSourceEntry ? `Goal from reflection: ${initialSourceEntry.title}` : ''));
      if (initialSourceEntry?.id) {
        setSelectedEntryId(initialSourceEntry.id);
      }
      setIsPlanModalOpen(true);
    }
  }, [initialPrompt, initialSourceEntry]);

  // Subscribe to user goals
  useEffect(() => {
    if (!user.uid) return;
    setIsLoading(true);

    const goalsRef = collection(db, 'users', user.uid, 'goals');
    const q = query(goalsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: GoalItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          // Normalize status
          let status: GoalStatus = 'not_started';
          if (data.status === 'completed') status = 'completed';
          else if (data.status === 'archived') status = 'archived';
          else if (data.status === 'in_progress' || data.status === 'active') status = 'in_progress';
          else if (data.status === 'not_started') status = 'not_started';

          items.push({
            id: d.id,
            userId: user.uid,
            title: data.title || 'Untitled Goal',
            description: data.description || '',
            category: data.category || 'general',
            status,
            milestones: Array.isArray(data.milestones) ? data.milestones : [],
            tasks: Array.isArray(data.tasks) ? data.tasks : [],
            targetDate: data.targetDate || data.timeline || '',
            timeline: data.timeline || '',
            rationale: data.rationale || data.contextReasoning || '',
            sourceInteractionId: data.sourceInteractionId,
            sourceInteractionTitle: data.sourceInteractionTitle,
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            completedAt: data.completedAt,
          });
        });

        // Sort: In Progress first, Not Started second, Completed third, Archived last
        const statusOrder: Record<GoalStatus, number> = {
          in_progress: 1,
          not_started: 2,
          completed: 3,
          archived: 4,
        };

        items.sort((a, b) => {
          const orderDiff = statusOrder[a.status] - statusOrder[b.status];
          if (orderDiff !== 0) return orderDiff;
          return b.createdAt - a.createdAt;
        });

        setGoals(items);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching goals:', err);
        setFeedbackMessage({ type: 'error', text: 'Could not load your goals from Firestore.' });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Load recent journal entries for context selection
  useEffect(() => {
    if (!user.uid) return;
    const fetchRecent = async () => {
      try {
        const ref = collection(db, 'users', user.uid, 'interactions');
        const q = query(ref, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const entries: JournalInteraction[] = [];
        snap.forEach((d) => {
          entries.push({ id: d.id, ...d.data() } as JournalInteraction);
        });
        setRecentEntries(entries.slice(0, 15));
      } catch (e) {
        console.warn('Could not load recent interactions for context selector:', e);
      }
    };
    fetchRecent();
  }, [user.uid]);

  // Calculate goal stats
  const stats = useMemo(() => {
    const totalGoals = goals.length;
    const activeGoals = goals.filter((g) => g.status === 'in_progress' || g.status === 'not_started').length;
    const completedGoals = goals.filter((g) => g.status === 'completed').length;
    const totalTasks = goals.reduce((sum, g) => sum + g.tasks.length, 0);
    const completedTasks = goals.reduce(
      (sum, g) => sum + g.tasks.filter((t) => t.completed).length,
      0
    );
    const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      totalTasks,
      completedTasks,
      overallProgress,
    };
  }, [goals]);

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      // Status Filter
      if (statusFilter === 'active') {
        if (goal.status !== 'in_progress' && goal.status !== 'not_started') return false;
      } else if (statusFilter === 'completed') {
        if (goal.status !== 'completed') return false;
      } else if (statusFilter === 'archived') {
        if (goal.status !== 'archived') return false;
      }

      // Category Filter
      if (categoryFilter !== 'all' && goal.category !== categoryFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesTitle = goal.title.toLowerCase().includes(queryLower);
        const matchesDesc = (goal.description || '').toLowerCase().includes(queryLower);
        const matchesTasks = goal.tasks.some((t) => t.title.toLowerCase().includes(queryLower));
        if (!matchesTitle && !matchesDesc && !matchesTasks) return false;
      }

      return true;
    });
  }, [goals, statusFilter, categoryFilter, searchQuery]);

  // Toggle expanded card
  const toggleExpand = (goalId: string) => {
    setExpandedGoals((prev) => ({
      ...prev,
      [goalId]: prev[goalId] === undefined ? false : !prev[goalId],
    }));
  };

  const isExpanded = (goalId: string) => {
    return expandedGoals[goalId] !== false; // Default to expanded
  };

  // ---------------- AI PLAN GENERATION ----------------

  const handleGeneratePlan = async () => {
    if (!planGoalPrompt.trim() && !selectedEntryId) {
      setFeedbackMessage({
        type: 'error',
        text: 'Please enter a goal topic or select a journal entry to anchor your plan.',
      });
      return;
    }

    setIsGeneratingPlan(true);
    setProposedPlan(null);
    setIsEditingProposedPlan(false);
    setFeedbackMessage(null);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) throw new Error('Authentication expired. Please sign in again.');

      let sourceText = '';
      let sourceTitle = '';
      if (selectedEntryId) {
        const matched = recentEntries.find((e) => e.id === selectedEntryId);
        if (matched) {
          sourceText = matched.prompt || matched.response || '';
          sourceTitle = matched.title || 'Journal Reflection';
        }
      }

      const payload = {
        goalPrompt: planGoalPrompt.trim(),
        sourceEntryId: selectedEntryId || undefined,
        sourceEntryText: sourceText || undefined,
        sourceEntryTitle: sourceTitle || undefined,
      };

      const response = await fetch('/api/goals/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate goal plan with Gemini.');
      }

      setProposedPlan(data.plan);
    } catch (err: any) {
      console.error('Error generating action plan:', err);
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to generate plan. Please try again.',
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // ---------------- HUMAN-IN-THE-LOOP APPROVAL / PERSISTENCE ----------------

  const handleAcceptPlan = async () => {
    if (!proposedPlan) return;

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) throw new Error('Authentication expired. Please sign in again.');

      const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newGoalData: GoalItem = {
        id: goalId,
        userId: user.uid,
        title: proposedPlan.title,
        description: proposedPlan.description,
        category: proposedPlan.category,
        status: 'in_progress',
        milestones: proposedPlan.milestones,
        tasks: proposedPlan.tasks.map((t, idx) => ({
          id: `task_${Date.now()}_${idx}`,
          title: t.title,
          completed: false,
          priority: t.priority,
          milestoneIndex: t.milestoneIndex,
        })),
        targetDate: proposedPlan.targetDate || proposedPlan.timeline,
        timeline: proposedPlan.timeline,
        rationale: proposedPlan.contextReasoning,
        sourceInteractionId: proposedPlan.detectedFromEntryId,
        sourceInteractionTitle: proposedPlan.detectedFromEntryTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Strict undefined stripping per Production Directives
      const sanitized = sanitizePayload(newGoalData);

      const goalDocRef = doc(db, 'users', user.uid, 'goals', goalId);
      await setDoc(goalDocRef, sanitized);

      setFeedbackMessage({
        type: 'success',
        text: `Goal "${proposedPlan.title}" created with ${proposedPlan.tasks.length} actionable tasks.`,
      });

      // Reset modal state
      setProposedPlan(null);
      setIsPlanModalOpen(false);
      setPlanGoalPrompt('');
      setSelectedEntryId('');
    } catch (err: any) {
      console.error('Error saving accepted goal:', err);
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to save goal to Firestore.',
      });
    }
  };

  const handleRejectPlan = () => {
    setProposedPlan(null);
    setIsEditingProposedPlan(false);
    setFeedbackMessage({
      type: 'success',
      text: 'Proposed plan discarded. Nothing was saved.',
    });
  };

  // ---------------- TASK & GOAL MUTATIONS ----------------

  const handleToggleTask = async (goal: GoalItem, taskId: string) => {
    const updatedTasks = goal.tasks.map((t) => {
      if (t.id === taskId) {
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? Date.now() : undefined,
        };
      }
      return t;
    });

    // Calculate progress
    const allCompleted = updatedTasks.length > 0 && updatedTasks.every((t) => t.completed);
    let nextStatus = goal.status;
    if (allCompleted && goal.status === 'in_progress') {
      nextStatus = 'completed';
    } else if (!allCompleted && goal.status === 'completed') {
      nextStatus = 'in_progress';
    }

    try {
      const goalDocRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(
        goalDocRef,
        sanitizePayload({
          ...goal,
          tasks: updatedTasks,
          status: nextStatus,
          updatedAt: Date.now(),
          completedAt: allCompleted ? Date.now() : undefined,
        }),
        { merge: true }
      );
    } catch (err) {
      console.error('Error updating task state:', err);
      setFeedbackMessage({ type: 'error', text: 'Could not update task. Please retry.' });
    }
  };

  const handleStatusChange = async (goal: GoalItem, newStatus: GoalStatus) => {
    try {
      const goalDocRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(
        goalDocRef,
        sanitizePayload({
          ...goal,
          status: newStatus,
          updatedAt: Date.now(),
          completedAt: newStatus === 'completed' ? Date.now() : undefined,
        }),
        { merge: true }
      );
    } catch (err) {
      console.error('Error updating goal status:', err);
      setFeedbackMessage({ type: 'error', text: 'Could not update goal status.' });
    }
  };

  const handleDeleteGoal = async (goalId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const goalDocRef = doc(db, 'users', user.uid, 'goals', goalId);
      await deleteDoc(goalDocRef);
      setFeedbackMessage({ type: 'success', text: `Goal "${title}" deleted.` });
    } catch (err) {
      console.error('Error deleting goal:', err);
      setFeedbackMessage({ type: 'error', text: 'Could not delete goal.' });
    }
  };

  const handleAddNewTaskToGoal = async (goal: GoalItem) => {
    const title = (newTaskTitle[goal.id] || '').trim();
    if (!title) return;

    const priority = newTaskPriority[goal.id] || 'medium';
    const newTask: GoalTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title,
      completed: false,
      priority,
      milestoneIndex: 0,
    };

    const updatedTasks = [...goal.tasks, newTask];

    try {
      const goalDocRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(
        goalDocRef,
        sanitizePayload({
          ...goal,
          tasks: updatedTasks,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );

      setNewTaskTitle((prev) => ({ ...prev, [goal.id]: '' }));
    } catch (err) {
      console.error('Error adding task:', err);
      setFeedbackMessage({ type: 'error', text: 'Failed to add task.' });
    }
  };

  const handleDeleteTaskFromGoal = async (goal: GoalItem, taskId: string) => {
    const updatedTasks = goal.tasks.filter((t) => t.id !== taskId);
    try {
      const goalDocRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(
        goalDocRef,
        sanitizePayload({
          ...goal,
          tasks: updatedTasks,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.error('Error deleting task:', err);
      setFeedbackMessage({ type: 'error', text: 'Failed to delete task.' });
    }
  };

  const handleReorderTask = async (goal: GoalItem, index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= goal.tasks.length) return;

    const updatedTasks = [...goal.tasks];
    const temp = updatedTasks[index];
    updatedTasks[index] = updatedTasks[targetIndex];
    updatedTasks[targetIndex] = temp;

    try {
      const goalDocRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(
        goalDocRef,
        sanitizePayload({
          ...goal,
          tasks: updatedTasks,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.error('Error reordering task:', err);
    }
  };

  const handleSaveInlineTaskEdit = async (goal: GoalItem, taskId: string) => {
    const trimmed = editingTaskTitle.trim();
    if (!trimmed) {
      setEditingTaskId(null);
      return;
    }

    const updatedTasks = goal.tasks.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t));

    try {
      const goalDocRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(
        goalDocRef,
        sanitizePayload({
          ...goal,
          tasks: updatedTasks,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
      setEditingTaskId(null);
    } catch (err) {
      console.error('Error updating task title:', err);
    }
  };

  // ---------------- MANUAL GOAL FORM HANDLERS ----------------

  const handleOpenManualGoal = (goalToEdit?: GoalItem) => {
    if (goalToEdit) {
      setEditingGoal(goalToEdit);
      setFormTitle(goalToEdit.title);
      setFormDescription(goalToEdit.description || '');
      setFormCategory(goalToEdit.category);
      setFormStatus(goalToEdit.status);
      setFormTimeline(goalToEdit.timeline || goalToEdit.targetDate || '');
      setFormMilestones(goalToEdit.milestones || []);
      setFormTasks(
        goalToEdit.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority || 'medium',
        }))
      );
    } else {
      setEditingGoal(null);
      setFormTitle('');
      setFormDescription('');
      setFormCategory('general');
      setFormStatus('in_progress');
      setFormTimeline('4 Weeks');
      setFormMilestones(['Phase 1: Foundation', 'Phase 2: Execution', 'Phase 3: Completion']);
      setFormTasks([]);
    }
    setFormMilestoneInput('');
    setFormTaskInput('');
    setIsManualModalOpen(true);
  };

  const handleSaveManualGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Please provide a goal title.' });
      return;
    }

    try {
      const goalId = editingGoal ? editingGoal.id : `goal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const goalData: GoalItem = {
        id: goalId,
        userId: user.uid,
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        status: formStatus,
        milestones: formMilestones.filter((m) => m.trim()),
        tasks: formTasks.map((t) => {
          const existing = editingGoal?.tasks.find((et) => et.id === t.id);
          return {
            id: t.id,
            title: t.title,
            completed: existing ? existing.completed : false,
            priority: t.priority,
            completedAt: existing?.completedAt,
          };
        }),
        timeline: formTimeline.trim(),
        targetDate: formTimeline.trim(),
        sourceInteractionId: editingGoal?.sourceInteractionId,
        sourceInteractionTitle: editingGoal?.sourceInteractionTitle,
        createdAt: editingGoal ? editingGoal.createdAt : Date.now(),
        updatedAt: Date.now(),
      };

      const docRef = doc(db, 'users', user.uid, 'goals', goalId);
      await setDoc(docRef, sanitizePayload(goalData));

      setFeedbackMessage({
        type: 'success',
        text: editingGoal ? `Goal "${formTitle}" updated.` : `New goal "${formTitle}" created.`,
      });

      setIsManualModalOpen(false);
    } catch (err: any) {
      console.error('Error saving manual goal:', err);
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to save goal.' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div
          className={`mb-6 p-4 rounded border flex items-center justify-between text-xs transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-[#eef5ef] border-[#c8ddcb] text-[#2c5332]'
              : 'bg-[#fdf3f2] border-[#f5c6cb] text-[#9b2c2c]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-[#8e8a82] hover:text-[#1a1a1a]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-[#e0ddd5] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-2xl sm:text-3xl text-[#1a1a1a]">
              AI Goal & Action Planner
            </span>
            <span className="text-[10px] uppercase tracking-[1.5px] px-2 py-0.5 bg-[#eef5ef] text-[#4a5d4e] border border-[#c8ddcb] rounded font-semibold">
              Gemini Powered
            </span>
          </div>
          <p className="text-xs text-[#8e8a82] mt-1">
            Turn authentic journal reflections into structured milestones, concrete tasks, and measurable progress.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-open-manual-goal"
            type="button"
            onClick={() => handleOpenManualGoal()}
            className="px-4 py-2 text-xs font-medium text-[#1a1a1a] bg-white border border-[#e0ddd5] rounded hover:border-[#1a1a1a] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Goal</span>
          </button>

          <button
            id="btn-open-ai-planner"
            type="button"
            onClick={() => {
              setProposedPlan(null);
              setIsPlanModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-[#4a5d4e] hover:bg-[#3d4d40] rounded transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>Generate Action Plan</span>
          </button>
        </div>
      </div>

      {/* Metrics / Statistics Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
        <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-sm">
          <p className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82]">Active Goals</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-2xl text-[#1a1a1a]">{stats.activeGoals}</span>
            <span className="text-xs text-[#8e8a82]">/ {stats.totalGoals} total</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-sm">
          <p className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82]">Completed Goals</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-2xl text-[#205493]">{stats.completedGoals}</span>
            <span className="text-xs text-[#8e8a82]">achieved</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-sm">
          <p className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82]">Tasks Completed</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-2xl text-[#4a5d4e]">{stats.completedTasks}</span>
            <span className="text-xs text-[#8e8a82]">/ {stats.totalTasks} tasks</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-sm">
          <p className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82]">Overall Execution</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-serif text-2xl text-[#1a1a1a]">{stats.overallProgress}%</span>
            <div className="flex-1 bg-[#f0eeea] h-2 rounded-full overflow-hidden border border-[#e0ddd5]">
              <div
                className="bg-[#4a5d4e] h-full transition-all duration-500"
                style={{ width: `${stats.overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#f8f6f0] border border-[#e0ddd5] rounded mb-6">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'completed', 'archived'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs uppercase tracking-[1px] rounded transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#4a5d4e] text-white font-medium shadow-sm'
                  : 'bg-white text-[#8e8a82] hover:text-[#1a1a1a] border border-[#e0ddd5]'
              }`}
            >
              {st === 'all'
                ? `All (${goals.length})`
                : st === 'active'
                ? `Active (${stats.activeGoals})`
                : st === 'completed'
                ? `Completed (${stats.completedGoals})`
                : `Archived (${goals.filter((g) => g.status === 'archived').length})`}
            </button>
          ))}
        </div>

        {/* Category & Search Input */}
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="learning">Learning</option>
            <option value="project">Project</option>
            <option value="productivity">Productivity</option>
            <option value="career">Career</option>
            <option value="creativity">Creativity</option>
            <option value="wellness">Wellness</option>
            <option value="general">General</option>
          </select>

          <input
            type="text"
            placeholder="Search goals or tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] placeholder-[#8e8a82] outline-none w-44 sm:w-56"
          />
        </div>
      </div>

      {/* Goals List Content */}
      {isLoading ? (
        <div className="py-16 text-center text-[#8e8a82]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#4a5d4e]" />
          <p className="text-xs uppercase tracking-[1.5px]">Loading Private Goals...</p>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="py-16 px-6 text-center bg-white border border-dashed border-[#e0ddd5] rounded-lg">
          <Target className="w-10 h-10 mx-auto text-[#8e8a82] mb-3 opacity-60" />
          <h3 className="font-serif italic text-lg text-[#1a1a1a] mb-1">
            {goals.length === 0 ? 'No goals defined yet' : 'No matching goals found'}
          </h3>
          <p className="text-xs text-[#8e8a82] max-w-md mx-auto mb-6">
            {goals.length === 0
              ? 'Synthesize goals automatically from your reflections or create your own structured roadmap.'
              : 'Try changing your filter or search query to find other objectives.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setProposedPlan(null);
                setIsPlanModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-[#4a5d4e] hover:bg-[#3d4d40] rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>Generate Action Plan with Gemini</span>
            </button>
            <button
              onClick={() => handleOpenManualGoal()}
              className="px-4 py-2 text-xs font-medium text-[#1a1a1a] bg-white border border-[#e0ddd5] rounded hover:border-[#1a1a1a] transition-colors cursor-pointer"
            >
              <span>Create Manual Goal</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGoals.map((goal) => {
            const completedCount = goal.tasks.filter((t) => t.completed).length;
            const totalCount = goal.tasks.length;
            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const catStyle = CATEGORY_STYLES[goal.category] || CATEGORY_STYLES.general;
            const statusConf = STATUS_CONFIG[goal.status];
            const expanded = isExpanded(goal.id);

            return (
              <div
                key={goal.id}
                id={`goal-card-${goal.id}`}
                className={`bg-white border rounded-lg overflow-hidden transition-all shadow-sm ${
                  goal.status === 'completed'
                    ? 'border-[#b9dbf8] bg-[#fdfefe]'
                    : goal.status === 'archived'
                    ? 'border-[#e0ddd5] opacity-75'
                    : 'border-[#e0ddd5]'
                }`}
              >
                {/* Goal Card Header */}
                <div className="p-5 sm:p-6 border-b border-[#f0eeea]">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {/* Category Tag */}
                        <span
                          className={`text-[10px] uppercase tracking-[1.5px] px-2 py-0.5 rounded border font-semibold ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {catStyle.label}
                        </span>

                        {/* Status Dropdown */}
                        <select
                          value={goal.status}
                          onChange={(e) => handleStatusChange(goal, e.target.value as GoalStatus)}
                          className={`text-[11px] px-2 py-0.5 rounded border font-medium outline-none cursor-pointer ${statusConf.badgeBg} ${statusConf.badgeText} ${statusConf.badgeBorder}`}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </select>

                        {/* Timeline / Target Date */}
                        {goal.targetDate && (
                          <span className="text-[11px] text-[#8e8a82] flex items-center gap-1 ml-1">
                            <Clock className="w-3 h-3" />
                            <span>{goal.targetDate}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="font-serif text-xl sm:text-2xl text-[#1a1a1a] font-normal leading-tight">
                        {goal.title}
                      </h3>

                      {goal.description && (
                        <p className="text-xs text-[#5c5850] mt-1.5 leading-relaxed max-w-3xl">
                          {goal.description}
                        </p>
                      )}

                      {/* Source Interaction Anchor */}
                      {goal.sourceInteractionTitle && onOpenEntry && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#4a5d4e]">
                          <BookOpen className="w-3 h-3" />
                          <span>Grounded in reflection:</span>
                          <button
                            onClick={() => goal.sourceInteractionId && onOpenEntry(goal.sourceInteractionId)}
                            className="font-serif italic underline hover:text-[#1a1a1a] cursor-pointer"
                          >
                            "{goal.sourceInteractionTitle}"
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick Card Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-start">
                      <button
                        title="Edit Goal Details"
                        onClick={() => handleOpenManualGoal(goal)}
                        className="p-1.5 text-[#8e8a82] hover:text-[#1a1a1a] border border-transparent hover:border-[#e0ddd5] rounded transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Delete Goal"
                        onClick={() => handleDeleteGoal(goal.id, goal.title)}
                        className="p-1.5 text-[#8e8a82] hover:text-[#c44536] border border-transparent hover:border-[#e0ddd5] rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => toggleExpand(goal.id)}
                        className="p-1.5 text-[#8e8a82] hover:text-[#1a1a1a] border border-[#e0ddd5] rounded transition-colors cursor-pointer flex items-center gap-1 text-xs"
                      >
                        {expanded ? (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Collapse</span>
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Expand</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Progress Indicator Bar */}
                  <div className="mt-4 pt-3 border-t border-[#f8f6f0]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-serif italic text-[#8e8a82]">
                        {completedCount} of {totalCount} tasks complete
                      </span>
                      <span className="font-medium text-[#1a1a1a]">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-[#f0eeea] h-2 rounded-full overflow-hidden border border-[#e0ddd5]">
                      <div
                        className={`h-full transition-all duration-300 ${
                          progressPercent === 100 ? 'bg-[#205493]' : 'bg-[#4a5d4e]'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Collapsible Section: Milestones & Tasks */}
                {expanded && (
                  <div className="p-5 sm:p-6 bg-[#faf9f5]">
                    {/* Milestones Stepper */}
                    {goal.milestones && goal.milestones.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="w-3.5 h-3.5 text-[#4a5d4e]" />
                          <h4 className="text-[11px] uppercase tracking-[1.5px] font-semibold text-[#1a1a1a]">
                            Milestones & Progression
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {goal.milestones.map((milestone, mIdx) => (
                            <div
                              key={mIdx}
                              className="p-3 bg-white border border-[#e0ddd5] rounded shadow-xs flex items-start gap-2.5"
                            >
                              <div className="w-5 h-5 rounded-full bg-[#eef5ef] text-[#4a5d4e] border border-[#c8ddcb] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                {mIdx + 1}
                              </div>
                              <p className="text-xs text-[#1a1a1a] leading-snug">{milestone}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tasks Checklist */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ListTodo className="w-3.5 h-3.5 text-[#4a5d4e]" />
                          <h4 className="text-[11px] uppercase tracking-[1.5px] font-semibold text-[#1a1a1a]">
                            Actionable Tasks
                          </h4>
                        </div>
                      </div>

                      {/* Task Items List */}
                      <div className="space-y-2 mb-4">
                        {goal.tasks.length === 0 ? (
                          <p className="text-xs text-[#8e8a82] italic py-2">
                            No tasks added yet. Add your first actionable task below.
                          </p>
                        ) : (
                          goal.tasks.map((task, idx) => {
                            const isEditing = editingTaskId === task.id;

                            return (
                              <div
                                key={task.id}
                                className={`p-3 rounded border flex items-center justify-between gap-3 transition-colors ${
                                  task.completed
                                    ? 'bg-[#f4f7f4] border-[#d8e6d9] text-[#7a8a7c]'
                                    : 'bg-white border-[#e0ddd5] text-[#1a1a1a]'
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Task Checkbox */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTask(goal, task.id)}
                                    className="cursor-pointer shrink-0 text-[#4a5d4e] hover:opacity-80 transition-opacity"
                                  >
                                    {task.completed ? (
                                      <CheckCircle2 className="w-4 h-4 text-[#4a5d4e]" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-[#8e8a82]" />
                                    )}
                                  </button>

                                  {/* Title / Inline Edit */}
                                  {isEditing ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <input
                                        type="text"
                                        value={editingTaskTitle}
                                        onChange={(e) => setEditingTaskTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveInlineTaskEdit(goal, task.id);
                                          if (e.key === 'Escape') setEditingTaskId(null);
                                        }}
                                        autoFocus
                                        className="flex-1 text-xs px-2 py-1 bg-white border border-[#4a5d4e] rounded outline-none text-[#1a1a1a]"
                                      />
                                      <button
                                        onClick={() => handleSaveInlineTaskEdit(goal, task.id)}
                                        className="text-xs px-2 py-1 bg-[#4a5d4e] text-white rounded cursor-pointer"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingTaskId(null)}
                                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditingTaskId(task.id);
                                        setEditingTaskTitle(task.title);
                                      }}
                                      title="Click to edit task title"
                                      className={`text-xs leading-snug cursor-pointer flex-1 truncate ${
                                        task.completed ? 'line-through text-[#7a8a7c]' : 'text-[#1a1a1a]'
                                      }`}
                                    >
                                      {task.title}
                                    </span>
                                  )}
                                </div>

                                {/* Task Controls & Priority Tag */}
                                {!isEditing && (
                                  <div className="flex items-center gap-2 shrink-0">
                                    {task.priority && (
                                      <span
                                        className={`text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded border font-semibold ${
                                          task.priority === 'high'
                                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                                            : task.priority === 'low'
                                            ? 'bg-slate-50 text-slate-800 border-slate-200'
                                            : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}
                                      >
                                        {task.priority}
                                      </span>
                                    )}

                                    {/* Reorder Buttons */}
                                    <button
                                      title="Move Up"
                                      disabled={idx === 0}
                                      onClick={() => handleReorderTask(goal, idx, 'up')}
                                      className="text-[#8e8a82] hover:text-[#1a1a1a] disabled:opacity-30 cursor-pointer p-0.5"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      title="Move Down"
                                      disabled={idx === goal.tasks.length - 1}
                                      onClick={() => handleReorderTask(goal, idx, 'down')}
                                      className="text-[#8e8a82] hover:text-[#1a1a1a] disabled:opacity-30 cursor-pointer p-0.5"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>

                                    {/* Delete Task */}
                                    <button
                                      title="Delete Task"
                                      onClick={() => handleDeleteTaskFromGoal(goal, task.id)}
                                      className="text-[#8e8a82] hover:text-[#c44536] cursor-pointer p-0.5 ml-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add New Task Form */}
                      <div className="flex items-center gap-2 p-2 bg-white border border-[#e0ddd5] rounded">
                        <input
                          type="text"
                          placeholder="Add new task..."
                          value={newTaskTitle[goal.id] || ''}
                          onChange={(e) =>
                            setNewTaskTitle((prev) => ({ ...prev, [goal.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddNewTaskToGoal(goal);
                          }}
                          className="flex-1 text-xs px-2 py-1 outline-none placeholder-[#8e8a82] text-[#1a1a1a]"
                        />

                        <select
                          value={newTaskPriority[goal.id] || 'medium'}
                          onChange={(e) =>
                            setNewTaskPriority((prev) => ({
                              ...prev,
                              [goal.id]: e.target.value as 'high' | 'medium' | 'low',
                            }))
                          }
                          className="text-[11px] px-2 py-1 bg-[#f8f6f0] border border-[#e0ddd5] rounded text-[#8e8a82] outline-none cursor-pointer"
                        >
                          <option value="high">High Priority</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low Priority</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleAddNewTaskToGoal(goal)}
                          className="px-3 py-1 bg-[#4a5d4e] text-white text-xs rounded hover:bg-[#3d4d40] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- AI PLAN GENERATOR MODAL ---------------- */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfbf7] border border-[#e0ddd5] rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#e0ddd5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#4a5d4e]" />
                <h3 className="font-serif text-xl text-[#1a1a1a]">AI Goal & Action Planner</h3>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="text-[#8e8a82] hover:text-[#1a1a1a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {!proposedPlan ? (
                <>
                  <div>
                    <label className="block text-xs uppercase tracking-[1.5px] font-semibold text-[#1a1a1a] mb-2">
                      What aspiration or topic would you like to plan?
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g., 'I want to improve my machine learning skills and deploy a model', 'Establish a consistent morning mindfulness routine', or 'Build and release an open-source library'..."
                      value={planGoalPrompt}
                      onChange={(e) => setPlanGoalPrompt(e.target.value)}
                      className="w-full text-xs p-3 bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] placeholder-[#8e8a82] outline-none focus:border-[#4a5d4e] leading-relaxed"
                    />
                  </div>

                  {/* Context Anchor from Journal Entries */}
                  {recentEntries.length > 0 && (
                    <div>
                      <label className="block text-xs uppercase tracking-[1.5px] font-semibold text-[#1a1a1a] mb-2">
                        Anchor Context to a Journal Reflection (Optional)
                      </label>
                      <select
                        value={selectedEntryId}
                        onChange={(e) => setSelectedEntryId(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] outline-none cursor-pointer"
                      >
                        <option value="">-- No specific entry (Analyze all recent journal history) --</option>
                        {recentEntries.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.title} ({new Date(entry.createdAt).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="p-3 bg-[#eef5ef] border border-[#c8ddcb] rounded text-xs text-[#2c5332] flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#4a5d4e] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">Strict Human-in-the-Loop Protocol</p>
                      <p className="text-[11px] leading-relaxed text-[#3e6844]">
                        Gemini will synthesize a structured draft with milestones and tasks grounded in your journal memory. You can review, edit, or discard the proposal before anything is saved.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                /* Proposed Plan Staging Card */
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold">Proposed Plan (Pending Your Approval)</span>
                    </div>
                    <button
                      onClick={() => setIsEditingProposedPlan(!isEditingProposedPlan)}
                      className="text-[11px] text-amber-800 underline hover:text-amber-950 cursor-pointer"
                    >
                      {isEditingProposedPlan ? 'Done Editing' : 'Edit Proposal'}
                    </button>
                  </div>

                  {/* Editable or Static View */}
                  {isEditingProposedPlan ? (
                    <div className="space-y-3 bg-white p-4 border border-[#e0ddd5] rounded">
                      <div>
                        <label className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] font-semibold">
                          Goal Title
                        </label>
                        <input
                          type="text"
                          value={proposedPlan.title}
                          onChange={(e) =>
                            setProposedPlan({ ...proposedPlan, title: e.target.value })
                          }
                          className="w-full text-xs p-2 border border-[#e0ddd5] rounded outline-none mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] font-semibold">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          value={proposedPlan.description}
                          onChange={(e) =>
                            setProposedPlan({ ...proposedPlan, description: e.target.value })
                          }
                          className="w-full text-xs p-2 border border-[#e0ddd5] rounded outline-none mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] font-semibold">
                            Category
                          </label>
                          <select
                            value={proposedPlan.category}
                            onChange={(e) =>
                              setProposedPlan({
                                ...proposedPlan,
                                category: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-2 border border-[#e0ddd5] rounded outline-none mt-1"
                          >
                            <option value="learning">Learning</option>
                            <option value="project">Project</option>
                            <option value="productivity">Productivity</option>
                            <option value="career">Career</option>
                            <option value="creativity">Creativity</option>
                            <option value="wellness">Wellness</option>
                            <option value="general">General</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] font-semibold">
                            Timeline
                          </label>
                          <input
                            type="text"
                            value={proposedPlan.timeline || ''}
                            onChange={(e) =>
                              setProposedPlan({ ...proposedPlan, timeline: e.target.value })
                            }
                            className="w-full text-xs p-2 border border-[#e0ddd5] rounded outline-none mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-white border border-[#e0ddd5] rounded">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] uppercase tracking-[1px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                          {proposedPlan.category}
                        </span>
                        {proposedPlan.timeline && (
                          <span className="text-xs text-[#8e8a82] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{proposedPlan.timeline}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="font-serif text-xl text-[#1a1a1a]">{proposedPlan.title}</h4>
                      {proposedPlan.description && (
                        <p className="text-xs text-[#5c5850] mt-1">{proposedPlan.description}</p>
                      )}

                      {proposedPlan.contextReasoning && (
                        <p className="text-[11px] text-[#4a5d4e] font-serif italic mt-2.5 p-2 bg-[#eef5ef] rounded border border-[#c8ddcb]">
                          💡 Context Alignment: {proposedPlan.contextReasoning}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Proposed Milestones */}
                  <div className="p-4 bg-white border border-[#e0ddd5] rounded">
                    <h5 className="text-[10px] uppercase tracking-[1.5px] font-semibold text-[#1a1a1a] mb-2.5">
                      Structured Milestones ({proposedPlan.milestones.length})
                    </h5>
                    <div className="space-y-1.5">
                      {proposedPlan.milestones.map((milestone, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-[#1a1a1a]">
                          <span className="w-4 h-4 rounded-full bg-[#eef5ef] text-[#4a5d4e] text-[9px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span>{milestone}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Proposed Tasks */}
                  <div className="p-4 bg-white border border-[#e0ddd5] rounded">
                    <h5 className="text-[10px] uppercase tracking-[1.5px] font-semibold text-[#1a1a1a] mb-2.5">
                      Actionable Tasks ({proposedPlan.tasks.length})
                    </h5>
                    <div className="space-y-2">
                      {proposedPlan.tasks.map((task, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-[#faf9f5] border border-[#e0ddd5] rounded text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Circle className="w-3.5 h-3.5 text-[#8e8a82]" />
                            <span className="text-[#1a1a1a]">{task.title}</span>
                          </div>
                          <span
                            className={`text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded border font-semibold ${
                              task.priority === 'high'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-[#e0ddd5] bg-[#f8f6f0] flex items-center justify-between">
              {!proposedPlan ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="px-4 py-2 text-xs text-[#8e8a82] hover:text-[#1a1a1a] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePlan}
                    disabled={isGeneratingPlan}
                    className="px-5 py-2 text-xs font-medium text-white bg-[#4a5d4e] hover:bg-[#3d4d40] rounded transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isGeneratingPlan ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Synthesizing Plan...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        <span>Generate Action Plan</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* Human In The Loop: Accept / Edit / Reject buttons */
                <>
                  <button
                    type="button"
                    onClick={handleRejectPlan}
                    className="px-4 py-2 text-xs font-medium text-[#c44536] hover:bg-[#fdf3f2] border border-[#f5c6cb] rounded transition-colors cursor-pointer"
                  >
                    Discard / Reject
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProposedPlan(!isEditingProposedPlan)}
                      className="px-4 py-2 text-xs text-[#1a1a1a] bg-white border border-[#e0ddd5] rounded hover:border-[#1a1a1a] transition-colors cursor-pointer"
                    >
                      {isEditingProposedPlan ? 'View Preview' : 'Edit Plan'}
                    </button>

                    <button
                      type="button"
                      onClick={handleAcceptPlan}
                      className="px-5 py-2 text-xs font-medium text-white bg-[#4a5d4e] hover:bg-[#3d4d40] rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Plan & Save</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MANUAL GOAL CREATION / EDIT MODAL ---------------- */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfbf7] border border-[#e0ddd5] rounded-lg max-w-xl w-full max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-5 border-b border-[#e0ddd5] flex items-center justify-between">
              <h3 className="font-serif text-xl text-[#1a1a1a]">
                {editingGoal ? 'Edit Goal' : 'Create Manual Goal'}
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-[#8e8a82] hover:text-[#1a1a1a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualGoal} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-[1px] font-semibold text-[#1a1a1a] mb-1">
                  Goal Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Master Machine Learning Foundations"
                  className="w-full text-xs p-2.5 bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] outline-none focus:border-[#4a5d4e]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[1px] font-semibold text-[#1a1a1a] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What is the definition of success for this goal?"
                  className="w-full text-xs p-2.5 bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] outline-none focus:border-[#4a5d4e]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-[1px] font-semibold text-[#1a1a1a] mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full text-xs p-2 bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] outline-none cursor-pointer"
                  >
                    <option value="learning">Learning</option>
                    <option value="project">Project</option>
                    <option value="productivity">Productivity</option>
                    <option value="career">Career</option>
                    <option value="creativity">Creativity</option>
                    <option value="wellness">Wellness</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[1px] font-semibold text-[#1a1a1a] mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as GoalStatus)}
                    className="w-full text-xs p-2 bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] outline-none cursor-pointer"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[1px] font-semibold text-[#1a1a1a] mb-1">
                    Timeline
                  </label>
                  <input
                    type="text"
                    value={formTimeline}
                    onChange={(e) => setFormTimeline(e.target.value)}
                    placeholder="e.g. 4 Weeks"
                    className="w-full text-xs p-2 bg-white border border-[#e0ddd5] rounded text-[#1a1a1a] outline-none"
                  />
                </div>
              </div>

              {/* Milestones in Manual Form */}
              <div>
                <label className="block text-xs uppercase tracking-[1px] font-semibold text-[#1a1a1a] mb-1">
                  Milestones
                </label>
                <div className="space-y-1.5 mb-2">
                  {formMilestones.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white border border-[#e0ddd5] rounded text-xs">
                      <span>{idx + 1}. {m}</span>
                      <button
                        type="button"
                        onClick={() => setFormMilestones(formMilestones.filter((_, i) => i !== idx))}
                        className="text-[#8e8a82] hover:text-[#c44536] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add milestone step..."
                    value={formMilestoneInput}
                    onChange={(e) => setFormMilestoneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (formMilestoneInput.trim()) {
                          setFormMilestones([...formMilestones, formMilestoneInput.trim()]);
                          setFormMilestoneInput('');
                        }
                      }
                    }}
                    className="flex-1 text-xs p-2 bg-white border border-[#e0ddd5] rounded outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (formMilestoneInput.trim()) {
                        setFormMilestones([...formMilestones, formMilestoneInput.trim()]);
                        setFormMilestoneInput('');
                      }
                    }}
                    className="px-3 py-2 text-xs bg-[#4a5d4e] text-white rounded cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Tasks in Manual Form */}
              <div>
                <label className="block text-xs uppercase tracking-[1px] font-semibold text-[#1a1a1a] mb-1">
                  Initial Tasks
                </label>
                <div className="space-y-1.5 mb-2">
                  {formTasks.map((t, idx) => (
                    <div key={t.id} className="flex items-center justify-between p-2 bg-white border border-[#e0ddd5] rounded text-xs">
                      <span>• {t.title} ({t.priority})</span>
                      <button
                        type="button"
                        onClick={() => setFormTasks(formTasks.filter((_, i) => i !== idx))}
                        className="text-[#8e8a82] hover:text-[#c44536] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add task title..."
                    value={formTaskInput}
                    onChange={(e) => setFormTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (formTaskInput.trim()) {
                          setFormTasks([
                            ...formTasks,
                            {
                              id: `task_${Date.now()}_${formTasks.length}`,
                              title: formTaskInput.trim(),
                              priority: formTaskPriority,
                            },
                          ]);
                          setFormTaskInput('');
                        }
                      }
                    }}
                    className="flex-1 text-xs p-2 bg-white border border-[#e0ddd5] rounded outline-none"
                  />
                  <select
                    value={formTaskPriority}
                    onChange={(e) => setFormTaskPriority(e.target.value as any)}
                    className="text-xs p-2 bg-white border border-[#e0ddd5] rounded text-[#8e8a82] outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (formTaskInput.trim()) {
                        setFormTasks([
                          ...formTasks,
                          {
                            id: `task_${Date.now()}_${formTasks.length}`,
                            title: formTaskInput.trim(),
                            priority: formTaskPriority,
                          },
                        ]);
                        setFormTaskInput('');
                      }
                    }}
                    className="px-3 py-2 text-xs bg-[#4a5d4e] text-white rounded cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#e0ddd5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#8e8a82] hover:text-[#1a1a1a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-[#4a5d4e] hover:bg-[#3d4d40] rounded transition-colors cursor-pointer shadow-sm"
                >
                  {editingGoal ? 'Update Goal' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
