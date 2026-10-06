import { useState, useEffect, useRef } from 'react';
import type {
  ViewType,
  HeritageSite,
  EventItem,
  CategoryType,
  UserProfile
} from './types';
import confetti from 'canvas-confetti';


import { apiFetchSites, apiFetchEvents, apiFetchCurrentUser, apiLogout, getJwtToken } from './api/client';

// Components
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { SearchModal } from './components/SearchModal';
import { QRScannerModal } from './components/QRScannerModal';
import { AuthModal } from './components/AuthModal';
import { DirectionsModal } from './components/DirectionsModal';
import { HeritageChatbot } from './components/HeritageChatbot';

// Views
import { HomeView } from './views/HomeView';
import { ExploreView } from './views/ExploreView';
import { MapView } from './views/MapView';
import { SiteDetailView } from './views/SiteDetailView';
import { InteractiveHistoryView } from './views/InteractiveHistoryView';
import { QRScanExperienceView } from './views/QRScanExperienceView';
import { EventsView } from './views/EventsView';
import { PlanView } from './views/PlanView';
import { SavedView } from './views/SavedView';
import { AboutView } from './views/AboutView';
import { TourismOfficeView } from './views/TourismOfficeView';
import { AdminView } from './views/AdminView';

export default function App() {
  // Navigation & View State
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [selectedSite, setSelectedSite] = useState<HeritageSite | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'All'>('All');

  // Dynamic Data State
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Saved / Favorites
  const [savedSiteIds, setSavedSiteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf_saved_sites');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : ['metropolitan-cathedral', 'lazatin-heritage-house'];
    } catch {
      return ['metropolitan-cathedral', 'lazatin-heritage-house'];
    }
  });

  const [savedEventIds, setSavedEventIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf_saved_events');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Cached profiles never establish authentication; Laravel verifies the bearer token.
  const [user, setUser] = useState<UserProfile | null>(null);
  const authRevision = useRef(0);

  const handleAuthenticatedLogin = (authenticatedUser: UserProfile) => {
    if (!getJwtToken()) return;
    authRevision.current += 1;
    setUser(authenticatedUser);
  };

  // Modals Visibility State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [directionsTargetSite, setDirectionsTargetSite] = useState<HeritageSite | null>(null);

  // Load live data from Laravel API on mount
  useEffect(() => {
    async function loadBackendData() {
      try {
        const fetchedSites = await apiFetchSites();
        if (fetchedSites && fetchedSites.length > 0) {
          setSites(fetchedSites);
        }
        const fetchedEvents = await apiFetchEvents();
        setEvents(fetchedEvents);
      } catch (err) {
        console.warn('Backend loading error:', err);
      }
    }
    loadBackendData();
  }, [currentView]);

  // Verify independently of catalogue loading, and ignore superseded requests.
  useEffect(() => {
    let cancelled = false;
    const revision = authRevision.current;
    apiFetchCurrentUser().then((currentUser) => {
      if (!cancelled && revision === authRevision.current) setUser(currentUser);
    });
    return () => { cancelled = true; };
  }, [currentView]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('sf_heritage_sites', JSON.stringify(sites));
  }, [sites]);

  useEffect(() => {
    localStorage.setItem('sf_saved_sites', JSON.stringify(savedSiteIds));
  }, [savedSiteIds]);

  useEffect(() => {
    localStorage.setItem('sf_saved_events', JSON.stringify(savedEventIds));
  }, [savedEventIds]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('sf_user_profile', JSON.stringify({ ...user, isLoggedIn: true }));
    } else {
      localStorage.removeItem('sf_user_profile');
    }
  }, [user]);

  // Scroll to top on view changes
  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    authRevision.current += 1;
    void apiLogout();
    setUser(null);
    setIsAuthOpen(false);
    navigateTo('home');
  };

  // Toggle Save Site
  const handleToggleSaveSite = (siteId: string) => {
    setSavedSiteIds((prev) => {
      const exists = prev.includes(siteId);
      const next = exists ? prev.filter((id) => id !== siteId) : [...prev, siteId];
      setUser((u) => (u ? { ...u, savedSites: next } : null));
      return next;
    });
  };

  // Toggle Save Event
  const handleToggleSaveEvent = (eventId: string) => {
    setSavedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  // Select Site to View Details (Page 4)
  const handleSelectSite = (site: HeritageSite) => {
    setSelectedSite(site);
    navigateTo('site-detail');
  };

  // Select Event to View Details (Page 8)
  const handleSelectEvent = (event: EventItem | null) => {
    setSelectedEvent(event);
    navigateTo('events');
  };

  // Open QR Scanner or Directly trigger on-site scan
  const handleTriggerQRScan = (site: HeritageSite) => {
    setSelectedSite(site);
    handleProcessQRScan(site.qrCodeId);
  };

  // Process QR Code Scan
  const handleProcessQRScan = (scannedCode: string) => {
    const matched = sites.find(
      (s) =>
        s.qrCodeId.toLowerCase() === scannedCode.toLowerCase() ||
        s.id.toLowerCase() === scannedCode.toLowerCase()
    );

    if (matched) {
      setSelectedSite(matched);
      setIsQROpen(false);

      // Collect stamp if not collected
      if (!user?.scannedSites?.includes(matched.id)) {
        handleStampCollected(matched.id);
      }

      navigateTo('qr-experience');
    }
  };

  // Handle Collecting a Heritage Stamp & Badges
  const handleStampCollected = (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    // Increment scanCount on site
    setSites((prev) =>
      prev.map((s) => (s.id === siteId ? { ...s, scanCount: s.scanCount + 1 } : s))
    );

    // Update User Stamps
    setUser((prev) => {
      if (!prev) return null;
      const prevScanned = prev.scannedSites || [];
      const prevStamps = prev.stamps || [];
      const prevBadges = prev.badges || [];

      if (prevScanned.includes(siteId)) return prev;

      const newScanned = [...prevScanned, siteId];
      const newStamps = [
        ...prevStamps,
        {
          siteId: site.id,
          siteName: site.name,
          collectedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
      ];

      // Calculate unlocked badges
      const unlockedBadges = [...prevBadges];
      if (!unlockedBadges.includes('first-scan')) {
        unlockedBadges.push('first-scan');
      }
      if (site.id === 'cathedral' && !unlockedBadges.includes('cathedral-explorer')) {
        unlockedBadges.push('cathedral-explorer');
      }
      if (site.category === 'Historical Buildings' && !unlockedBadges.includes('sugar-baron')) {
        unlockedBadges.push('sugar-baron');
      }
      if (site.id === 'train-station' && !unlockedBadges.includes('railway-adventurer')) {
        unlockedBadges.push('railway-adventurer');
      }
      if (newScanned.length >= 5 && !unlockedBadges.includes('master-explorer')) {
        unlockedBadges.push('master-explorer');
      }

      return {
        ...prev,
        scannedSites: newScanned,
        stamps: newStamps,
        badges: unlockedBadges
      };
    });

    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {
      // Ignore error
    }
  };

  // Community Photo Upload handler
  const handlePhotoUploaded = () => {
    setUser((prev) => {
      if (!prev) return null;
      const prevBadges = prev.badges || [];
      const updatedBadges = [...prevBadges];
      if (!updatedBadges.includes('heritage-photographer')) {
        updatedBadges.push('heritage-photographer');
      }
      const updatedUser = {
        ...prev,
        badges: updatedBadges
      };
      try {
        localStorage.setItem('sf_user_profile', JSON.stringify({ ...updatedUser, isLoggedIn: true }));
      } catch {
        // Ignore error
      }
      return updatedUser;
    });
  };

  // Category selection handler
  const handleSelectCategory = (cat: CategoryType) => {
    setSelectedCategory(cat);
    navigateTo('explore');
  };

  // Admin Actions


  if (currentView === 'admin') {
    if (!user || user.role !== 'admin') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
          <div className="text-center p-8 bg-white shadow-xl rounded-xl">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">You need administrator privileges to access this portal.</p>
            <button onClick={() => navigateTo('home')} className="bg-[#7A1C30] text-white px-6 py-2 rounded-lg font-bold">Return to Home</button>
          </div>
        </div>
      );
    }

    return (
      <AdminView 
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div id="san-fernando-app-root" className="min-h-screen flex flex-col bg-[#FDFCFB] text-[#23201F] font-sans antialiased selection:bg-[#dc2626] selection:text-white">
      {/* DESKTOP & MOBILE MAIN HEADER */}
      <Header
        currentView={currentView}
        onNavigate={navigateTo}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenQRScanner={() => setIsQROpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        savedCount={(savedSiteIds?.length || 0) + (savedEventIds?.length || 0)}
        user={user}
        totalSites={sites?.length || 10}
        onToggleAdminMode={() => navigateTo('admin')}
      />

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main id="main-content-viewport" className="flex-1">
        {/* PAGE 1: HOME */}
        {currentView === 'home' && (
          <HomeView
            onExploreClick={() => navigateTo('explore')}
            onMapClick={() => navigateTo('map')}
            onSelectSite={handleSelectSite}
            onSelectCategory={handleSelectCategory}
            onSelectEvent={(evt) => {
              setSelectedEvent(evt);
              navigateTo('events');
            }}
            featuredSites={sites.slice(0, 3)}
            upcomingEvents={events}
            savedSiteIds={savedSiteIds}
            onToggleSaveSite={handleToggleSaveSite}
          />
        )}

        {/* COMBINED EXPLORE HERITAGE & MAP */}
        {currentView === 'explore' && (
          <ExploreView
            sites={sites}
            onSelectSite={handleSelectSite}
            savedSiteIds={savedSiteIds}
            onToggleSaveSite={handleToggleSaveSite}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onPlanRoute={() => navigateTo('plan')}
          />
        )}

        {currentView === 'map' && (
          <MapView
            sites={sites}
            onSelectSite={handleSelectSite}
            onPlanRoute={() => navigateTo('plan')}
            savedSiteIds={savedSiteIds}
            onToggleSaveSite={handleToggleSaveSite}
            initialViewMode="map"
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        )}

        {/* PAGE 4: HERITAGE SITE DETAILS */}
        {currentView === 'site-detail' && selectedSite && (
          <SiteDetailView
            site={selectedSite}
            onBack={() => navigateTo('explore')}
            onOpenDirections={(site) => setDirectionsTargetSite(site)}
            onOpenInteractiveHistory={(site) => {
              setSelectedSite(site);
              navigateTo('interactive-history');
            }}
            isSaved={savedSiteIds.includes(selectedSite.id)}
            onToggleSave={handleToggleSaveSite}
            onAddToPlan={(siteId) => {
              if (!savedSiteIds.includes(siteId)) handleToggleSaveSite(siteId);
              navigateTo('plan');
            }}
            userName={user?.name || 'Guest Traveler'}
            onPhotoUploaded={handlePhotoUploaded}
          />
        )}

        {/* PAGE 5: DEDICATED INTERACTIVE HISTORY */}
        {currentView === 'interactive-history' && selectedSite && (
          <InteractiveHistoryView
            site={selectedSite}
            onBack={() => navigateTo('site-detail')}
            onLaunchQRMode={handleTriggerQRScan}
          />
        )}

        {/* PAGE 6: ON-SITE QR SCAN EXPERIENCE */}
        {currentView === 'qr-experience' && selectedSite && (
          <QRScanExperienceView
            site={selectedSite}
            onBack={() => navigateTo('site-detail')}
            onStampCollected={handleStampCollected}
            isStampUnlocked={(user?.scannedSites || []).includes(selectedSite.id)}
          />
        )}

        {/* PAGE 7 & 8: EVENTS & EVENT DETAILS */}
        {currentView === 'events' && (
          <EventsView
            events={events}
            sites={sites}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
            onSelectSite={handleSelectSite}
            savedEventIds={savedEventIds}
            onToggleSaveEvent={handleToggleSaveEvent}
          />
        )}

        {/* PAGE 9: PLAN YOUR VISIT */}
        {currentView === 'plan' && (
          <PlanView
            sites={sites}
            savedSiteIds={savedSiteIds}
            onSelectSite={handleSelectSite}
            onExploreClick={() => navigateTo('explore')}
          />
        )}

        {/* PAGE 10: SAVED / FAVORITES */}
        {currentView === 'saved' && (
          <SavedView
            savedSites={sites.filter((s) => savedSiteIds.includes(s.id))}
            savedEvents={events.filter((e) => savedEventIds.includes(e.id))}
            onSelectSite={handleSelectSite}
            onSelectEvent={(evt) => {
              setSelectedEvent(evt);
              navigateTo('events');
            }}
            onRemoveSite={handleToggleSaveSite}
            onRemoveEvent={handleToggleSaveEvent}
            onExploreClick={() => navigateTo('explore')}
            onPlanTrip={() => navigateTo('plan')}
          />
        )}

        {/* PAGE 11: ABOUT */}
        {currentView === 'about' && (
          <AboutView
            onExploreClick={() => navigateTo('explore')}
            onContactClick={() => navigateTo('tourism-office')}
          />
        )}

        {/* PAGE 12: TOURISM OFFICE & CONTACT */}
        {currentView === 'tourism-office' && <TourismOfficeView />}

      </main>

      {/* FOOTER - Harmonized with Deep Maroon Low-Poly & Decorative Parols */}
      <footer id="app-main-footer" className="relative overflow-hidden border-t border-[#861f2a]/40 bg-lowpoly-maroon py-14 px-4 sm:px-6 lg:px-8 text-xs text-[#ffeaec]/85 pb-28 lg:pb-14 shadow-2xl">
        {/* Low-poly background image */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-90">
          <img
            src="/images/background/background.png"
            alt="Footer Background"
            className="h-full w-full object-cover object-bottom"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#3a040a]/90 via-[#36040a]/85 to-[#260205]/95" />
        </div>

        <div className="relative z-20 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5b82a] text-[#3d0309] font-serif font-bold text-sm shadow-md">
                SF
              </span>
              <span className="font-serif text-lg font-bold text-white tracking-wide">
                Sa’n Fernando
              </span>
            </div>
            <p className="body-sm text-[#ffeaec]/80 leading-relaxed">
              “Saan sa San Fernando?” Discovering the living stories, heroic revolutions, and vibrant giant lantern heritage of the Provincial Capital of Pampanga, Philippines.
            </p>
            <p className="label-compact text-[#ffd580] font-semibold">
              Official Tourism & Heritage Web Platform
            </p>
          </div>

          <div>
            <h4 className="label-prominent text-white font-bold mb-3 tracking-wider uppercase text-[11px]">Explore</h4>
            <ul className="space-y-2 body-sm">
              <li>
                <button onClick={() => navigateTo('explore')} className="hover:text-[#ffd580] transition-colors">
                  Heritage Directory
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('map')} className="hover:text-[#ffd580] transition-colors">
                  Interactive Heritage Map
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('events')} className="hover:text-[#ffd580] transition-colors">
                  Cultural Events & Festivals
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('plan')} className="hover:text-[#ffd580] transition-colors">
                  Heritage Walking Trails
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="label-prominent text-white font-bold mb-3 tracking-wider uppercase text-[11px]">Plan & Visit</h4>
            <ul className="space-y-2 body-sm">
              <li>
                <button onClick={() => navigateTo('plan')} className="hover:text-[#ffd580] transition-colors">
                  Suggested Itineraries
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('saved')} className="hover:text-[#ffd580] transition-colors">
                  My Saved Sites ({savedSiteIds.length})
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('about')} className="hover:text-[#ffd580] transition-colors">
                  About Project
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('tourism-office')} className="hover:text-[#ffd580] transition-colors">
                  City Tourism Office
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="label-prominent text-white font-bold mb-3 tracking-wider uppercase text-[11px]">Institutional Access</h4>
            <p className="body-sm text-[#ffeaec]/80 leading-relaxed mb-3">
              City Government of San Fernando, Pampanga. For accredited tour guides and CMS updates:
            </p>
            <button
              onClick={() => navigateTo('admin')}
              className="rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-md px-3.5 py-1.5 label-compact text-[#ffd580] font-semibold transition-colors"
            >
              CMS Admin Portal
            </button>
          </div>
        </div>

        <div className="relative z-20 max-w-7xl mx-auto mt-10 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2 label-compact text-[#ffeaec]/60">
          <span>© {new Date().getFullYear()} City Government of San Fernando, Pampanga. All Rights Reserved.</span>
          <span>Home of the Giant Lantern Festival (Ligligan Parul).</span>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION */}
      <MobileNav
        currentView={currentView}
        onNavigate={navigateTo}
        savedCount={savedSiteIds.length + savedEventIds.length}
        onOpenQRScanner={() => setIsQROpen(true)}
      />

      {/* SEARCH MODAL */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        sites={sites}
        events={events}
        onSelectSite={handleSelectSite}
        onSelectEvent={handleSelectEvent}
      />

      {/* ON-SITE QR SCANNER MODAL */}
      <QRScannerModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        sites={sites}
        onScanSuccess={handleProcessQRScan}
      />

      {/* USER AUTH & PROFILE MODAL */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onLogin={handleAuthenticatedLogin}
        onLogout={handleLogout}
        savedSiteIds={savedSiteIds}
        sites={sites}
        onNavigateAdmin={() => {
          setIsAuthOpen(false);
          navigateTo('admin');
        }}
      />

      {/* DIRECTIONS & TRANSIT MODAL */}
      <DirectionsModal
        isOpen={!!directionsTargetSite}
        site={directionsTargetSite}
        onClose={() => setDirectionsTargetSite(null)}
      />

      {/* LOWER-RIGHT COLLAPSIBLE HERITAGE CHATBOT */}
      <HeritageChatbot
        sites={sites}
        onSelectSite={handleSelectSite}
        onPlanRoute={() => navigateTo('plan')}
      />
    </div>
  );
}
