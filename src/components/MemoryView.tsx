import React, { useState, useEffect } from 'react';
import {
  Brain,
  Trash2,
  Search,
  Sparkles,
  Target,
  Compass,
  BookOpen,
  Briefcase,
  AlertCircle,
  Heart,
  Calendar,
  Award,
  Filter,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile, UserMemory, MemoryCategory } from '../types';

interface MemoryViewProps {
  user: UserProfile;
}

const CATEGORY_CONFIG: Record<
  MemoryCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; text: string; border: string }
> = {
  goal: {
    label: 'Goal',
    icon: Target,
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  project: {
    label: 'Project',
    icon: Briefcase,
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
  },
  skill: {
    label: 'Skill',
    icon: BookOpen,
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
  },
  challenge: {
    label: 'Challenge',
    icon: AlertCircle,
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  achievement: {
    label: 'Achievement',
    icon: Award,
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
  interest: {
    label: 'Interest',
    icon: Compass,
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
  },
  preference: {
    label: 'Preference',
    icon: Heart,
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
  },
  plan: {
    label: 'Plan',
    icon: Calendar,
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
  },
};

export const MemoryView: React.FC<MemoryViewProps> = ({ user }) => {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Subscribe to the authenticated user's isolated memories subcollection
  useEffect(() => {
    if (!user.uid) return;

    setLoading(true);
    setErrorMessage(null);

    // Path: users/{userId}/memories
    const memoriesRef = collection(db, 'users', user.uid, 'memories');
    const q = query(memoriesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: UserMemory[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as UserMemory);
        });
        setMemories(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching user memories:', err);
        setErrorMessage('Failed to load memory database. Please check your connection.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Handle single memory deletion
  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      const docRef = doc(db, 'users', user.uid, 'memories', id);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.error('Delete memory failed:', err);
      setErrorMessage(`Could not delete memory: ${err.message || 'Permission denied'}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Handle clear all memories
  const handleClearAll = async () => {
    try {
      setIsClearingAll(true);
      setShowClearConfirm(false);

      const memoriesRef = collection(db, 'users', user.uid, 'memories');
      const snapshot = await getDocs(memoriesRef);

      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
    } catch (err: any) {
      console.error('Clear all memories failed:', err);
      setErrorMessage(`Failed to clear memories: ${err.message || 'Error occurred'}`);
    } finally {
      setIsClearingAll(false);
    }
  };

  // Filter memories by category and search term
  const filteredMemories = memories.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const queryLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !queryLower ||
      item.content.toLowerCase().includes(queryLower) ||
      item.category.toLowerCase().includes(queryLower);
    return matchesCategory && matchesSearch;
  });

  const categoriesPresent = Array.from(new Set(memories.map((m) => m.category)));

  return (
    <div className="flex-1 bg-[#fcfbf7] px-4 py-8 sm:px-8 max-w-5xl mx-auto w-full">
      {/* Editorial Header */}
      <div className="mb-8 border-b border-[#e0ddd5] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[2px] font-semibold text-[#8e8a82]">
              Cognitive Profile
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4a5d4e]" />
            <span className="text-[10px] uppercase tracking-[2px] text-[#4a5d4e]">
              Owner-Scoped Isolation
            </span>
          </div>
          <h1 className="font-serif italic text-3xl sm:text-4xl text-[#1a1a1a] font-normal">
            AI Long-Term Memory
          </h1>
          <p className="text-sm text-[#66635d] mt-1 max-w-2xl leading-relaxed">
            Durable goals, recurring challenges, active projects, and personal preferences extracted from your journal.
            Gemini references relevant memories to give contextual depth to your reflections.
          </p>
        </div>

        {/* Clear All Action */}
        {memories.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-clear-all-memories"
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isClearingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#c44536] border border-[#e0ddd5] hover:border-[#c44536] rounded bg-white hover:bg-[#c44536]/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Memories</span>
            </button>
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e0ddd5] rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 text-[#c44536] mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-serif text-lg font-medium text-[#1a1a1a]">
                Clear All AI Memories?
              </h3>
            </div>
            <p className="text-sm text-[#66635d] leading-relaxed mb-6">
              This will permanently delete all {memories.length} stored memories from your private cloud collection.
              Your journal entries will remain untouched, but Gemini will start with a fresh cognitive context.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs uppercase tracking-wider font-medium text-[#8e8a82] hover:text-[#1a1a1a] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearingAll}
                className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-[#c44536] hover:bg-[#a83628] rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                {isClearingAll ? 'Clearing...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8a82]" />
          <input
            id="input-search-memories"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your memories by keyword or topic..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-[#e0ddd5] rounded focus:outline-none focus:border-[#4a5d4e] transition-colors text-[#1a1a1a]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8a82] hover:text-[#1a1a1a]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded text-xs tracking-wider transition-colors cursor-pointer shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-[#4a5d4e] text-white font-medium'
                : 'bg-white border border-[#e0ddd5] text-[#66635d] hover:text-[#1a1a1a]'
            }`}
          >
            All ({memories.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([catKey, config]) => {
            const count = memories.filter((m) => m.category === catKey).length;
            if (count === 0 && selectedCategory !== catKey) return null;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(catKey)}
                className={`px-2.5 py-1.5 rounded text-xs tracking-wider transition-colors cursor-pointer shrink-0 capitalize ${
                  selectedCategory === catKey
                    ? 'bg-[#4a5d4e] text-white font-medium'
                    : 'bg-white border border-[#e0ddd5] text-[#66635d] hover:text-[#1a1a1a]'
                }`}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#e0ddd5] border-t-[#4a5d4e] rounded-full animate-spin mb-3" />
          <p className="font-serif italic text-sm text-[#4a5d4e]">Consulting Memory Vault...</p>
        </div>
      ) : memories.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-6 text-center border border-dashed border-[#e0ddd5] rounded-lg bg-white/60">
          <div className="w-12 h-12 rounded-full bg-[#f4f1ea] border border-[#e0ddd5] flex items-center justify-center mx-auto mb-4 text-[#4a5d4e]">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="font-serif italic text-xl text-[#1a1a1a] mb-2 font-normal">
            No memories recorded yet
          </h3>
          <p className="text-sm text-[#66635d] max-w-md mx-auto leading-relaxed mb-6">
            As you reflect and save journal entries, Gemini automatically identifies durable personal milestones,
            skills, recurring challenges, and aspirations to remember over time.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#f4f1ea] rounded text-xs text-[#4a5d4e]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Write your first reflection to start building your cognitive timeline</span>
          </div>
        </div>
      ) : filteredMemories.length === 0 ? (
        /* No Matches Filter State */
        <div className="py-12 text-center text-[#8e8a82]">
          <p className="text-sm">No memories matching &quot;{searchQuery}&quot; in this category.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-2 text-xs font-medium text-[#4a5d4e] hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        /* Grid of Memory Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map((memory) => {
            const config = CATEGORY_CONFIG[memory.category] || CATEGORY_CONFIG.interest;
            const Icon = config.icon;
            const isDeleting = deletingId === memory.id;

            const dateLabel = new Date(memory.createdAt || Date.now()).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={memory.id}
                id={`memory-card-${memory.id}`}
                className="bg-white border border-[#e0ddd5] hover:border-[#4a5d4e]/40 rounded-lg p-5 flex flex-col justify-between transition-all group shadow-xs"
              >
                <div>
                  {/* Top Bar: Category Pill & Delete Button */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${config.bg} ${config.text} ${config.border}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{config.label}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDelete(memory.id)}
                      disabled={isDeleting}
                      title="Delete this memory"
                      className="opacity-60 group-hover:opacity-100 hover:text-[#c44536] text-[#8e8a82] p-1 rounded transition-colors cursor-pointer disabled:opacity-30"
                    >
                      {isDeleting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Memory Content */}
                  <p className="text-sm text-[#2b2927] leading-relaxed font-normal">
                    {memory.content}
                  </p>
                </div>

                {/* Footer Metadata */}
                <div className="mt-4 pt-3 border-t border-[#f4f1ea] flex items-center justify-between text-[11px] text-[#8e8a82]">
                  <span>Added {dateLabel}</span>
                  <span className="font-mono text-[10px] opacity-60">ID: {memory.id.slice(0, 8)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
