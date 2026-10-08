import { useEffect, useRef, useState } from 'react';
import type { CheckinConfig } from '../types';
import { AdminApiError, apiFetchCheckinConfigs, apiSaveCheckinConfig } from '../api/client';
import { ErrorState } from './ErrorState';

const control = 'ui-control disabled:opacity-50';
type Draft = { enabled: boolean; radius: string };
type RowState = { saving?: boolean; error?: string; notice?: string };
const filters = ['All', 'Enabled', 'Disabled', 'Missing Coordinates', 'Archived'] as const;

export function AdminCheckins({ onManageHeritage }: { onManageHeritage?: () => void } = {}) {
  const [configs, setConfigs] = useState<CheckinConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof filters[number]>('All');
  const locks = useRef(new Set<number>());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    apiFetchCheckinConfigs().then(value => {
      if (!cancelled) { setConfigs(value); setLoading(false); }
    }).catch(failure => {
      if (!cancelled) { setError(failure instanceof Error ? failure.message : 'Unable to load visit verification configuration.'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [revision]);
  const edit = (id: number, draft: Draft) => {
    setDrafts(current => ({ ...current, [id]: draft }));
    setRows(current => ({ ...current, [id]: {} }));
  };
  const save = async (config: CheckinConfig, draft: Draft) => {
    const id = config.heritage_site_id;
    if (locks.current.has(id) || (draft.enabled === config.enabled && Number(draft.radius) === config.radius_meters)) return;
    const radius = Number(draft.radius);
    if (!draft.radius.trim() || !Number.isInteger(radius) || radius < 25 || radius > 500) {
      setRows(current => ({ ...current, [id]: { error: 'Radius must be a whole number between 25 and 500 meters.' } })); return;
    }
    if (draft.enabled && (config.status !== 'active' || !config.has_coordinates)) {
      setRows(current => ({ ...current, [id]: { error: 'Only active sites with valid coordinates can enable visit verification.' } })); return;
    }
    locks.current.add(id);
    setRows(current => ({ ...current, [id]: { saving: true } }));
    try {
      const updated = await apiSaveCheckinConfig(String(id), draft.enabled, radius);
      if (mounted.current) {
        setConfigs(current => current.map(item => item.heritage_site_id === id ? updated : item));
        setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
        setRows(current => ({ ...current, [id]: { notice: 'Visit verification updated.' } }));
      }
    } catch (failure) {
      if (mounted.current) setRows(current => ({ ...current, [id]: { error: failure instanceof AdminApiError
        ? Object.values(failure.validationErrors).flat().join(' ') || failure.message : 'Unable to save visit verification configuration. Please try again.' } }));
    } finally { locks.current.delete(id); }
  };
  const unavailable = configs.filter(site => site.status !== 'active' || !site.has_coordinates).length;
  const enabledCount = configs.filter(site => site.status === 'active' && site.has_coordinates && site.enabled).length;
  const query = search.trim().toLowerCase();
  const visible = configs.filter(site => [site.name, site.category, site.address].some(value => value.toLowerCase().includes(query)))
    .filter(site => filter === 'All' || (filter === 'Enabled' && site.enabled) || (filter === 'Disabled' && !site.enabled)
      || (filter === 'Missing Coordinates' && !site.has_coordinates) || (filter === 'Archived' && site.status === 'archived'));
  return <section id="admin-checkins" className="space-y-4 max-w-5xl min-w-0">
    <h2 className="page-title">Visit Verification</h2>
    {!loading && !error && <p className="text-sm text-[#61564d]">{configs.length} Heritage Sites · Enabled: {enabledCount} · Disabled: {configs.length - unavailable - enabledCount} · Unavailable: {unavailable}</p>}
    <label htmlFor="checkin-search" className="block text-sm font-semibold">Search heritage sites</label>
    <input id="checkin-search" className={`${control} w-full`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, category or address" />
    <div className="flex flex-wrap gap-2" aria-label="Filter heritage sites">{filters.map(value => <button key={value} type="button" className={control} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
    {loading && <p role="status">Loading visit verification configuration…</p>}
    {error && <ErrorState message={error} onRetry={() => { setError(''); setLoading(true); setRevision(value => value + 1); }} />}
    {!loading && !error && visible.length === 0 && <p role="status">{configs.length ? 'No heritage sites match your search.' : 'No heritage sites available.'}</p>}
    {!loading && !error && <div className="space-y-3">{visible.map(config => {
      const id = config.heritage_site_id;
      const draft = drafts[id] || { enabled: config.enabled, radius: String(config.radius_meters) };
      const state = rows[id] || {};
      const canEnable = config.status === 'active' && config.has_coordinates;
      const changed = draft.enabled !== config.enabled || Number(draft.radius) !== config.radius_meters || !draft.radius.trim();
      return <form key={id} id={`checkin-site-${id}`} className="ui-card p-4 space-y-3 min-w-0" onSubmit={event => { event.preventDefault(); void save(config, draft); }}>
        <div><h3 className="text-base font-semibold break-words">{config.name}</h3><p className="text-sm">{config.status === 'active' ? 'Active' : 'Archived'} · {config.has_coordinates ? 'Coordinates available' : 'Coordinates unavailable'}</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3 min-h-11"><label htmlFor={`checkin-enabled-${id}`} className="font-semibold">Visit Verification</label>
              <button id={`checkin-enabled-${id}`} type="button" role="switch" aria-checked={draft.enabled} aria-describedby={!canEnable ? `checkin-restriction-${id}` : undefined} disabled={state.saving || !canEnable}
                className={`relative h-7 w-12 shrink-0 rounded-full border disabled:opacity-50 ${draft.enabled ? 'bg-green-700 border-green-700' : 'bg-gray-400 border-gray-400'}`} onClick={() => edit(id, { ...draft, enabled: !draft.enabled })}>
                <span aria-hidden="true" className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${draft.enabled ? 'left-0.5 translate-x-5' : 'left-0.5'}`} />
              </button><span className={draft.enabled ? 'text-green-800' : 'text-[#61564d]'}>{draft.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            {!canEnable && <p id={`checkin-restriction-${id}`} className="text-sm text-[#61564d]">{config.status !== 'active' ? 'Archived sites cannot use visit verification.' : 'Coordinates required before Visit Verification can be enabled.'}</p>}
            {!config.has_coordinates && onManageHeritage && <button type="button" className="ui-button-secondary min-h-11 text-sm" disabled={state.saving} onClick={onManageHeritage}>Edit Heritage Site</button>}
          </div>
          <div className={draft.enabled ? '' : 'text-[#61564d]'}><label htmlFor={`checkin-radius-${id}`} className="block text-sm mb-1">Radius (25–500 meters)</label>
            <input id={`checkin-radius-${id}`} className={`${control} w-full sm:w-28`} type="number" min="25" max="500" step="1" required value={draft.radius} disabled={state.saving} onChange={event => edit(id, { ...draft, radius: event.target.value })} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm">{config.verified_visitors} verified visitors</p>
          <button id={`checkin-save-${id}`} className={`${control} bg-[#7e1925] text-white`} disabled={!changed || state.saving || (draft.enabled && !canEnable)}>{state.saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
        {state.error && <p role="alert" className="text-red-800">{state.error}</p>}
        {state.notice && <p role="status" className="status-success">{state.notice}</p>}
      </form>;
    })}</div>}
  </section>;
}
