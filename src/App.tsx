import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logOut } from './lib/firebase';
import { decryptJournalEntry, clearEncryptionSessionCache } from './lib/encryption';
import type { UserProfile, JournalInteraction } from './types';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { JournalWorkspace } from './components/JournalWorkspace';
import { HistoryView } from './components/HistoryView';
import { MemoryView } from './components/MemoryView';
import { SemanticSearchView } from './components/SemanticSearchView';
import { GrowthDashboardView } from './components/GrowthDashboardView';
import { SecurityCenterView } from './components/SecurityCenterView';
import { GoalsView } from './components/GoalsView';
import { JournalMapView } from './components/JournalMapView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App Navigation
  const [activeTab, setActiveTab] = useState<'journal' | 'history' | 'search' | 'memory' | 'goals' | 'map' | 'dashboard' | 'security'>('journal');
  const [selectedInteraction, setSelectedInteraction] = useState<JournalInteraction | null>(null);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [goalsCount, setGoalsCount] = useState<number>(0);

  // Cross-view Goal trigger params
  const [pendingGoalPrompt, setPendingGoalPrompt] = useState<string | undefined>(undefined);
  const [pendingGoalSourceEntry, setPendingGoalSourceEntry] = useState<{ id: string; title: string; text: string } | undefined>(undefined);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      } else {
        setCurrentUser(null);
        setSelectedInteraction(null);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to total user journal count for the badge
  useEffect(() => {
    if (!currentUser?.uid) {
      setHistoryCount(0);
      return;
    }

    const interactionsRef = collection(db, 'users', currentUser.uid, 'interactions');
    const unsubscribe = onSnapshot(
      interactionsRef,
      (snapshot) => {
        setHistoryCount(snapshot.size);
      },
      (err) => {
        console.warn('History count snapshot warning:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Listen to total user memories count for the badge
  useEffect(() => {
    if (!currentUser?.uid) {
      setMemoryCount(0);
      return;
    }

    const memoriesRef = collection(db, 'users', currentUser.uid, 'memories');
    const unsubscribe = onSnapshot(
      memoriesRef,
      (snapshot) => {
        setMemoryCount(snapshot.size);
      },
      (err) => {
        console.warn('Memory count snapshot warning:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Listen to total user goals count for the badge
  useEffect(() => {
    if (!currentUser?.uid) {
      setGoalsCount(0);
      return;
    }

    const goalsRef = collection(db, 'users', currentUser.uid, 'goals');
    const unsubscribe = onSnapshot(
      goalsRef,
      (snapshot) => {
        setGoalsCount(snapshot.size);
      },
      (err) => {
        console.warn('Goals count snapshot warning:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      setActiveTab('journal');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        // User closed or dismissed the popup window
        console.info('Google sign-in popup was dismissed by the user.');
        setAuthError('The sign-in window was closed before completing authentication. Please click "Sign in with Google" to try again.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        console.info('Previous sign-in popup request superseded.');
        setAuthError('Sign-in request was interrupted. Please try again.');
      } else if (err?.code === 'auth/popup-blocked') {
        console.warn('Google sign-in popup was blocked by browser.');
        setAuthError('The sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.');
      } else {
        console.error('Sign-in failed with unexpected error:', err);
        setAuthError(err?.message || 'Failed to authenticate with Google. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (currentUser?.uid) {
        clearEncryptionSessionCache(currentUser.uid);
      }
      await logOut();
      setSelectedInteraction(null);
      setActiveTab('journal');
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleOpenEntryById = async (interactionId: string) => {
    if (!currentUser?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, 'users', currentUser.uid, 'interactions', interactionId));
      if (docSnap.exists()) {
        const rawData = { id: docSnap.id, ...docSnap.data() } as JournalInteraction;
        const decrypted = await decryptJournalEntry(rawData, currentUser);
        setSelectedInteraction(decrypted);
        setActiveTab('journal');
      }
    } catch (err) {
      console.error('Failed to open journal entry:', err);
    }
  };

  // Loading Splash
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#fcfbf7] flex flex-col items-center justify-center p-4 text-[#1a1a1a]">
        <div className="w-8 h-8 border-2 border-[#e0ddd5] border-t-[#4a5d4e] rounded-full animate-spin mb-4" />
        <p className="font-serif italic text-base text-[#4a5d4e]">
          Gemini Journal
        </p>
        <p className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] mt-1">
          Opening Private Monograph...
        </p>
      </div>
    );
  }

  const handleNavigateToGoals = (
    prompt?: string,
    sourceEntry?: { id: string; title: string; text: string }
  ) => {
    setPendingGoalPrompt(prompt);
    setPendingGoalSourceEntry(sourceEntry);
    setActiveTab('goals');
  };

  // Unauthenticated Landing View
  if (!currentUser) {
    return (
      <LandingView
        onSignIn={handleSignIn}
        isLoading={isSigningIn}
        errorMessage={authError}
      />
    );
  }

  // Authenticated Dashboard
  return (
    <div className="min-h-screen bg-[#fcfbf7] text-[#1a1a1a] flex flex-col">
      <Navbar
        user={currentUser}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'goals') {
            setPendingGoalPrompt(undefined);
            setPendingGoalSourceEntry(undefined);
          }
          setActiveTab(tab);
        }}
        onLogout={handleLogout}
        historyCount={historyCount}
        memoryCount={memoryCount}
        goalsCount={goalsCount}
      />

      <main className="flex-1 flex flex-col">
        {activeTab === 'journal' ? (
          <JournalWorkspace
            user={currentUser}
            activeInteraction={selectedInteraction}
            onSavedInteraction={(interaction) => {
              setSelectedInteraction(interaction);
            }}
            onNewInteraction={() => {
              setSelectedInteraction(null);
            }}
            onNavigateToGoals={handleNavigateToGoals}
          />
        ) : activeTab === 'history' ? (
          <HistoryView
            user={currentUser}
            onSelectInteraction={(interaction) => {
              setSelectedInteraction(interaction);
              setActiveTab('journal');
            }}
            onCreateNew={() => {
              setSelectedInteraction(null);
              setActiveTab('journal');
            }}
          />
        ) : activeTab === 'search' ? (
          <SemanticSearchView
            user={currentUser}
            onOpenEntry={handleOpenEntryById}
            onCreateNew={() => {
              setSelectedInteraction(null);
              setActiveTab('journal');
            }}
          />
        ) : activeTab === 'goals' ? (
          <GoalsView
            user={currentUser}
            onOpenEntry={handleOpenEntryById}
            onNavigateToJournal={() => {
              setSelectedInteraction(null);
              setActiveTab('journal');
            }}
            initialPrompt={pendingGoalPrompt}
            initialSourceEntry={pendingGoalSourceEntry}
          />
        ) : activeTab === 'map' ? (
          <JournalMapView
            user={currentUser}
            onOpenEntry={handleOpenEntryById}
            onCreateNewWithLocation={() => {
              setSelectedInteraction(null);
              setActiveTab('journal');
            }}
          />
        ) : activeTab === 'dashboard' ? (
          <GrowthDashboardView
            user={currentUser}
            onOpenEntry={handleOpenEntryById}
            onCreateNewEntry={() => {
              setSelectedInteraction(null);
              setActiveTab('journal');
            }}
            onNavigateToGoals={handleNavigateToGoals}
          />
        ) : activeTab === 'security' ? (
          <SecurityCenterView user={currentUser} />
        ) : (
          <MemoryView user={currentUser} />
        )}
      </main>

      <footer className="py-6 border-t border-[#e0ddd5] text-center text-xs text-[#8e8a82]">
        Gemini Journal • Private Reflections • Powered by Google Gemini & Cloud Firestore
      </footer>
    </div>
  );
}
