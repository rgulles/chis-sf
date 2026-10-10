import { useEffect, useState, useMemo, useRef, lazy, Suspense } from 'react';
import type { HeritageSite, Itinerary } from '../types';
import { apiFetchItineraries, apiFetchItineraryById } from '../api/client';
import { hasUsableCoordinates } from '../utils/heritageCoordinates';
import { handleHeritageImageError, HERITAGE_IMAGE_PLACEHOLDER } from '../utils/heritageImages';
import { CUSTOM_ITINERARY_KEY, readCustomItinerary, resolveCustomItinerary, moveItineraryStop } from '../utils/customItinerary';
import { fetchRoadRoute, routeKey, ROAD_ROUTE_UNAVAILABLE, type RoadRoute } from '../utils/osrm';
const MapView = lazy(() => import('./MapView').then(module => ({ default: module.MapView })));

interface PlanViewProps {
  sites: HeritageSite[];
  savedSiteIds: string[];
  onSelectSite: (site: HeritageSite) => void;
  onExploreClick: () => void;
  onToggleSaveSite?: (id: string) => void;
  catalogueReady?: boolean;
  catalogueError?: string | null;
  visitedSiteIds?: string[];
}

const buttonStyle = 'min-h-11 rounded-lg border border-[#e8dfd5] px-3 py-2 text-sm font-semibold hover:bg-[#faf2ee] disabled:opacity-50 disabled:cursor-not-allowed';

