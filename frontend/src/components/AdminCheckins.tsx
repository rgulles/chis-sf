import { useEffect, useRef, useState } from 'react';
import type { CheckinConfig } from '../types';
import { AdminApiError, apiFetchCheckinConfigs, apiSaveCheckinConfig } from '../api/client';
import { ErrorState } from './ErrorState';

interface Props { sites: { id: string | number; name: string; status: string; latitude?: number | string | null; longitude?: number | string | null }[] }
const control = 'ui-control disabled:opacity-50';

export function AdminCheckins({ sites }: Props) {
  const [configs, setConfigs] = useState<CheckinConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [siteId, setSiteId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [radius, setRadius] = useState(100);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    apiFetchCheckinConfigs().then(value => { if (!cancelled) { setConfigs(value); setLoading(false); } }).catch(failure => { if (!cancelled) { setError(failure instanceof Error ? failure.message : 'Unable to load visit verification configuration.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [revision]);
  const selectSite = (id: string) => {
    const config = configs.find(value => String(value.heritage_site_id) === id);
    setSiteId(id); setEnabled(config?.enabled || false); setRadius(config?.radius_meters || 100); setError(''); setNotice('');
  };
  const mutate = async () => {
    const id = siteId;
    if (!id || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const config = await apiSaveCheckinConfig(id, enabled, radius);
      setConfigs(current => [...current.filter(value => value.heritage_site_id !== config.heritage_site_id), config]);
      setNotice('Visit verification configuration saved.');
      setRevision(value => value + 1);
    } catch (failure) {
      setError(failure instanceof AdminApiError ? Object.values(failure.validationErrors).flat().join(' ') || failure.message : 'Unable to save visit verification configuration.');
    } finally { lock.current = false; setBusy(false); }
  };
  const selected = sites.find(site => String(site.id) === siteId);
  const canEnable = selected?.status === 'active' && selected.latitude != null && selected.longitude != null && String(selected.latitude).trim() !== '' && String(selected.longitude).trim() !== '' && Number.isFinite(Number(selected.latitude)) && Number.isFinite(Number(selected.longitude)) && Math.abs(Number(selected.latitude)) <= 90 && Math.abs(Number(selected.longitude)) <= 180;
  return <section id="admin-checkins" className="space-y-5 max-w-5xl">
    <h2 className="page-title">Visit Verification</h2><p>Enable only approved active sites with verified coordinates. No site is enabled automatically.</p>
    {loading && <p role="status">Loading visit verification configuration…</p>}
    {error && <ErrorState message={error} onRetry={() => { setError(''); setLoading(true); setRevision(value => value + 1); }} />}
    {notice && <p role="status" className="status-success">{notice}</p>}
    <form className="ui-card p-4 space-y-3" onSubmit={event => { event.preventDefault(); void mutate(); }}>
      <label className="block" htmlFor="checkin-admin-site">Heritage site</label><select id="checkin-admin-site" className={`${control} w-full`} value={siteId} disabled={busy || loading} onChange={event => selectSite(event.target.value)} required><option value="">Choose a site</option>{sites.filter(site => site.status === 'active' || configs.some(config => String(config.heritage_site_id) === String(site.id))).map(site => <option key={site.id} value={String(site.id)}>{site.name}{site.status === 'active' ? '' : ' (archived)'}</option>)}</select>
      <label className="block" htmlFor="checkin-radius">Verification radius (25–500 meters)</label><input id="checkin-radius" className={control} type="number" min="25" max="500" step="1" required value={radius} disabled={busy} onChange={event => setRadius(Number(event.target.value))} />
      <label className="flex gap-3 items-center min-h-11"><input id="checkin-enabled" type="checkbox" checked={enabled} disabled={busy || (!canEnable && !enabled)} onChange={event => setEnabled(event.target.checked)} />Enable visit verification</label>
      <button id="checkin-admin-save" className={`${control} bg-[#7e1925] text-white`} disabled={!siteId || busy || loading}>{busy ? 'Saving…' : 'Save Configuration'}</button>
    </form>
    {!loading && !configs.length && !error && <p>No participating sites configured yet.</p>}
    <div className="grid gap-3 sm:grid-cols-2">{configs.map(config => <article key={config.id} className="rounded-xl border bg-white p-4 space-y-3"><h3 className="text-base font-semibold">{sites.find(site => String(site.id) === String(config.heritage_site_id))?.name || 'Heritage Site'}</h3><p>{config.enabled ? 'Enabled' : 'Disabled'} · {config.radius_meters} m radius{config.verified_visitors !== undefined && ` · ${config.verified_visitors} verified visitors`}</p><div className="flex flex-wrap gap-2"><button className={control} disabled={busy} onClick={() => selectSite(String(config.heritage_site_id))}>Edit</button></div></article>)}</div>
  </section>;
}
