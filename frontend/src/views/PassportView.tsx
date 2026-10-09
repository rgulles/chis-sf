import React, { useState } from 'react';
import { LockKeyhole, Award, User } from 'lucide-react';
import type { HeritagePassport, HeritageSite, UserProfile } from '../types';

interface PassportViewProps {
  user: UserProfile | null;
  passport: HeritagePassport | null;
  error: string;
  onLogin: () => void;
  onRetry: () => void;
  onSite: (site: HeritageSite) => void;
}

export function PassportView({ user, passport, error, onLogin, onRetry, onSite }: PassportViewProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'forward' | 'backward'>('forward');
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);

  // Compute pages data
  const percent = passport?.eligible_site_count ? Math.min(100, Math.round((passport.visited_eligible_count / passport.eligible_site_count) * 100)) : 0;
  const eligibleIds = new Set(passport?.eligible_sites.map(s => String(s.id)));
  const historicVisits = passport?.visits.filter(v => !eligibleIds.has(String(v.heritage_site_id))) || [];
  const allStamps = [...(passport?.eligible_sites || []), ...(historicVisits.map(v => v.site))];
  const visitsMap = new Map(passport?.visits.map(visit => [String(visit.heritage_site_id), visit]));

  const achievements = [
    { id: 'first', title: 'First Discovery', desc: 'Earn your first heritage stamp.', req: 1 },
    { id: 'explorer', title: 'Heritage Explorer', desc: 'Visit five unique heritage sites.', req: 5 },
    { id: 'enthusiast', title: 'Cultural Enthusiast', desc: 'Visit ten unique heritage sites.', req: 10 },
    { id: 'discoverer', title: 'San Fernando Discoverer', desc: 'Complete all eligible heritage site stamps.', req: passport?.eligible_site_count || 999 }
  ];

  const visitCount = passport?.visits.length || 0;

  // Build Pages Array
  const pages: React.ReactNode[] = [];

  // Page 0: Cover (Matching requested colors & logo)
  pages.push(
    <div key="cover" className="flex flex-col items-center justify-center h-full bg-[#401C24] text-[#e7c980] p-6 sm:p-10 relative overflow-hidden select-none">
      {/* Paper Texture Overlay */}
      <div className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

      <div className="relative z-10 w-full flex flex-col items-center justify-center gap-0 sm:gap-1 opacity-90">
        <h1 className="font-['Cambria',_Georgia,_serif] text-4.5xl sm:text-[2.5rem] font-bold tracking-widest uppercase text-center text-[#e7c980] whitespace-nowrap w-full">
          San Fernando
        </h1>

        <div className="flex flex-col items-center justify-center w-full px-0">
          <img
            src="/images/passport-logo.png"
            alt="San Fernando Heritage Logo"
            className="w-full aspect-square max-w-[240px] sm:max-w-[280px] object-contain mix-blend-screen py-3"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
          />
          <div className="hidden flex-col items-center justify-center w-full aspect-square max-w-[240px] sm:max-w-[280px] rounded-full bg-[#e7c980]/5">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#e7c980] text-center px-2">Logo Here</span>
          </div>
        </div>

        <div className="w-full flex flex-col items-center justify-center gap-1 mt-0">
          <h2 className="font-['Cambria',_Georgia,_serif] text-4.5xl sm:text-[2.5rem] font-bold tracking-widest uppercase text-center text-[#e7c980] whitespace-nowrap w-full leading-none">
            Pasaporte
          </h2>
          <div className="w-12 h-7 border-[2px] border-[#e7c980] rounded flex items-center justify-center mt-3">
            <div className="w-3.5 h-3.5 rounded-full bg-[#e7c980]"></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Unauthenticated Fallback
  if (!user || (!passport && !error)) {
    pages.push(
      <div key="unauth" className="flex flex-col items-center justify-center h-full bg-[#fdf8f0] text-[#2c2825] p-8 text-center relative border-x border-[#e8dfd5]">
        <LockKeyhole className="w-12 h-12 text-[#4a2422] mb-4 opacity-50" />
        <h2 className="font-['Cinzel',_serif] text-2xl font-bold mb-2">Passport Locked</h2>
        <p className="text-sm text-gray-600 mb-6 max-w-xs">{error || 'Please sign in or create an account to view and collect verified heritage stamps.'}</p>
        <button className="bg-[#4a2422] text-[#fdf8f0] px-6 py-3 rounded-full font-bold shadow-md hover:bg-[#2c1514] transition-colors uppercase text-sm tracking-wider" onClick={error ? onRetry : onLogin}>
          {error ? 'Retry Loading' : 'Sign in to Open'}
        </button>
      </div>
    );
  } else if (error) {
    pages.push(
      <div key="error" className="flex flex-col items-center justify-center h-full bg-[#fdf8f0] text-[#2c2825] p-8 text-center relative border-x border-[#e8dfd5]">
        <h2 className="font-['Cinzel',_serif] text-2xl font-bold text-red-700 mb-2">Verification Error</h2>
        <p className="text-sm text-gray-600 mb-6 max-w-xs">{error}</p>
        <button className="bg-[#4a2422] text-[#fdf8f0] px-6 py-3 rounded-full font-bold shadow-md hover:bg-[#2c1514] transition-colors uppercase text-sm tracking-wider" onClick={onRetry}>Retry</button>
      </div>
    );
  } else {
    const p = passport!;

    // Page 1: Identity & Journey
    pages.push(
      <div key="identity" className="flex flex-col h-full bg-[#f4f8f7] text-[#2c2825] p-5 sm:p-8 relative overflow-hidden">
        {/* Passport Guilloche/Watermark simulation */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#e2eceb_0%,_transparent_70%)] pointer-events-none"></div>
        <div className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
        <div className="absolute top-3 bottom-3 left-3 right-3 border-[0.5px] border-[#6b8e88] opacity-30 pointer-events-none rounded-sm"></div>

        <div className="relative z-10 flex flex-col h-full w-full">
          <div className="flex flex-col items-center border-b border-[#6b8e88]/30 pb-2 mb-4 mt-1 text-center">
            <p className="text-[7px] font-sans font-bold tracking-[0.2em] text-[#6b8e88] uppercase mb-1">Lungsod ng San Fernando</p>
            <h2 className="font-['Cambria',_Georgia,_serif] text-base sm:text-lg font-bold uppercase tracking-[0.1em] text-[#2c3e50]">Traveler Identity</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start mb-6 w-full">
            <div className="w-20 h-28 sm:w-24 sm:h-32 bg-gray-50 border border-[#b2c8c5] shadow-inner flex-shrink-0 flex items-center justify-center text-gray-400 relative overflow-hidden p-1">
              {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover grayscale-[20%] contrast-125" /> : <User className="w-10 h-10 opacity-50" />}
              {/* Fake holographic overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-300/10 via-transparent to-yellow-300/10 mix-blend-screen pointer-events-none"></div>
            </div>
            <div className="flex-1 space-y-3 w-full">
              <div>
                <label className="text-[7px] sm:text-[8px] font-sans font-bold uppercase tracking-widest text-[#6b8e88] block mb-0.5">Name / Pangalan</label>
                <p className="font-mono text-sm sm:text-base font-bold leading-tight text-[#1a252f]">{user.name}</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[7px] sm:text-[8px] font-sans font-bold uppercase tracking-widest text-[#6b8e88] block mb-0.5">Passport No.</label>
                  <p className="font-mono text-xs sm:text-sm font-bold text-[#c0392b]">SF{user.id.toString().padStart(6, '0')}</p>
                </div>
                <div className="flex-1">
                  <label className="text-[7px] sm:text-[8px] font-sans font-bold uppercase tracking-widest text-[#6b8e88] block mb-0.5">Date of Issue</label>
                  <p className="font-mono text-xs sm:text-sm font-bold text-[#1a252f]">{user.memberSince || (user as any).created_at ? new Date(user.memberSince || (user as any).created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>

          <h2 className="font-['Cambria',_Georgia,_serif] text-sm sm:text-base font-bold border-b border-[#6b8e88]/30 pb-1 mb-4 uppercase tracking-[0.1em] text-[#2c3e50] mt-2">Activity Overview</h2>

          <div className="grid grid-cols-2 gap-3 mb-6 text-center">
            <div className="bg-white/40 p-3 rounded-sm border border-[#6b8e88]/20 shadow-sm">
              <p className="text-2xl sm:text-3xl font-['Cambria',_Georgia,_serif] font-bold text-[#2c3e50] mb-0.5">{p.visits.length}</p>
              <p className="text-[8px] uppercase tracking-widest font-bold text-[#6b8e88]">Stamps Earned</p>
            </div>
            <div className="bg-white/40 p-3 rounded-sm border border-[#6b8e88]/20 shadow-sm">
              <p className="text-2xl sm:text-3xl font-['Cambria',_Georgia,_serif] font-bold text-[#2c3e50] mb-0.5">{p.visited_eligible_count}</p>
              <p className="text-[8px] uppercase tracking-widest font-bold text-[#6b8e88]">Sites Visited</p>
            </div>
          </div>

          <div className="w-full mb-4">
            <p className="text-[8px] font-sans font-bold uppercase tracking-widest text-[#6b8e88] mb-2 text-center">Heritage Discovery Progress</p>
            <div className="h-2 bg-[#d6e5e3] rounded-full overflow-hidden border border-[#b2c8c5] shadow-inner">
              <div className="h-full bg-gradient-to-r from-[#2c3e50] to-[#3498db] transition-all duration-1000 relative" style={{ width: `${percent}%` }}>
              </div>
            </div>
            <p className="mt-2 text-[9px] font-mono font-bold text-center text-[#1a252f]">{p.visited_eligible_count} of {p.eligible_site_count} Sites</p>
          </div>
        </div>
      </div>
    );

    // Stamp Pages - 6 stamps per page for vertical orientation
    const STAMPS_PER_PAGE = 6;
    const stampColors = ['text-[#4a2422] border-[#4a2422]', 'text-[#1e3a5f] border-[#1e3a5f]', 'text-[#1b3b2b] border-[#1b3b2b]', 'text-[#6b4c2a] border-[#6b4c2a]'];
    const stampRotations = ['-rotate-6', 'rotate-3', '-rotate-3', 'rotate-6', '-rotate-12', 'rotate-12'];

    for (let i = 0; i < allStamps.length; i += STAMPS_PER_PAGE) {
      const pageStamps = allStamps.slice(i, i + STAMPS_PER_PAGE);
      pages.push(
        <div key={`stamps-${i}`} className="flex flex-col h-full bg-[#f4f8f7] text-[#2c2825] p-5 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#e2eceb_0%,_transparent_70%)] pointer-events-none"></div>
          <div className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
          <div className="absolute top-3 bottom-3 left-3 right-3 border-[0.5px] border-[#6b8e88] opacity-30 pointer-events-none rounded-sm"></div>

          <div className="relative z-10 flex flex-col h-full w-full">
            <h2 className="font-['Cambria',_Georgia,_serif] text-sm sm:text-base font-bold border-b border-[#6b8e88]/30 pb-1 mb-4 uppercase tracking-[0.1em] text-[#2c3e50] text-center mt-1">Visas / Stamps</h2>
            <div className="grid grid-cols-2 gap-y-6 gap-x-2 flex-1 items-start justify-items-center mb-4">
              {pageStamps.map((site, idx) => {
                const visit = visitsMap.get(String(site.id));
                const colorClass = stampColors[(i + idx) % stampColors.length];
                const rotation = stampRotations[(i + idx) % stampRotations.length];
                return (
                  <div key={site.id} className="flex flex-col items-center text-center w-full relative">
                    {visit ? (
                      <button onClick={() => onSite(site)} className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[3px] border-double flex flex-col items-center justify-center p-2 transform ${rotation} opacity-85 mix-blend-multiply ${colorClass} hover:opacity-100 hover:scale-105 transition-all cursor-pointer`}>
                        <div className="absolute inset-1 border border-current rounded-full opacity-30 pointer-events-none"></div>
                        <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest border-b border-current pb-0.5 mb-0.5 opacity-90">Verified</span>
                        <span className="font-['Cinzel',_serif] text-[9px] sm:text-[10px] font-bold leading-tight px-1 uppercase">{site.name}</span>
                        <span className="text-[7px] mt-1 font-mono opacity-80 uppercase tracking-widest">{new Date(visit.verified_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </button>
                    ) : (
                      <button onClick={() => onSite(site)} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-dashed border-[#d4c5b0] flex flex-col items-center justify-center p-2 opacity-40 hover:opacity-100 hover:border-[#4a2422] hover:bg-[#4a2422]/5 transition-all group">
                        <LockKeyhole className="w-5 h-5 sm:w-6 sm:h-6 mb-1 text-gray-400 group-hover:text-[#4a2422]" />
                        <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-gray-500 leading-tight group-hover:text-[#4a2422]">{site.name}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-auto pt-3 text-center opacity-30 border-t border-dashed border-[#d4c5b0]">
              <span className="text-xs font-mono font-bold">{pages.length}</span>
            </div>
          </div>
        </div>
      );
    }

    // Achievements Page
    pages.push(
      <div key="achievements" className="flex flex-col h-full bg-[#f4f8f7] text-[#2c2825] p-5 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#e2eceb_0%,_transparent_70%)] pointer-events-none"></div>
        <div className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
        <div className="absolute top-3 bottom-3 left-3 right-3 border-[0.5px] border-[#6b8e88] opacity-30 pointer-events-none rounded-sm"></div>

        <div className="relative z-10 flex flex-col h-full w-full">
          <h2 className="font-['Cambria',_Georgia,_serif] text-sm sm:text-base font-bold border-b border-[#6b8e88]/30 pb-1 mb-4 uppercase tracking-[0.1em] text-[#2c3e50] text-center mt-1">Heritage Achievements</h2>
          <div className="flex-1 space-y-3 mb-4">
            {achievements.map(ach => {
              const unlocked = visitCount >= ach.req;
              return (
                <div key={ach.id} className={`flex gap-3 p-3 rounded-sm border ${unlocked ? 'bg-white/60 border-[#3498db]/40 shadow-sm' : 'bg-transparent border-[#6b8e88]/30 border-dashed opacity-60'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${unlocked ? 'bg-[#3498db]/10 border-[#3498db] text-[#3498db]' : 'bg-transparent border-[#6b8e88]/40 text-[#6b8e88]'}`}>
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <h4 className={`font-bold text-[10px] sm:text-xs uppercase tracking-widest mb-0.5 ${unlocked ? 'text-[#2c3e50]' : 'text-[#6b8e88]'}`}>{ach.title}</h4>
                    <p className="text-[9px] sm:text-[10px] text-[#2c3e50]/80 leading-tight font-serif">{ach.desc}</p>
                    {!unlocked && <p className="text-[8px] font-mono font-bold text-[#c0392b] uppercase tracking-widest mt-1">{visitCount} / {ach.req} Visits</p>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-auto pt-3 text-center opacity-30 border-t border-dashed border-[#d4c5b0]">
            <span className="text-xs font-mono font-bold">{pages.length}</span>
          </div>
        </div>
      </div>
    );
  }

  const maxPage = pages.length - 1;

  const navigateTo = (newIndex: number) => {
    if (newIndex === pageIndex || isAnimating || newIndex < 0 || newIndex > maxPage) return;
    setFlipDirection(newIndex > pageIndex ? 'forward' : 'backward');
    setOutgoingIndex(pageIndex);
    setPageIndex(newIndex);
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      setOutgoingIndex(null);
    }, 600); // matches CSS animation duration
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isRight = (e.clientX - rect.left) > (rect.width / 2);

    if (isRight) {
      navigateTo(pageIndex === maxPage ? 0 : pageIndex + 1);
    } else {
      navigateTo(pageIndex === 0 ? maxPage : pageIndex - 1);
    }
  };

  return (
    <section id="passport-view" className="w-full h-full min-h-[500px] flex flex-col relative overflow-hidden font-sans border-none bg-transparent items-center justify-center">

      {/* Import Cinzel Font to perfectly match Trajan */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');
      `}} />

      {/* Main Content Area - Vertical Rectangular Passport Design */}
      <div
        className="w-[90vw] max-w-[360px] sm:max-w-[400px] h-[75vh] max-h-[650px] min-h-[500px] relative z-10 flex flex-col cursor-pointer"
        onClick={handleContainerClick}
        title="Click left or right edge to flip pages"
      >

        {/* The Passport Flat Interface with Flip Animation */}
        <div
          className="w-full h-full relative rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-visible"
          style={{ perspective: '2500px' }}
        >
          <style dangerouslySetInnerHTML={{
            __html: `
            .flip-layer {
              position: absolute;
              top: 0; left: 0; width: 100%; height: 100%;
              backface-visibility: hidden;
              transform-style: preserve-3d;
              border-radius: 4px;
              overflow: hidden;
            }
            .flip-enter-forward {
              transform: rotateY(90deg);
              transform-origin: left;
              z-index: 20;
            }
            .flip-enter-active-forward {
              transform: rotateY(0deg);
              transition: transform 600ms cubic-bezier(0.4, 0.0, 0.2, 1);
            }
            .flip-exit-forward {
              transform: rotateY(0deg);
              transform-origin: left;
              z-index: 10;
            }
            .flip-exit-active-forward {
              transform: rotateY(-90deg);
              transition: transform 600ms cubic-bezier(0.4, 0.0, 0.2, 1);
            }
            
            .flip-enter-backward {
              transform: rotateY(-90deg);
              transform-origin: left;
              z-index: 20;
            }
            .flip-enter-active-backward {
              transform: rotateY(0deg);
              transition: transform 600ms cubic-bezier(0.4, 0.0, 0.2, 1);
            }
            .flip-exit-backward {
              transform: rotateY(0deg);
              transform-origin: left;
              z-index: 10;
            }
            .flip-exit-active-backward {
              transform: rotateY(90deg);
              transition: transform 600ms cubic-bezier(0.4, 0.0, 0.2, 1);
            }
          `}} />

          {/* Render Incoming Page */}
          <div className={`flip-layer ${isAnimating ? `flip-enter-${flipDirection} flip-enter-active-${flipDirection}` : ''}`}>
            {pages[pageIndex]}
          </div>

          {/* Render Outgoing Page during animation */}
          {isAnimating && outgoingIndex !== null && (
            <div className={`flip-layer flip-exit-${flipDirection} flip-exit-active-${flipDirection}`}>
              {pages[outgoingIndex]}
            </div>
          )}
        </div>

      </div>

    </section>
  );
}
