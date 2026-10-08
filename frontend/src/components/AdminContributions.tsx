import { useEffect, useRef, useState } from 'react';
import type { AdminContribution, ContributionStatus } from '../types';
import { apiFetchAdminContributions, apiModerateContribution, apiRemoveContribution } from '../api/client';
import { ErrorState } from './ErrorState';
import { handleHeritageImageError } from '../utils/heritageImages';

export function AdminContributions() {
  const [status, setStatus] = useState<ContributionStatus>('pending');
  const [result, setResult] = useState<{ key: string; items?: AdminContribution[]; error?: string } | null>(null);
  const [actionError, setActionError] = useState(''), [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0), [saving, setSaving] = useState(false);
  const requestKey = `${status}:${retry}`, loading = result?.key !== requestKey;
  const items = loading ? [] : result?.items || [], error = loading ? '' : result?.error || '';
  const busy = useRef(false), generation = useRef(0);
  useEffect(() => {
    const revision = ++generation.current;
    apiFetchAdminContributions(status).then(items => { if (revision === generation.current) setResult({ key: requestKey, items }); })
      .catch(failure => { if (revision === generation.current) setResult({ key: requestKey, error: failure instanceof Error ? failure.message : 'Unable to load contributions.' }); });
    return () => { generation.current = revision + 1; };
  }, [status, requestKey]);
  const moderate = async (item: AdminContribution, action: 'approved' | 'rejected' | 'remove') => {
    if (busy.current) return;
    if (action === 'remove' && !window.confirm('Remove this contribution and its photos?')) return;
    busy.current = true; setSaving(true); setActionError(''); setNotice('');
    const revision = generation.current;
    try {
      if (action === 'remove') await apiRemoveContribution(item.id);
      else await apiModerateContribution(item.id, action);
      if (revision === generation.current) {
        setNotice(action === 'remove' ? 'Contribution removed.' : action === 'approved' ? 'Contribution approved.' : 'Contribution rejected.');
        setRetry(value => value + 1);
      }
    } catch (failure) {
      if (revision === generation.current) setActionError(failure instanceof Error ? failure.message : 'Unable to moderate this contribution. Please try again.');
    } finally { busy.current = false; setSaving(false); }
  };
  return <section className="space-y-5 min-w-0">
    <h2 className="section-title">Visitor Contributions</h2>
    <div className="flex flex-wrap gap-2" aria-label="Contribution status filters">{(['pending', 'approved', 'rejected'] as const).map(value => <button key={value} className={status === value ? 'ui-button-primary' : 'ui-button-secondary'} disabled={saving} aria-pressed={status === value} onClick={() => { setStatus(value); setActionError(''); setNotice(''); }}>{value === 'pending' ? 'Pending' : value === 'approved' ? 'Approved' : 'Rejected'}</button>)}</div>
    {loading && <p role="status">Loading contributions…</p>}
    {error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} retryLabel="Retry" />}
    {actionError && <ErrorState message={actionError} />}
    <p role="status" aria-live="polite">{saving ? 'Saving moderation…' : notice}</p>
    {!loading && !error && !items.length && <p>{status === 'pending' ? 'No contributions waiting for review.' : `No ${status} contributions.`}</p>}
    {!loading && !error && items.map(item => <article key={item.id} className="ui-card p-4 sm:p-6 space-y-3 min-w-0">
      <h3 className="font-semibold break-words">{item.heritage_site.name}</h3>
      <p className="break-words [overflow-wrap:anywhere]">{item.visitor_name}</p>
      <div className="flex flex-wrap gap-3"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time><span className="capitalize">{item.status}</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{item.images.map((url, index) => <a key={index} href={url} target="_blank" rel="noopener noreferrer" aria-label={`View visitor photo ${index + 1} from ${item.heritage_site.name}`}><img src={url} alt={`Visitor photo from ${item.heritage_site.name}`} className="w-full min-w-0 h-52 object-cover rounded" loading="lazy" onError={handleHeritageImageError} /></a>)}</div>
      {item.caption && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.caption}</p>}
      <div className="flex flex-wrap gap-2">
        {item.status !== 'approved' && <button className="ui-button-primary" disabled={saving || item.heritage_site.status !== 'active'} onClick={() => moderate(item, 'approved')}>Approve</button>}
        {item.status !== 'rejected' && <button className="ui-button-secondary" disabled={saving} onClick={() => moderate(item, 'rejected')}>Reject</button>}
        <button className="ui-button-secondary text-[#7e1925]" disabled={saving} onClick={() => moderate(item, 'remove')}>Remove</button>
      </div>
    </article>)}
  </section>;
}