export const PlanView = ({ sites, savedSiteIds, onSelectSite, onExploreClick, onToggleSaveSite = () => {}, catalogueReady = true, catalogueError, visitedSiteIds }: PlanViewProps) => {
  const [mode, setMode] = useState<'recommended' | 'custom'>('recommended');
  const [routes, setRoutes] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [listRetry, setListRetry] = useState(0);
  const [detailRetry, setDetailRetry] = useState(0);
  const listRefresh = useRef(false);
  const detailRefresh = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Itinerary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [ids, setIds] = useState(readCustomItinerary);
  const [storageError, setStorageError] = useState('');
  const [query, setQuery] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const customSites = useMemo(() => resolveCustomItinerary(ids, sites), [ids, sites]);
  const liveIds = useMemo(() => customSites.map(site => site.id), [customSites]);
  const customJson = JSON.stringify(liveIds);
  if (catalogueReady && !catalogueError && JSON.stringify(ids) !== customJson) setIds(liveIds);

  useEffect(() => {
    let cancelled = false;
    const refresh = listRefresh.current;
    listRefresh.current = false;
    apiFetchItineraries(refresh).then(value => { if (!cancelled) { setRoutes(value); setError(''); } })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Unable to load recommended itineraries.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listRetry]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const refresh = detailRefresh.current;
    detailRefresh.current = false;
    apiFetchItineraryById(selectedId, refresh).then(value => { if (!cancelled) { setDetail(value); setDetailError(value ? '' : 'This itinerary is no longer available.'); } })
      .catch(failure => { if (!cancelled) setDetailError(failure instanceof Error ? failure.message : 'Unable to load this itinerary.'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, detailRetry]);

  // Prune stale IDs only after a successful live catalogue load, never on failure/loading.
  useEffect(() => {
    if (!catalogueReady || catalogueError) return;
    try { localStorage.setItem(CUSTOM_ITINERARY_KEY, customJson); } catch { /* Explicit edits report storage failures below. */ }
  }, [catalogueReady, catalogueError, customJson]);

  const changeIds = (next: string[]) => {
    setMapOpen(false);
    setIds(next);
    try { localStorage.setItem(CUSTOM_ITINERARY_KEY, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('This browser could not save your itinerary. Keep this page open or enable browser storage.'); }
  };
  const addSite = (id: string) => {
    if (liveIds.includes(id)) return;
    changeIds([...liveIds, id]);
  };
  const openDetail = (id: string) => {
    const summary = routes.find(route => route.id === id) || null;
    setSelectedId(id); setDetail(summary); setDetailError(''); setDetailLoading(!summary); setMapOpen(false);
  };
  const retryLoad = () => {
    if (selectedId) { detailRefresh.current = true; setDetailLoading(true); setDetailRetry(value => value + 1); }
    else { listRefresh.current = true; setLoading(true); setListRetry(value => value + 1); }
  };
  const detailStops = useMemo(() => detail?.stops.filter(stop => stop.site) || [], [detail]);
  const itinerarySites = useMemo(() => mode === 'custom' ? customSites : detailStops.map(stop => stop.site!), [mode, customSites, detailStops]);
  const unmapped = useMemo(() => itinerarySites.filter(site => !hasUsableCoordinates(site.coordinates)).length, [itinerarySites]);
  const roadKey = useMemo(() => routeKey(itinerarySites), [itinerarySites]);
  const [roadResults, setRoadResults] = useState<Record<string, { route?: RoadRoute; error?: string }>>({});
  const road = roadResults[roadKey];
  useEffect(() => {
    if (!mapOpen || roadKey.split(';').length < 2) return;
    let current = true;
    fetchRoadRoute(roadKey).then(route => { if (current) setRoadResults(previous => ({ ...previous, [roadKey]: { route } })); })
      .catch(() => { if (current) setRoadResults(previous => ({ ...previous, [roadKey]: { error: ROAD_ROUTE_UNAVAILABLE } })); });
    return () => { current = false; };
  }, [mapOpen, roadKey]);
  const browse = useMemo(() => {
    const needle = query.toLowerCase();
    return sites.filter(site => site.status === 'active' && `${site.name} ${site.category} ${site.address}`.toLowerCase().includes(needle));
  }, [sites, query]);

  const renderStop = (site: HeritageSite, index: number, custom: boolean, key = site.id) => (
    <li key={key} className="grid grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-[#e8dfd5] py-3">
      <img src={site.heroImage || HERITAGE_IMAGE_PLACEHOLDER} alt={site.name} loading="lazy" width={96} height={80} onError={handleHeritageImageError} className="h-20 w-[72px] sm:w-24 rounded-sm object-cover" referrerPolicy="no-referrer" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-bold text-[#7e1925]">{`Stop ${index + 1}`}</p>
        <h3 className="font-bold text-sm sm:text-base break-words">{site.name}</h3>
        {visitedSiteIds && <p className="text-sm font-semibold text-[#7e1925]">{visitedSiteIds.includes(site.id) ? 'Visited' : 'Not yet visited'}</p>}
        <p className="text-xs text-[#574141]">{site.category}</p><p className="text-xs break-words text-[#574141]">{site.address}</p>
      </div>
        <div className="col-span-2 sm:col-start-2 sm:col-span-1 flex flex-wrap gap-2">
          <button id={`itinerary-view-site-${site.id}`} className={buttonStyle} onClick={() => onSelectSite(site)}>View Site</button>
          {hasUsableCoordinates(site.coordinates) ? <a id={`itinerary-directions-${site.id}`} className={buttonStyle} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${site.coordinates.lat},${site.coordinates.lng}`}>Directions</a> : <span className="self-center text-xs text-[#574141]">Verified coordinates not yet available</span>}
          {custom && <>
            <button id={`custom-up-${site.id}`} aria-label={`Move ${site.name} up`} className={buttonStyle} disabled={index === 0} onClick={() => changeIds(moveItineraryStop(liveIds, index, -1))}>Move Up</button>
            <button id={`custom-down-${site.id}`} aria-label={`Move ${site.name} down`} className={buttonStyle} disabled={index === customSites.length - 1} onClick={() => changeIds(moveItineraryStop(liveIds, index, 1))}>Move Down</button>
            <button id={`custom-remove-${site.id}`} aria-label={`Remove ${site.name}`} className={buttonStyle} onClick={() => changeIds(liveIds.filter(id => id !== site.id))}>Remove</button>
          </>}
        </div>
    </li>
  );

  const renderRouteSummary = () => {
    const hasRoadStops = roadKey.split(';').length >= 2;
    const pending = mapOpen && hasRoadStops && !road;
    const placeholder = road?.error ? 'Unavailable' : pending ? 'Calculating…' : 'Not estimated yet';
    return <section id="itinerary-route-summary" aria-labelledby="itinerary-route-summary-title" className="border border-[#e8dfd5] bg-[#fdf9f4] p-3 sm:p-4 space-y-3 min-w-0">
      <h3 id="itinerary-route-summary-title" className="text-sm font-bold text-[#7e1925]">Route Summary</h3>
      <dl aria-live="polite" aria-busy={pending} className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div><dt className="text-xs text-[#574141]">Total stops</dt><dd className="font-semibold">{itinerarySites.length}</dd></div>
        <div><dt className="text-xs text-[#574141]">Estimated road distance</dt><dd className="font-semibold">{road?.route ? `${(road.route.distance / 1000).toFixed(1)} km` : placeholder}</dd></div>
        <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-[#574141]">Estimated driving time</dt><dd className="font-semibold">{road?.route ? `${Math.max(1, Math.round(road.route.duration / 60))} min` : placeholder}</dd></div>
      </dl>
      {!road?.route && !mapOpen && hasRoadStops && <p className="text-xs text-[#574141]">Open the route map for OSRM road distance and driving estimates.</p>}
      {road?.route && <p className="text-xs text-[#574141]">Road estimates provided by OSRM; they do not include live traffic.</p>}
      <button id="itinerary-map-toggle" className={`${buttonStyle} bg-[#7e1925] text-white hover:bg-[#580b14]`} aria-expanded={mapOpen} aria-controls="itinerary-route-map" onClick={() => setMapOpen(value => !value)}>{mapOpen ? 'Hide Route Map' : 'View Route on Map'}</button>
      {mapOpen && <div id="itinerary-route-map" className="space-y-3 min-w-0">
        {!hasRoadStops ? <p role="status">At least two stops with coordinates are needed for a road route.</p> : pending ? <p role="status">Estimating road route…</p> : road?.error && <p role="status">{road.error}</p>}
        {unmapped > 0 && <p className="text-xs text-[#574141]">{unmapped} {unmapped === 1 ? 'stop has' : 'stops have'} no verified map location and {unmapped === 1 ? 'is' : 'are'} excluded from the road route.</p>}
        <Suspense fallback={<p role="status">Loading map…</p>}><MapView sites={itinerarySites} roadRoute={road?.route} orderedStops savedSiteIds={savedSiteIds} onToggleSaveSite={onToggleSaveSite} onSelectSite={onSelectSite} onPlanRoute={() => {}} initialViewMode="map" /></Suspense>
      </div>}
    </section>;
  };

  return <section id="plan-view" className="max-w-7xl mx-auto px-4 py-8 pb-28 space-y-6 text-[#1e1b19]">
    <h1 className="page-title">Plan Your Heritage Trip</h1>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Itinerary mode">
      {(['recommended', 'custom'] as const).map(value => <button key={value} id={`plan-${value}-tab`} aria-pressed={mode === value} className={`${buttonStyle} ${mode === value ? 'bg-[#7e1925] text-white hover:bg-[#580b14]' : 'bg-white'}`} onClick={() => { setMode(value); setMapOpen(false); }}>{value === 'recommended' ? 'Recommended' : 'Build My Own Itinerary'}</button>)}
    </div>
    {mode === 'recommended' && <>
      {loading && !selectedId && <p role="status">Loading recommended itineraries…</p>}
      {error && !selectedId && <div role="alert"><p>{error}</p><button className={buttonStyle} onClick={retryLoad}>Retry</button></div>}
      {!selectedId && (routes.length > 0 || (!loading && !error)) && (routes.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{routes.map(route => <article key={route.id} className="rounded-xl border border-[#e8dfd5] bg-white p-4 space-y-3 min-w-0 break-words">
        <h2 className="text-lg font-bold">{route.name}</h2>{route.description && <p className="text-sm">{route.description}</p>}<p className="text-sm">{route.stops.length} stops</p>
        <div className="flex gap-2">{route.stops.slice(0, 3).map(stop => stop.site && <img key={stop.id} src={stop.site.heroImage || HERITAGE_IMAGE_PLACEHOLDER} alt={stop.site.name} loading="lazy" decoding="async" width={56} height={56} onError={handleHeritageImageError} className="h-14 w-14 object-cover rounded-lg" />)}</div>
        <button id={`open-itinerary-${route.id}`} className={buttonStyle} onClick={() => openDetail(route.id)}>View Itinerary</button>
      </article>)}</div> : <p>No recommended itineraries are currently available.</p>)}
      {selectedId && <div className="space-y-4">
        <button className={buttonStyle} onClick={() => { setSelectedId(null); setDetail(null); setMapOpen(false); }}>Back to recommended itineraries</button>
        {detailLoading && <p role="status">Loading itinerary…</p>}
        {detailError && <div role="alert"><p>{detailError}</p><button className={buttonStyle} onClick={retryLoad}>Retry</button></div>}
        {detail && <><h2 className="text-2xl font-bold">{detail.name}</h2>{detail.description && <p>{detail.description}</p>}
          {itinerarySites.length > 0 && renderRouteSummary()}
          {itinerarySites.length ? <ol>{detailStops.map((stop, index) => renderStop(stop.site!, index, false, stop.id))}</ol> : <p>No active stops are currently available in this itinerary.</p>}
        </>}
      </div>}
    </>}
    {mode === 'custom' && <div className="space-y-5">
      <h2 className="text-2xl font-bold">Your custom itinerary</h2>
      <p className="text-sm">Choose stops and arrange them in the order you want to visit. Changes save automatically on this browser.</p>
      {storageError && <p role="alert">{storageError}</p>}
      {catalogueError ? <div role="alert"><p>{catalogueError}</p><p>Your stored itinerary has been kept. Reload to try again.</p></div> : !catalogueReady ? <p role="status">Loading heritage sites…</p> : <>
        {customSites.length ? <>{renderRouteSummary()}<ol>{customSites.map((site, index) => renderStop(site, index, true))}</ol><button id="custom-clear" className={buttonStyle} onClick={() => { changeIds([]); setMapOpen(false); }}>Clear itinerary</button></> : <p>Your itinerary is empty. Add heritage sites below.</p>}
        {savedSiteIds.some(id => !liveIds.includes(id) && sites.some(site => site.id === id && site.status === 'active')) && <button className={buttonStyle} onClick={() => changeIds([...new Set([...liveIds, ...sites.filter(site => site.status === 'active' && savedSiteIds.includes(site.id)).map(site => site.id)])])}>Add saved places</button>}
        <label className="block font-semibold" htmlFor="custom-site-search">Find heritage sites</label>
        <input id="custom-site-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, category, or address" className="w-full min-h-11 rounded-lg border border-[#e8dfd5] bg-white px-3" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{browse.map(site => <article key={site.id} className="rounded-xl border border-[#e8dfd5] bg-white p-3 space-y-2"><h3 className="font-bold">{site.name}</h3><p className="text-sm">{site.category}</p><button id={`custom-add-${site.id}`} className={buttonStyle} disabled={liveIds.includes(site.id)} onClick={() => addSite(site.id)}>{liveIds.includes(site.id) ? 'Added' : 'Add stop'}</button></article>)}</div>
        {!browse.length && <p>No heritage sites match your search.</p>}
        <button className={buttonStyle} onClick={onExploreClick}>Browse the heritage catalogue</button>
      </>}
    </div>}
  </section>;
};
