import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type {
  ViewType,
  HeritageSite,
  EventItem,
  CategoryType,
  UserProfile,
  HeritagePassport
} from './types';


import { apiFetchSites, apiFetchSiteById, apiFetchEvents, apiFetchCurrentUser, apiLogout, getJwtToken, apiFetchItineraries } from './api/client';
import { parseHeritageRoute, mapDestinationId, mapDirectionsUrl } from './utils/heritageNavigation';
import { useToast } from './hooks/useToast';

// Components
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { SearchModal } from './components/SearchModal';
import { AuthModal } from './components/AuthModal';
import { HeritageChatbot } from './components/HeritageChatbot';

// Views
import { HomeView } from './views/HomeView';
import { SavedView } from './views/SavedView';
import { AboutView } from './views/AboutView';
import { TourismOfficeView } from './views/TourismOfficeView';
import { ErrorState } from './components/ErrorState';
import { apiFetchPassport } from './api/client';
import { PassportModal } from './components/PassportModal';

const ExploreView = lazy(() => import('./views/ExploreView').then(module => ({ default: module.ExploreView })));
const MapView = lazy(() => import('./views/MapView').then(module => ({ default: module.MapView })));
const SiteDetailView = lazy(() => import('./views/SiteDetailView').then(module => ({ default: module.SiteDetailView })));
const EventsView = lazy(() => import('./views/EventsView').then(module => ({ default: module.EventsView })));
const PlanView = lazy(() => import('./views/PlanView').then(module => ({ default: module.PlanView })));
const AdminView = lazy(() => import('./views/AdminView').then(module => ({ default: module.AdminView })));
const PassportView = lazy(() => import('./views/PassportView').then(module => ({ default: module.PassportView })));

