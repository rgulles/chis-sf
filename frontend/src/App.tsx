import { useState, useEffect, useRef } from 'react';
import type {
  ViewType,
  HeritageSite,
  EventItem,
  CategoryType,
  UserProfile
} from './types';


import { apiFetchSites, apiFetchSiteById, apiFetchEvents, apiFetchCurrentUser, apiLogout, getJwtToken } from './api/client';
import { parseHeritageRoute } from './utils/heritageNavigation';

// Components
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { SearchModal } from './components/SearchModal';
import { AuthModal } from './components/AuthModal';
import { DirectionsModal } from './components/DirectionsModal';
import { HeritageChatbot } from './components/HeritageChatbot';

// Views
import { HomeView } from './views/HomeView';
import { ExploreView } from './views/ExploreView';
import { MapView } from './views/MapView';
import { SiteDetailView } from './views/SiteDetailView';
import { EventsView } from './views/EventsView';
import { PlanView } from './views/PlanView';
import { SavedView } from './views/SavedView';
import { AboutView } from './views/AboutView';
import { TourismOfficeView } from './views/TourismOfficeView';
import { AdminView } from './views/AdminView';

export default function App() {
  // Navigation & View State
  const [currentView, setCurrentView] = useState<ViewType>(() => parseHeritageRoute(window.location?.hash || '').view);
  const [routeSiteId, setRouteSiteId] = useState<string | null>(() => parseHeritageRoute(window.location?.hash || '').siteId);
  const [detailStatus, setDetailStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [detailRetry, setDetailRetry] = useState(0);
  const routeHash = useRef(window.location?.hash || '');
  const [selectedSite, setSelectedSite] = useState<HeritageSite | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'All'>('All');

  // Dynamic Data State
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Saved / Favorites
  const [savedSiteIds, setSavedSiteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf_saved_sites');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && /^[1-9]\d*$/.test(id)) : [];
    } catch {
      return [];
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
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [directionsTargetSite, setDirectionsTargetSite] = useState<HeritageSite | null>(null);

  // Load live data from Laravel API on mount
  useEffect(() => {
    let cancelled = false;
    async function loadBackendData() {
      try {
        const fetchedSites = await apiFetchSites();
        if (!cancelled) {
          setSites(fetchedSites);
          setSitesError(null);
          if (currentView !== 'site-detail') setSelectedSite((previous) => previous ? fetchedSites.find((site) => site.id === previous.id) || null : null);
          setDirectionsTargetSite((previous) => previous ? fetchedSites.find((site) => site.id === previous.id) || null : null);
        }
      } catch (err) {
        if (!cancelled) {
          setSites([]);
          if (currentView !== 'site-detail') setSelectedSite(null);
          setDirectionsTargetSite(null);
          setSitesError(err instanceof Error ? err.message : 'Unable to load heritage sites. Please try again.');
        }
      }
      try {
        const fetchedEvents = await apiFetchEvents();
        setEvents(fetchedEvents);
      } catch (err) {
        console.warn('Backend loading error:', err);
      }
    }
    loadBackendData();
    return () => { cancelled = true; };
  }, [currentView]);

  useEffect(() => {
    const syncRoute = () => {
      if (routeHash.current === window.location.hash) return;
      routeHash.current = window.location.hash;
      const route = parseHeritageRoute(window.location.hash);
      setSelectedSite(null);
      setDetailStatus('loading');
      setRouteSiteId(route.siteId);
      setCurrentView(route.view);
      setDirectionsTargetSite(null);
    };
    window.addEventListener?.('popstate', syncRoute);
    window.addEventListener?.('hashchange', syncRoute);
    return () => {
      window.removeEventListener?.('popstate', syncRoute);
      window.removeEventListener?.('hashchange', syncRoute);
    };
  }, []);

  useEffect(() => {
    if (currentView !== 'site-detail') return;
    let cancelled = false;
    setSelectedSite(null);
    setDetailStatus('loading');
    if (!routeSiteId) {
      setDetailStatus('not-found');
      return;
    }
    apiFetchSiteById(routeSiteId).then(site => {
      if (cancelled) return;
      setSelectedSite(site);
      setDetailStatus(site ? 'ready' : 'not-found');
    }).catch(() => {
      if (!cancelled) setDetailStatus('error');
    });
    return () => { cancelled = true; };
  }, [currentView, routeSiteId, detailRetry]);

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
    const id = view === 'site-detail' ? selectedSite?.id : null;
    const hash = id ? `#/heritage/${encodeURIComponent(id)}` : `#/${view}`;
    if (window.location && window.location.hash !== hash) window.history.pushState({ chisNavigation: true }, '', hash);
    routeHash.current = hash;
    setRouteSiteId(id || null);
    if (view === 'site-detail') { setSelectedSite(null); setDetailStatus('loading'); setDetailRetry(value => value + 1); }
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
    const hash = `#/heritage/${encodeURIComponent(site.id)}`;
    if (window.location && window.location.hash !== hash) window.history.pushState({ chisNavigation: true }, '', hash);
    routeHash.current = hash;
    setSelectedSite(null);
    setDetailStatus('loading');
    setRouteSiteId(site.id);
    setDetailRetry(value => value + 1);
    setCurrentView('site-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Select Event to View Details (Page 8)
  const handleSelectEvent = (event: EventItem | null) => {
    setSelectedEvent(event);
    navigateTo('events');
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
        onOpenAuth={() => setIsAuthOpen(true)}
        savedCount={sites.filter(site => savedSiteIds.includes(site.id)).length + savedEventIds.length}
        user={user}
        totalSites={sites.length}
        onToggleAdminMode={() => navigateTo('admin')}
      />

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main id="main-content-viewport" className="flex-1">
        {sitesError && (
          <div role="alert" className="mx-auto max-w-7xl px-4 py-3 text-sm text-red-800 bg-red-50">
            {sitesError}
          </div>
        )}
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
        {currentView === 'site-detail' && detailStatus !== 'ready' && (
          <section className="max-w-5xl mx-auto p-8 space-y-4" aria-live="polite">
            <h1 className="headline-md">{detailStatus === 'loading' ? 'Loading heritage site…' : detailStatus === 'not-found' ? 'Heritage site not found' : 'Unable to load this heritage site'}</h1>
            {detailStatus === 'not-found' && <p>This site is unavailable or no longer public.</p>}
            {detailStatus === 'error' && <button onClick={() => setDetailRetry(value => value + 1)}>Try again</button>}
            {detailStatus !== 'loading' && <button onClick={() => navigateTo('explore')}>Return to Explore</button>}
          </section>
        )}
        {currentView === 'site-detail' && detailStatus === 'ready' && selectedSite && selectedSite.id === routeSiteId && (
          <SiteDetailView
            site={selectedSite}
            onBack={() => window.history?.state?.chisNavigation ? window.history.back() : navigateTo('explore')}
            onOpenDirections={(site) => setDirectionsTargetSite(site)}
            isSaved={savedSiteIds.includes(selectedSite.id)}
            onToggleSave={handleToggleSaveSite}
            onAddToPlan={(siteId) => {
              if (!savedSiteIds.includes(siteId)) handleToggleSaveSite(siteId);
              navigateTo('plan');
            }}
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
        savedCount={sites.filter(site => savedSiteIds.includes(site.id)).length + savedEventIds.length}
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
