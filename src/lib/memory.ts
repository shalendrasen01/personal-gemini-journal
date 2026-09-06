import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, getCurrentUserIdToken } from './firebase';
import { sanitizePayload } from './sanitize';
import type { UserMemory, MemoryCategory } from '../types';

// Common conversational stopwords to ignore during relevance matching
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'been',
  'what', 'when', 'where', 'which', 'will', 'would', 'could', 'should', 'about',
  'today', 'feel', 'feeling', 'like', 'just', 'more', 'some', 'than', 'them',
  'then', 'they', 'your', 'ours', 'mine', 'myself', 'into', 'over', 'after',
]);

/**
 * Retrieves the most contextually relevant memories for a given journal entry.
 * Evaluates semantic and keyword overlap between current entry and stored memories.
 */
export async function retrieveRelevantMemories(
  userId: string,
  entryText: string,
  maxCount: number = 5
): Promise<Array<{ category: string; content: string }>> {
  if (!userId || !entryText || entryText.trim().length < 5) {
    return [];
  }

  try {
    const memoriesRef = collection(db, 'users', userId, 'memories');
    // Fetch up to 40 recent memories to evaluate relevance locally
    const q = query(memoriesRef, orderBy('createdAt', 'desc'), limit(40));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    const allMemories: UserMemory[] = [];
    snapshot.forEach((docSnap) => {
      allMemories.push({ id: docSnap.id, ...docSnap.data() } as UserMemory);
    });

    // Tokenize current entry into distinct significant keywords
    const tokens = entryText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

    const tokenSet = new Set(tokens);

    // Score memories based on keyword overlap and category relevance
    const scoredMemories = allMemories.map((mem) => {
      const memText = `${mem.category} ${mem.content}`.toLowerCase();
      let score = 0;

      for (const token of tokenSet) {
        if (memText.includes(token)) {
          // Exact token match
          score += 3;
        }
      }

      // High-priority durable categories receive a slight boost
      if (mem.category === 'goal' || mem.category === 'project' || mem.category === 'challenge') {
        score += 1;
      }

      return { memory: mem, score };
    });

    // Filter to memories with positive relevance, or take the top 2 most recent if all are 0
    const relevant = scoredMemories
      .filter((sm) => sm.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCount)
      .map((sm) => ({
        category: sm.memory.category,
        content: sm.memory.content,
      }));

    if (relevant.length > 0) {
      return relevant;
    }

    // If no direct keyword overlap found, return up to 2 recent core goals/projects for ambient context
    const baseline = allMemories
      .filter((m) => m.category === 'goal' || m.category === 'project')
      .slice(0, 2)
      .map((m) => ({ category: m.category, content: m.content }));

    return baseline;
  } catch (err) {
    console.warn('Memory retrieval warning (non-fatal):', err);
    // Graceful degradation: never break the main reflection flow
    return [];
  }
}

/**
 * Triggers AI memory extraction on a newly saved journal entry and stores
 * durable facts in the user's isolated Firestore subcollection.
 */
export async function extractAndPersistMemories(
  userId: string,
  entryText: string,
  sourceInteractionId?: string
): Promise<{ extractedCount: number; newMemories: UserMemory[] }> {
  if (!userId || !entryText || entryText.trim().length < 30) {
    return { extractedCount: 0, newMemories: [] };
  }

  try {
    const idToken = await getCurrentUserIdToken();
    if (!idToken) {
      console.warn('No ID token available for memory extraction');
      return { extractedCount: 0, newMemories: [] };
    }

    // Retrieve existing memory statements to avoid duplicates
    const memoriesRef = collection(db, 'users', userId, 'memories');
    const existingSnap = await getDocs(query(memoriesRef, limit(25)));
    const existingList: string[] = [];
    existingSnap.forEach((d) => {
      const data = d.data();
      if (data.content) existingList.push(data.content);
    });

    // Call server extraction API
    const response = await fetch('/api/gemini/extract-memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        text: entryText,
        existingMemories: existingList,
      }),
    });

    if (!response.ok) {
      console.warn('Memory extraction API responded with status:', response.status);
      return { extractedCount: 0, newMemories: [] };
    }

    const data = await response.json();
    const rawExtracted: Array<{ category: MemoryCategory; content: string }> = data.memories || [];

    if (rawExtracted.length === 0) {
      return { extractedCount: 0, newMemories: [] };
    }

    const createdMemories: UserMemory[] = [];
    const now = Date.now();

    for (const item of rawExtracted) {
      // Check if duplicate of already known memory
      const isDuplicate = existingList.some(
        (existing) => existing.toLowerCase().includes(item.content.toLowerCase()) ||
                      item.content.toLowerCase().includes(existing.toLowerCase())
      );

      if (isDuplicate) continue;

      const memoryId = `mem_${now}_${Math.random().toString(36).substring(2, 8)}`;
      const newMemory: UserMemory = {
        id: memoryId,
        userId,
        category: item.category,
        content: item.content,
        sourceInteractionId,
        createdAt: now,
        updatedAt: now,
      };

      const memoryDocRef = doc(db, 'users', userId, 'memories', memoryId);
      await setDoc(memoryDocRef, sanitizePayload(newMemory));
      createdMemories.push(newMemory);
    }

    return {
      extractedCount: createdMemories.length,
      newMemories: createdMemories,
    };
  } catch (err) {
    console.warn('Memory extraction pipeline warning (non-fatal):', err);
    return { extractedCount: 0, newMemories: [] };
  }
}
