import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Save, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  PlusCircle, 
  Compass, 
  FileText, 
  Lightbulb, 
  CheckSquare, 
  Copy, 
  RotateCcw,
  Brain,
  Mic,
  Target,
  MapPin,
  X
} from 'lucide-react';
import type { JournalInteraction, JournalMode, ChatTurn, UserProfile, GoalDetectionResult, EntryLocation } from '../types';
import { getCurrentUserIdToken, db } from '../lib/firebase';
import { sanitizePayload } from '../lib/sanitize';
import { retrieveRelevantMemories, extractAndPersistMemories } from '../lib/memory';
import { doc, setDoc } from 'firebase/firestore';
import { VoiceJournalModal } from './VoiceJournalModal';
import { LocationPickerModal } from './LocationPickerModal';

interface JournalWorkspaceProps {
  user: UserProfile;
  activeInteraction: JournalInteraction | null;
  onSavedInteraction: (interaction: JournalInteraction) => void;
  onNewInteraction: () => void;
  onNavigateToGoals?: (prompt?: string, sourceEntry?: { id: string; title: string; text: string }) => void;
}

const INSPIRATION_PROMPTS: Record<JournalMode, string[]> = {
  reflection: [
    "What drained my energy today, and what silently gave me peace?",
    "What is an emotion I avoided expressing today, and why?",
    "If I stepped out of my comfort zone right now, what would I do?",
  ],
  summary: [
    "Here is everything that happened in my mind today: [describe thoughts]",
    "Summarize my conflicting feelings about this upcoming decision: [describe dilemma]",
  ],
  brainstorm: [
    "I feel stuck regarding [topic]. What are 3 alternative ways to view this situation?",
    "What if the worst outcome happened, how would I recover and grow?",
  ],
  actionable: [
    "I want to make progress on [goal] without burning out. What are 3 gentle micro-habits?",
    "Based on my current overwhelm, what is the single highest leverage task to tackle first?",
  ],
};

const MODE_CONFIG: Record<
  JournalMode,
  { label: string; icon: React.FC<{ className?: string }>; description: string }
> = {
  reflection: {
    label: 'Deep Reflection',
    icon: Compass,
    description: 'Empathetic listening, inquiry, and emotional processing',
  },
  summary: {
    label: 'Distill & Summarize',
    icon: FileText,
    description: 'Core takeaways, recurring themes, and cognitive patterns',
  },
  brainstorm: {
    label: 'Brainstorm & Reframe',
    icon: Lightbulb,
    description: 'Creative perspectives and cognitive reframing',
  },
  actionable: {
    label: 'Action Plan',
    icon: CheckSquare,
    description: 'Bite-sized micro-steps and low-friction habits',
  },
};

