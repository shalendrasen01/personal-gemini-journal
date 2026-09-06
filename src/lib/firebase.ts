import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Cloud Firestore with explicit databaseId per Firebase Integration Skill
export const db: Firestore = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || (firebaseConfig as any).databaseId || undefined);

/**
 * Sign in using Google Federated Identity
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      console.info(
        "Google Sign-In cancelled: popup was closed before authentication completed."
      );
    } else if (error?.code === 'auth/popup-blocked') {
      console.warn(
        "Google Sign-In popup was blocked by the browser. Allow popups or open in a new tab."
      );
    } else {
      console.error("Google Sign-In Error:", error);
    }

    throw error;
  }
}

/**
 * Sign out current authenticated user
 */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Retrieve verified ID Token for backend API authorization
 */
export async function getCurrentUserIdToken(forceRefresh: boolean = false): Promise<string | null> {
  let currentUser = auth.currentUser;

  // If auth is still determining state on page load, wait for ready
  if (!currentUser && typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
      currentUser = auth.currentUser;
    } catch {
      // Continue if authStateReady is not supported or rejected
    }
  }

  if (!currentUser) return null;

  try {
    const token = await currentUser.getIdToken(forceRefresh);
    return token ? token.trim() : null;
  } catch (err) {
    console.warn("Retrying ID token retrieval with forceRefresh=true:", err);
    try {
      const refreshedToken = await currentUser.getIdToken(true);
      return refreshedToken ? refreshedToken.trim() : null;
    } catch (retryErr) {
      console.warn("Could not retrieve Firebase ID token:", retryErr);
      return null;
    }
  }
}