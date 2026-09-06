export type JournalMode = 'reflection' | 'summary' | 'brainstorm' | 'actionable';

export type MemoryCategory =
  | 'goal'
  | 'interest'
  | 'skill'
  | 'project'
  | 'challenge'
  | 'preference'
  | 'plan'
  | 'achievement';

export interface UserMemory {
  id: string;
  userId: string;
  category: MemoryCategory;
  content: string;
  sourceInteractionId?: string;
  sourceSnippet?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface EntryLocation {
  latitude: number;
  longitude: number;
  name?: string;
  city?: string;
  country?: string;
  timestamp?: number;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  version: number;
  tagLength?: number;
  encryptedAt: number;
}

export interface JournalInteraction {
  id?: string;
  userId: string;
  title: string;
  prompt: string;
  response: string;
  turns: ChatTurn[];
  mode: JournalMode;
  location?: EntryLocation;
  createdAt: number;
  updatedAt: number;
  modelUsed?: string;
  tags?: string[];
  isEncrypted?: boolean;
  encryptedPayload?: EncryptedPayload;
  isDecryptionFailed?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface SemanticSearchResult {
  id: string;
  title: string;
  createdAt: number;
  excerpt: string;
  score: number; // 0.0 to 1.0 (relevance / similarity)
  mode?: JournalMode;
}

export interface AskJournalResponse {
  answer: string;
  retrievedEntries: SemanticSearchResult[];
  modelUsed?: string;
  timestamp: number;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  data?: T;
}

export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'archived';

export interface GoalTask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: number;
  priority?: 'high' | 'medium' | 'low';
  milestoneIndex?: number;
}

export interface GoalItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: 'learning' | 'project' | 'productivity' | 'career' | 'creativity' | 'wellness' | 'general';
  status: GoalStatus;
  milestones?: string[];
  tasks: GoalTask[];
  targetDate?: string;
  timeline?: string;
  rationale?: string;
  sourceInteractionId?: string;
  sourceInteractionTitle?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ProposedTask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  milestoneIndex?: number;
}

export interface ProposedGoalPlan {
  title: string;
  description: string;
  category: 'learning' | 'project' | 'productivity' | 'career' | 'creativity' | 'wellness' | 'general';
  targetDate?: string;
  timeline?: string;
  milestones: string[];
  tasks: ProposedTask[];
  contextReasoning?: string;
  detectedFromEntryId?: string;
  detectedFromEntryTitle?: string;
}

export interface GoalDetectionResult {
  success?: boolean;
  detected: boolean;
  suggestedTitle?: string;
  category?: 'learning' | 'project' | 'productivity' | 'career' | 'creativity' | 'wellness' | 'general';
  confidence?: 'high' | 'medium' | 'low';
  reasoning?: string;
  suggestedPrompt?: string;
  error?: string;
}

export interface JournalStats {
  totalEntries: number;
  activeGoals: number;
  completedGoals: number;
  completedTasks: number;
  currentStreak: number;
  entriesThisWeek: number;
  entriesThisMonth: number;
}

export interface SupportingEvidence {
  entryId?: string;
  title: string;
  date: string;
  snippet?: string;
}

export interface GrowthTheme {
  name: string;
  count: number;
  description: string;
  supportingEntries: SupportingEvidence[];
  relevanceScore?: number;
}

export interface ProgressTrend {
  id: string;
  title: string;
  description: string;
  direction: 'increasing' | 'steady' | 'shifting';
  supportingDates: string[];
  evidenceExcerpt: string;
  sourceEntryTitles: string[];
}

export interface GrowthAchievement {
  id: string;
  title: string;
  category: 'project' | 'technology' | 'goal' | 'consistency' | 'personal';
  description: string;
  dateDetected: string;
  sourceEntryTitle: string;
  sourceEntryId?: string;
}

export interface WeeklyReview {
  id?: string;
  userId: string;
  weekLabel: string;
  weekStart: number;
  weekEnd: number;
  entryCount: number;
  whatWentWell: string[];
  majorAccomplishments: string[];
  challengesEncountered: string[];
  importantThemes: string[];
  goalsProgressed: string[];
  suggestedNextFocus: string[];
  groundedEntryTitles: string[];
  modelUsed?: string;
  createdAt: number;
}