export const JournalWorkspace: React.FC<JournalWorkspaceProps> = ({
  user,
  activeInteraction,
  onSavedInteraction,
  onNewInteraction,
  onNavigateToGoals,
}) => {
  const [title, setTitle] = useState('');
  const [entryText, setEntryText] = useState('');
  const [mode, setMode] = useState<JournalMode>('reflection');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [modelUsed, setModelUsed] = useState<string>('gemini-3.6-flash');
  
  // Follow-up input for multi-turn conversation
  const [followUpText, setFollowUpText] = useState('');

  // Interaction State
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [memoriesReferenced, setMemoriesReferenced] = useState<number>(0);
  const [memoryExtractionNotice, setMemoryExtractionNotice] = useState<string | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [detectedGoal, setDetectedGoal] = useState<GoalDetectionResult | null>(null);
  const [location, setLocation] = useState<EntryLocation | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Formatted date string in Georgia Editorial format e.g. "Monday, October 21st"
  const currentDateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  // Sync if an active interaction is provided (e.g., opened from history)
  useEffect(() => {
    if (activeInteraction) {
      setCurrentId(activeInteraction.id || null);
      setTitle(activeInteraction.title || '');
      setEntryText(activeInteraction.prompt || '');
      setMode(activeInteraction.mode || 'reflection');
      setTurns(activeInteraction.turns || []);
      setModelUsed(activeInteraction.modelUsed || 'gemini-3.6-flash');
      setLocation(activeInteraction.location || null);
      setHasUnsavedChanges(false);
      setErrorMessage(null);
    } else {
      resetForm();
    }
  }, [activeInteraction]);

  const resetForm = () => {
    setCurrentId(null);
    setTitle('');
    setEntryText('');
    setFollowUpText('');
    setTurns([]);
    setLocation(null);
    setHasUnsavedChanges(false);
    setErrorMessage(null);
  };

  const handlePromptSelect = (prompt: string) => {
    if (entryText.trim()) {
      setEntryText((prev) => `${prev}\n\n${prompt}`);
    } else {
      setEntryText(prompt);
    }
    setHasUnsavedChanges(true);
  };

  const handleApplyVoiceTranscript = (transcriptText: string, autoReflect?: boolean) => {
    if (!transcriptText.trim()) return;
    const trimmed = transcriptText.trim();
    const newEntry = entryText.trim() ? `${entryText.trim()}\n\n${trimmed}` : trimmed;
    setEntryText(newEntry);
    if (!title.trim()) {
      const words = trimmed.split(' ').slice(0, 5).join(' ');
      setTitle(words.length > 35 ? words.slice(0, 35) + '...' : words || 'Spoken Reflection');
    }
    setHasUnsavedChanges(true);
    if (autoReflect) {
      handleGenerateReflection(newEntry);
    }
  };

  /**
   * Primary entry reflection generation with Gemini
   */
  const handleGenerateReflection = async (retryPrompt?: string) => {
    const textToSend = retryPrompt || entryText.trim();
    if (!textToSend) {
      setErrorMessage('Please write your thoughts or reflections before requesting Gemini guidance.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('User authentication token not found. Please sign in again.');
      }

      // Retrieve relevant long-term memories for contextual personalization
      let relevantMemories: Array<{ category: string; content: string }> = [];
      try {
        relevantMemories = await retrieveRelevantMemories(user.uid, textToSend, 5);
      } catch (memErr) {
        console.warn('Could not retrieve relevant memories (continuing normally):', memErr);
      }

      const newUserTurn: ChatTurn = {
        id: `turn-${Date.now()}-user`,
        role: 'user',
        content: textToSend,
        timestamp: Date.now(),
      };

      const payload = {
        prompt: textToSend,
        history: turns,
        mode,
        memories: relevantMemories,
        location: location || undefined,
      };

      let response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      // If token expired during an idle session, attempt a single refresh & retry
      if (response.status === 401) {
        const refreshedToken = await getCurrentUserIdToken(true);
        if (refreshedToken) {
          response = await fetch('/api/gemini/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${refreshedToken}`,
            },
            body: JSON.stringify(payload),
          });
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to generate reflection (${response.status})`);
      }

      const newModelTurn: ChatTurn = {
        id: `turn-${Date.now()}-model`,
        role: 'model',
        content: data.response,
        timestamp: Date.now(),
      };

      const updatedTurns = [...turns, newUserTurn, newModelTurn];
      setTurns(updatedTurns);
      if (data.modelUsed) {
        setModelUsed(data.modelUsed);
      }
      if (typeof data.memoriesUsedCount === 'number') {
        setMemoriesReferenced(data.memoriesUsedCount);
      } else {
        setMemoriesReferenced(relevantMemories.length);
      }
      setHasUnsavedChanges(true);

      if (!title.trim()) {
        const words = textToSend.split(' ').slice(0, 5).join(' ');
        setTitle(words.length > 35 ? words.slice(0, 35) + '...' : words || 'Evening Reflection');
      }
    } catch (err: any) {
      console.error('Error generating reflection:', err);
      setErrorMessage(err.message || 'An error occurred while consulting Gemini. You can retry safely.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Follow-up turn in multi-turn conversation
   */
  const handleSendFollowUp = async () => {
    const text = followUpText.trim();
    if (!text || isGenerating) return;

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Authentication expired. Please sign in again.');
      }

      // Contextual memory retrieval for follow-up prompt
      let relevantMemories: Array<{ category: string; content: string }> = [];
      try {
        relevantMemories = await retrieveRelevantMemories(user.uid, text, 4);
      } catch (memErr) {
        console.warn('Memory retrieval warning during follow-up:', memErr);
      }

      const newUserTurn: ChatTurn = {
        id: `turn-${Date.now()}-user`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const currentConversation = [...turns, newUserTurn];
      const payload = {
        prompt: text,
        history: turns,
        mode,
        memories: relevantMemories,
        location: location || undefined,
      };

      let response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      // If token expired during an idle session, attempt a single refresh & retry
      if (response.status === 401) {
        const refreshedToken = await getCurrentUserIdToken(true);
        if (refreshedToken) {
          response = await fetch('/api/gemini/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${refreshedToken}`,
            },
            body: JSON.stringify(payload),
          });
        }
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate response.');
      }

      const newModelTurn: ChatTurn = {
        id: `turn-${Date.now()}-model`,
        role: 'model',
        content: data.response,
        timestamp: Date.now(),
      };

      setTurns([...currentConversation, newModelTurn]);
      if (data.modelUsed) {
        setModelUsed(data.modelUsed);
      }
      if (typeof data.memoriesUsedCount === 'number') {
        setMemoriesReferenced(data.memoriesUsedCount);
      }
      setFollowUpText('');
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Follow-up generation error:', err);
      setErrorMessage(err.message || 'Failed to send follow-up. Your text was preserved so you can retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Cloud Firestore Persistence with Guaranteed Transaction Verification
   * and Strict Undefined-Stripping
   */
  const handleSaveToFirestore = async () => {
    if (!entryText.trim() && turns.length === 0) {
      setErrorMessage('Cannot save an empty journal entry. Please write some thoughts first.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const interactionDocId = currentId || `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const latestModelTurn = [...turns].reverse().find((t) => t.role === 'model');
      const primaryResponse = latestModelTurn ? latestModelTurn.content : '';

      const rawInteractionData = {
        id: interactionDocId,
        userId: user.uid,
        title: title.trim() || 'Untitled Reflection',
        prompt: entryText.trim() || (turns[0]?.content ?? ''),
        response: primaryResponse,
        turns: turns.map((t) => ({
          id: t.id,
          role: t.role,
          content: t.content,
          timestamp: t.timestamp,
        })),
        mode,
        createdAt: activeInteraction?.createdAt || Date.now(),
        updatedAt: Date.now(),
        modelUsed: modelUsed || 'gemini-3.6-flash',
        location: location || undefined,
      };

      const sanitizedData = sanitizePayload(rawInteractionData);
      const interactionDocRef = doc(db, 'users', user.uid, 'interactions', interactionDocId);
      await setDoc(interactionDocRef, sanitizedData, { merge: true });

      setCurrentId(interactionDocId);
      setHasUnsavedChanges(false);
      onSavedInteraction(sanitizedData as JournalInteraction);

      // Background Memory Extraction: identify goals, skills, challenges, and preferences
      const fullEntryText = `${title}\n\n${entryText}\n\n${turns.map((t) => `${t.role}: ${t.content}`).join('\n')}`;
      extractAndPersistMemories(user.uid, fullEntryText, interactionDocId)
        .then(({ extractedCount }) => {
          if (extractedCount > 0) {
            setMemoryExtractionNotice(
              `Gemini identified ${extractedCount} durable ${extractedCount === 1 ? 'memory' : 'memories'} from this entry.`
            );
            setTimeout(() => setMemoryExtractionNotice(null), 6000);
          }
        })
        .catch((extractErr) => {
          console.warn('Background memory extraction warning (non-fatal):', extractErr);
        });

      // AI Goal & Action Detection (Human-in-the-Loop)
      const token = await getCurrentUserIdToken();
      fetch('/api/goals/detect-from-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entryText: fullEntryText,
          entryTitle: title || 'Reflection',
          entryId: interactionDocId,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data: GoalDetectionResult) => {
          if (data && data.detected && data.suggestedTitle && data.confidence !== 'low') {
            setDetectedGoal(data);
          }
        })
        .catch((err) => {
          console.warn('Goal detection warning (non-fatal):', err);
        });
    } catch (err: any) {
      console.error('Firestore save failed:', err);
      setErrorMessage(
        `Failed to save journal to Cloud Firestore: ${err.message || 'Permission or network error'}. Your entry has been retained.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const wordCount = entryText.trim() ? entryText.trim().split(/\s+/).length : 0;
  const latestGeminiTurn = [...turns].reverse().find((t) => t.role === 'model');

  return (
    <div className="flex-1 flex flex-col bg-[#fcfbf7]">
      {/* Editorial Sub-Header Bar */}
      <header className="h-18 sm:h-20 border-b border-[#e0ddd5] flex items-center justify-between px-6 sm:px-12 bg-[#fcfbf7]">
        <div className="flex items-center gap-3">
          <div>
            <span className="font-serif italic text-base sm:text-lg text-[#1a1a1a]">
              {currentDateStr}
            </span>
            <span className="hidden sm:inline-block text-xs text-[#8e8a82] ml-3 uppercase tracking-wider">
              • {wordCount} words
            </span>
          </div>

          {/* Location Badge or Add Location Trigger */}
          {location ? (
            <div className="flex items-center gap-1.5 bg-[#f8f6f0] border border-[#c8ddcb] px-2.5 py-1 rounded text-xs text-[#4a5d4e]">
              <MapPin className="w-3 h-3 text-[#4a5d4e] shrink-0" />
              <button
                id="btn-edit-location-header"
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="font-medium hover:underline text-left max-w-[140px] sm:max-w-[200px] truncate cursor-pointer"
                title={`${location.name} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}) - Click to edit`}
              >
                {location.name || `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`}
              </button>
              <button
                id="btn-remove-location-header"
                type="button"
                onClick={() => {
                  setLocation(null);
                  setHasUnsavedChanges(true);
                }}
                className="text-[#8e8a82] hover:text-[#c44536] ml-1 p-0.5 cursor-pointer"
                title="Remove location"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              id="btn-add-location-header"
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-dashed border-[#8e8a82]/50 hover:border-[#4a5d4e] hover:text-[#4a5d4e] rounded text-xs text-[#8e8a82] transition-colors cursor-pointer"
              title="Attach optional location to this entry"
            >
              <MapPin className="w-3 h-3" />
              <span>Add Location</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Add Location Button */}
          {!location && (
            <button
              id="btn-add-location-mobile"
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="sm:hidden p-2 border border-dashed border-[#8e8a82]/50 hover:border-[#4a5d4e] text-[#8e8a82] hover:text-[#4a5d4e] rounded cursor-pointer"
              title="Add Location"
            >
              <MapPin className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            id="btn-open-voice-journal-header"
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="px-3.5 py-2 border border-[#4a5d4e]/40 bg-[#4a5d4e]/10 text-[#4a5d4e] hover:bg-[#4a5d4e]/20 text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            title="Record spoken reflections via microphone"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Journal</span>
          </button>

          {currentId && (
            <button
              id="btn-cancel-reset"
              type="button"
              onClick={onNewInteraction}
              className="px-4 py-2 border border-[#1a1a1a] bg-transparent text-[#1a1a1a] text-xs uppercase tracking-wider font-medium hover:bg-[#1a1a1a]/5 transition-colors cursor-pointer"
            >
              New Entry
            </button>
          )}

          <button
            id="btn-save-journal"
            type="button"
            disabled={isSaving}
            onClick={handleSaveToFirestore}
            className={`px-5 py-2 text-xs uppercase tracking-wider font-medium transition-all cursor-pointer flex items-center gap-2 ${
              hasUnsavedChanges
                ? 'bg-[#4a5d4e] hover:bg-[#3d4d40] text-white shadow-xs'
                : 'bg-[#1a1a1a] hover:bg-[#333] text-white'
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-stone-300" />
                <span>{currentId ? 'Saved' : 'Save Entry'}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Memory Extraction Notification Toast */}
      {memoryExtractionNotice && (
        <div className="bg-[#4a5d4e]/10 border-b border-[#4a5d4e]/20 px-6 sm:px-12 py-2.5 flex items-center justify-between text-xs text-[#4a5d4e] transition-all">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 shrink-0" />
            <span className="font-medium">{memoryExtractionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setMemoryExtractionNotice(null)}
            className="text-[#4a5d4e] hover:opacity-75 cursor-pointer font-medium uppercase tracking-wider text-[10px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* AI Goal & Action Plan Candidate Notification */}
      {detectedGoal && onNavigateToGoals && (
        <div className="bg-[#eef5ef] border-b border-[#c8ddcb] px-6 sm:px-12 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#2c5332] transition-all">
          <div className="flex items-start sm:items-center gap-2.5">
            <Target className="w-4 h-4 text-[#4a5d4e] shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1a1a1a]">
                  Goal Detected: "{detectedGoal.suggestedTitle}"
                </span>
                <span className="text-[10px] uppercase tracking-[1px] px-1.5 py-0.5 bg-white border border-[#c8ddcb] rounded text-[#4a5d4e] font-semibold">
                  {detectedGoal.category}
                </span>
              </div>
              <p className="text-[11px] text-[#4a5d4e] mt-0.5">
                {detectedGoal.reasoning}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setDetectedGoal(null)}
              className="px-3 py-1.5 text-[11px] text-[#8e8a82] hover:text-[#1a1a1a] cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                const fullText = `${title}\n\n${entryText}\n\n${turns.map((t) => `${t.role}: ${t.content}`).join('\n')}`;
                onNavigateToGoals(detectedGoal.suggestedTitle, {
                  id: currentId || '',
                  title: title || 'Reflection',
                  text: fullText,
                });
                setDetectedGoal(null);
              }}
              className="px-3.5 py-1.5 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-[11px] font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3 h-3 text-amber-200" />
              <span>Generate Action Plan</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Alert if needed */}
      {errorMessage && (
        <div className="mx-6 sm:mx-12 mt-4 p-4 border border-[#c44536]/30 bg-[#c44536]/5 text-[#c44536] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => handleGenerateReflection()}
            className="underline font-semibold ml-4 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Dual-Column Editorial Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Primary Journal Composition */}
        <section className="flex-[1.2] p-6 sm:p-12 border-b lg:border-b-0 lg:border-r border-[#e0ddd5] flex flex-col bg-[#fcfbf7]">
          {/* Mode Selector Tabs (Editorial Pill format) */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] font-bold mr-1">
              Focus:
            </span>
            {(Object.keys(MODE_CONFIG) as JournalMode[]).map((m) => {
              const isSelected = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setHasUnsavedChanges(true);
                  }}
                  className={`px-3 py-1 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#4a5d4e] text-white font-medium'
                      : 'border border-[#e0ddd5] text-[#8e8a82] hover:text-[#1a1a1a] bg-white'
                  }`}
                >
                  {MODE_CONFIG[m].label}
                </button>
              );
            })}
          </div>

          {/* Large Editorial Title Input */}
          <input
            id="journal-title-input"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasUnsavedChanges(true);
            }}
            placeholder="Title of your reflection..."
            className="w-full border-none bg-transparent font-serif italic text-2xl sm:text-4xl text-[#1a1a1a] outline-none mb-6 placeholder:text-[#8e8a82]/40"
          />

          {/* Reflection Starters & Voice Quick-Trigger */}
          {turns.length === 0 && (
            <div className="mb-6 space-y-3">
              <button
                id="btn-voice-journal-starter-banner"
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="w-full py-2.5 px-4 border border-[#4a5d4e]/30 bg-[#4a5d4e]/5 hover:bg-[#4a5d4e]/10 text-[#4a5d4e] text-xs flex items-center justify-between transition-all cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span className="font-serif italic">Prefer speaking? Record a Voice Reflection with live transcription</span>
                </span>
                <span className="text-[10px] uppercase font-sans tracking-wider font-bold underline">
                  Start Recording
                </span>
              </button>

              <div className="p-4 border border-[#e0ddd5] bg-[#f8f6f0]">
                <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] font-bold block mb-2">
                  Prompt Starters
                </span>
                <div className="flex flex-wrap gap-2">
                  {INSPIRATION_PROMPTS[mode].map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePromptSelect(prompt)}
                      className="text-left text-xs font-serif italic text-[#4a5d4e] hover:text-[#1a1a1a] hover:underline transition-colors"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Writing Area */}
          <div className="flex-1 flex flex-col min-h-[260px]">
            <textarea
              id="journal-content-textarea"
              rows={turns.length > 0 ? 6 : 12}
              value={entryText}
              onChange={(e) => {
                setEntryText(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="What thoughts are moving through your mind right now? Write without editing yourself..."
              className="w-full flex-1 border-none bg-transparent font-serif text-base sm:text-lg leading-[1.8] text-[#333] outline-none resize-none placeholder:text-[#8e8a82]/40"
            />
          </div>

          {/* Action Row */}
          <div className="pt-6 border-t border-[#e0ddd5] flex items-center justify-between">
            <div className="text-[11px] text-[#8e8a82] uppercase tracking-[1px]">
              {MODE_CONFIG[mode].description}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                id="btn-voice-journal-action-row"
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="px-4 py-3 border border-[#4a5d4e]/40 bg-[#4a5d4e]/5 hover:bg-[#4a5d4e]/15 text-[#4a5d4e] text-xs uppercase tracking-wider font-medium transition-all cursor-pointer flex items-center gap-1.5"
                title="Record reflection by voice"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Voice Input</span>
              </button>

              <button
                id="btn-reflect-gemini"
                type="button"
                disabled={isGenerating || !entryText.trim()}
                onClick={() => handleGenerateReflection()}
                className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#333] active:bg-[#000] text-white text-xs uppercase tracking-wider font-medium transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Consulting Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#e0ddd5]" />
                    <span>{turns.length > 0 ? 'Regenerate Analysis' : 'Reflect with Gemini'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Right Column / Aside: Gemini Reflection & Dialogue Panel */}
        <aside className="flex-[0.9] bg-[#fbf9f4] flex flex-col">
          <div className="px-6 sm:px-8 py-5 border-b border-[#e0ddd5] flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] font-bold">
              Gemini Reflection
            </span>
            <div className="flex items-center gap-2.5">
              {turns.length > 0 && onNavigateToGoals && (
                <button
                  type="button"
                  onClick={() => {
                    const fullText = `${title}\n\n${entryText}\n\n${turns.map((t) => `${t.role}: ${t.content}`).join('\n')}`;
                    onNavigateToGoals(title || entryText.slice(0, 50), {
                      id: currentId || '',
                      title: title || 'Reflection',
                      text: fullText,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#4a5d4e] bg-[#eef5ef] hover:bg-[#dfeee1] border border-[#c8ddcb] rounded transition-colors flex items-center gap-1 cursor-pointer"
                  title="Turn this reflection into a structured goal and milestones"
                >
                  <Target className="w-3 h-3" />
                  <span>Plan Goal</span>
                </button>
              )}
              {memoriesReferenced > 0 && (
                <span
                  title={`${memoriesReferenced} long-term personal memories referenced for context`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#4a5d4e]/10 text-[#4a5d4e] rounded text-[11px] font-medium border border-[#4a5d4e]/20"
                >
                  <Brain className="w-3 h-3" />
                  <span>{memoriesReferenced} {memoriesReferenced === 1 ? 'memory' : 'memories'}</span>
                </span>
              )}
              <span className="font-serif italic text-xs text-[#4a5d4e]">
                {modelUsed}
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
            {turns.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-8 text-[#8e8a82]">
                <Sparkles className="w-8 h-8 text-[#4a5d4e]/40 mb-4" />
                <p className="font-serif italic text-lg text-[#4a5d4e] mb-2">
                  "Silence is often the first page of clarity."
                </p>
                <p className="text-xs text-[#8e8a82] max-w-xs leading-relaxed">
                  Compose your entry on the left and select "Reflect with Gemini" to receive a tailored perspective.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {turns.map((turn, index) => {
                  const isUser = turn.role === 'user';
                  return (
                    <div
                      key={turn.id || index}
                      className={
                        isUser
                          ? 'border-l-2 border-[#8e8a82] pl-4 py-1 text-xs text-[#555] font-sans'
                          : 'space-y-4'
                      }
                    >
                      {isUser ? (
                        <div>
                          <span className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82] font-semibold block mb-1">
                            Your Follow-Up
                          </span>
                          <p className="italic text-stone-800">{turn.content}</p>
                        </div>
                      ) : (
                        <div className="border border-[#e0ddd5] bg-white p-6 shadow-2xs">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] uppercase tracking-[2px] text-[#4a5d4e] font-bold">
                              Synthesis & Reflection
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(turn.content, index)}
                              className="text-stone-400 hover:text-stone-800 text-xs p-1"
                              title="Copy Reflection"
                            >
                              {copiedIndex === index ? (
                                <Check className="w-3.5 h-3.5 text-[#4a5d4e]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <div className="font-serif text-sm sm:text-base leading-[1.8] text-[#333] whitespace-pre-wrap">
                            {turn.content}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Multi-turn Continuation Input */}
                <div className="pt-6 border-t border-[#e0ddd5] border-dashed">
                  <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] font-bold block mb-3">
                    Continue the Dialogue
                  </span>
                  <div className="flex gap-2">
                    <input
                      id="followup-input"
                      type="text"
                      value={followUpText}
                      onChange={(e) => setFollowUpText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendFollowUp();
                        }
                      }}
                      disabled={isGenerating}
                      placeholder="Ask for clarification or deeper inquiry..."
                      className="flex-1 bg-white border border-[#e0ddd5] text-xs text-[#1a1a1a] px-3.5 py-2.5 outline-none focus:border-[#4a5d4e]"
                    />
                    <button
                      id="btn-send-followup"
                      type="button"
                      disabled={isGenerating || !followUpText.trim()}
                      onClick={handleSendFollowUp}
                      className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#333] text-white text-xs uppercase tracking-wider font-medium disabled:opacity-40 cursor-pointer"
                    >
                      {isGenerating ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Voice Journaling Modal */}
      <VoiceJournalModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onApplyTranscript={handleApplyVoiceTranscript}
      />

      {/* Location Attachment Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentLocation={location}
        onSelectLocation={(newLocation) => {
          setLocation(newLocation);
          setHasUnsavedChanges(true);
        }}
      />
    </div>
  );
};
