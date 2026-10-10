import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { HeritageSite, UserProfile, VisitorContribution, MyContribution, VerificationAvailability } from '../types';
import { apiFetchContributions, apiFetchMyContribution, apiSubmitContribution, AdminApiError } from '../api/client';
import { ErrorState } from './ErrorState';
import { handleHeritageImageError } from '../utils/heritageImages';

export function VisitorExperiences({ site, user, onLogin, verificationRevision = 0, onVerifyVisit, onEligibility, availability }: {
  site: HeritageSite; user: UserProfile | null; onLogin: () => void; verificationRevision?: number;
  onVerifyVisit?: () => boolean; onEligibility?: (verified: boolean) => void;
  availability?: VerificationAvailability;
}) {
  const verificationEnabled = availability ? availability.enabled : site.visitVerificationEnabled;
  const [retry, setRetry] = useState(0);
  const publicKey = `${site.id}:${retry}`, statusKey = `${site.id}:${user?.id}:${verificationRevision}:${retry}`;
  const [publicResult, setPublicResult] = useState<{ key: string; items?: VisitorContribution[]; error?: string } | null>(null);
  const [myResult, setMyResult] = useState<{ key: string; data?: MyContribution; error?: string } | null>(null);
  const loading = publicResult?.key !== publicKey, error = loading ? '' : publicResult?.error || '';
  const items = loading ? [] : publicResult?.items || [];
  const statusLoading = Boolean(user) && myResult?.key !== statusKey;
  const mine = statusLoading ? null : myResult?.data || null, statusError = statusLoading ? '' : myResult?.error || '';
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]), [caption, setCaption] = useState('');
  const [formError, setFormError] = useState(''), [saving, setSaving] = useState(false);
  const busy = useRef(false), files = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let current = true;
    apiFetchContributions(site.id).then(items => { if (current) setPublicResult({ key: publicKey, items }); })
      .catch(failure => { if (current) setPublicResult({ key: publicKey, error: failure instanceof Error ? failure.message : 'Unable to load visitor experiences.' }); });
    return () => { current = false; };
  }, [site.id, publicKey]);
  useEffect(() => {
    let current = true;
    if (user) apiFetchMyContribution(site.id).then(data => { if (current) { setMyResult({ key: statusKey, data }); onEligibility?.(data.verified); } })
      .catch(failure => { if (current) setMyResult({ key: statusKey, error: failure instanceof Error ? failure.message : 'Unable to load your contribution status.' }); });
    return () => { current = false; };
  }, [site.id, user, statusKey, onEligibility]);
  useEffect(() => () => { photos.forEach(photo => URL.revokeObjectURL(photo.url)); }, [photos]);
  const selectPhotos = (selected: File[]) => {
    setFormError('');
    if (selected.length > 3) { setFormError('Choose a maximum of 3 photos.'); return; }
    if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || !/\.(jpe?g|png|webp)$/i.test(file.name) || file.size > 5 * 1024 * 1024)) {
      setFormError('Choose JPEG, PNG or WebP photos no larger than 5 MB each.'); return;
    }
    setPhotos(selected.map(file => ({ file, url: URL.createObjectURL(file) })));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    if (!photos.length || photos.length > 3 || caption.length > 500) { setFormError('Choose 1 to 3 photos and a caption of at most 500 characters.'); return; }
    busy.current = true; setSaving(true); setFormError('');
    try {
      const contribution = await apiSubmitContribution(site.id, photos.map(photo => photo.file), caption);
      setMyResult(previous => previous?.data ? { ...previous, data: { ...previous.data, can_submit: false, contribution } } : previous);
      setPhotos([]); setCaption('');
      if (files.current) files.current.value = '';
    } catch (failure) {
      const details = failure instanceof AdminApiError ? Object.values(failure.validationErrors).flat().join(' ') : '';
      setFormError(details || (failure instanceof Error ? failure.message : 'Unable to submit your experience. Please try again.'));
      if (failure instanceof AdminApiError && [403, 409].includes(failure.status || 0)) setRetry(value => value + 1);
    } finally { busy.current = false; setSaving(false); }
  };
  const removePhoto = (index: number) => {
    // Recreate remaining URLs because the effect releases the previous selection.
    setPhotos(photos.filter((_, position) => position !== index).map(photo => ({ file: photo.file, url: URL.createObjectURL(photo.file) })));
    if (files.current) files.current.value = '';
  };
  return <section id="visitor-experiences" className="space-y-4 min-w-0">
    <h2 className="section-title font-editorial border-b border-[#e7e0d6] pb-2">Visitor Experiences</h2>
    <p className="text-sm text-[#61564d]">Photos and short experiences shared by verified visitors.</p>
    {loading && <p role="status">Loading visitor experiences…</p>}
    {error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} retryLabel="Retry" />}
    {!loading && !error && !items.length && <p>No visitor experiences have been shared yet.</p>}
    {!loading && !error && <div className="space-y-4">{items.map(item => <article key={item.id} className="border-b border-[#e7ded4] py-4 space-y-3 min-w-0">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold break-words [overflow-wrap:anywhere]">{item.visitor_name}</h3><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{item.images.map((url, index) => <img key={index} src={url} alt={`Visitor photo from ${site.name}`} loading="lazy" decoding="async" width={480} height={208} onError={handleHeritageImageError} className="w-full min-w-0 h-52 object-cover rounded" />)}</div>
      {item.caption && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.caption}</p>}
    </article>)}</div>}
    <div className={statusLoading ? 'space-y-3 min-w-0' : 'ui-card p-4 sm:p-6 space-y-3 min-w-0'}>
      {!user ? <><p>Sign in to share your experience.</p><button className="ui-button-primary" onClick={onLogin}>Sign In</button></> : <>
        {statusLoading && <p role="status">Loading your contribution status…</p>}
        {statusError && <ErrorState message={statusError} onRetry={() => setRetry(value => value + 1)} retryLabel="Retry" />}
        {mine && <>
          {!mine.active ? <p role="status">This heritage site is archived and cannot accept contributions.</p> : !mine.verified ? <><p>Verify your visit before sharing an experience.</p>{verificationEnabled === false ? <p role="status">Visit verification is currently unavailable for this site.</p> : verificationEnabled === true ? <button className="ui-button-primary" onClick={() => { if (!onVerifyVisit?.()) setFormError('Visit verification is not ready. Please use the Heritage Passport section or retry its loading error.'); }}>Verify My Visit</button> : availability?.error ? <p role="alert">Unable to load visit verification. Retry in the Heritage Passport section.</p> : <p role="status">Loading visit verification…</p>}{formError && <p role="alert">{formError}</p>}</> : <>
            {mine.contribution?.status === 'pending' && <p role="status">Your contribution is awaiting review.</p>}
            {mine.contribution?.status === 'approved' && <p role="status">Your contribution is published.</p>}
            {mine.contribution?.status === 'rejected' && <p role="status">Your contribution was rejected. You may submit a replacement for review.</p>}
            {mine.can_submit && <form id="contribution-form" onSubmit={submit} className="space-y-3 min-w-0">
              <h3 className="font-semibold">Share Your Experience</h3>
              <div className="rounded-xl border border-[#e7e0d6] bg-[#faf2ee] p-4 space-y-3 min-w-0">
                <label htmlFor="contribution-photos" className="block font-semibold">Photos</label>
                <p id="contribution-photo-help" className="text-sm text-[#61564d]">1–3 images • JPEG, PNG, or WebP • Max 5 MB each</p>
                <input ref={files} id="contribution-photos" type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={saving} tabIndex={-1} aria-describedby="contribution-photo-help contribution-photo-count" className="sr-only" onChange={event => { selectPhotos(Array.from(event.target.files || [])); event.target.value = ''; }} />
                <button type="button" disabled={saving} aria-controls="contribution-photos" aria-describedby="contribution-photo-help" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#7A1C30] bg-white px-4 py-2 text-sm font-semibold text-[#7A1C30] transition-colors hover:bg-[#7A1C30]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A1C30] disabled:opacity-50 w-full sm:w-auto" onClick={() => files.current?.click()}><ImagePlus className="h-5 w-5 shrink-0" aria-hidden="true" />Choose Photos</button>
                <p id="contribution-photo-count" role="status" aria-live="polite" className="text-sm text-[#61564d]">{photos.length} of 3 photos selected</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{photos.map((photo, index) => <figure key={photo.url} className="min-w-0 space-y-2">
                <img src={photo.url} alt={`Selected visitor photo ${index + 1} from ${site.name}`} width={160} height={112} className="h-28 w-full object-cover rounded-lg" />
                <button type="button" className="ui-button-secondary w-full min-h-11 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A1C30]" disabled={saving} onClick={() => removePhoto(index)}>Remove photo {index + 1}</button>
              </figure>)}</div>
              <label htmlFor="contribution-caption" className="block">Caption (optional, plain text)</label>
              <textarea id="contribution-caption" rows={3} maxLength={500} value={caption} disabled={saving} className="w-full min-w-0 rounded border border-[#e7e0d6] p-3" onChange={event => setCaption(event.target.value)} />
              <p className="text-sm">{caption.length}/500 characters</p>
              <button className="ui-button-primary" disabled={saving || !photos.length}>{saving ? 'Submitting…' : 'Submit for Review'}</button>
              <p role="status" aria-live="polite">{saving ? 'Uploading your experience…' : ''}</p>
            </form>}
          </>}
        </>}
      </>}
      {formError && <p role="alert" className="status-error p-3">{formError}</p>}
    </div>
  </section>;
}
