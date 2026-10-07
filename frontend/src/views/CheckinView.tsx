import { useEffect, useRef, useState } from 'react';
import { CheckCircle, MapPin } from 'lucide-react';
import type { CheckinContext, CheckinResult, HeritageSite, UserProfile } from '../types';
import { apiResolveCheckin, apiVerifyCheckin } from '../api/client';
import { handleHeritageImageError } from '../utils/heritageImages';

interface Props {
  token: string;
  user: UserProfile | null;
  onLogin: () => void;
  onPassport: () => void;
  onSite: (site: HeritageSite) => void;
  onExplore: () => void;
  onVerified: () => void;
  onSessionExpired?: () => void;
}
const button = 'min-h-11 rounded-lg border border-[#7e1925] px-4 py-2 font-semibold disabled:opacity-50';

export function CheckinView({ token, user, onLogin, onPassport, onSite, onExplore, onVerified, onSessionExpired }: Props) {
  const [context, setContext] = useState<CheckinContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const busy = useRef(false), generation = useRef(0);
  useEffect(() => {
    const revision = ++generation.current;
    apiResolveCheckin(token).then(value => { if (generation.current === revision) { setContext(value); setLoading(false); } }).catch(failure => {
      if (generation.current === revision) { setError(failure instanceof Error ? failure.message : 'Unable to load this QR.'); setLoading(false); }
    });
    return () => { generation.current = revision + 1; busy.current = false; };
  }, [token, retry]);
  const verify = () => {
    if (busy.current || !user) return;
    setError('');
    if (!navigator.geolocation || !window.isSecureContext) { setError('Location verification requires HTTPS and a browser with geolocation support. Localhost is supported for development.'); return; }
    busy.current = true; setLocating(true);
    const revision = generation.current;
    navigator.geolocation.getCurrentPosition(async position => {
      if (revision !== generation.current) return;
      try {
        const response = await apiVerifyCheckin(token, { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        if (revision === generation.current) { setResult(response); onVerified(); }
      } catch (failure) {
        if (revision === generation.current) {
          setError(failure instanceof Error ? failure.message : 'Unable to verify. Please try again.');
          if (failure instanceof Error && 'status' in failure && failure.status === 401) onSessionExpired?.();
        }
      }
      finally { if (revision === generation.current) { busy.current = false; setLocating(false); } }
    }, failure => {
      if (revision !== generation.current) return;
      setError(failure.code === 1 ? 'Location permission denied. Allow location access in your browser and try again.' : failure.code === 3 ? 'Location request timed out. Move into an open area and try again.' : 'Location unavailable. Check your device location settings and try again.');
      busy.current = false; setLocating(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };
  return <section id="checkin-view" className="max-w-2xl mx-auto p-4 sm:p-8 pb-28 space-y-5">
    <h1 className="headline-lg">Heritage Check-In</h1>
    {loading && <p role="status">Loading heritage QR…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !context && <button className={button} onClick={() => { setError(''); setLoading(true); setRetry(value => value + 1); }}>Retry QR</button>}
    {context && <><img src={context.site.heroImage} alt={context.site.name} onError={handleHeritageImageError} className="w-full h-44 object-cover rounded-xl" /><h2 className="text-xl font-bold">{context.site.name}</h2><p className="break-words">{context.site.address}</p>
      {!context.enabled ? <p>Check-in is currently disabled for this site.</p> : !context.coordinates_configured ? <p>This site is not ready for location verification.</p> : !user ? <><p>Sign in or create a visitor account to earn your passport stamp.</p><button className={button} onClick={onLogin}>Sign in / Create account</button></> : result ? <div className="rounded-xl border border-[#7e1925] bg-[#faf2ee] p-5 space-y-3" role="status">
        <CheckCircle aria-hidden="true" className="text-[#7e1925]" /><h3 className="text-xl font-bold">{result.status === 'verified' ? 'Visit Verified' : 'Already visited'}</h3>
        {result.status === 'verified' ? <><p>+{result.points_earned} Points</p><p>Passport stamp unlocked</p></> : <p>Your original stamp is saved. No additional points awarded.</p>}
        <p>Verified {new Date(result.visit.verified_at).toLocaleDateString()}</p><button className={button} onClick={onPassport}>View Passport</button>
      </div> : <><p>Your location is used once to verify this visit. Exact visitor coordinates are not stored.</p><button id="verify-location" className={`${button} bg-[#7e1925] text-white flex items-center gap-2`} disabled={locating} onClick={verify}><MapPin aria-hidden="true" size={18} />{locating ? 'Getting your location…' : 'Verify My Location'}</button></>}
      <div className="flex flex-wrap gap-3"><button className={button} onClick={() => onSite(context.site)}>View Heritage Site</button><button className={button} onClick={onExplore}>Continue Exploring</button></div>
    </>}
  </section>;
}
