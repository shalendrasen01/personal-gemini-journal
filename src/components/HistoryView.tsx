import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  ArrowUpRight, 
  AlertCircle, 
  Sparkles,
  BookOpen,
  MapPin,
  Lock
} from 'lucide-react';
import type { JournalInteraction, JournalMode, UserProfile } from '../types';
import { db } from '../lib/firebase';
import { decryptJournalEntries } from '../lib/encryption';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

interface HistoryViewProps {
  user: UserProfile;
  onSelectInteraction: (interaction: JournalInteraction) => void;
  onCreateNew: () => void;
}

const MODE_LABELS: Record<JournalMode, string> = {
  reflection: 'Reflection',
  summary: 'Summary',
  brainstorm: 'Brainstorm',
  actionable: 'Action Plan',
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  onSelectInteraction,
  onCreateNew,
}) => {
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to user's isolated interactions subcollection
  useEffect(() => {
    if (!user.uid) return;

    setLoading(true);
    setErrorMessage(null);

    // Path: users/{userId}/interactions
    const interactionsRef = collection(db, 'users', user.uid, 'interactions');
    const q = query(interactionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const items: JournalInteraction[] = [];
        snapshot.forEach((docSnapshot) => {
          items.push({ id: docSnapshot.id, ...docSnapshot.data() } as JournalInteraction);
        });
        
        try {
          // Decrypt client-side encrypted entries
          const decrypted = await decryptJournalEntries(items, user);
          setInteractions(decrypted);
        } catch (decryptErr) {
          console.warn('Error decrypting entries:', decryptErr);
          setInteractions(items);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching interactions:', error);
        setErrorMessage('Failed to load past journal entries. Please check network connection.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this journal entry?')) {
      return;
    }

    try {
      setDeletingId(id);
      const docRef = doc(db, 'users', user.uid, 'interactions', id);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.error('Delete interaction failed:', err);
      alert('Could not delete entry. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredInteractions = interactions.filter((item) => {
    const matchesMode = selectedModeFilter === 'all' || item.mode === selectedModeFilter;
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      item.title?.toLowerCase().includes(queryLower) ||
      item.prompt?.toLowerCase().includes(queryLower) ||
      item.response?.toLowerCase().includes(queryLower);

    return matchesMode && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-12 py-12">
      {/* Editorial Archive Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-[#e0ddd5]">
        <div>
          <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] font-bold block mb-1">
            Private Monograph Repository
          </span>
          <h1 className="font-serif italic text-3xl sm:text-4xl text-[#1a1a1a]">
            Journal Archive & History
          </h1>
        </div>

        <button
          id="btn-history-new-entry"
          type="button"
          onClick={onCreateNew}
          className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#333] text-white text-xs uppercase tracking-wider font-medium cursor-pointer transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#e0ddd5]" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="mb-6 p-4 border border-[#c44536]/30 bg-[#c44536]/5 text-[#c44536] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8e8a82] absolute left-3.5 top-3" />
          <input
            id="search-interactions-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries by topic, keyword, or insight..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e0ddd5] text-xs text-[#1a1a1a] placeholder:text-[#8e8a82]/50 outline-none focus:border-[#4a5d4e]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['all', 'reflection', 'summary', 'brainstorm', 'actionable'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedModeFilter(m)}
              className={`px-3 py-2 text-xs uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                selectedModeFilter === m
                  ? 'bg-[#4a5d4e] text-white font-medium'
                  : 'bg-white border border-[#e0ddd5] text-[#8e8a82] hover:text-[#1a1a1a]'
              }`}
            >
              {m === 'all' ? 'All' : MODE_LABELS[m as JournalMode]}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-6 h-6 border-2 border-[#e0ddd5] border-t-[#4a5d4e] rounded-full animate-spin mx-auto mb-4" />
          <p className="font-serif italic text-sm text-[#8e8a82]">Retrieving your journal entries...</p>
        </div>
      ) : filteredInteractions.length === 0 ? (
        <div className="p-12 text-center border border-[#e0ddd5] bg-white">
          <BookOpen className="w-8 h-8 text-[#8e8a82] mx-auto mb-3" />
          <h3 className="font-serif italic text-xl text-[#1a1a1a] mb-1">No Entries Found</h3>
          <p className="font-serif text-sm text-[#8e8a82] max-w-sm mx-auto mb-6">
            {searchQuery
              ? 'No reflections matched your search query. Try another keyword or clear filters.'
              : 'Your private journal is currently empty. Begin by writing your first reflection.'}
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="px-5 py-2.5 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-xs uppercase tracking-wider font-medium cursor-pointer"
          >
            Start First Reflection
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#e0ddd5] border-y border-[#e0ddd5]">
          {filteredInteractions.map((item) => {
            const dateStr = new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }).format(new Date(item.createdAt));

            const turnCount = item.turns?.length || (item.response ? 2 : 1);

            return (
              <div
                key={item.id}
                onClick={() => onSelectInteraction(item)}
                className="py-6 group hover:bg-[#f8f6f0] px-4 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-baseline justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 mb-2">
                    <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82]">
                      {dateStr}
                    </span>
                    <span className="text-[#8e8a82]">•</span>
                    <span className="text-[10px] uppercase tracking-[1.5px] text-[#4a5d4e] font-semibold">
                      {MODE_LABELS[item.mode || 'reflection']}
                    </span>
                    <span className="text-[#8e8a82]">•</span>
                    <span className="text-[10px] text-[#8e8a82]">
                      {turnCount} dialogue {turnCount === 1 ? 'turn' : 'turns'}
                    </span>
                    {item.location && (
                      <>
                        <span className="text-[#8e8a82]">•</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#4a5d4e] bg-[#f8f6f0] border border-[#c8ddcb] px-1.5 py-0.5 rounded">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="line-clamp-1 max-w-[120px] sm:max-w-[200px]">{item.location.name}</span>
                        </span>
                      </>
                    )}
                    {item.isEncrypted && (
                      <>
                        <span className="text-[#8e8a82]">•</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#4a5d4e] bg-[#4a5d4e]/10 border border-[#4a5d4e]/20 px-1.5 py-0.5 rounded" title="Client-Side Encrypted with AES-256-GCM">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Encrypted</span>
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="font-serif italic text-xl text-[#1a1a1a] group-hover:text-[#4a5d4e] transition-colors mb-2">
                    {item.title || 'Untitled Reflection'}
                  </h3>

                  <p className="font-serif text-sm text-[#555] line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </p>

                  {item.response && (
                    <div className="mt-3 pl-3 border-l border-[#e0ddd5] text-xs font-serif italic text-[#8e8a82] line-clamp-1">
                      Gemini: "{item.response.replace(/\n/g, ' ')}"
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    title="Delete Entry"
                    disabled={deletingId === item.id}
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-1.5 text-[#8e8a82] hover:text-[#c44536] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-[#1a1a1a] group-hover:text-[#4a5d4e]">
                    <span>Open</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
