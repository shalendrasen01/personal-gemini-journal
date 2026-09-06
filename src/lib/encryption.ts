/**
 * Client-Side Zero-Knowledge Encryption Module (WebCrypto AES-256-GCM)
 * 
 * Provides client-side authenticated encryption for journal entry content
 * before it is persisted to Cloud Firestore. Decryption is performed strictly
 * on the client-side after fetch, preventing database operators, cloud breaches,
 * or raw Firestore inspect tools from observing user reflection text.
 * 
 * Cryptographic Architecture:
 * - Cipher: AES-GCM (Galois/Counter Mode) with 256-bit key length
 * - Authenticated Tag Length: 128 bits
 * - IV: 12 bytes (96 bits), uniquely sampled per write using crypto.getRandomValues()
 * - Key Derivation: PBKDF2 with SHA-256, 100,000 iterations, bound to the user's
 *   Firebase Auth session context and a user-specific client secret.
 * - Key Protection: Extractable flag set to false (non-exportable raw key in browser memory).
 */

import type { JournalInteraction, UserProfile } from '../types';

// In-memory session key cache to avoid re-running 100,000 PBKDF2 iterations on every read/write
const sessionKeyCache = new Map<string, CryptoKey>();

/**
 * Encodes an ArrayBuffer or Uint8Array to a Base64 string safely
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string to a Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verifies that the browser environment supports the W3C Web Cryptography API
 */
export function isClientEncryptionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

/**
 * Retrieves or generates the user-specific client secret.
 * Stored locally in browser storage, unique per Firebase user UID.
 */
function getOrCreateUserSecret(userId: string): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return `ephemeral_secret_${userId}`;
  }

  const storageKey = `gemini_cse_secret_${userId}`;
  let secret = window.localStorage.getItem(storageKey);

  if (!secret) {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    secret = bufferToBase64(randomBytes);
    try {
      window.localStorage.setItem(storageKey, secret);
    } catch (e) {
      console.warn('Notice: Could not persist client secret to localStorage (incognito/restricted mode):', e);
    }
  }

  return secret;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey using PBKDF2 bound to the user's Firebase Auth identity
 */
export async function getOrCreateUserEncryptionKey(userId: string): Promise<CryptoKey> {
  if (!isClientEncryptionSupported()) {
    throw new Error('Web Cryptography API is not available in this browser environment.');
  }

  // Check in-memory cache first
  const cachedKey = sessionKeyCache.get(userId);
  if (cachedKey) {
    return cachedKey;
  }

  const userSecret = getOrCreateUserSecret(userId);
  const keyMaterialSource = `journal-session-cse-v1:${userId}:${userSecret}`;
  const rawKeyBytes = new TextEncoder().encode(keyMaterialSource);

  // 1. Import raw base key material for PBKDF2
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 2. Derive non-exportable 256-bit AES-GCM key
  const salt = new TextEncoder().encode(`gemini-journal-salt-v1:${userId}`);
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // extractable = false prevents raw key extraction from JS memory
    ['encrypt', 'decrypt']
  );

  sessionKeyCache.set(userId, derivedKey);
  return derivedKey;
}

/**
 * Encrypts a journal entry's sensitive content prior to writing to Cloud Firestore.
 * In Firestore, only encryptedPayload and metadata are stored; plaintext is never exposed.
 */
export async function encryptJournalEntry(
  entry: JournalInteraction,
  user: UserProfile
): Promise<JournalInteraction> {
  if (!user?.uid) {
    throw new Error('User authentication required for client-side encryption.');
  }

  const key = await getOrCreateUserEncryptionKey(user.uid);

  // 96-bit (12-byte) IV randomly sampled per write
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Package sensitive content
  const sensitivePayload = {
    title: entry.title || 'Untitled Reflection',
    prompt: entry.prompt || '',
    response: entry.response || '',
    turns: entry.turns || [],
  };

  const encodedPayload = new TextEncoder().encode(JSON.stringify(sensitivePayload));

  // Execute AES-GCM encryption with 128-bit authentication tag
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    encodedPayload
  );

  const ciphertextBase64 = bufferToBase64(ciphertextBuffer);
  const ivBase64 = bufferToBase64(iv);

  // Return sanitized document ready for Firestore
  return {
    ...entry,
    // Mask plaintext strings in Firestore database view
    title: '[Encrypted Entry]',
    prompt: '[Encrypted Journal Content]',
    response: entry.response ? '[Encrypted Model Reflection]' : '',
    turns: [],
    isEncrypted: true,
    encryptedPayload: {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      version: 1,
      tagLength: 128,
      encryptedAt: Date.now(),
    },
  };
}

/**
 * Decrypts a journal entry fetched from Cloud Firestore.
 * Automatically handles backwards-compatibility for unencrypted legacy entries.
 */
export async function decryptJournalEntry(
  entry: JournalInteraction,
  user: UserProfile
): Promise<JournalInteraction> {
  // If not encrypted, return untouched (preserves legacy entries without alteration)
  if (!entry.isEncrypted || !entry.encryptedPayload) {
    return entry;
  }

  if (!user?.uid) {
    return entry;
  }

  try {
    const key = await getOrCreateUserEncryptionKey(user.uid);
    const iv = base64ToBuffer(entry.encryptedPayload.iv);
    const ciphertext = base64ToBuffer(entry.encryptedPayload.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: entry.encryptedPayload.tagLength || 128,
      },
      key,
      ciphertext
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    const parsed = JSON.parse(decryptedText);

    return {
      ...entry,
      title: typeof parsed.title === 'string' ? parsed.title : entry.title,
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : entry.prompt,
      response: typeof parsed.response === 'string' ? parsed.response : entry.response,
      turns: Array.isArray(parsed.turns) ? parsed.turns : entry.turns || [],
      isEncrypted: true,
      isDecryptionFailed: false,
    };
  } catch (decryptErr) {
    console.warn('Notice: Decryption error for entry ID', entry.id, decryptErr);
    return {
      ...entry,
      title: entry.title || '[Encrypted Reflection]',
      prompt: '[Client-Side Encrypted: Unable to decrypt with current session key]',
      response: '',
      turns: [],
      isEncrypted: true,
      isDecryptionFailed: true,
    };
  }
}

/**
 * Decrypts an array of journal interactions in parallel
 */
export async function decryptJournalEntries(
  entries: JournalInteraction[],
  user: UserProfile
): Promise<JournalInteraction[]> {
  if (!entries || entries.length === 0 || !user?.uid) {
    return entries;
  }

  return Promise.all(entries.map((entry) => decryptJournalEntry(entry, user)));
}

/**
 * Clears cached encryption keys from memory (called on logout)
 */
export function clearEncryptionSessionCache(userId?: string): void {
  if (userId) {
    sessionKeyCache.delete(userId);
  } else {
    sessionKeyCache.clear();
  }
}
