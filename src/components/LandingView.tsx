import React from 'react';
import { Sparkles, ShieldCheck, Lock, ArrowRight, MessageSquare, Compass, ArrowUpRight, RotateCcw } from 'lucide-react';

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
    <div className="min-h-screen bg-[#fcfbf7] text-[#1a1a1a] flex flex-col justify-between">
      {/* Top Editorial Masthead Header */}
      <header className="max-w-6xl mx-auto w-full px-6 sm:px-12 py-8 flex items-center justify-between border-b border-[#e0ddd5]">
        <div>
          <span className="font-serif italic text-2xl text-[#4a5d4e] tracking-tight">
            Gemini Journal
          </span>
          <p className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] mt-0.5">
            Private Reflective Monograph
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs uppercase tracking-[1.5px] text-[#8e8a82]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4a5d4e]"></span>
          <span>Zero-Knowledge Firestore</span>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-4xl mx-auto w-full px-6 sm:px-12 py-16 sm:py-20 flex flex-col items-center text-center">
        {/* Editorial Subtitle */}
        <p className="text-[11px] uppercase tracking-[2.5px] text-[#8e8a82] font-semibold mb-6">
          Issue No. 1 • The Reflective Mind
        </p>

        {/* Primary Heading */}
        <h1 className="font-serif italic text-4xl sm:text-6xl text-[#1a1a1a] tracking-tight leading-[1.2] max-w-3xl mb-6">
          A confidential sanctuary to reflect, converse, and find clarity.
        </h1>

        <p className="font-serif text-base sm:text-xl text-[#555] max-w-2xl leading-[1.8] mb-12">
          Transform your raw thoughts, daily tensions, and decisions into structured insights.
          Engage in multi-turn reflective dialogues with Gemini and safely preserve your growth in isolated Cloud Firestore storage.
        </p>

        {/* Authentication notification banner if any */}
        {errorMessage && (
          <div className="w-full max-w-md mb-8 p-4 border border-[#e0ddd5] bg-white text-xs text-left shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[2px] text-[#4a5d4e] font-bold">
                Authentication Notice
              </span>
              <button
                type="button"
                onClick={onSignIn}
                disabled={isLoading}
                className="inline-flex items-center gap-1 text-[11px] text-[#1a1a1a] hover:text-[#4a5d4e] font-semibold underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry Sign-In</span>
              </button>
            </div>
            <p className="font-serif italic text-sm text-[#555] mb-2 leading-relaxed">
              {errorMessage}
            </p>
            {typeof window !== 'undefined' && window.self !== window.top && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-[11px] text-[#4a5d4e] hover:underline font-medium"
              >
                <span>Open in new tab to bypass iframe popup constraints</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Sign-In Monograph Box */}
        <div className="w-full max-w-md bg-white border border-[#e0ddd5] p-8 sm:p-10 shadow-2xs">
          <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[2px] text-[#8e8a82] font-bold mb-6">
            <Lock className="w-3.5 h-3.5 text-[#4a5d4e]" />
            <span>Federated Google Access</span>
          </div>

          <button
            id="btn-google-signin"
            type="button"
            disabled={isLoading}
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#1a1a1a] hover:bg-[#333] active:bg-[#000] text-white text-xs uppercase tracking-wider font-medium transition-all disabled:opacity-50 cursor-pointer group"
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

          <p className="font-serif italic text-xs text-[#8e8a82] mt-5 leading-relaxed">
            No password creation or storage. Protected by Google Identity and strict owner-bound Cloud Firestore isolation.
          </p>
        </div>

        {/* Feature Triad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-16 text-left">
          <div className="p-6 bg-white border border-[#e0ddd5]">
            <p className="font-serif italic text-lg text-[#4a5d4e] mb-2">
              Multi-Turn Dialogue
            </p>
            <p className="text-xs text-[#555] leading-relaxed">
              Don't just record thoughts and close the notebook. Delve deeper into emotional patterns with iterative Gemini reflections.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#e0ddd5]">
            <p className="font-serif italic text-lg text-[#4a5d4e] mb-2">
              Four Reframing Lenses
            </p>
            <p className="text-xs text-[#555] leading-relaxed">
              Switch fluidly between Deep Reflection, Executive Summaries, Creative Brainstorms, and Micro-Action Plans.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#e0ddd5]">
            <p className="font-serif italic text-lg text-[#4a5d4e] mb-2">
              Owner-Bound Security
            </p>
            <p className="text-xs text-[#555] leading-relaxed">
              Strict rules enforce that only your verified Google authentication UID can access your journal archives.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full px-6 py-6 border-t border-[#e0ddd5] text-center text-xs text-[#8e8a82]">
        Gemini Journal • Editorial Edition • Designed for Cloud Run & Cloud Firestore
      </footer>
    </div>
  );
};
