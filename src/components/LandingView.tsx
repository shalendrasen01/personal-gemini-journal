import React from 'react';
import { ShieldCheck, Lock, ArrowRight, MessageSquare, Compass, ArrowUpRight, RotateCcw } from 'lucide-react';

interface LandingViewProps {
  onSignIn: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSignIn,
  isLoading,
  errorMessage,
}) => {
  return (
    <div className="relative min-h-screen bg-[#fcfbf7] text-[#1a1a1a] flex flex-col justify-between overflow-x-hidden">
      {/* Subtle Full-Bleed Background Texture & Soft Editorial Linework */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Soft Radial Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[620px] bg-[radial-gradient(ellipse_70%_55%_at_50%_15%,rgba(74,93,78,0.07),transparent_70%)]" />

        {/* Micro-Dot Monograph Paper Texture */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-[0.35]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="monograph-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.75" fill="#4a5d4e" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#monograph-grid)" />
        </svg>

        {/* Soft Editorial Contour Rings Illustration Behind Headline */}
        <svg
          aria-hidden="true"
          className="absolute left-1/2 top-20 sm:top-24 -translate-x-1/2 w-[860px] max-w-[96vw] h-[440px] text-[#4a5d4e]/[0.08] pointer-events-none select-none"
          viewBox="0 0 860 440"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="430" cy="220" rx="410" ry="195" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
          <ellipse cx="430" cy="220" rx="330" ry="150" stroke="currentColor" strokeWidth="1.2" />
          <ellipse cx="430" cy="220" rx="240" ry="105" stroke="currentColor" strokeWidth="1" strokeDasharray="8 8" />
          <ellipse cx="430" cy="220" rx="145" ry="60" stroke="currentColor" strokeWidth="1.2" />
          {/* Gentle flowing horizon contours */}
          <path d="M50 220C170 150 290 290 430 220C570 150 690 290 810 220" stroke="currentColor" strokeWidth="0.9" />
          <path d="M110 220C210 170 310 270 430 220C550 170 650 270 750 220" stroke="currentColor" strokeWidth="0.7" strokeDasharray="5 5" />
          <circle cx="430" cy="220" r="3" fill="currentColor" />
        </svg>
      </div>

      {/* Top Editorial Masthead Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 sm:px-12 py-8 flex items-center justify-between border-b border-[#e0ddd5]/80">
        <div>
          <span className="font-serif italic text-2xl text-[#2d3a30] tracking-tight">
            Gemini Journal
          </span>
          <p className="text-[10px] uppercase tracking-[2px] text-[#2c2c2c] font-medium mt-0.5">
            Private Reflective Monograph
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs uppercase tracking-[1.5px] text-[#242424] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4a5d4e]"></span>
          <span>Zero-Knowledge Firestore</span>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 sm:px-12 py-16 sm:py-20 flex flex-col items-center text-center">
        {/* Editorial Subtitle */}
        <p className="text-[11px] uppercase tracking-[2.5px] text-[#2a2d2b] font-semibold mb-6">
          Issue No. 1 • The Reflective Mind
        </p>

        {/* Primary Heading */}
        <h1 className="font-serif italic text-4xl sm:text-6xl text-[#121212] tracking-tight leading-[1.2] max-w-3xl mb-6">
          A confidential sanctuary to reflect, converse, and find clarity.
        </h1>

        {/* Hero Body Text - Darkened to crisp near-black for high contrast */}
        <p className="font-serif text-base sm:text-xl text-[#1c1917] max-w-2xl leading-[1.8] mb-12">
          Transform your raw thoughts, daily tensions, and decisions into structured insights.
          Engage in multi-turn reflective dialogues with Gemini and safely preserve your growth in isolated Cloud Firestore storage.
        </p>

        {/* Authentication notification banner if any */}
        {errorMessage && (
          <div className="w-full max-w-md mb-8 p-5 rounded-xl border border-[#e0ddd5]/80 bg-white text-xs text-left shadow-[0_4px_16px_-4px_rgba(26,26,26,0.06)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[2px] text-[#2d3a30] font-bold">
                Authentication Notice
              </span>
              <button
                type="button"
                onClick={onSignIn}
                disabled={isLoading}
                className="inline-flex items-center gap-1 text-[11px] text-[#121212] hover:text-[#4a5d4e] font-semibold underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry Sign-In</span>
              </button>
            </div>
            <p className="font-serif italic text-sm text-[#1f1f1f] mb-2 leading-relaxed">
              {errorMessage}
            </p>
            {typeof window !== 'undefined' && window.self !== window.top && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-[11px] text-[#2d3a30] hover:underline font-semibold"
              >
                <span>Open in new tab to bypass iframe popup constraints</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Sign-In Monograph Box - Soft shadow integration */}
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xs p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_-12px_rgba(40,35,25,0.09),0_4px_16px_-2px_rgba(40,35,25,0.03)] border border-stone-200/40 hover:shadow-[0_24px_54px_-12px_rgba(40,35,25,0.12),0_6px_20px_-2px_rgba(40,35,25,0.05)] transition-shadow duration-300">
          <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[2px] text-[#2a2d2b] font-bold mb-6">
            <Lock className="w-3.5 h-3.5 text-[#4a5d4e]" />
            <span>Federated Google Access</span>
          </div>

          <button
            id="btn-google-signin"
            type="button"
            disabled={isLoading}
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#141414] hover:bg-[#2c2c2c] active:bg-[#000] text-white text-xs uppercase tracking-wider font-medium rounded-xl transition-all disabled:opacity-50 cursor-pointer group shadow-sm"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </div>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign in with Google</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          <p className="font-serif italic text-xs text-[#242424] mt-5 leading-relaxed">
            No password creation or storage. Protected by Google Identity and strict owner-bound Cloud Firestore isolation.
          </p>
        </div>

        {/* Feature Triad - Increased padding, monoline icons, darkened text */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-16 text-left">
          {/* Feature 1 */}
          <div className="p-8 sm:p-9 bg-white/95 backdrop-blur-xs rounded-2xl border border-stone-200/50 shadow-[0_10px_30px_-10px_rgba(40,35,25,0.06)] hover:shadow-[0_16px_36px_-10px_rgba(40,35,25,0.09)] transition-all duration-300">
            <div className="w-9 h-9 rounded-xl bg-[#4a5d4e]/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-4.5 h-4.5 text-[#3a4e3e]" strokeWidth={1.6} />
            </div>
            <p className="font-serif italic text-lg text-[#233126] font-medium mb-2">
              Multi-Turn Dialogue
            </p>
            <p className="text-xs text-[#1f1f1f] leading-relaxed">
              Don't just record thoughts and close the notebook. Delve deeper into emotional patterns with iterative Gemini reflections.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-8 sm:p-9 bg-white/95 backdrop-blur-xs rounded-2xl border border-stone-200/50 shadow-[0_10px_30px_-10px_rgba(40,35,25,0.06)] hover:shadow-[0_16px_36px_-10px_rgba(40,35,25,0.09)] transition-all duration-300">
            <div className="w-9 h-9 rounded-xl bg-[#4a5d4e]/10 flex items-center justify-center mb-4">
              <Compass className="w-4.5 h-4.5 text-[#3a4e3e]" strokeWidth={1.6} />
            </div>
            <p className="font-serif italic text-lg text-[#233126] font-medium mb-2">
              Four Reframing Lenses
            </p>
            <p className="text-xs text-[#1f1f1f] leading-relaxed">
              Switch fluidly between Deep Reflection, Executive Summaries, Creative Brainstorms, and Micro-Action Plans.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-8 sm:p-9 bg-white/95 backdrop-blur-xs rounded-2xl border border-stone-200/50 shadow-[0_10px_30px_-10px_rgba(40,35,25,0.06)] hover:shadow-[0_16px_36px_-10px_rgba(40,35,25,0.09)] transition-all duration-300">
            <div className="w-9 h-9 rounded-xl bg-[#4a5d4e]/10 flex items-center justify-center mb-4">
              <ShieldCheck className="w-4.5 h-4.5 text-[#3a4e3e]" strokeWidth={1.6} />
            </div>
            <p className="font-serif italic text-lg text-[#233126] font-medium mb-2">
              Owner-Bound Security
            </p>
            <p className="text-xs text-[#1f1f1f] leading-relaxed">
              Strict rules enforce that only your verified Google authentication UID can access your journal archives.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 border-t border-[#e0ddd5]/80 text-center text-xs text-[#2b2b2b] font-medium">
        Gemini Journal • Editorial Edition • Designed for Cloud Run & Cloud Firestore
      </footer>
    </div>
  );
};
