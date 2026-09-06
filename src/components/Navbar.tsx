import React from 'react';
import { BookOpen, Sparkles, History, LogOut, User as UserIcon, Shield } from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile;
  activeTab: 'journal' | 'history' | 'search' | 'memory' | 'goals' | 'map' | 'dashboard' | 'security';
  onTabChange: (tab: 'journal' | 'history' | 'search' | 'memory' | 'goals' | 'map' | 'dashboard' | 'security') => void;
  onLogout: () => void;
  historyCount: number;
  memoryCount?: number;
  goalsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  onTabChange,
  onLogout,
  historyCount,
  memoryCount = 0,
  goalsCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#f8f6f0] border-b border-[#e0ddd5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        {/* Editorial Masthead */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif italic font-normal text-2xl text-[#4a5d4e] tracking-tight">
                Gemini Journal
              </span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#4a5d4e]"></span>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-[2px] text-[#8e8a82] font-semibold">
                Editorial Edition
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[2px] text-[#8e8a82] mt-0.5">
              Authenticated: {user.displayName || user.email || 'Julian R.'}
            </p>
          </div>
        </div>

        {/* Center Nav with Editorial Dot Indicators */}
        <nav className="flex items-center gap-6 sm:gap-8">
          <button
            id="nav-journal-tab"
            type="button"
            onClick={() => onTabChange('journal')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'journal'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'journal'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>New Reflection</span>
          </button>

          <button
            id="nav-history-tab"
            type="button"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'history'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>Archive</span>
            {historyCount > 0 && (
              <span className="font-serif italic text-xs text-[#8e8a82] lowercase">
                ({historyCount})
              </span>
            )}
          </button>

          <button
            id="nav-search-tab"
            type="button"
            onClick={() => onTabChange('search')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'search'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'search'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>Search</span>
          </button>

          <button
            id="nav-memory-tab"
            type="button"
            onClick={() => onTabChange('memory')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'memory'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'memory'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>Memory</span>
            {memoryCount > 0 && (
              <span className="font-serif italic text-xs text-[#8e8a82] lowercase">
                ({memoryCount})
              </span>
            )}
          </button>

          <button
            id="nav-goals-tab"
            type="button"
            onClick={() => onTabChange('goals')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'goals'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'goals'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>Goals</span>
            {goalsCount > 0 && (
              <span className="font-serif italic text-xs text-[#8e8a82] lowercase">
                ({goalsCount})
              </span>
            )}
          </button>

          <button
            id="nav-map-tab"
            type="button"
            onClick={() => onTabChange('map')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'map'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'map'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>Map</span>
          </button>

          <button
            id="nav-dashboard-tab"
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>Dashboard</span>
          </button>

          <button
            id="nav-security-tab"
            type="button"
            onClick={() => onTabChange('security')}
            className={`flex items-center gap-2.5 py-1 text-xs uppercase tracking-[1.5px] transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'text-[#1a1a1a] font-semibold'
                : 'text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                activeTab === 'security'
                  ? 'bg-[#4a5d4e]'
                  : 'border border-[#8e8a82]'
              }`}
            />
            <span>Security</span>
          </button>
        </nav>

        {/* User Badge & Sign Out */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 border border-[#e0ddd5] rounded bg-white text-[11px] text-[#4a5d4e]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4a5d4e] animate-pulse" />
            <span className="font-serif italic font-medium">Gemini 3.8</span>
            <span className="text-[#8e8a82]">• Online</span>
          </div>

          <button
            id="btn-logout"
            type="button"
            onClick={onLogout}
            title="Sign Out"
            className="text-xs font-medium text-[#c44536] hover:underline cursor-pointer bg-transparent border-none p-0 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};
