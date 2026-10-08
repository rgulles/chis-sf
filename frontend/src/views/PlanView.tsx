import { useEffect, useState } from 'react';
import type { HeritageSite, Itinerary } from '../types';
import { apiFetchItineraries, apiFetchItineraryById } from '../api/client';
import { hasUsableCoordinates } from '../utils/heritageCoordinates';
import { handleHeritageImageError, HERITAGE_IMAGE_PLACEHOLDER } from '../utils/heritageImages';
import { CUSTOM_ITINERARY_KEY, readCustomItinerary, resolveCustomItinerary, moveItineraryStop } from '../utils/customItinerary';
import { MapView } from './MapView';

interface PlanViewProps {
  sites: HeritageSite[];
  savedSiteIds: string[];
  onSelectSite: (site: HeritageSite) => void;
  onExploreClick: () => void;
  onToggleSaveSite?: (id: string) => void;
  catalogueReady?: boolean;
  catalogueError?: string | null;
  visitedSiteIds?: string[];
  onPassport?: () => void;
}

const buttonStyle = 'min-h-11 rounded-lg border border-[#e8dfd5] px-3 py-2 text-sm font-semibold hover:bg-[#faf2ee] disabled:opacity-50 disabled:cursor-not-allowed';

export const PlanView = ({ sites, savedSiteIds, onSelectSite, onExploreClick, onToggleSaveSite = () => {}, catalogueReady = true, catalogueError, visitedSiteIds, onPassport }: PlanViewProps) => {
  const [mode, setMode] = useState<'recommended' | 'custom'>('recommended');
  const [routes, setRoutes] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Itinerary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [ids, setIds] = useState(readCustomItinerary);
  const [storageError, setStorageError] = useState('');
  const [query, setQuery] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const customSites = resolveCustomItinerary(ids, sites);
  const liveIds = customSites.map(site => site.id);
  const customJson = JSON.stringify(liveIds);
  if (catalogueReady && !catalogueError && JSON.stringify(ids) !== customJson) setIds(liveIds);

  useEffect(() => {
    let cancelled = false;
    apiFetchItineraries().then(value => { if (!cancelled) { setRoutes(value); setError(''); } })
      .catch(failure => { if (!cancelled) { setRoutes([]); setError(failure instanceof Error ? failure.message : 'Unable to load recommended itineraries.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    apiFetchItineraryById(selectedId).then(value => { if (!cancelled) { setDetail(value); setDetailError(value ? '' : 'This itinerary is no longer available.'); } })
      .catch(failure => { if (!cancelled) { setDetail(null); setDetailError(failure instanceof Error ? failure.message : 'Unable to load this itinerary.'); } })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, retry]);

  // Prune stale IDs only after a successful live catalogue load, never on failure/loading.
  useEffect(() => {
    if (!catalogueReady || catalogueError) return;
    try { localStorage.setItem(CUSTOM_ITINERARY_KEY, customJson); } catch { /* Explicit edits report storage failures below. */ }
  }, [catalogueReady, catalogueError, customJson]);

  const changeIds = (next: string[]) => {
    setIds(next);
    try { localStorage.setItem(CUSTOM_ITINERARY_KEY, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('This browser could not save your itinerary. Keep this page open or enable browser storage.'); }
  };
  const addSite = (id: string) => {
    if (liveIds.includes(id)) return;
    changeIds([...liveIds, id]);
  };
  const openDetail = (id: string) => { setSelectedId(id); setDetail(null); setDetailError(''); setDetailLoading(true); setMapOpen(false); };
  const retryLoad = () => { setLoading(true); if (selectedId) setDetailLoading(true); setRetry(value => value + 1); };
  const itinerarySites = mode === 'custom' ? customSites : detail?.stops.flatMap(stop => stop.site ? [stop.site] : []) || [];
  const unmapped = itinerarySites.filter(site => !hasUsableCoordinates(site.coordinates)).length;
  const browse = sites.filter(site => site.status === 'active' && `${site.name} ${site.category} ${site.address}`.toLowerCase().includes(query.toLowerCase()));

  const renderStop = (site: HeritageSite, index: number, custom: boolean) => (
    <li key={site.id} className="flex flex-col sm:flex-row gap-3 rounded-xl border border-[#e8dfd5] bg-white p-3">
      <img src={site.heroImage || HERITAGE_IMAGE_PLACEHOLDER} alt={site.name} onError={handleHeritageImageError} className="h-20 w-28 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-bold text-[#7e1925]">{`Stop ${index + 1}`}</p>
        <h3 className="font-bold break-words">{site.name}</h3>
        {visitedSiteIds && <p className="text-sm font-semibold text-[#7e1925]">{visitedSiteIds.includes(site.id) ? 'Visited' : 'Not yet visited'}</p>}
        <p className="text-sm text-[#574141]">{site.category}</p><p className="text-sm break-words">{site.address}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button id={`itinerary-view-site-${site.id}`} className={buttonStyle} onClick={() => onSelectSite(site)}>View Site</button>
          {hasUsableCoordinates(site.coordinates) ? <a id={`itinerary-directions-${site.id}`} className={buttonStyle} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${site.coordinates.lat},${site.coordinates.lng}`}>Directions</a> : <span className="self-center text-xs text-[#574141]">Verified coordinates not yet available</span>}
          {custom && <>
            <button id={`custom-up-${site.id}`} aria-label={`Move ${site.name} up`} className={buttonStyle} disabled={index === 0} onClick={() => changeIds(moveItineraryStop(liveIds, index, -1))}>Move Up</button>
            <button id={`custom-down-${site.id}`} aria-label={`Move ${site.name} down`} className={buttonStyle} disabled={index === customSites.length - 1} onClick={() => changeIds(moveItineraryStop(liveIds, index, 1))}>Move Down</button>
            <button id={`custom-remove-${site.id}`} aria-label={`Remove ${site.name}`} className={buttonStyle} onClick={() => changeIds(liveIds.filter(id => id !== site.id))}>Remove</button>
          </>}
        </div>
      </div>
    </li>
  );

  return <section id="plan-view" className="max-w-7xl mx-auto px-4 py-8 pb-28 space-y-6 text-[#1e1b19]">
    <h1 className="page-title">Plan Your Heritage Trip</h1>
    {onPassport && <button className={buttonStyle} onClick={onPassport}>Heritage Passport</button>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Itinerary mode">
      {(['recommended', 'custom'] as const).map(value => <button key={value} id={`plan-${value}-tab`} aria-pressed={mode === value} className={`${buttonStyle} ${mode === value ? 'bg-[#7e1925] text-white hover:bg-[#580b14]' : 'bg-white'}`} onClick={() => { setMode(value); setMapOpen(false); }}>{value === 'recommended' ? 'Recommended' : 'Build My Own Itinerary'}</button>)}
    </div>
    {mode === 'recommended' && <>
      {loading && !selectedId && <p role="status">Loading recommended itineraries…</p>}
      {error && !selectedId && <div role="alert"><p>{error}</p><button className={buttonStyle} onClick={retryLoad}>Retry</button></div>}
      {!selectedId && !loading && !error && (routes.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{routes.map(route => <article key={route.id} className="rounded-xl border border-[#e8dfd5] bg-white p-4 space-y-3">
        <h2 className="text-lg font-bold">{route.name}</h2>{route.description && <p className="text-sm">{route.description}</p>}<p className="text-sm">{route.stops.length} stops</p>
        <div className="flex gap-2">{route.stops.slice(0, 3).map(stop => stop.site && <img key={stop.id} src={stop.site.heroImage} alt={stop.site.name} onError={handleHeritageImageError} className="h-14 w-14 object-cover rounded-lg" />)}</div>
        <button id={`open-itinerary-${route.id}`} className={buttonStyle} onClick={() => openDetail(route.id)}>View Itinerary</button>
      </article>)}</div> : <p>No recommended itineraries are currently available.</p>)}
      {selectedId && <div className="space-y-4">
        <button className={buttonStyle} onClick={() => { setSelectedId(null); setDetail(null); setMapOpen(false); }}>Back to recommended itineraries</button>
        {detailLoading && <p role="status">Loading itinerary…</p>}
        {detailError && <div role="alert"><p>{detailError}</p><button className={buttonStyle} onClick={retryLoad}>Retry</button></div>}
        {detail && <><h2 className="text-2xl font-bold">{detail.name}</h2>{detail.description && <p>{detail.description}</p>}
          {itinerarySites.length ? <ol className="space-y-3">{itinerarySites.map((site, index) => renderStop(site, index, false))}</ol> : <p>No active stops are currently available in this itinerary.</p>}
        </>}
      </div>}
    </>}
    {mode === 'custom' && <div className="space-y-5">
      <h2 className="text-2xl font-bold">Your custom itinerary</h2>
      <p className="text-sm">Choose stops and arrange them in the order you want to visit. Changes save automatically on this browser.</p>
      {storageError && <p role="alert">{storageError}</p>}
      {catalogueError ? <div role="alert"><p>{catalogueError}</p><p>Your stored itinerary has been kept. Reload to try again.</p></div> : !catalogueReady ? <p role="status">Loading heritage sites…</p> : <>
        {customSites.length ? <><ol className="space-y-3">{customSites.map((site, index) => renderStop(site, index, true))}</ol><button id="custom-clear" className={buttonStyle} onClick={() => { changeIds([]); setMapOpen(false); }}>Clear itinerary</button></> : <p>Your itinerary is empty. Add heritage sites below.</p>}
        {savedSiteIds.some(id => !liveIds.includes(id) && sites.some(site => site.id === id && site.status === 'active')) && <button className={buttonStyle} onClick={() => changeIds([...new Set([...liveIds, ...sites.filter(site => site.status === 'active' && savedSiteIds.includes(site.id)).map(site => site.id)])])}>Add saved places</button>}
        <label className="block font-semibold" htmlFor="custom-site-search">Find heritage sites</label>
        <input id="custom-site-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, category, or address" className="w-full min-h-11 rounded-lg border border-[#e8dfd5] bg-white px-3" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{browse.map(site => <article key={site.id} className="rounded-xl border border-[#e8dfd5] bg-white p-3 space-y-2"><h3 className="font-bold">{site.name}</h3><p className="text-sm">{site.category}</p><button id={`custom-add-${site.id}`} className={buttonStyle} disabled={liveIds.includes(site.id)} onClick={() => addSite(site.id)}>{liveIds.includes(site.id) ? 'Added' : 'Add stop'}</button></article>)}</div>
        {!browse.length && <p>No heritage sites match your search.</p>}
        <button className={buttonStyle} onClick={onExploreClick}>Browse the heritage catalogue</button>
      </>}
    </div>}
    {itinerarySites.length > 0 && !(mode === 'custom' && (!catalogueReady || catalogueError)) && <div className="space-y-3">
      <button id="itinerary-map-toggle" className={buttonStyle} aria-expanded={mapOpen} onClick={() => setMapOpen(value => !value)}>{mapOpen ? 'Hide Map' : 'View on Map'}</button>
      {mapOpen && <><p className="text-sm">Map shows heritage stops with verified coordinates. Stop order is listed above; this is not a navigation route.{unmapped > 0 && ` ${unmapped} ${unmapped === 1 ? 'stop has' : 'stops have'} no verified map location.`}</p>
        <MapView sites={itinerarySites} savedSiteIds={savedSiteIds} onToggleSaveSite={onToggleSaveSite} onSelectSite={onSelectSite} onPlanRoute={() => {}} initialViewMode="map" />
      </>}
    </div>}
  </section>;
};
