import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  Sparkles,
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  ArrowUpRight,
  Flame,
  Target,
  BookOpen,
  RefreshCw,
  Clock,
  Compass,
  FileText,
  Lightbulb,
  CheckSquare,
  AlertCircle,
  ChevronRight,
  Trash2,
  BarChart2,
  PieChart as PieIcon,
  Tag,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
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
import { db, auth } from '../lib/firebase';
import { sanitizePayload } from '../lib/sanitize';
import type {
  UserProfile,
  JournalInteraction,
  JournalStats,
  GoalItem,
  GoalTask,
  GrowthTheme,
  ProgressTrend,
  GrowthAchievement,
  WeeklyReview,
  UserMemory,
} from '../types';

interface GrowthDashboardViewProps {
  user: UserProfile;
  onOpenEntry: (interactionId: string) => void;
  onCreateNewEntry: () => void;
  onNavigateToGoals?: (prompt?: string, sourceEntry?: { id: string; title: string; text: string }) => void;
}

// Category badges styling
const GOAL_CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  learning: { label: 'Learning', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  project: { label: 'Project', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  productivity: { label: 'Productivity', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  career: { label: 'Career', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  creativity: { label: 'Creativity', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  wellness: { label: 'Wellness', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  general: { label: 'General', bg: 'bg-stone-50', text: 'text-stone-800', border: 'border-stone-200' },
};

const MODE_COLORS: Record<string, string> = {
  reflection: '#4a5d4e',
  summary: '#5c6b73',
  brainstorm: '#9c6644',
  actionable: '#2b9348',
};

export const GrowthDashboardView: React.FC<GrowthDashboardViewProps> = ({
  user,
  onOpenEntry,
  onCreateNewEntry,
  onNavigateToGoals,
}) => {
  // Database States
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // AI Insights State
  const [themes, setThemes] = useState<GrowthTheme[]>([]);
  const [trends, setTrends] = useState<ProgressTrend[]>([]);
  const [achievements, setAchievements] = useState<GrowthAchievement[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);

  // Weekly Review State
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0); // 0 = current week, 1 = 1 week ago, etc.
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Goal Form State
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<GoalItem['category']>('learning');
  const [newGoalTasksInput, setNewGoalTasksInput] = useState('');
  const [goalFormError, setGoalFormError] = useState<string | null>(null);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [goalFilter, setGoalFilter] = useState<'all' | 'active' | 'completed'>('active');

  // 1. Subscribe to User's Interactions
  useEffect(() => {
    if (!user.uid) return;
    const ref = collection(db, 'users', user.uid, 'interactions');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: JournalInteraction[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...d.data() } as JournalInteraction));
        setInteractions(items);
        setIsLoadingData(false);
      },
      (err) => {
        console.error('Error loading interactions for dashboard:', err);
        setIsLoadingData(false);
      }
    );
    return () => unsub();
  }, [user.uid]);

  // 2. Subscribe to User's Goals
  useEffect(() => {
    if (!user.uid) return;
    const ref = collection(db, 'users', user.uid, 'goals');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: GoalItem[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...d.data() } as GoalItem));
        setGoals(items);
      },
      (err) => console.error('Error loading goals:', err)
    );
    return () => unsub();
  }, [user.uid]);

  // 3. Subscribe to User's Memories (for goal recommendations)
  useEffect(() => {
    if (!user.uid) return;
    const ref = collection(db, 'users', user.uid, 'memories');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: UserMemory[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...d.data() } as UserMemory));
        setMemories(items);
      },
      (err) => console.error('Error loading memories:', err)
    );
    return () => unsub();
  }, [user.uid]);

  // 4. Calculate Key Journal Statistics
  const stats: JournalStats = useMemo(() => {
    const totalEntries = interactions.length;
    const activeGoals = goals.filter((g) => g.status === 'active').length;
    const completedGoals = goals.filter((g) => g.status === 'completed').length;
    const completedTasks = goals.reduce(
      (acc, g) => acc + (Array.isArray(g.tasks) ? g.tasks.filter((t) => t.completed).length : 0),
      0
    );

    // Current Streak Calculation
    let currentStreak = 0;
    if (totalEntries > 0) {
      const dates = new Set(
        interactions.map((i) => {
          const d = new Date(i.createdAt);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
      );

      const today = new Date();
      const formatDate = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const todayStr = formatDate(today);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);

      // Check if user journaled today or yesterday to continue streak
      let checkDate = dates.has(todayStr) ? new Date(today) : dates.has(yesterdayStr) ? yesterday : null;

      if (checkDate) {
        while (dates.has(formatDate(checkDate))) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    // Entries This Week (Monday 00:00 to now)
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0).getTime();
    const entriesThisWeek = interactions.filter((i) => i.createdAt >= startOfWeek).length;

    // Entries This Month (1st 00:00 to now)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
    const entriesThisMonth = interactions.filter((i) => i.createdAt >= startOfMonth).length;

    return {
      totalEntries,
      activeGoals,
      completedGoals,
      completedTasks,
      currentStreak,
      entriesThisWeek,
      entriesThisMonth,
    };
  }, [interactions, goals]);

  // 5. Compute Chart Data (Last 14 Days Activity)
  const activityChartData = useMemo(() => {
    const days: { date: string; entries: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

      const count = interactions.filter((entry) => entry.createdAt >= dayStart && entry.createdAt <= dayEnd).length;
      days.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        entries: count,
      });
    }
    return days;
  }, [interactions]);

  // 6. Compute Mode Breakdown
  const modeBreakdownData = useMemo(() => {
    const counts: Record<string, number> = {
      reflection: 0,
      summary: 0,
      brainstorm: 0,
      actionable: 0,
    };
    interactions.forEach((i) => {
      const m = i.mode || 'reflection';
      counts[m] = (counts[m] || 0) + 1;
    });

    return [
      { name: 'Reflection', key: 'reflection', count: counts.reflection, fill: MODE_COLORS.reflection },
      { name: 'Summary', key: 'summary', count: counts.summary, fill: MODE_COLORS.summary },
      { name: 'Brainstorm', key: 'brainstorm', count: counts.brainstorm, fill: MODE_COLORS.brainstorm },
      { name: 'Action Plan', key: 'actionable', count: counts.actionable, fill: MODE_COLORS.actionable },
    ];
  }, [interactions]);

  // 7. Calculate Week Boundaries for Weekly Review
  const currentWeekSpan = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOfWeek - selectedWeekOffset * 7,
      0,
      0,
      0,
      0
    );
    const endOfWeek = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + 6,
      23,
      59,
      59,
      999
    );

    const label =
      selectedWeekOffset === 0
        ? 'Current Week'
        : selectedWeekOffset === 1
        ? 'Last Week'
        : `${selectedWeekOffset} Weeks Ago`;

    const formattedSpan = `${startOfWeek.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} – ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const entriesInThisWeek = interactions.filter(
      (entry) => entry.createdAt >= startOfWeek.getTime() && entry.createdAt <= endOfWeek.getTime()
    );

    return {
      label,
      formattedSpan,
      start: startOfWeek.getTime(),
      end: endOfWeek.getTime(),
      entriesCount: entriesInThisWeek.length,
      entries: entriesInThisWeek,
    };
  }, [selectedWeekOffset, interactions]);

  // 8. Fetch AI Analytics Insights (Themes, Trends, Achievements)
  const fetchGrowthInsights = async (force: boolean = false) => {
    if (interactions.length === 0) return;
    setIsGeneratingInsights(true);
    setInsightsError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken(force);
      if (!idToken) throw new Error('Authentication expired. Please sign in again.');

      const res = await fetch('/api/analytics/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch personal growth insights.');
      }

      setThemes(data.themes || []);
      setTrends(data.trends || []);
      setAchievements(data.achievements || []);
      setLastAnalyzedAt(data.timestamp || Date.now());
    } catch (err: any) {
      console.error('Growth insights fetch failed:', err);
      setInsightsError(err.message || 'Could not generate growth insights.');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Auto-fetch insights when entries exist and not yet fetched
  useEffect(() => {
    if (interactions.length > 0 && themes.length === 0 && !isGeneratingInsights && !insightsError) {
      fetchGrowthInsights();
    }
  }, [interactions.length]);

  // 9. Generate AI Weekly Review
  const handleGenerateWeeklyReview = async () => {
    setIsGeneratingReview(true);
    setReviewError(null);
    setReviewMessage(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication session expired. Please sign in again.');

      const res = await fetch('/api/analytics/weekly-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          weekStartTimestamp: currentWeekSpan.start,
          weekEndTimestamp: currentWeekSpan.end,
          weekLabel: `${currentWeekSpan.label} (${currentWeekSpan.formattedSpan})`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate weekly review.');
      }

      if (data.empty) {
        setReviewMessage(data.message);
        setWeeklyReview(null);
      } else {
        setWeeklyReview(data.review);
      }
    } catch (err: any) {
      console.error('Generate weekly review error:', err);
      setReviewError(err.message || 'Failed to generate weekly review with Gemini.');
    } finally {
      setIsGeneratingReview(false);
    }
  };

  // 10. Goals Management
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) {
      setGoalFormError('Please enter a goal title.');
      return;
    }

    setIsSavingGoal(true);
    setGoalFormError(null);

    try {
      const goalDocId = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const taskLines = newGoalTasksInput
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const tasks: GoalTask[] = taskLines.map((line, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: line.replace(/^[-*•]\s*/, ''),
        completed: false,
      }));

      const rawGoal: GoalItem = {
        id: goalDocId,
        userId: user.uid,
        title: newGoalTitle.trim(),
        category: newGoalCategory,
        status: 'in_progress',
        tasks,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const sanitized = sanitizePayload(rawGoal);
      await setDoc(doc(db, 'users', user.uid, 'goals', goalDocId), sanitized);

      setNewGoalTitle('');
      setNewGoalTasksInput('');
      setIsAddingGoal(false);
    } catch (err: any) {
      console.error('Failed to create goal:', err);
      setGoalFormError(err.message || 'Failed to save goal.');
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleToggleTask = async (goal: GoalItem, taskId: string) => {
    try {
      const updatedTasks = goal.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            completed: !t.completed,
            completedAt: !t.completed ? Date.now() : undefined,
          };
        }
        return t;
      });

      // Auto-complete goal if all tasks are finished
      const allCompleted = updatedTasks.length > 0 && updatedTasks.every((t) => t.completed);
      const updatedGoal: Partial<GoalItem> = {
        tasks: updatedTasks,
        status: allCompleted ? 'completed' : goal.status,
        updatedAt: Date.now(),
        completedAt: allCompleted ? Date.now() : undefined,
      };

      await setDoc(doc(db, 'users', user.uid, 'goals', goal.id), sanitizePayload(updatedGoal), { merge: true });
    } catch (err) {
      console.error('Toggle task error:', err);
    }
  };

  const handleToggleGoalStatus = async (goal: GoalItem) => {
    try {
      const nextStatus: GoalItem['status'] = goal.status === 'completed' ? 'in_progress' : 'completed';
      const updatedGoal: Partial<GoalItem> = {
        status: nextStatus,
        completedAt: nextStatus === 'completed' ? Date.now() : undefined,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'users', user.uid, 'goals', goal.id), sanitizePayload(updatedGoal), { merge: true });
    } catch (err) {
      console.error('Toggle goal status error:', err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'goals', goalId));
    } catch (err) {
      console.error('Delete goal error:', err);
    }
  };

  // Convert memory goals to active goal item with one click
  const handleImportGoalFromMemory = async (memory: UserMemory) => {
    try {
      const goalDocId = `goal_mem_${Date.now()}`;
      const rawGoal: GoalItem = {
        id: goalDocId,
        userId: user.uid,
        title: memory.content,
        category: 'learning',
        status: 'in_progress',
        tasks: [{ id: `task_${Date.now()}_0`, title: 'Define initial milestone', completed: false }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'users', user.uid, 'goals', goalDocId), sanitizePayload(rawGoal));
    } catch (err) {
      console.error('Import memory goal error:', err);
    }
  };

  const filteredGoals = goals.filter((g) => {
    if (goalFilter === 'all') return true;
    if (goalFilter === 'active') return g.status === 'in_progress' || g.status === 'not_started';
    if (goalFilter === 'completed') return g.status === 'completed';
    return true;
  });

  const memoryGoalsAvailable = memories.filter(
    (m) => m.category === 'goal' && !goals.some((g) => g.title.toLowerCase() === m.content.toLowerCase())
  );

  return (
    <div className="flex-1 bg-[#fcfbf7] px-4 py-8 sm:px-8 max-w-6xl mx-auto w-full space-y-10">
      {/* 1. Header Section */}
      <section className="border-b border-[#e0ddd5] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase tracking-[2px] font-bold text-[#4a5d4e]">
              Personal Growth Intelligence
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4a5d4e]" />
            <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82]">
              Private & Scoped to UID
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1a1a1a] tracking-tight">
            Growth & Patterns Dashboard
          </h1>
          <p className="text-sm text-[#5a5751] mt-1 max-w-2xl">
            Understand personal milestones, long-term trends, and habit consistency grounded strictly in your reflective writing.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {lastAnalyzedAt && (
            <span className="text-[11px] text-[#8e8a82] font-serif italic hidden sm:inline">
              Analyzed {new Date(lastAnalyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            id="btn-refresh-insights"
            type="button"
            onClick={() => fetchGrowthInsights(true)}
            disabled={isGeneratingInsights || interactions.length === 0}
            className="px-3.5 py-2 bg-white border border-[#e0ddd5] rounded text-xs text-[#1a1a1a] hover:bg-[#edeae1] font-medium transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
            title="Re-analyze journal entries with Gemini"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#4a5d4e] ${isGeneratingInsights ? 'animate-spin' : ''}`} />
            <span>{isGeneratingInsights ? 'Analyzing...' : 'Refresh AI Insights'}</span>
          </button>
        </div>
      </section>

      {/* 2. Journal Statistics Grid (Requirement 1: 7 Core Metrics) */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[2px] font-bold text-[#8e8a82]">
          Journal & Goal Statistics
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Metric 1: Total Entries */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8e8a82]">
              <span className="text-[10px] uppercase tracking-[1px] font-semibold">Total Entries</span>
              <BookOpen className="w-3.5 h-3.5 text-[#4a5d4e]" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#1a1a1a]">{stats.totalEntries}</div>
            <div className="text-[10px] text-[#8e8a82]">All reflections recorded</div>
          </div>

          {/* Metric 2: Active Goals */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8e8a82]">
              <span className="text-[10px] uppercase tracking-[1px] font-semibold">Active Goals</span>
              <Target className="w-3.5 h-3.5 text-sky-700" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#1a1a1a]">{stats.activeGoals}</div>
            <div className="text-[10px] text-[#8e8a82]">In progress</div>
          </div>

          {/* Metric 3: Completed Goals */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8e8a82]">
              <span className="text-[10px] uppercase tracking-[1px] font-semibold">Goals Reached</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#1a1a1a]">{stats.completedGoals}</div>
            <div className="text-[10px] text-[#8e8a82]">Finished targets</div>
          </div>

          {/* Metric 4: Completed Tasks */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8e8a82]">
              <span className="text-[10px] uppercase tracking-[1px] font-semibold">Tasks Done</span>
              <CheckSquare className="w-3.5 h-3.5 text-indigo-700" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#1a1a1a]">{stats.completedTasks}</div>
            <div className="text-[10px] text-[#8e8a82]">Micro-habits checked</div>
          </div>

          {/* Metric 5: Current Streak */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8e8a82]">
              <span className="text-[10px] uppercase tracking-[1px] font-semibold">Current Streak</span>
              <Flame className={`w-3.5 h-3.5 ${stats.currentStreak > 0 ? 'text-amber-600' : 'text-[#8e8a82]'}`} />
            </div>
            <div className="text-2xl font-serif font-bold text-[#1a1a1a]">
              {stats.currentStreak} <span className="text-xs font-normal text-[#8e8a82]">days</span>
            </div>
            <div className="text-[10px] text-[#8e8a82]">
              {stats.currentStreak > 0 ? 'Daily momentum active' : 'Start streak today'}
            </div>
          </div>

          {/* Metric 6: Entries This Week */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8e8a82]">
              <span className="text-[10px] uppercase tracking-[1px] font-semibold">This Week</span>
              <Calendar className="w-3.5 h-3.5 text-[#4a5d4e]" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#1a1a1a]">{stats.entriesThisWeek}</div>
            <div className="text-[10px] text-[#8e8a82]">Since Monday</div>
          </div>

          {/* Metric 7: Entries This Month */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8e8a82]">
              <span className="text-[10px] uppercase tracking-[1px] font-semibold">This Month</span>
              <BarChart2 className="w-3.5 h-3.5 text-purple-700" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#1a1a1a]">{stats.entriesThisMonth}</div>
            <div className="text-[10px] text-[#8e8a82]">Current calendar month</div>
          </div>
        </div>
      </section>

      {/* 3. Visual Charts Grid (Activity Timeline & Mode Distribution) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline Chart */}
        <div className="lg:col-span-2 p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-3">
            <div>
              <h3 className="font-serif text-base text-[#1a1a1a] font-medium">Reflective Cadence</h3>
              <p className="text-xs text-[#8e8a82]">Daily journal entries over the last 14 days</p>
            </div>
            <span className="text-xs font-serif italic text-[#4a5d4e]">Consistency Overview</span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="entryCadenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4a5d4e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4a5d4e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8e8a82' }} axisLine={{ stroke: '#e0ddd5' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8e8a82' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0ddd5',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="entries"
                  name="Entries"
                  stroke="#4a5d4e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#entryCadenceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reflection Mode Distribution */}
        <div className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-[#e0ddd5] pb-3">
              <h3 className="font-serif text-base text-[#1a1a1a] font-medium">Thinking Modes</h3>
              <p className="text-xs text-[#8e8a82]">Distribution across reflection styles</p>
            </div>

            <div className="mt-4 space-y-3">
              {modeBreakdownData.map((mode) => {
                const total = stats.totalEntries || 1;
                const percent = Math.round((mode.count / total) * 100);
                return (
                  <div key={mode.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#2c2b29]">{mode.name}</span>
                      <span className="text-[#8e8a82]">
                        {mode.count} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#f4f1ea] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%`, backgroundColor: mode.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[#e0ddd5] text-[11px] text-[#8e8a82] italic">
            Reflections nourish intuition; Action plans translate insight into progress.
          </div>
        </div>
      </section>

      {/* 4. AI Weekly Review (Requirement 5 & 6) */}
      <section className="p-6 sm:p-8 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e0ddd5] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#4a5d4e]" />
              <span className="text-[10px] uppercase tracking-[2px] font-bold text-[#4a5d4e]">
                Synthesis Engine
              </span>
            </div>
            <h2 className="font-serif text-2xl text-[#1a1a1a]">AI Weekly Review</h2>
            <p className="text-xs text-[#5a5751] mt-0.5">
              Comprehensive synthesis of your entries, accomplishments, and challenges for the week.
            </p>
          </div>

          {/* Week Selector & Generate Button */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              id="select-week-offset"
              value={selectedWeekOffset}
              onChange={(e) => setSelectedWeekOffset(Number(e.target.value))}
              className="text-xs py-2 px-3 bg-[#fcfbf7] border border-[#e0ddd5] rounded text-[#1a1a1a] font-medium focus:outline-hidden focus:border-[#4a5d4e] cursor-pointer"
            >
              <option value={0}>Current Week ({currentWeekSpan.formattedSpan})</option>
              <option value={1}>Last Week</option>
              <option value={2}>2 Weeks Ago</option>
              <option value={3}>3 Weeks Ago</option>
            </select>

            <button
              id="btn-generate-weekly-review"
              type="button"
              onClick={handleGenerateWeeklyReview}
              disabled={isGeneratingReview || currentWeekSpan.entriesCount === 0}
              className="px-4 py-2 bg-[#4a5d4e] text-white text-xs font-medium uppercase tracking-[1px] rounded hover:bg-[#3d4d40] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
            >
              {isGeneratingReview ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Weekly Review</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notice if no entries in selected week */}
        {currentWeekSpan.entriesCount === 0 && (
          <div className="p-4 bg-[#f8f6f0] border border-[#e0ddd5] rounded text-xs text-[#5a5751] flex items-center justify-between">
            <span>
              You have 0 journal entries recorded during {currentWeekSpan.formattedSpan}. Write or select another week to generate a review.
            </span>
            <button
              type="button"
              onClick={onCreateNewEntry}
              className="font-semibold text-[#4a5d4e] hover:underline cursor-pointer ml-4 shrink-0"
            >
              Write Reflection
            </button>
          </div>
        )}

        {/* Review Error Banner */}
        {reviewError && (
          <div className="p-4 bg-[#c44536]/5 border border-[#c44536]/30 rounded text-xs text-[#c44536] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{reviewError}</span>
          </div>
        )}

        {/* Review Message (e.g. empty results) */}
        {reviewMessage && (
          <div className="p-4 bg-[#f8f6f0] border border-[#e0ddd5] rounded text-xs text-[#5a5751]">
            {reviewMessage}
          </div>
        )}

        {/* Weekly Review Content Display */}
        {weeklyReview && (
          <article className="space-y-6 pt-2">
            <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-2">
              <span className="font-serif italic text-sm text-[#8e8a82]">
                Synthesizing {weeklyReview.entryCount} entries from {weeklyReview.weekLabel}
              </span>
              <span className="text-[10px] uppercase tracking-[1.5px] px-2 py-0.5 bg-[#4a5d4e]/10 text-[#4a5d4e] rounded font-semibold">
                Grounded in Journal Records
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. What Went Well */}
              <div className="p-5 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
                <div className="flex items-center gap-2 text-[#4a5d4e]">
                  <CheckCircle2 className="w-4 h-4" />
                  <h4 className="font-serif text-base font-semibold text-[#1a1a1a]">What Went Well</h4>
                </div>
                <ul className="space-y-2 text-xs text-[#2c2b29] leading-relaxed">
                  {weeklyReview.whatWentWell.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#4a5d4e] font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 2. Major Accomplishments */}
              <div className="p-5 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Award className="w-4 h-4" />
                  <h4 className="font-serif text-base font-semibold text-[#1a1a1a]">Major Accomplishments</h4>
                </div>
                <ul className="space-y-2 text-xs text-[#2c2b29] leading-relaxed">
                  {weeklyReview.majorAccomplishments.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3. Challenges Encountered */}
              <div className="p-5 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  <h4 className="font-serif text-base font-semibold text-[#1a1a1a]">Challenges Encountered</h4>
                </div>
                <ul className="space-y-2 text-xs text-[#2c2b29] leading-relaxed">
                  {weeklyReview.challengesEncountered.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 4. Important Themes */}
              <div className="p-5 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
                <div className="flex items-center gap-2 text-purple-700">
                  <Tag className="w-4 h-4" />
                  <h4 className="font-serif text-base font-semibold text-[#1a1a1a]">Important Themes</h4>
                </div>
                <ul className="space-y-2 text-xs text-[#2c2b29] leading-relaxed">
                  {weeklyReview.importantThemes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 5. Goals Progressed */}
              <div className="p-5 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Target className="w-4 h-4" />
                  <h4 className="font-serif text-base font-semibold text-[#1a1a1a]">Goals Progressed</h4>
                </div>
                <ul className="space-y-2 text-xs text-[#2c2b29] leading-relaxed">
                  {weeklyReview.goalsProgressed.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 6. Suggested Next Focus */}
              <div className="p-5 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
                <div className="flex items-center gap-2 text-[#4a5d4e]">
                  <Lightbulb className="w-4 h-4" />
                  <h4 className="font-serif text-base font-semibold text-[#1a1a1a]">Suggested Next Focus</h4>
                </div>
                <ul className="space-y-2 text-xs text-[#2c2b29] leading-relaxed">
                  {weeklyReview.suggestedNextFocus.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#4a5d4e] font-bold">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Explainability Grounding Badge */}
            {weeklyReview.groundedEntryTitles.length > 0 && (
              <div className="p-3 bg-[#edeae1]/60 border border-[#e0ddd5] rounded text-[11px] text-[#5a5751] flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-[#4a5d4e] shrink-0" />
                <span>
                  <strong>Grounded Evidence:</strong> Derived from "{weeklyReview.groundedEntryTitles.join('", "')}".
                </span>
              </div>
            )}
          </article>
        )}
      </section>

      {/* 5. Top Themes & Progress Trends Section (Requirements 2, 3, 6) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Recurring Themes */}
        <div className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-3">
            <div>
              <h3 className="font-serif text-xl text-[#1a1a1a] font-medium">Top Recurring Themes</h3>
              <p className="text-xs text-[#8e8a82]">Identified by Gemini across your journal archive</p>
            </div>
            <Tag className="w-4 h-4 text-[#4a5d4e]" />
          </div>

          {themes.length === 0 ? (
            <div className="p-8 bg-[#f8f6f0] border border-[#e0ddd5] rounded text-center text-xs text-[#8e8a82] space-y-2">
              <Compass className="w-6 h-6 mx-auto text-[#8e8a82]" />
              <p>Write a few reflections to let Gemini discover your central recurring themes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {themes.map((theme, idx) => (
                <div key={idx} className="p-4 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2 group">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-base font-semibold text-[#1a1a1a] group-hover:text-[#4a5d4e] transition-colors">
                      {theme.name}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[1px] px-2 py-0.5 bg-[#edeae1] rounded text-[#5a5751]">
                      ~{theme.count} {theme.count === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <p className="text-xs text-[#5a5751] leading-relaxed">{theme.description}</p>

                  {/* Explainability: Supporting Entries */}
                  {theme.supportingEntries && theme.supportingEntries.length > 0 && (
                    <div className="pt-2 border-t border-[#e0ddd5]/60 flex flex-wrap items-center gap-1.5 text-[11px] text-[#8e8a82]">
                      <span className="font-semibold text-[#4a5d4e]">Evidence:</span>
                      {theme.supportingEntries.map((se, seIdx) => (
                        <button
                          key={seIdx}
                          type="button"
                          onClick={() => se.entryId && onOpenEntry(se.entryId)}
                          className="px-2 py-0.5 bg-white border border-[#e0ddd5] rounded hover:border-[#4a5d4e] hover:text-[#1a1a1a] transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        >
                          <span>"{se.title}"</span>
                          <span className="text-[9px] text-[#8e8a82]">({se.date})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress Trends Over Time */}
        <div className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-3">
            <div>
              <h3 className="font-serif text-xl text-[#1a1a1a] font-medium">Progress Trends</h3>
              <p className="text-xs text-[#8e8a82]">Meaningful behavioral & project shifts</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#4a5d4e]" />
          </div>

          {trends.length === 0 ? (
            <div className="p-8 bg-[#f8f6f0] border border-[#e0ddd5] rounded text-center text-xs text-[#8e8a82] space-y-2">
              <TrendingUp className="w-6 h-6 mx-auto text-[#8e8a82]" />
              <p>As you log progress and project reflections, patterns will be highlighted here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trends.map((trend) => (
                <div key={trend.id} className="p-4 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-base font-semibold text-[#1a1a1a]">{trend.title}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-[1px] px-2 py-0.5 rounded border ${
                        trend.direction === 'increasing'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : trend.direction === 'shifting'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {trend.direction}
                    </span>
                  </div>
                  <p className="text-xs text-[#5a5751] leading-relaxed">{trend.description}</p>

                  {trend.evidenceExcerpt && (
                    <div className="p-2 bg-white border border-[#e0ddd5] rounded text-[11px] text-[#5a5751] italic">
                      "{trend.evidenceExcerpt}"
                    </div>
                  )}

                  {trend.supportingDates && trend.supportingDates.length > 0 && (
                    <div className="text-[10px] text-[#8e8a82]">
                      Observed across: {trend.supportingDates.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="p-3 bg-[#edeae1]/40 border border-[#e0ddd5] rounded text-[10px] text-[#8e8a82]">
            Note: All progress insights are strictly focused on project activity, learning focus, and habit consistency.
          </div>
        </div>
      </section>

      {/* 6. Achievements Gallery (Requirement 4) */}
      <section className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-3">
          <div>
            <h3 className="font-serif text-xl text-[#1a1a1a] font-medium">Positive Accomplishments</h3>
            <p className="text-xs text-[#8e8a82]">Victories and milestones detected in your writing</p>
          </div>
          <Award className="w-4 h-4 text-purple-700" />
        </div>

        {achievements.length === 0 ? (
          <div className="p-8 bg-[#f8f6f0] border border-[#e0ddd5] rounded text-center text-xs text-[#8e8a82] space-y-2">
            <Award className="w-6 h-6 mx-auto text-[#8e8a82]" />
            <p>Milestones, finished tasks, and technologies learned will be recognized here as you journal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className="p-4 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2 hover:border-[#4a5d4e]/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[1px] px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded">
                    {ach.category}
                  </span>
                  <span className="text-[11px] text-[#8e8a82]">{ach.dateDetected}</span>
                </div>
                <h4 className="font-serif text-base font-semibold text-[#1a1a1a]">{ach.title}</h4>
                <p className="text-xs text-[#5a5751] leading-relaxed">{ach.description}</p>
                <div className="pt-2 border-t border-[#e0ddd5]/60 flex items-center justify-between text-[11px]">
                  <span className="text-[#8e8a82] truncate max-w-[180px]">From: "{ach.sourceEntryTitle}"</span>
                  {ach.sourceEntryId && (
                    <button
                      type="button"
                      onClick={() => onOpenEntry(ach.sourceEntryId!)}
                      className="text-[#4a5d4e] font-semibold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7. Goals Progress & Tasks Section */}
      <section className="p-6 sm:p-8 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e0ddd5] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-[#4a5d4e]" />
              <span className="text-[10px] uppercase tracking-[2px] font-bold text-[#4a5d4e]">
                Execution Tracker
              </span>
            </div>
            <h3 className="font-serif text-2xl text-[#1a1a1a]">Goals & Tasks Progress</h3>
            <p className="text-xs text-[#5a5751] mt-0.5">
              Active projects, micro-habits, and milestone roadmaps tracked across your reflections.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="inline-flex p-1 bg-[#edeae1] rounded border border-[#e0ddd5]">
              {(['active', 'completed', 'all'] as const).map((filterVal) => (
                <button
                  key={filterVal}
                  type="button"
                  onClick={() => setGoalFilter(filterVal)}
                  className={`px-3 py-1 rounded text-xs tracking-wider capitalize transition-all cursor-pointer ${
                    goalFilter === filterVal ? 'bg-white text-[#1a1a1a] font-semibold shadow-xs' : 'text-[#8e8a82]'
                  }`}
                >
                  {filterVal}
                </button>
              ))}
            </div>

            {onNavigateToGoals && (
              <button
                type="button"
                onClick={() => onNavigateToGoals()}
                className="px-3.5 py-1.5 bg-[#eef5ef] hover:bg-[#dfeee1] text-[#4a5d4e] border border-[#c8ddcb] text-xs font-medium uppercase tracking-[1px] rounded transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Goal Planner</span>
              </button>
            )}

            <button
              id="btn-open-add-goal"
              type="button"
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              className="px-3.5 py-1.5 bg-[#4a5d4e] text-white text-xs font-medium uppercase tracking-[1px] rounded hover:bg-[#3d4d40] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Goal</span>
            </button>
          </div>
        </div>

        {/* Memory Import Suggestions (bridging extracted memories to goals) */}
        {memoryGoalsAvailable.length > 0 && (
          <div className="p-4 bg-[#f8f6f0] border border-[#e0ddd5] rounded space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#4a5d4e]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini identified these goals in your reflections. Add them to your active tracker?</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {memoryGoalsAvailable.slice(0, 3).map((mem) => (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => handleImportGoalFromMemory(mem)}
                  className="px-3 py-1.5 bg-white border border-[#e0ddd5] hover:border-[#4a5d4e] rounded text-xs text-[#1a1a1a] transition-all cursor-pointer flex items-center gap-1.5 group"
                >
                  <Plus className="w-3 h-3 text-[#4a5d4e]" />
                  <span>"{mem.content}"</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add New Goal Form */}
        {isAddingGoal && (
          <form onSubmit={handleCreateGoal} className="p-5 bg-[#fcfbf7] border border-[#4a5d4e]/40 rounded space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-base font-medium text-[#1a1a1a]">Define a New Goal</h4>
              <button
                type="button"
                onClick={() => setIsAddingGoal(false)}
                className="text-xs text-[#8e8a82] hover:text-[#1a1a1a] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {goalFormError && (
              <div className="text-xs text-[#c44536] p-2 bg-[#c44536]/10 rounded border border-[#c44536]/20">
                {goalFormError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] font-semibold">Goal Title</label>
                <input
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  placeholder="e.g. Master TypeScript systems architecture"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#e0ddd5] rounded focus:outline-hidden focus:border-[#4a5d4e]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] font-semibold">Category</label>
                <select
                  value={newGoalCategory}
                  onChange={(e) => setNewGoalCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#e0ddd5] rounded focus:outline-hidden focus:border-[#4a5d4e] cursor-pointer"
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
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] font-semibold">
                Tasks & Milestones (One per line)
              </label>
              <textarea
                value={newGoalTasksInput}
                onChange={(e) => setNewGoalTasksInput(e.target.value)}
                placeholder="Read chapter on generics&#10;Implement vector search in Express&#10;Write reflective summary"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white border border-[#e0ddd5] rounded focus:outline-hidden focus:border-[#4a5d4e]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={isSavingGoal || !newGoalTitle.trim()}
                className="px-4 py-2 bg-[#4a5d4e] text-white text-xs font-medium uppercase tracking-[1px] rounded hover:bg-[#3d4d40] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingGoal ? 'Saving...' : 'Save Goal'}
              </button>
            </div>
          </form>
        )}

        {/* Goals List */}
        {filteredGoals.length === 0 ? (
          <div className="p-8 bg-[#f8f6f0] border border-[#e0ddd5] rounded text-center text-xs text-[#8e8a82] space-y-2">
            <Target className="w-6 h-6 mx-auto text-[#8e8a82]" />
            <p>No {goalFilter !== 'all' ? goalFilter : ''} goals found. Click "New Goal" to establish your next milestone.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGoals.map((goal) => {
              const categoryStyle = GOAL_CATEGORY_STYLES[goal.category] || GOAL_CATEGORY_STYLES.general;
              const totalTasks = goal.tasks?.length || 0;
              const completedTasksCount = goal.tasks?.filter((t) => t.completed).length || 0;
              const percent = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : goal.status === 'completed' ? 100 : 0;

              return (
                <div
                  key={goal.id}
                  className={`p-5 border rounded transition-all ${
                    goal.status === 'completed'
                      ? 'bg-[#f8f6f0]/70 border-[#e0ddd5] opacity-80'
                      : 'bg-[#fcfbf7] border-[#e0ddd5] hover:border-[#4a5d4e]/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e0ddd5]/60 pb-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleGoalStatus(goal)}
                        className={`cursor-pointer transition-colors ${
                          goal.status === 'completed' ? 'text-emerald-700' : 'text-[#8e8a82] hover:text-[#4a5d4e]'
                        }`}
                        title={goal.status === 'completed' ? 'Mark active' : 'Mark completed'}
                      >
                        {goal.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div>
                        <h4
                          className={`font-serif text-base font-semibold ${
                            goal.status === 'completed' ? 'line-through text-[#8e8a82]' : 'text-[#1a1a1a]'
                          }`}
                        >
                          {goal.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[9px] font-semibold uppercase tracking-[1px] px-1.5 py-0.5 rounded border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
                          >
                            {categoryStyle.label}
                          </span>
                          <span className="text-[11px] text-[#8e8a82]">
                            {completedTasksCount} of {totalTasks} tasks completed ({percent}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="w-24 bg-[#edeae1] rounded-full h-2 overflow-hidden hidden sm:block">
                        <div
                          className="bg-[#4a5d4e] h-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="p-1 text-[#8e8a82] hover:text-[#c44536] rounded cursor-pointer transition-colors"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tasks List */}
                  {goal.tasks && goal.tasks.length > 0 && (
                    <div className="pt-3 space-y-2">
                      {goal.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTask(goal, task.id)}
                          className="flex items-center gap-2.5 text-xs text-[#2c2b29] hover:text-[#1a1a1a] cursor-pointer group py-1"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => {}} // Handled by div onClick
                            className="w-3.5 h-3.5 text-[#4a5d4e] rounded border-[#e0ddd5] cursor-pointer"
                          />
                          <span className={`${task.completed ? 'line-through text-[#8e8a82]' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
