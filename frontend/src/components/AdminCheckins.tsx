import { useEffect, useRef, useState } from 'react';
import type { CheckinConfig } from '../types';
import { AdminApiError, apiFetchCheckinConfigs, apiSaveCheckinConfig, apiRotateCheckinToken } from '../api/client';
import { checkinUrl, printableCheckinSvg, publicCheckinBase } from '../utils/checkinQr';

interface Props { sites: { id: string | number; name: string; status: string; latitude?: number | string | null; longitude?: number | string | null }[] }
const control = 'min-h-11 rounded-lg border px-3 py-2 text-sm disabled:opacity-50';

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
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [qr, setQr] = useState<{ id: string; svg: string; url: string } | null>(null);
  const lock = useRef(false), qrRevision = useRef<object>({});
  useEffect(() => {
    let cancelled = false;
    apiFetchCheckinConfigs().then(value => { if (!cancelled) { setConfigs(value); setLoading(false); } }).catch(() => { if (!cancelled) { setError('Unable to load check-in configuration.'); setLoading(false); } });
    return () => { cancelled = true; qrRevision.current = {}; };
  }, [revision]);
  const selectSite = (id: string) => {
    const config = configs.find(value => String(value.heritage_site_id) === id);
    setSiteId(id); setEnabled(config?.enabled || false); setRadius(config?.radius_meters || 100); setError(''); setNotice('');
  };
  const mutate = async (rotate = false) => {
    const id = rotate ? rotateId : siteId;
    if (!id || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const config = rotate ? await apiRotateCheckinToken(id) : await apiSaveCheckinConfig(id, enabled, radius);
      setConfigs(current => [...current.filter(value => value.heritage_site_id !== config.heritage_site_id), config]);
      setQr(null); qrRevision.current = {}; setRotateId(null);
      setNotice(rotate ? 'QR rotated. Replace printed QR codes; the previous token is invalid. Visit history is preserved.' : 'Check-in configuration saved. Deploy the official QR at the approved site before inviting visitors.');
      setRevision(value => value + 1);
    } catch (failure) {
      setError(failure instanceof AdminApiError ? Object.values(failure.validationErrors).flat().join(' ') || failure.message : 'Unable to save check-in configuration.');
    } finally { lock.current = false; setBusy(false); }
  };
  const preview = async (config: CheckinConfig) => {
    const revision = {};
    qrRevision.current = revision;
    setQr(null); setError('');
    try {
      const site = sites.find(value => String(value.id) === String(config.heritage_site_id));
      const url = checkinUrl(config.public_token, publicCheckinBase());
      const svg = await printableCheckinSvg(site?.name || 'Heritage Site', url);
      if (revision === qrRevision.current) setQr({ id: String(config.heritage_site_id), svg, url });
    } catch { if (revision === qrRevision.current) setError('Unable to generate QR. Check the public frontend URL configuration.'); }
  };
  return <section id="admin-checkins" className="space-y-5 max-w-5xl">
    <h2 className="text-2xl font-bold">Heritage Check-In</h2><p>Enable only approved active sites with verified coordinates and an official QR placed on site. No site is enabled automatically.</p>
    {loading && <p role="status">Loading check-in configuration…</p>}
    {error && <div role="alert"><p>{error}</p><button className={control} onClick={() => { setError(''); setRevision(value => value + 1); }}>Reload configurations</button></div>}
    {notice && <p role="status">{notice}</p>}
    <form className="rounded-xl border bg-white p-4 space-y-3" onSubmit={event => { event.preventDefault(); void mutate(); }}>
      <label className="block" htmlFor="checkin-admin-site">Heritage site</label><select id="checkin-admin-site" className={`${control} w-full`} value={siteId} disabled={busy || loading} onChange={event => selectSite(event.target.value)} required><option value="">Choose a site</option>{sites.filter(site => site.status === 'active' || configs.some(config => String(config.heritage_site_id) === String(site.id))).map(site => <option key={site.id} value={String(site.id)}>{site.name}{site.status === 'active' ? '' : ' (archived)'}</option>)}</select>
      <label className="block" htmlFor="checkin-radius">Verification radius (25–500 meters)</label><input id="checkin-radius" className={control} type="number" min="25" max="500" step="1" required value={radius} disabled={busy} onChange={event => setRadius(Number(event.target.value))} />
      <label className="flex gap-3 items-center min-h-11"><input id="checkin-enabled" type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} />Enable visitor check-in</label>
      <button id="checkin-admin-save" className={`${control} bg-[#7e1925] text-white`} disabled={!siteId || busy || loading}>{busy ? 'Saving…' : 'Save / Generate initial QR'}</button>
    </form>
    <div className="grid gap-3 sm:grid-cols-2">{configs.map(config => <article key={config.id} className="rounded-xl border bg-white p-4 space-y-3"><h3 className="font-bold">{sites.find(site => String(site.id) === String(config.heritage_site_id))?.name || 'Heritage Site'}</h3><p>{config.enabled ? 'Enabled' : 'Disabled'} · {config.radius_meters} m radius{config.verified_visitors !== undefined && ` · ${config.verified_visitors} verified visitors`}</p><div className="flex flex-wrap gap-2"><button className={control} disabled={busy} onClick={() => selectSite(String(config.heritage_site_id))}>Edit</button><button id={`checkin-qr-${config.heritage_site_id}`} className={control} disabled={busy} onClick={() => void preview(config)}>View QR</button><button className={control} disabled={busy} onClick={() => setRotateId(String(config.heritage_site_id))}>Rotate QR</button></div></article>)}</div>
    {rotateId && <div role="dialog" aria-label="Confirm QR rotation" className="rounded-xl border border-[#7e1925] p-4 space-y-3"><p>The old QR will stop working. Existing passport stamps remain. Replace the printed QR after rotation.</p><button className={control} disabled={busy} onClick={() => void mutate(true)}>Confirm rotation</button><button className={control} disabled={busy} onClick={() => setRotateId(null)}>Cancel</button></div>}
    {qr && <div className="rounded-xl border bg-white p-4 space-y-3"><img id="official-checkin-qr" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`} alt="Official CHIS heritage check-in QR" className="w-full max-w-sm h-auto" /><p className="break-all text-sm">{qr.url}</p><a id="checkin-qr-download" className={`${control} inline-flex items-center`} download={`chis-heritage-checkin-${qr.id}.svg`} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`}>Download printable SVG</a><button className={control} onClick={() => { setQr(null); qrRevision.current = {}; }}>Close QR</button></div>}
  </section>;
}
