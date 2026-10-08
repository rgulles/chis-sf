import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { CheckinResult, HeritageSite, UserProfile, VerificationAvailability } from '../types';
import { apiCheckinAvailability, apiVerifyVisit } from '../api/client';
import { ErrorState } from './ErrorState';

interface Props {
  site: HeritageSite;
  user: UserProfile | null;
  onLogin: () => void;
  onPassport: () => void;
  onExplore: () => void;
  onVerified: () => void;
  actionRef?: RefObject<HTMLButtonElement | null>;
  alreadyVerified?: boolean;
  availability?: VerificationAvailability;
  onRetryAvailability?: () => void;
}
const button = 'min-h-11 rounded-lg border border-[#7e1925] px-4 py-2 font-semibold disabled:opacity-50';

export function VisitVerification({ site, user, onLogin, onPassport, onExplore, onVerified, actionRef, alreadyVerified = false, availability: sharedAvailability, onRetryAvailability }: Props) {
  const [localEnabled, setEnabled] = useState<boolean | undefined>(site.visitVerificationEnabled);
  const [localLoading, setLoading] = useState(site.visitVerificationEnabled === undefined);
  const [localError, setError] = useState('');
  const enabled = sharedAvailability ? sharedAvailability.enabled : localEnabled;
  const loading = sharedAvailability ? sharedAvailability.loading : localLoading;
  const error = sharedAvailability?.error || localError;
  const hasSharedAvailability = sharedAvailability !== undefined;
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const busy = useRef(false), generation = useRef(0), outcome = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const revision = ++generation.current;
    if (hasSharedAvailability) return () => { generation.current = revision + 1; busy.current = false; };
    const availability = retry === 0 && site.visitVerificationEnabled !== undefined
      ? Promise.resolve(site.visitVerificationEnabled) : apiCheckinAvailability(site.id);
    availability.then(value => {
      if (generation.current === revision) { setEnabled(value); setLoading(false); setLocating(false); setResult(null); setError(''); }
    }).catch(failure => {
      if (generation.current === revision) { setError(failure instanceof Error ? failure.message : 'Unable to load visit verification.'); setLoading(false); }
    });
    return () => { generation.current = revision + 1; busy.current = false; };
  }, [site.id, site.visitVerificationEnabled, retry, hasSharedAvailability]);
  useEffect(() => { if (result) outcome.current?.focus(); }, [result]);
  const reload = () => { setError(''); setLoading(true); setRetry(value => value + 1); };
  const verify = () => {
    if (busy.current) return;
    if (alreadyVerified || result) { onPassport(); return; }
    if (!user) { onLogin(); return; }
    setError('');
    if (!navigator.geolocation || !window.isSecureContext) { setError('Location verification requires HTTPS and a browser with geolocation support. Localhost is supported for development.'); return; }
    busy.current = true; setLocating(true);
    const revision = generation.current;
    try { navigator.geolocation.getCurrentPosition(async position => {
      if (revision !== generation.current) return;
      try {
        const response = await apiVerifyVisit(site.id, { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        if (revision === generation.current) { setResult(response); onVerified(); }
      } catch (failure) {
        if (revision === generation.current) setError(failure instanceof Error ? failure.message : 'Unable to verify. Please try again.');
      } finally { if (revision === generation.current) { busy.current = false; setLocating(false); } }
    }, failure => {
      if (revision !== generation.current) return;
      setError(failure.code === 1 ? 'Location permission denied. Allow location access in your browser and try again.' : failure.code === 3 ? 'Location request timed out. Move into an open area and try again.' : 'Location unavailable. Check your device location settings and try again.');
      busy.current = false; setLocating(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }); }
    catch { busy.current = false; setLocating(false); setError('Location unavailable. Check your device location settings and try again.'); }
  };
  if (!loading && enabled === false && !error) return null;
  return <aside id="visit-verification" className="rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-5 space-y-3">
    <h2 className="section-title">Heritage Passport</h2>
    {loading && <p role="status">Loading visit verification…</p>}
    {error && <ErrorState message={error} onRetry={sharedAvailability?.error ? onRetryAvailability : enabled ? verify : reload} />}
    {!loading && enabled === true && (alreadyVerified && !result ? <div role="status"><p>Your visit is verified.</p><button className={button} onClick={onPassport}>View Passport</button></div> : result ? <div ref={outcome} tabIndex={-1} role="status" className="space-y-3">
      <h3 className="text-xl font-bold">{result.status === 'verified' ? 'Visit Verified' : 'Already Visited'}</h3><p>{site.name}</p>
      {result.status === 'verified' ? <><p>+100 Points</p><p>Passport stamp unlocked</p></> : <p>Your passport stamp was already unlocked on {new Date(result.visit.verified_at).toLocaleDateString()}. No additional points were awarded.</p>}
      <div className="flex flex-wrap gap-3"><button className={button} onClick={onPassport}>View Passport</button><button className={button} onClick={onExplore}>Continue Exploring</button></div>
    </div> : <>
      <p>Verify that you are visiting this heritage site to unlock its passport stamp and earn 100 points.</p>
      <p className="text-sm">Your location is used only for verification. Exact visitor coordinates are not stored.</p>
      {!user && <p>Sign in or create a visitor account to verify your visit.</p>}
      {locating && <p role="status">Getting your location…</p>}
      <button ref={actionRef} id="verify-location" className={`${button} bg-[#7e1925] text-white`} disabled={locating} onClick={verify}>{locating ? 'Getting your location…' : 'Verify My Visit'}</button>
    </>)}
  </aside>;
}
