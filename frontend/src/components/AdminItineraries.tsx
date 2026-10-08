import { useEffect, useRef, useState } from 'react';
import type { Itinerary, ItineraryInput } from '../types';
import { AdminApiError, apiFetchAdminItineraries, apiSaveItinerary, apiArchiveItinerary, apiRestoreItinerary } from '../api/client';
import { moveItineraryStop } from '../utils/customItinerary';

interface Props { sites: { id: string | number; name: string; status: string }[] }
interface Draft { id?: string; name: string; description: string; status: 'active' | 'archived'; ids: string[] }
const control = 'ui-control hover:bg-gray-50 disabled:opacity-50';

export const AdminItineraries = ({ sites }: Props) => {
  const [routes, setRoutes] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    apiFetchAdminItineraries().then(value => { if (!cancelled) { setRoutes(value); setLoadError(''); } })
      .catch(failure => { if (!cancelled) setLoadError(failure instanceof Error ? failure.message : 'Unable to load itineraries.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  const refresh = () => { setLoading(true); setRevision(value => value + 1); };
  const mutate = async (request: () => Promise<unknown>, message: string, close = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await request(); if (close) setDraft(null); setNotice(message); refresh(); }
    catch (failure) {
      setError(failure instanceof AdminApiError ? [failure.message, ...Object.values(failure.validationErrors).flat()].join(' ') : 'Unable to save changes. Please retry.');
    } finally { lock.current = false; setBusy(false); }
  };
  const open = (route?: Itinerary) => {
    setError(''); setNotice('');
    setDraft(route ? { id: route.id, name: route.name, description: route.description || '', status: route.status, ids: route.stops.map(stop => stop.siteId) } : { name: '', description: '', status: 'active', ids: [] });
  };
  const stopName = (id: string) => sites.find(site => String(site.id) === id)?.name
    || routes.flatMap(route => route.stops).find(stop => stop.siteId === id)?.site?.name || `Unavailable heritage site #${id}`;
  return <section id="admin-itineraries" className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="page-title">Recommended Itineraries</h2><button id="admin-itinerary-new" disabled={busy || loading || !!loadError} className={control} onClick={() => open()}>Create itinerary</button></div>
    {loading && <p role="status">Loading itineraries…</p>}
    {loadError && <div role="alert"><p>{loadError}</p><button className={control} onClick={refresh}>Retry</button></div>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status" className="status-success">{notice}</p>}
    {draft && <form id="admin-itinerary-form" className="ui-card p-4 space-y-4" onSubmit={event => {
      event.preventDefault();
      const payload: ItineraryInput = { name: draft.name, description: draft.description.trim() || null, status: draft.status, stops: draft.ids.map((id, index) => ({ heritage_site_id: Number(id), sort_order: index })) };
      void mutate(() => apiSaveItinerary(payload, draft.id), 'Itinerary saved.', true);
    }}>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block">Name<input id="admin-itinerary-name" required maxLength={255} className="block w-full border rounded-lg p-2" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="block">Description (optional)<textarea id="admin-itinerary-description" maxLength={10000} className="block w-full border rounded-lg p-2" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="block">Status<select className="block min-h-11 border rounded-lg p-2" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Draft['status'] })}><option value="active">Active</option><option value="archived">Archived</option></select></label>
        <label className="block">Add active heritage site<select id="admin-itinerary-add-stop" className="block w-full min-h-11 border rounded-lg p-2" value="" onChange={event => {
          const id = event.target.value; if (id && !draft.ids.includes(id)) setDraft({ ...draft, ids: [...draft.ids, id] });
        }}><option value="">Select a site</option>{sites.filter(site => site.status === 'active' && !draft.ids.includes(String(site.id))).map(site => <option key={site.id} value={String(site.id)}>{site.name}</option>)}</select></label>
        <ol className="space-y-2">{draft.ids.map((id, index) => <li key={id} className="flex flex-wrap items-center gap-2 border rounded-lg p-2">
          <span className="min-w-0 flex-1">{index + 1}. {stopName(id)}{sites.find(site => String(site.id) === id)?.status !== 'active' && <span className="block text-sm text-amber-800">Archived or unavailable; hidden publicly. Remove if no longer needed.</span>}</span>
          <button id={`admin-itinerary-up-${id}`} type="button" className={control} aria-label={`Move ${stopName(id)} up`} disabled={busy || index === 0} onClick={() => setDraft({ ...draft, ids: moveItineraryStop(draft.ids, index, -1) })}>Up</button>
          <button id={`admin-itinerary-down-${id}`} type="button" className={control} aria-label={`Move ${stopName(id)} down`} disabled={busy || index === draft.ids.length - 1} onClick={() => setDraft({ ...draft, ids: moveItineraryStop(draft.ids, index, 1) })}>Down</button>
          <button id={`admin-itinerary-remove-${id}`} type="button" className={control} aria-label={`Remove ${stopName(id)}`} onClick={() => setDraft({ ...draft, ids: draft.ids.filter(value => value !== id) })}>Remove</button>
        </li>)}</ol>
        <div className="flex gap-2"><button id="admin-itinerary-save" type="submit" disabled={busy || !draft.ids.length} className={control}>{busy ? 'Saving…' : 'Save itinerary'}</button><button type="button" className={control} onClick={() => setDraft(null)}>Cancel</button></div>
      </fieldset>
    </form>}
    {!loading && !loadError && <div className="space-y-3">{routes.length ? routes.map(route => <article key={route.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <div className="flex-1 min-w-0"><h3 className="font-bold break-words">{route.name}</h3><p>{route.status} · {route.stops.length} stops</p></div>
      <button id={`admin-itinerary-edit-${route.id}`} className={control} disabled={busy} onClick={() => open(route)}>Edit</button>
      <button id={`admin-itinerary-status-${route.id}`} className={control} disabled={busy} onClick={() => void mutate(() => route.status === 'active' ? apiArchiveItinerary(route.id) : apiRestoreItinerary(route.id), route.status === 'active' ? 'Itinerary archived.' : 'Itinerary restored.')}>{route.status === 'active' ? 'Archive' : 'Restore'}</button>
    </article>) : <p>No recommended itineraries yet.</p>}</div>}
  </section>;
};
