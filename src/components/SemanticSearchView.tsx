import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  ArrowUpRight,
  Calendar,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Brain,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { UserProfile, SemanticSearchResult, AskJournalResponse, JournalMode, JournalInteraction } from '../types';
import { getCurrentUserIdToken, db } from '../lib/firebase';
import { decryptJournalEntries } from '../lib/encryption';

interface SemanticSearchViewProps {
  user: UserProfile;
  onOpenEntry: (interactionId: string) => void;
  onCreateNew: () => void;
}

const SUGGESTED_QUERIES = [
  'What progress have I made on my AI project?',
  'Show me entries where I was struggling with motivation',
  'Find things I wrote about learning machine learning',
  'Find entries where I made progress',
  'What did I say about my personal goals?',
];

const MODE_LABELS: Record<string, string> = {
  reflection: 'Reflection',
  summary: 'Summary',
  brainstorm: 'Brainstorm',
  actionable: 'Action Plan',
};

export const SemanticSearchView: React.FC<SemanticSearchViewProps> = ({
  user,
  onOpenEntry,
  onCreateNew,
}) => {
  const [searchMode, setSearchMode] = useState<'search' | 'ask'>('ask');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search Results
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[] | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // Ask Journal Result
  const [askResponse, setAskResponse] = useState<AskJournalResponse | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');

  // Decrypted interactions for semantic search context
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'users', user.uid, 'interactions'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rawItems = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as JournalInteraction[];
        const decrypted = await decryptJournalEntries(rawItems, user);
        setInteractions(decrypted);
      },
      (err) => {
        console.warn('Semantic search interactions fetch notice:', err);
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  const executeSearch = async (targetQuery?: string) => {
    const textToSearch = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!textToSearch) {
      setErrorMessage('Please enter a query or question to search your journal.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Fetch fresh Firebase ID token via auto-refreshing resilient helper
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Authentication session expired. Please refresh the page and sign in again.');
      }

      const candidateEntries = interactions.slice(0, 50).map((e) => ({
        id: e.id,
        title: e.title,
        prompt: e.prompt,
        response: e.response,
        createdAt: e.createdAt,
        mode: e.mode,
      }));

      if (searchMode === 'search') {
        const res = await fetch('/api/journal/semantic-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            query: textToSearch,
            entries: candidateEntries,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to complete semantic search.');
        }

        setSearchResults(data.results || []);
        setLastSearchQuery(textToSearch);
      } else {
        // "Ask my journal" mode
        const res = await fetch('/api/journal/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            question: textToSearch,
            entries: candidateEntries,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to process journal question.');
        }

        setAskResponse({
          answer: data.answer || '',
          retrievedEntries: data.retrievedEntries || [],
          modelUsed: data.modelUsed,
          timestamp: data.timestamp || Date.now(),
        });
        setLastQuestion(textToSearch);
      }
    } catch (err: any) {
      console.error('Search operation failed:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while searching your journal.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    }
  };

  const handleSelectSuggestedQuery = (suggested: string) => {
    setQuery(suggested);
    // If query starts with "What" or questions, prefer 'ask' mode, else 'search'
    if (suggested.startsWith('What') || suggested.startsWith('How')) {
      setSearchMode('ask');
    }
    executeSearch(suggested);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#fcfbf7]">
      {/* Search Header */}
      <section className="bg-[#f8f6f0] border-b border-[#e0ddd5] px-6 sm:px-12 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[2px] text-[#4a5d4e] font-bold">
                  Semantic Retrieval Engine
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#4a5d4e]" />
                <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82]">
                  Powered by Gemini Embeddings
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#1a1a1a] tracking-tight">
                Journal Intelligence & Search
              </h1>
              <p className="text-sm text-[#5a5751] mt-1">
                Retrieve thoughts by natural meaning and ask questions grounded strictly in your personal records.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="inline-flex p-1 bg-[#edeae1] rounded border border-[#e0ddd5] self-start sm:self-auto">
              <button
                id="btn-mode-ask"
                type="button"
                onClick={() => {
                  setSearchMode('ask');
                  setErrorMessage(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs tracking-wider transition-all cursor-pointer ${
                  searchMode === 'ask'
                    ? 'bg-white text-[#4a5d4e] font-semibold shadow-xs'
                    : 'text-[#8e8a82] hover:text-[#1a1a1a]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask My Journal</span>
              </button>

              <button
                id="btn-mode-search"
                type="button"
                onClick={() => {
                  setSearchMode('search');
                  setErrorMessage(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs tracking-wider transition-all cursor-pointer ${
                  searchMode === 'search'
                    ? 'bg-white text-[#4a5d4e] font-semibold shadow-xs'
                    : 'text-[#8e8a82] hover:text-[#1a1a1a]'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Semantic Search</span>
              </button>
            </div>
          </div>

          {/* Search Box Input */}
          <div className="relative">
            <div className="flex items-center bg-white border border-[#e0ddd5] rounded shadow-xs focus-within:border-[#4a5d4e] focus-within:ring-1 focus-within:ring-[#4a5d4e] transition-all overflow-hidden">
              <div className="pl-4 pr-2 text-[#8e8a82]">
                {searchMode === 'ask' ? (
                  <Sparkles className="w-5 h-5 text-[#4a5d4e]" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
              </div>
              <input
                id="input-semantic-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchMode === 'ask'
                    ? "Ask your journal anything (e.g., 'What progress have I made on my AI project?')..."
                    : "Describe what you want to find (e.g., 'Entries where I was struggling with motivation')..."
                }
                className="w-full py-3.5 pr-4 text-sm text-[#1a1a1a] placeholder-[#8e8a82] focus:outline-hidden bg-transparent"
                disabled={isLoading}
              />
              <div className="pr-2">
                <button
                  id="btn-execute-search"
                  type="button"
                  onClick={() => executeSearch()}
                  disabled={isLoading || !query.trim()}
                  className="px-5 py-2 bg-[#4a5d4e] text-white text-xs font-medium uppercase tracking-[1px] rounded hover:bg-[#3d4d40] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>{searchMode === 'ask' ? 'Analyzing...' : 'Searching...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{searchMode === 'ask' ? 'Ask Gemini' : 'Search'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Suggested Natural Language Prompts */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] uppercase tracking-wider text-[#8e8a82] font-semibold">
              Try:
            </span>
            {SUGGESTED_QUERIES.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestedQuery(suggestion)}
                className="text-xs px-2.5 py-1 bg-white hover:bg-[#edeae1] border border-[#e0ddd5] rounded text-[#5a5751] hover:text-[#1a1a1a] transition-colors cursor-pointer"
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto w-full px-6 sm:px-12 py-8 flex-1">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 border border-[#c44536]/30 bg-[#c44536]/5 text-[#c44536] text-xs flex items-center justify-between rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => executeSearch()}
              className="font-medium underline hover:opacity-80 cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="p-6 bg-white border border-[#e0ddd5] rounded space-y-3">
              <div className="h-4 bg-[#edeae1] rounded w-1/3" />
              <div className="h-3 bg-[#edeae1] rounded w-3/4" />
              <div className="h-3 bg-[#edeae1] rounded w-1/2" />
            </div>
            <div className="p-6 bg-white border border-[#e0ddd5] rounded space-y-3">
              <div className="h-4 bg-[#edeae1] rounded w-1/4" />
              <div className="h-3 bg-[#edeae1] rounded w-5/6" />
              <div className="h-3 bg-[#edeae1] rounded w-2/3" />
            </div>
          </div>
        )}

        {/* Ask My Journal Result Mode */}
        {!isLoading && searchMode === 'ask' && askResponse && (
          <div className="space-y-8">
            {/* Gemini Answer Container */}
            <article className="bg-white border border-[#e0ddd5] rounded shadow-xs overflow-hidden">
              <div className="bg-[#f8f6f0] px-6 py-3.5 border-b border-[#e0ddd5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#4a5d4e]" />
                  <span className="text-[10px] uppercase tracking-[2px] text-[#4a5d4e] font-bold">
                    Gemini Journal Synthesis
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {askResponse.modelUsed && (
                    <span className="font-serif italic text-xs text-[#8e8a82]">
                      {askResponse.modelUsed}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <span className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82] font-semibold">
                    Question:
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#1a1a1a] mt-1">
                    "{lastQuestion}"
                  </h2>
                </div>

                <div className="prose text-sm sm:text-base text-[#2c2b29] leading-relaxed whitespace-pre-line border-t border-[#e0ddd5] pt-6 font-sans">
                  {askResponse.answer}
                </div>
              </div>
            </article>

            {/* Citations & Retrieved Journal Entries */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#4a5d4e]" />
                  <h3 className="text-xs uppercase tracking-[2px] font-bold text-[#1a1a1a]">
                    Grounded Journal Records ({askResponse.retrievedEntries.length})
                  </h3>
                </div>
                <span className="text-[11px] text-[#8e8a82]">
                  Consulted for verified evidence
                </span>
              </div>

              {askResponse.retrievedEntries.length === 0 ? (
                <div className="p-4 bg-white border border-[#e0ddd5] rounded text-xs text-[#8e8a82]">
                  No matching journal entries were found in your personal records.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {askResponse.retrievedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-5 bg-white border border-[#e0ddd5] rounded hover:border-[#4a5d4e]/50 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-[1.5px] px-2 py-0.5 bg-[#edeae1] rounded text-[#5a5751] font-semibold">
                              {MODE_LABELS[entry.mode || 'reflection'] || 'Reflection'}
                            </span>
                            <span className="text-xs text-[#8e8a82]">
                              {new Date(entry.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <h4 className="font-serif text-base text-[#1a1a1a] font-medium group-hover:text-[#4a5d4e] transition-colors">
                            {entry.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            title="Semantic confidence score"
                            className="text-[11px] font-medium px-2 py-1 bg-[#4a5d4e]/10 text-[#4a5d4e] rounded border border-[#4a5d4e]/20 shrink-0"
                          >
                            {Math.round(entry.score * 100)}% Match
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenEntry(entry.id)}
                            className="p-1.5 text-[#8e8a82] hover:text-[#4a5d4e] hover:bg-[#edeae1] rounded cursor-pointer transition-colors"
                            title="Open original entry in journal"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-[#5a5751] leading-relaxed italic border-l-2 border-[#e0ddd5] pl-3 py-0.5">
                        "{entry.excerpt}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Semantic Search Mode Results */}
        {!isLoading && searchMode === 'search' && searchResults !== null && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-3">
              <div>
                <h3 className="text-xs uppercase tracking-[2px] font-bold text-[#1a1a1a]">
                  Semantic Results ({searchResults.length})
                </h3>
                <p className="text-xs text-[#8e8a82] mt-0.5">
                  Showing reflections semantically related to "{lastSearchQuery}"
                </p>
              </div>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-12 bg-white border border-[#e0ddd5] rounded text-center space-y-4">
                <BookOpen className="w-8 h-8 text-[#8e8a82] mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-serif text-lg text-[#1a1a1a]">
                    No Semantically Relevant Reflections Found
                  </h4>
                  <p className="text-xs text-[#8e8a82] max-w-md mx-auto">
                    We couldn't locate reflections discussing this concept. Try phrasing your query differently or write a new journal entry.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="mt-2 px-4 py-2 bg-[#4a5d4e] text-white text-xs font-medium uppercase tracking-[1px] rounded hover:bg-[#3d4d40] cursor-pointer transition-colors"
                >
                  Write a New Reflection
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.map((result) => (
                  <article
                    key={result.id}
                    className="p-6 bg-white border border-[#e0ddd5] rounded hover:border-[#4a5d4e]/40 transition-all shadow-xs group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[1.5px] px-2 py-0.5 bg-[#edeae1] rounded text-[#5a5751] font-semibold">
                            {MODE_LABELS[result.mode || 'reflection'] || 'Reflection'}
                          </span>
                          <span className="text-xs text-[#8e8a82] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(result.createdAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h4 className="font-serif text-xl text-[#1a1a1a] font-medium group-hover:text-[#4a5d4e] transition-colors">
                          {result.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 self-start sm:self-auto">
                        <span className="text-[11px] font-medium px-2.5 py-1 bg-[#4a5d4e]/10 text-[#4a5d4e] rounded border border-[#4a5d4e]/20">
                          {Math.round(result.score * 100)}% Semantic Match
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenEntry(result.id)}
                          className="px-3 py-1 bg-[#edeae1] hover:bg-[#4a5d4e] hover:text-white rounded text-xs text-[#1a1a1a] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Open Entry</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-[#fcfbf7] border border-[#e0ddd5] rounded text-xs text-[#4a4843] leading-relaxed">
                      <span className="text-[10px] uppercase tracking-[1px] font-bold text-[#8e8a82] block mb-1">
                        Relevant Excerpt:
                      </span>
                      "{result.excerpt}"
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Default / Unsearched State */}
        {!isLoading && searchResults === null && !askResponse && (
          <div className="p-8 sm:p-12 bg-white border border-[#e0ddd5] rounded text-center space-y-6">
            <div className="w-12 h-12 rounded-full bg-[#4a5d4e]/10 border border-[#4a5d4e]/20 flex items-center justify-center mx-auto text-[#4a5d4e]">
              <Brain className="w-6 h-6" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="font-serif text-2xl text-[#1a1a1a]">
                Natural Language Semantic Memory
              </h3>
              <p className="text-xs text-[#5a5751] leading-relaxed">
                Traditional keyword search requires exact words. With Gemini semantic retrieval, your entries are converted into high-dimensional vector embeddings, allowing you to search by feeling, intent, milestone, or concept.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left pt-2">
              <div className="p-4 bg-[#f8f6f0] border border-[#e0ddd5] rounded space-y-1">
                <span className="text-[10px] uppercase tracking-[1.5px] text-[#4a5d4e] font-bold">
                  Mode 1: Semantic Search
                </span>
                <p className="text-xs text-[#5a5751]">
                  Discovers entries by thematic similarity even when the exact phrasing differs.
                </p>
              </div>

              <div className="p-4 bg-[#f8f6f0] border border-[#e0ddd5] rounded space-y-1">
                <span className="text-[10px] uppercase tracking-[1.5px] text-[#4a5d4e] font-bold">
                  Mode 2: Ask My Journal
                </span>
                <p className="text-xs text-[#5a5751]">
                  Synthesizes answers to questions using verified facts from your retrieved journal entries.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
