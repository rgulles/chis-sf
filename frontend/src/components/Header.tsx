import React from 'react';
import { User } from 'lucide-react';
import type { ViewType, UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onOpenSearch?: () => void;
  onOpenQRScanner?: () => void;
  onOpenAuth: () => void;
  user: UserProfile | null;
  totalSites?: number;
  onToggleAdminMode?: () => void;
  savedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenSearch,
  onOpenQRScanner,
  onOpenAuth,
  user,
  onToggleAdminMode,
  savedCount = 0,
}) => {
  const desktopNavItems: Array<{ id: ViewType; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'explore', label: 'Explore Heritage' },
    { id: 'events', label: 'Events' },
    { id: 'plan', label: 'Plan Your Visit' },
    { id: 'about', label: 'About' },
  ];

  return (
    <header id="app-header" className="sticky top-0 z-40 w-full border-b border-[#e7e0d6] bg-[#fff8f5]/95 backdrop-blur-md">
      {/* Main Navigation Bar */}
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Logo (Red Star Emblem) */}
        <div id="brand-logo">
          <BrandLogo 
            onClick={() => onNavigate('home')} 
            className="scale-105 origin-left"
          />
        </div>

        {/* Desktop Navigation Links */}
        <nav id="desktop-nav-menu" className="hidden lg:flex items-center space-x-1.5">
          {desktopNavItems.map((item) => {
            const isActive = item.id === 'explore'
              ? (currentView === 'explore' || currentView === 'map')
              : currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onNavigate(item.id)}
                className={`rounded-md px-4 py-2 text-sm font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-[#7e1925] text-white'
                    : 'text-[#1e1b19] hover:bg-[#faf2ee] hover:text-[#7e1925]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions Area */}
        <div className="flex items-center gap-3">
          {onOpenSearch && (
            <button onClick={onOpenSearch} className="p-2 text-[#7e1925] hover:bg-[#faf2ee] rounded-full transition-colors" title="Search">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
          )}
          {onOpenQRScanner && (
            <button onClick={onOpenQRScanner} className="p-2 text-[#7e1925] hover:bg-[#faf2ee] rounded-full transition-colors hidden sm:block" title="Scan QR Code">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
            </button>
          )}
          <button onClick={() => onNavigate('saved')} className="p-2 text-[#7e1925] hover:bg-[#faf2ee] rounded-full transition-colors relative" title="Saved Plans">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
            {savedCount > 0 && (
              <span className="absolute top-0 right-0 h-4 w-4 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center border-2 border-[#fff8f5]">
                {savedCount}
              </span>
            )}
          </button>
          <button
            id="header-profile-btn"
            onClick={user?.role === 'admin' ? onToggleAdminMode : onOpenAuth}
            className="group relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#7e1925] bg-[#fff8f5] hover:bg-[#faf2ee] hover:border-[#580b14] transition-all overflow-hidden shadow-xs hover:shadow focus:outline-none focus:ring-2 focus:ring-[#7e1925]/30"
            title={user ? `${user.name} (Profile & Admin)` : 'Sign In / Admin Login'}
            aria-label="Profile and Admin Login"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User Profile'}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/characters/nicolasa-dayrit.jpg';
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#7e1925]">
                <User className="h-5 w-5 text-[#7e1925] stroke-[2.2]" />
              </div>
            )}
            {user?.role === 'admin' && (
              <span 
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#7e1925] border-2 border-white ring-1 ring-[#5e0012]" 
                title="Admin Logged In" 
              />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