export default function App() {
  const { addToast } = useToast();
  // Navigation & View State
  const [currentView, setCurrentView] = useState<ViewType>(() => parseHeritageRoute(window.location?.hash || '').view === 'passport' ? 'home' : parseHeritageRoute(window.location?.hash || '').view);
  const [passportOpen, setPassportOpen] = useState(false);
  const passportVersion = useRef('');
  const [passportState, setPassportState] = useState<{ userId: string; data: HeritagePassport | null; error: string } | null>(null);
  const [passportRevision, setPassportRevision] = useState(0);
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
  const [dataRetry, setDataRetry] = useState(0);
  const [eventsRetry, setEventsRetry] = useState(0);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [eventsError, setEventsError] = useState('');
  const [eventsLoading, setEventsLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
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
  const passport = user && passportState?.userId === String(user.id) ? passportState.data : null;
  const passportError = user && passportState?.userId === String(user.id) ? passportState.error : '';
  const passportUserId = user ? String(user.id) : null;
  useEffect(() => {
    if (!passportUserId || !passportOpen || passportVersion.current === `${passportUserId}:${passportRevision}`) return;
    let cancelled = false;
    const userId = passportUserId;
    apiFetchPassport().then(data => { if (!cancelled) { passportVersion.current = `${userId}:${passportRevision}`; setPassportState({ userId, data, error: '' }); } }).catch(failure => {
      if (!cancelled) setPassportState({ userId, data: null, error: failure instanceof Error ? failure.message : 'Unable to load your passport. Please try again.' });
    });
    return () => { cancelled = true; };
  }, [passportUserId, passportRevision, passportOpen]);
  const authRevision = useRef(0);

  const handleAuthenticatedLogin = (authenticatedUser: UserProfile) => {
    if (!getJwtToken()) return;
    passportVersion.current = '';
    setPassportState(null);
    authRevision.current += 1;
    setUser(authenticatedUser);
  };

  // Modals Visibility State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [directionsDestinationId, setDirectionsDestinationId] = useState<string | null>(() => mapDestinationId(window.location?.hash || ''));
  const [sitesLoading, setSitesLoading] = useState(true);

  useEffect(() => {
    const expire = () => {
      authRevision.current++;
      passportVersion.current = '';
      setPassportOpen(false);
      setUser(null);
      setPassportState(null);
      setIsAuthOpen(true);
      addToast('error', 'Your session has expired. Please log in again.');
    };
    const syncSession = (event: StorageEvent) => {
      if (event.key !== 'chis_jwt_token' && event.key !== null) return;
      authRevision.current++; passportVersion.current = ''; setPassportOpen(false); setUser(null); setPassportState(null); setSessionRevision(value => value + 1);
    };
    window.addEventListener?.('chis:session-expired', expire);
    window.addEventListener?.('storage', syncSession);
    return () => { window.removeEventListener?.('chis:session-expired', expire); window.removeEventListener?.('storage', syncSession); };
  }, []);

  // Independent startup requests; navigation reuses App state. Only explicit refreshes rerun them.
  useEffect(() => {
    // Start only the requested page's routes before its lazy chunk arrives. Plan shares this promise.
    if (currentView === 'plan') void apiFetchItineraries().catch(() => { /* Plan owns the visible error and Retry. */ });
  }, [currentView]);

  useEffect(() => {
    let cancelled = false;
    setSitesLoading(true);
    setSitesError(null);
    apiFetchSites().then(fetchedSites => {
      if (!cancelled) {
        setSites(fetchedSites);
        setSitesError(null);
      }
    }).catch(err => {
      if (!cancelled) {
        setSites([]);
        setDirectionsDestinationId(null);
        setSitesError(err instanceof Error ? err.message : 'Unable to load heritage sites. Please try again.');
      }
    }).finally(() => {
      if (!cancelled) setSitesLoading(false);
    });
    return () => { cancelled = true; };
  }, [dataRetry]);

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true); setEventsError('');
    apiFetchEvents().then(fetchedEvents => {
      if (!cancelled) { setEvents(fetchedEvents); setEventsError(''); }
    }).catch(err => {
      if (!cancelled) { setEvents([]); setEventsError(err instanceof Error ? err.message : 'Unable to load events. Please try again.'); }
    }).finally(() => {
      if (!cancelled) setEventsLoading(false);
    });
    return () => { cancelled = true; };
  }, [eventsRetry]);

  useEffect(() => {
    const syncRoute = () => {
      if (routeHash.current === window.location.hash) return;
      routeHash.current = window.location.hash;
      const route = parseHeritageRoute(window.location.hash);
      if (route.view === 'passport') { setIsAuthOpen(true); return; }
      setSelectedSite(null);
      setDetailStatus('loading');
      setRouteSiteId(route.siteId);
      setCurrentView(route.view);
      setDirectionsDestinationId(mapDestinationId(window.location.hash));
      setSelectedCategory('All');
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
    }).catch(failure => {
      if (!cancelled) { setDetailStatus('error'); setDetailError(failure instanceof Error ? failure.message : 'Unable to load this heritage site.'); }
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
  }, [sessionRevision]);

  // Keep only intentional small preferences; the live catalogue stays in memory.

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
    if (view === 'passport') { setIsAuthOpen(true); return; }
    const id = view === 'site-detail' ? selectedSite?.id : null;
    const hash = id ? `#/heritage/${encodeURIComponent(id)}` : `#/${view}`;
    if (window.location && window.location.hash !== hash) window.history.pushState({ chisNavigation: true }, '', hash);
    routeHash.current = hash;
    setRouteSiteId(id || null);
    if (view === 'site-detail') { setSelectedSite(null); setDetailStatus('loading'); setDetailRetry(value => value + 1); }
    setDirectionsDestinationId(null);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    authRevision.current += 1;
    passportVersion.current = '';
    setPassportOpen(false);
    void apiLogout();
    setUser(null);
    setPassportState(null);
    setIsAuthOpen(false);
    navigateTo('home');
    addToast('info', 'You have been logged out.');
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

  const openDirections = (site: HeritageSite) => {
    const hash = mapDirectionsUrl(site.id);
    if (window.location.hash !== hash) window.history.pushState({ chisNavigation: true }, '', hash);
    routeHash.current = hash;
    setDirectionsDestinationId(site.id);
    setSelectedCategory('All');
    setCurrentView('map');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const closeDirections = () => {
    window.history.replaceState({ chisNavigation: true }, '', '#/map');
    routeHash.current = '#/map';
    setDirectionsDestinationId(null);
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
    setDirectionsDestinationId(null);
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
      <Suspense fallback={<p role="status" className="p-6">Loading Admin...</p>}><AdminView
        user={user}
        onLogout={handleLogout}
        onPublicDataChanged={kind => kind === 'events' ? setEventsRetry(value => value + 1) : setDataRetry(value => value + 1)}
      /></Suspense>
    );
  }

  return (
    <><div id="san-fernando-app-root" inert={passportOpen && !!user ? true : undefined} className="min-h-screen flex flex-col bg-[#FDFCFB] text-[#23201F] font-sans antialiased selection:bg-[#dc2626] selection:text-white">
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
        <Suspense fallback={<p role="status" className="p-6">Loading page...</p>}>
          {currentView === 'not-found' && <ErrorState kind="not-found" title="Page not found" onHome={() => navigateTo('home')} />}
          {sitesError && currentView !== 'site-detail' && <ErrorState message={sitesError} onRetry={() => setDataRetry(value => value + 1)} />}
          {sitesLoading && ['explore', 'map'].includes(currentView) && <p role="status" className="p-6">Loading heritage sites...</p>}
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
          {currentView === 'explore' && !sitesLoading && !sitesError && (
            <ExploreView
              onOpenDirections={openDirections}
              sites={sites}
              onSelectSite={handleSelectSite}
              savedSiteIds={savedSiteIds}
              onToggleSaveSite={handleToggleSaveSite}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              onPlanRoute={() => navigateTo('plan')}
            />
          )}

          {currentView === 'map' && !sitesLoading && !sitesError && (
            <MapView
              destinationId={directionsDestinationId}
              onCloseDirections={closeDirections}
              onOpenDirections={openDirections}
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
            <section className="max-w-5xl mx-auto p-8 space-y-4" role={detailStatus === 'loading' ? 'status' : 'alert'}>
              <h1 className="headline-md">{detailStatus === 'loading' ? 'Loading heritage site...' : detailStatus === 'not-found' ? 'Heritage site not found' : 'Unable to load this heritage site'}</h1>
              {detailStatus === 'not-found' && <p>This site is unavailable or no longer public.</p>}
              {detailStatus === 'error' && <ErrorState message={detailError} onRetry={() => setDetailRetry(value => value + 1)} />}
              {detailStatus !== 'loading' && <button onClick={() => navigateTo('explore')}>Return to Explore</button>}
            </section>
          )}
          {currentView === 'site-detail' && detailStatus === 'ready' && selectedSite && selectedSite.id === routeSiteId && (
            <SiteDetailView
              site={selectedSite}
              user={user}
              onLogin={() => setIsAuthOpen(true)}
              onPassport={() => setIsAuthOpen(true)}
              onExplore={() => navigateTo('explore')}
              onVerified={() => { setPassportState(null); setPassportRevision(value => value + 1); }}
              onBack={() => window.history?.state?.chisNavigation ? window.history.back() : navigateTo('explore')}
              onOpenDirections={openDirections}
              isSaved={savedSiteIds.includes(selectedSite.id)}
              onToggleSave={handleToggleSaveSite}
              onAddToPlan={(siteId) => {
                if (!savedSiteIds.includes(siteId)) handleToggleSaveSite(siteId);
                navigateTo('plan');
              }}
            />
          )}

          {/* PAGE 7 & 8: EVENTS & EVENT DETAILS */}
          {currentView === 'events' && eventsLoading && <p role="status" className="p-6">Loading events...</p>}
          {eventsError && ['home', 'events', 'saved'].includes(currentView) && <ErrorState message={eventsError} onRetry={() => setEventsRetry(value => value + 1)} />}
          {currentView === 'events' && !eventsLoading && !eventsError && !events.length && <p role="status" className="p-6">No events are currently available.</p>}
          {currentView === 'events' && !eventsLoading && !eventsError && (
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
              visitedSiteIds={passport ? passport.visits.map(visit => String(visit.heritage_site_id)) : undefined}
              sites={sites}
              savedSiteIds={savedSiteIds}
              catalogueReady={!sitesLoading && !sitesError}
              catalogueError={sitesError}
              onToggleSaveSite={handleToggleSaveSite}
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
        </Suspense>
      </main>

      {/* FOOTER - Harmonized with Deep Maroon Low-Poly & Decorative Parols */}
      <footer id="app-main-footer" className="relative overflow-hidden border-t border-[#861f2a]/40 bg-lowpoly-maroon py-14 px-4 sm:px-6 lg:px-8 text-xs text-[#ffeaec]/85 pb-28 lg:pb-14 shadow-2xl">
        {/* Low-poly background image */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-90">
          <img
            src="/images/background.png"
            alt="Footer Background"
            className="h-full w-full object-cover object-bottom"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#3a040a]/90 via-[#36040a]/85 to-[#260205]/95" />
        </div>

        <div className="relative z-20 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src="/images/logo-transparent.png" alt="CHIS logo" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
              <span className="font-serif text-lg font-bold text-white tracking-wide">
                Sa'n Fernando
              </span>
            </div>
            <p className="body-sm text-[#ffeaec]/80 leading-relaxed">
              "Saan sa San Fernando?" Discovering the living stories, heroic revolutions, and vibrant giant lantern heritage of the Provincial Capital of Pampanga, Philippines.
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
          <span>&copy; {new Date().getFullYear()} City Government of San Fernando, Pampanga. All Rights Reserved.</span>
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
        passport={passport}
        passportError={passportError}
        onSite={handleSelectSite}
        onOpenPassport={() => { if (user) { setIsAuthOpen(false); setPassportOpen(true); } }}
      />

      {/* LOWER-RIGHT COLLAPSIBLE HERITAGE CHATBOT */}
      <HeritageChatbot
        currentSite={currentView === 'site-detail' && detailStatus === 'ready' ? selectedSite : null}
        onOpenDirections={openDirections}
        sites={sites}
        onSelectSite={handleSelectSite}
        onPlanRoute={() => navigateTo('plan')}
      />
    </div>{passportOpen && user && <PassportModal onClose={() => setPassportOpen(false)}><Suspense fallback={<p role="status" className="p-6">Loading passport...</p>}><PassportView user={user} passport={passport} error={passportError} onLogin={() => setIsAuthOpen(true)} onRetry={() => { setPassportState(null); setPassportRevision(value => value + 1); }} onSite={site => { setPassportOpen(false); handleSelectSite(site); }} /></Suspense></PassportModal>}</>
  );
}
