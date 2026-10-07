import { CheckCircle, LockKeyhole } from 'lucide-react';
import type { HeritagePassport, HeritageSite, UserProfile } from '../types';
import { handleHeritageImageError } from '../utils/heritageImages';

export function PassportView({ user, passport, error, onLogin, onRetry, onSite }: {
  user: UserProfile | null; passport: HeritagePassport | null; error: string; onLogin: () => void; onRetry: () => void; onSite: (site: HeritageSite) => void;
}) {
  const visitedIds = new Set(passport?.visits.map(visit => String(visit.heritage_site_id)));
  return <section id="passport-view" className="max-w-5xl mx-auto px-4 py-8 pb-28 space-y-6">
    <h1 className="headline-lg">Heritage Passport</h1>
    {!user ? <><p>Sign in to collect verified heritage stamps.</p><button className="min-h-11 border rounded-lg p-3" onClick={onLogin}>Sign in / Create account</button></> : <>
      <p className="text-lg font-semibold">{user.name}</p>
      {error ? <div role="alert"><p>{error}</p><button className="min-h-11 border rounded-lg p-3" onClick={onRetry}>Retry Passport</button></div> : !passport ? <p role="status">Loading passport…</p> : <>
        <div className="rounded-xl bg-[#7e1925] text-white p-5 space-y-2"><p className="text-2xl font-bold">{passport.visited_eligible_count} / {passport.eligible_site_count} available sites visited</p><p>{passport.visited_count} verified sites · {passport.total_points} Points</p><progress aria-label="Currently eligible heritage sites visited" className="w-full" max={passport.eligible_site_count || 1} value={passport.visited_eligible_count} /></div>
        <p>Visit participating sites and scan their official CHIS QR to verify your location. Previously earned stamps remain in your history when a site becomes unavailable.</p>
        <h2 className="text-xl font-bold">Verified stamps</h2>
        {!passport.visits.length && <p>No verified visits yet.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{passport.visits.map(visit => <article key={visit.id} className="rounded-xl border-2 border-[#7e1925] bg-[#faf2ee] p-4 space-y-2"><CheckCircle aria-hidden="true" className="text-[#7e1925]" /><img alt={visit.site.name} src={visit.site.heroImage} onError={handleHeritageImageError} className="w-full h-24 object-cover rounded-lg" /><h3 className="font-bold">{visit.site.name}</h3><p>Visited {new Date(visit.verified_at).toLocaleDateString()}</p><p>{visit.points_awarded} Points{visit.site.status !== 'active' ? ' · Currently unavailable' : ''}</p>{visit.site.status === 'active' && <button className="min-h-11 underline" onClick={() => onSite(visit.site)}>View Site</button>}</article>)}</div>
        <h2 className="text-xl font-bold">Unvisited participating sites</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{passport.eligible_sites.filter(site => !visitedIds.has(site.id)).map(site => <article key={site.id} className="rounded-xl border border-[#e8dfd5] bg-white p-4 space-y-2"><LockKeyhole aria-hidden="true" className="text-[#574141]" /><h3 className="font-bold">{site.name}</h3><p className="text-sm">Not yet visited</p><button className="min-h-11 underline" onClick={() => onSite(site)}>View Site</button></article>)}</div>
        {!passport.eligible_site_count && <p>No heritage sites are currently enabled for check-in.</p>}
      </>}
    </>}
  </section>;
}
