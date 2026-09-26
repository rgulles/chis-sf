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
  isAdminMode?: boolean;
  onToggleAdminMode?: () => void;
  savedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenAuth,
  user,
  isAdminMode = false,
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

        {/* Actions Area: Profile Icon with Red Border */}
        <div className="flex items-center gap-2">
          <button
            id="header-profile-btn"
            onClick={onOpenAuth}
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
            {isAdminMode && (
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
