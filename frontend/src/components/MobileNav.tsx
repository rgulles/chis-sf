import React from 'react';
import { Home, Compass, Calendar, Bookmark, Navigation } from 'lucide-react';
import type { ViewType } from '../types';

interface MobileNavProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  savedCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  onNavigate,
  savedCount
}) => {
  const items: Array<{ id: ViewType; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'plan', label: 'Plan', icon: Navigation },
    { id: 'saved', label: 'Saved', icon: Bookmark },
  ];

  return (
    <nav id="mobile-bottom-nav" className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#e7e0d6] bg-[#faf2ee]/95 backdrop-blur-md pb-safe">
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto items-center px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'explore'
            ? (currentView === 'explore' || currentView === 'map')
            : currentView === item.id;
          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
              className={`relative min-h-11 min-w-0 flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-[#7e1925]' : 'text-[#574141] hover:text-[#1e1b19]'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                {item.id === 'saved' && savedCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#7e1925] text-[9px] font-bold text-white">
                    {savedCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-wider uppercase font-sans ${isActive ? 'text-[#7e1925] font-bold' : 'text-[#574141] font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 h-0.5 w-6 bg-[#7e1925]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
