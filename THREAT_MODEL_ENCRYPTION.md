# Client-Side Zero-Knowledge Encryption: Threat Model & Cryptographic Specification

## 1. Executive Summary & Objective
This application implements **Client-Side Zero-Knowledge Authenticated Encryption** using the W3C Web Cryptography API (`window.crypto.subtle`). Before any user journal reflection, dialogue turn, or prompt is transmitted across the network and stored in Google Cloud Firestore, it is encrypted on the client device using AES-256-GCM. 

Decryption occurs strictly client-side after documents are fetched. The database server, cloud storage buckets, and infrastructure operators only ever observe Base64-encoded ciphertext and cryptographic initialization vectors (IVs).

---

## 2. Cryptographic Architecture & Primitives

| Component | Technical Specification | Rationale |
| :--- | :--- | :--- |
| **Symmetric Cipher** | `AES-256-GCM` (Galois/Counter Mode) | Standard authenticated symmetric cipher; guarantees both confidentiality and tamper-evident message integrity. |
| **Authentication Tag** | `128 bits` | Maximum security tag length for AES-GCM, preventing ciphertext bit-flipping attacks. |
| **Initialization Vector (IV)** | `96 bits (12 bytes)` cryptographically random | Generated freshly for every write operation via `crypto.getRandomValues()`, preventing IV reuse attacks across entries. |
| **Key Derivation Function (KDF)** | `PBKDF2` with `SHA-256` | Derives cryptographic keys from user session material with high computational hardness. |
| **KDF Iterations** | `100,000 rounds` | Matches OWASP password hashing and key derivation security baselines to prevent brute-force attacks. |
| **Key Extraction Safeguard** | `extractable: false` | Prevents the raw AES key bits from being exported from WebCrypto browser memory by rogue scripts or extensions. |
| **Salt Generation** | User-specific namespace salt (`gemini-journal-salt-v1:${userId}`) | Ensures that identical entries across different users produce different ciphertext keys. |

---

## 3. Threat Model Coverage Matrix

### 3.1. What This Encryption DOES Protect Against (In-Scope Defenses)

| Threat Scenario | Attack Vector | Mitigation Provided |
| :--- | :--- | :--- |
| **Cloud Firestore Database Breach** | Attacker gains unauthorized read access to Firestore collections via misconfigured IAM rules or database export leaks. | **Complete Protection**: The attacker only obtains encrypted ciphertext envelopes (`encryptedPayload.ciphertext`, `iv`). Plaintext prompts, responses, and dialogue turns cannot be read without the user's client-side key. |
| **Rogue Cloud Infrastructure Admin** | Cloud project administrator, support personnel, or rogue service account inspects Firestore documents directly in the GCP console. | **Complete Protection**: All journal reflections, user text, and AI responses appear as masked strings (`[Encrypted Entry]`, `[Encrypted Journal Content]`). |
| **Exfiltrated Storage Backups** | Cold backups or database snapshots stored in Google Cloud Storage are stolen or intercepted. | **Complete Protection**: Backup files contain only AES-GCM ciphertext blocks. Decryption requires client-side WebCrypto key derivation. |
| **Ciphertext Tampering / Bit-Flipping** | Malicious actor modifies ciphertext bytes in transit or at rest in Firestore. | **Complete Protection**: AES-GCM computes a 128-bit authentication tag. Any modification of ciphertext or IV causes `crypto.subtle.decrypt` to throw a verification error, preventing corrupted data from being accepted. |
| **Cross-User Session Contamination** | User A tries to decrypt User B's entries. | **Complete Protection**: Key derivation binds specifically to `user.uid` and user-specific client secret entropy. User A's derived key fails authentication tag validation against User B's entries. |

---

### 3.2. What This Encryption DOES NOT Protect Against (Out-of-Scope / Residual Risks)

| Residual Risk | Attack Vector | Technical Boundary / Explanation |
| :--- | :--- | :--- |
| **Compromised Client Device (Host OS Malware)** | User's personal computer or phone is infected with keyloggers, screen scrapers, or memory-dumping malware. | **Out of Scope**: If the client environment itself is compromised, malware can intercept keystrokes before WebCrypto encryption or read decrypted DOM nodes directly from browser memory. |
| **Malicious Browser Extensions** | User installs a rogue browser extension with broad `tabs`, `<all_urls>`, or `activeTab` permissions. | **Out of Scope**: Browser extensions running in the same browser context can inspect the DOM tree where decrypted reflection text is rendered. |
| **Cross-Site Scripting (XSS)** | Injection of arbitrary JavaScript execution in the application's client origin. | **Out of Scope**: An attacker executing arbitrary JS within the application's origin can invoke `crypto.subtle` with the user's active session or read user input fields before encryption. *(Mitigated at application layer by strict React JSX escaping and zero `dangerouslySetInnerHTML` usage).* |
| **Physical Access / Unlocked Device Theft** | Unauthorized individual physically accesses an unlocked laptop or phone with an active browser session. | **Out of Scope**: Once the user has signed in and decrypted entries are rendered in the DOM, physical observation cannot be prevented cryptographically. Users must rely on OS-level screen locks and logout controls. |
| **Structural / Behavioral Metadata Leakage** | Traffic analysis or database inspection of unencrypted metadata fields. | **Partial / Out of Scope**: Document identifiers (`id`), creation timestamps (`createdAt`), classification modes (`mode`), and geotag coordinates (`location`) remain unencrypted to support Firestore range querying and map rendering. |

---

## 4. Key Lifecycle & Storage

1. **Generation / Derivation**:
   - On user sign-in, the application retrieves or generates a 256-bit cryptographically secure user client secret.
   - Using `window.crypto.subtle.importKey`, key material is imported and derived via `PBKDF2` (SHA-256, 100,000 iterations).
   - The derived `CryptoKey` is retained strictly in non-exportable browser memory (`extractable: false`) and cached in an ephemeral session map.
2. **Encryption (Write Phase)**:
   - `encryptJournalEntry(entry, user)` packages `{ title, prompt, response, turns }`.
   - Generates a fresh 12-byte random IV.
   - Encrypts via AES-GCM (128-bit tag).
   - Sets Firestore fields: `isEncrypted: true`, `encryptedPayload: { ciphertext, iv, version: 1, tagLength: 128, encryptedAt }`.
3. **Decryption (Read Phase)**:
   - `decryptJournalEntry(entry, user)` inspects `isEncrypted`.
   - If not encrypted (legacy entries), returns as-is for backward compatibility.
   - If encrypted, converts Base64 IV and ciphertext, runs `crypto.subtle.decrypt`, and parses decrypted JSON into memory.
4. **Session Teardown**:
   - On sign-out, `clearEncryptionSessionCache(user.uid)` purges cached `CryptoKey` objects from memory.

---

## 5. Threat Summary Matrix

| Threat Zone | Threat Scenario | Countermeasure Implemented |
| :--- | :--- | :--- |
| **Input Surfaces** | User journal entry containing sensitive reflections | Client-side WebCrypto AES-256-GCM encryption before network transmission. |
| **Storage & State** | Direct Firestore data breach or backup leak | Ciphertext envelopes only; zero plaintext in Firestore. |
| **Key Compromise** | Malicious script attempting to extract raw symmetric key | `extractable: false` prevents raw key export from WebCrypto memory. |
| **Data Integrity** | Ciphertext tampering in database | 128-bit AES-GCM authentication tag verification rejects altered payloads. |
| **Client Endpoint** | Malware / Keylogger on user device | **Documented Out of Scope**: Requires host OS endpoint security and browser isolation. |
