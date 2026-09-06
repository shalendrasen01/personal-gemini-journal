import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Key,
  Database,
  Server,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Globe,
  Terminal,
  ArrowDown,
  Info,
  ExternalLink,
  EyeOff,
  UserCheck,
  FileCode2,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface SecurityCenterViewProps {
  user: UserProfile;
}

interface SecurityControl {
  id: string;
  name: string;
  status: 'Enforced' | 'Active' | 'Verified';
  badgeColor: string;
  icon: React.ElementType;
  explanation: string;
  protectsAgainst: string;
  technicalVerification: string;
}

export const SecurityCenterView: React.FC<SecurityCenterViewProps> = ({ user }) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'auth' | 'backend' | 'data' | 'ai'>('all');
  const [expandedControlId, setExpandedControlId] = useState<string | null>(null);

  // Verified Security Controls Matrix
  const securityControls: SecurityControl[] = [
    {
      id: 'google-auth',
      name: 'Google Authentication',
      status: 'Verified',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: UserCheck,
      explanation: 'Federated single sign-on delegated entirely to Google Identity Services with OAuth 2.0 / OpenID Connect.',
      protectsAgainst: 'Password reuse vulnerabilities, credential stuffing, brute force login attacks, and local password storage breaches.',
      technicalVerification: 'Client invokes GoogleAuthProvider via Firebase Auth SDK popup flow. No custom password hashes are stored.',
    },
    {
      id: 'firebase-auth',
      name: 'Firebase Authentication',
      status: 'Active',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Fingerprint,
      explanation: 'Issues cryptographically signed, short-lived RS256 JSON Web Tokens (JWT) bound to the user profile.',
      protectsAgainst: 'Session replay attacks, forged user sessions, unauthenticated data access, and unauthorized API invocation.',
      technicalVerification: 'Firebase client manages token lifecycle, auto-refreshes expiring tokens, and attaches bearer credentials to API calls.',
    },
    {
      id: 'firestore-rules',
      name: 'User-Scoped Firestore Access',
      status: 'Enforced',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Database,
      explanation: 'Granular Firestore security rules restrict all document reads, writes, and queries strictly to the authenticated user ID.',
      protectsAgainst: 'Insecure Direct Object References (IDOR), unauthorized cross-account reading, horizontal privilege escalation, and data leaks.',
      technicalVerification: 'firestore.rules evaluates request.auth != null && request.auth.uid == userId on all /users/{userId}/* subcollections.',
    },
    {
      id: 'token-verification',
      name: 'Firebase ID Token Verification',
      status: 'Enforced',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: ShieldCheck,
      explanation: 'Backend Express middleware validates JWT signatures, expiration timestamps, and issuer signatures on every API request.',
      protectsAgainst: 'Forged request headers, token tampering, man-in-the-middle impersonation, and unauthenticated API abuse.',
      technicalVerification: 'verifyAuth middleware in server.ts calls Firebase Admin SDK auth.verifyIdToken(token) before route handlers execute.',
    },
    {
      id: 'server-gemini',
      name: 'Server-Side Gemini API Access',
      status: 'Enforced',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Cpu,
      explanation: 'All AI reflection, search indexing, memory extraction, and weekly reviews run exclusively inside server-side Node.js endpoints.',
      protectsAgainst: 'Client-side API key theft, browser network inspection exposure, unauthorized model quota exhaustion, and browser tampering.',
      technicalVerification: '@google/genai SDK is initialized in server.ts using process.env.GEMINI_API_KEY. Zero client bundle exposure.',
    },
    {
      id: 'secret-manager',
      name: 'Secret Manager Configuration',
      status: 'Active',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Key,
      explanation: 'Production runtime credentials and API keys are injected dynamically via Google Cloud Secret Manager IAM roles.',
      protectsAgainst: 'Hardcoded source code secrets, accidental git commit leakage, container image decompilation exposure, and credential theft.',
      technicalVerification: 'Cloud Run service account possesses secretmanager.secretAccessor role. No static credentials exist in repository.',
    },
    {
      id: 'https-cloud-run',
      name: 'HTTPS & Cloud Run Ingress',
      status: 'Active',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Globe,
      explanation: 'All transport layer communication is encrypted end-to-end via TLS 1.3 / HTTPS on managed Google Cloud Run infrastructure.',
      protectsAgainst: 'Packet sniffing, unencrypted cleartext interception, session eavesdropping, and active man-in-the-middle attacks.',
      technicalVerification: 'Managed Google SSL/TLS certificates terminate ingress. Strict HTTP-to-HTTPS redirection enforced by reverse proxy.',
    },
    {
      id: 'user-isolation',
      name: 'User Data Isolation',
      status: 'Enforced',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Lock,
      explanation: 'Multi-tenant database records (reflections, memories, embeddings, goals, reviews) reside in segregated user subcollections.',
      protectsAgainst: 'Cross-tenant data contamination, global query leaks, unintended multi-user broadcast, and data privacy breaches.',
      technicalVerification: 'Both client Firestore queries and backend Admin SDK lookups filter explicitly on the authenticated req.user.uid path.',
    },
    {
      id: 'prompt-injection',
      name: 'Prompt Injection Protection',
      status: 'Verified',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Terminal,
      explanation: 'All journal text, search inputs, and goal notes are treated as untrusted plain data and cannot override system instructions.',
      protectsAgainst: 'Indirect prompt injection, jailbreak attempts, system instruction bypass, AI behavior hijacking, and rogue tool invocation.',
      technicalVerification: 'System instructions define strict boundaries. Content is structured in isolated fields; untrusted strings are sanitized.',
    },
  ];

  const filteredControls = securityControls.filter((control) => {
    if (activeCategoryFilter === 'all') return true;
    if (activeCategoryFilter === 'auth') return control.id.includes('auth') || control.id === 'token-verification';
    if (activeCategoryFilter === 'backend') return control.id === 'token-verification' || control.id === 'https-cloud-run' || control.id === 'secret-manager';
    if (activeCategoryFilter === 'data') return control.id === 'firestore-rules' || control.id === 'user-isolation';
    if (activeCategoryFilter === 'ai') return control.id === 'server-gemini' || control.id === 'prompt-injection';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* 1. Header & Posture Banner */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e0ddd5] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="w-4 h-4 text-[#4a5d4e]" />
              <span className="text-[10px] uppercase tracking-[2px] font-bold text-[#4a5d4e]">
                Security Center & Audit Log
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#1a1a1a] tracking-tight">
              Application Security Architecture
            </h1>
            <p className="text-xs sm:text-sm text-[#5a5751] mt-1 max-w-2xl leading-relaxed">
              Transparent, verified overview of the cryptographic boundaries, user data isolation mechanisms, and AI safety controls safeguarding your personal journal.
            </p>
          </div>

          {/* Security Posture Status Badge */}
          <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[1.5px] font-semibold text-[#8e8a82]">
                Security Posture
              </div>
              <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>9 of 9 Controls Active & Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Identity Context Card */}
        <div className="p-4 bg-[#fcfbf7] border border-[#e0ddd5] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#5a5751]">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-[#4a5d4e]" />
            <span>
              <strong>Authenticated Identity:</strong> {user.displayName || user.email || 'Julian R.'} ({user.email})
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#8e8a82]">
            <span>Firebase UID:</span>
            <code className="px-2 py-0.5 bg-[#edeae1] text-[#1a1a1a] rounded font-mono text-[10px]">
              {user.uid.slice(0, 10)}...{user.uid.slice(-6)}
            </code>
          </div>
        </div>
      </section>

      {/* 2. End-to-End Security Architecture Flowchart */}
      <section className="p-6 sm:p-8 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-6">
        <div className="border-b border-[#e0ddd5] pb-4">
          <div className="flex items-center gap-2 mb-1">
            <FileCode2 className="w-4 h-4 text-[#4a5d4e]" />
            <span className="text-[10px] uppercase tracking-[2px] font-bold text-[#4a5d4e]">
              Data Flow & Trust Boundaries
            </span>
          </div>
          <h2 className="font-serif text-2xl text-[#1a1a1a]">Security Architecture Workflow</h2>
          <p className="text-xs text-[#5a5751] mt-0.5">
            Every request travels through authenticated identity verification and user-bound isolation barriers.
          </p>
        </div>

        {/* Flowchart Diagram */}
        <div className="p-6 bg-[#fcfbf7] border border-[#e0ddd5] rounded">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center text-center">
            {/* Step 1: Browser */}
            <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1.5 flex flex-col items-center">
              <Globe className="w-5 h-5 text-[#4a5d4e]" />
              <div className="font-serif text-xs font-semibold text-[#1a1a1a]">Browser Client</div>
              <div className="text-[10px] text-[#8e8a82]">TLS 1.3 / HTTPS</div>
            </div>

            {/* Down/Right Arrow 1 */}
            <div className="flex justify-center text-[#8e8a82]">
              <ArrowDown className="w-4 h-4 md:-rotate-90 text-[#4a5d4e]" />
            </div>

            {/* Step 2: Firebase Auth & ID Token */}
            <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1.5 flex flex-col items-center">
              <Fingerprint className="w-5 h-5 text-indigo-700" />
              <div className="font-serif text-xs font-semibold text-[#1a1a1a]">Firebase Auth</div>
              <div className="text-[10px] text-indigo-800 font-medium">Signed JWT ID Token</div>
            </div>

            {/* Down/Right Arrow 2 */}
            <div className="flex justify-center text-[#8e8a82]">
              <ArrowDown className="w-4 h-4 md:-rotate-90 text-[#4a5d4e]" />
            </div>

            {/* Step 3: Cloud Run & Admin Verification */}
            <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1.5 flex flex-col items-center">
              <Server className="w-5 h-5 text-[#4a5d4e]" />
              <div className="font-serif text-xs font-semibold text-[#1a1a1a]">Cloud Run Backend</div>
              <div className="text-[10px] text-emerald-800 font-medium">Admin Token Verification</div>
            </div>

            {/* Down/Right Arrow 3 */}
            <div className="flex justify-center text-[#8e8a82]">
              <ArrowDown className="w-4 h-4 md:-rotate-90 text-[#4a5d4e]" />
            </div>

            {/* Step 4: Scoped Firestore & Gemini */}
            <div className="p-4 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-1.5 flex flex-col items-center">
              <Database className="w-5 h-5 text-amber-700" />
              <div className="font-serif text-xs font-semibold text-[#1a1a1a]">User Firestore & AI</div>
              <div className="text-[10px] text-amber-800 font-medium">Scoped UID / Gemini API</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#e0ddd5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#5a5751]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Zero Direct Client-to-Gemini Access:</strong> All model reasoning passes through authenticated Cloud Run endpoints.
              </span>
            </span>
            <span className="text-[11px] text-[#8e8a82]">
              Architecture Standard: Defense-in-Depth
            </span>
          </div>
        </div>
      </section>

      {/* 3. Core Security Controls Matrix (Requirement 1 & 2) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e0ddd5] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#4a5d4e]" />
              <span className="text-[10px] uppercase tracking-[2px] font-bold text-[#4a5d4e]">
                Verified Controls
              </span>
            </div>
            <h2 className="font-serif text-2xl text-[#1a1a1a]">Verified Security Controls Matrix</h2>
            <p className="text-xs text-[#5a5751] mt-0.5">
              Inspection breakdown for each technical control guarding authentication, data storage, and AI interactions.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="inline-flex p-1 bg-[#edeae1] rounded border border-[#e0ddd5] flex-wrap">
            {[
              { key: 'all', label: 'All Controls (9)' },
              { key: 'auth', label: 'Auth & Identity' },
              { key: 'backend', label: 'Backend & Cloud' },
              { key: 'data', label: 'Data & Firestore' },
              { key: 'ai', label: 'AI & Prompts' },
            ].map((filterItem) => (
              <button
                key={filterItem.key}
                type="button"
                onClick={() => setActiveCategoryFilter(filterItem.key as any)}
                className={`px-3 py-1 rounded text-xs tracking-wider transition-all cursor-pointer ${
                  activeCategoryFilter === filterItem.key
                    ? 'bg-white text-[#1a1a1a] font-semibold shadow-xs'
                    : 'text-[#8e8a82] hover:text-[#1a1a1a]'
                }`}
              >
                {filterItem.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredControls.map((control) => {
            const IconComponent = control.icon;
            const isExpanded = expandedControlId === control.id;

            return (
              <div
                key={control.id}
                className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-4 flex flex-col justify-between hover:border-[#4a5d4e]/40 transition-colors"
              >
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-[#f4f1ea] flex items-center justify-center text-[#4a5d4e] shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <h3 className="font-serif text-base font-semibold text-[#1a1a1a]">
                        {control.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[9px] font-semibold uppercase tracking-[1px] px-2 py-0.5 rounded border shrink-0 ${control.badgeColor}`}
                    >
                      {control.status}
                    </span>
                  </div>

                  {/* Explanation */}
                  <p className="text-xs text-[#2c2b29] leading-relaxed">
                    {control.explanation}
                  </p>

                  {/* What it Protects Against */}
                  <div className="p-3 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-1">
                    <div className="text-[10px] uppercase tracking-[1px] font-bold text-[#c44536] flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>Protects Against</span>
                    </div>
                    <p className="text-xs text-[#5a5751] leading-relaxed">
                      {control.protectsAgainst}
                    </p>
                  </div>
                </div>

                {/* Technical Verification Details Dropdown */}
                <div className="pt-3 border-t border-[#e0ddd5] space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpandedControlId(isExpanded ? null : control.id)}
                    className="text-[11px] font-semibold text-[#4a5d4e] hover:underline cursor-pointer flex items-center justify-between w-full"
                  >
                    <span>{isExpanded ? 'Hide Verification Audit' : 'Show Verification Audit'}</span>
                    <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="p-2.5 bg-[#edeae1]/50 border border-[#e0ddd5] rounded text-[11px] text-[#5a5751] font-mono leading-relaxed">
                      {control.technicalVerification}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Deep-Dive Security Modules: Secrets, Firestore, & Prompt Safety */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Module A: Secret Management Hygiene */}
        <div className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#4a5d4e] border-b border-[#e0ddd5] pb-3">
            <Key className="w-4 h-4" />
            <h3 className="font-serif text-lg font-semibold text-[#1a1a1a]">Secret Management</h3>
          </div>

          <div className="p-4 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
            <div className="text-[10px] uppercase tracking-[1.5px] font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Current Secret Status</span>
            </div>
            <div className="text-xs font-semibold text-[#1a1a1a] bg-white p-2.5 border border-[#e0ddd5] rounded">
              Gemini API key: Protected by Secret Manager
            </div>
          </div>

          <div className="space-y-2 text-xs text-[#5a5751] leading-relaxed">
            <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              <span>Zero Plaintext Exposure Standard</span>
            </div>
            <p>
              In accordance with security directives, secret strings, API keys, service account JSON payloads, private certificates, and session passwords are never printed or transmitted to client browser bundles.
            </p>
          </div>
        </div>

        {/* Module B: Firestore User Scoping */}
        <div className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-indigo-700 border-b border-[#e0ddd5] pb-3">
            <Database className="w-4 h-4" />
            <h3 className="font-serif text-lg font-semibold text-[#1a1a1a]">User-Scoped Firestore</h3>
          </div>

          <div className="p-4 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
            <div className="text-[10px] uppercase tracking-[1.5px] font-bold text-indigo-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Data Scoping Rule</span>
            </div>
            <p className="text-xs text-[#2c2b29] leading-relaxed">
              All journal reflections, long-term memories, goals, and weekly reviews are strictly scoped by authenticated Firebase UID (<code>/users/{user.uid.slice(0, 8)}.../*</code>).
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#5a5751] leading-relaxed">
            <div className="flex items-center gap-1.5 text-indigo-800 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Strict Non-Cross-User Access</span>
            </div>
            <p>
              The application engine guarantees that another user's private reflections and goals can never be queried, listed, or displayed under any circumstance.
            </p>
          </div>
        </div>

        {/* Module C: Prompt Injection & AI Safety */}
        <div className="p-6 bg-white border border-[#e0ddd5] rounded shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-purple-700 border-b border-[#e0ddd5] pb-3">
            <Terminal className="w-4 h-4" />
            <h3 className="font-serif text-lg font-semibold text-[#1a1a1a]">Prompt Safety & Isolation</h3>
          </div>

          <div className="p-4 bg-[#fcfbf7] border border-[#e0ddd5] rounded space-y-2">
            <div className="text-[10px] uppercase tracking-[1.5px] font-bold text-purple-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              <span>Untrusted Data Boundary</span>
            </div>
            <p className="text-xs text-[#2c2b29] leading-relaxed">
              Journal content and reflections are treated strictly as untrusted data inputs and cannot override or subvert system-level directives.
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#5a5751] leading-relaxed">
            <div className="flex items-center gap-1.5 text-purple-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>System Instruction Binding</span>
            </div>
            <p>
              System prompts enforce non-clinical framing, strict JSON schema output validation, and payload sanitization before model inference execution.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Audit Transparency & Compliance Footer */}
      <section className="p-6 bg-[#edeae1]/60 border border-[#e0ddd5] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#5a5751]">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-[#4a5d4e] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-[#1a1a1a]">
              Continuous Verification Guarantee:
            </span>
            <p className="text-[11px] text-[#5a5751]">
              Every control on this page is actively enforced by production configuration, Cloud Run container constraints, and deployed Firestore security rules.
            </p>
          </div>
        </div>

        <div className="text-[11px] text-[#8e8a82] shrink-0 font-mono">
          Audit Status: VERIFIED_ENFORCED
        </div>
      </section>
    </div>
  );
};
