import { CheckCircle, LockKeyhole } from 'lucide-react';
import type { HeritagePassport, HeritageSite, UserProfile } from '../types';

export function PassportView({ user, passport, error, onLogin, onRetry, onSite }: {
  user: UserProfile | null; passport: HeritagePassport | null; error: string; onLogin: () => void; onRetry: () => void; onSite: (site: HeritageSite) => void;
}) {
  const visits = new Map(passport?.visits.map(visit => [String(visit.heritage_site_id), visit]));
  const eligibleIds = new Set(passport?.eligible_sites.map(site => String(site.id)));
  const historicVisits = passport?.visits.filter(visit => !eligibleIds.has(String(visit.heritage_site_id))) || [];
  const percent = passport?.eligible_site_count ? Math.min(100, Math.round(passport.visited_eligible_count / passport.eligible_site_count * 100)) : 0;
  const stamp = (site: HeritageSite, history = false) => {
    const visit = visits.get(String(site.id));
    return <article key={site.id} data-unlocked={!!visit} className={`passport-stamp min-w-0 flex flex-col items-center text-center p-3 sm:p-4 border space-y-2 ${visit ? 'border-[#c6931d] bg-[#391f22] text-[#f6e6c7]' : 'border-[#544737] bg-[#27231f] text-[#b7ac9d]'}`}>
      {visit ? <CheckCircle aria-hidden="true" className="h-7 w-7 text-[#c6931d]" /> : <LockKeyhole aria-hidden="true" className="h-7 w-7" />}
      <h3 className="text-sm font-semibold break-words w-full">{site.name}</h3>
      {visit ? <><p className="text-[10px] tracking-widest uppercase text-[#e0bf7b]">Visited</p><time className="text-xs" dateTime={visit.verified_at}>{new Date(visit.verified_at).toLocaleDateString()}</time><p className="text-xs">{visit.points_awarded} Points{history ? ' · Currently unavailable' : ''}</p></> : <p className="text-xs">Not yet visited</p>}
      {site.status === 'active' && <button className="min-h-11 text-xs underline underline-offset-4" onClick={() => onSite(site)}>View Site</button>}
    </article>;
  };
  return <section id="passport-view" className="bg-[#1e1b19] text-[#fffdf9] px-4 sm:px-8 pt-2 pb-8 space-y-6">
    <header className="text-center border-b border-[#927440] pb-5 space-y-3">
      <p className="text-[9px] sm:text-[10px] tracking-[0.16em] uppercase text-[#e0bf7b]">Republika ng Pilipinas • Lungsod ng San Fernando</p>
      <h1 id="passport-title" className="font-editorial text-3xl sm:text-4xl leading-tight text-[#f6e6c7]">PASAPORTE NG PAMANA</h1>
      <p className="text-xs tracking-wide text-[#d1c3b3]">CHIS Heritage Visit Passport</p>
    </header>
    {!user ? <><p>Sign in to collect verified heritage stamps.</p><button className="min-h-11 border border-[#927440] p-3" onClick={onLogin}>Sign in / Create account</button></> : <>
      <div className="border-y border-[#544737] py-4 flex items-center gap-3 min-w-0">
        <span aria-hidden="true" className="h-11 w-11 shrink-0 border border-[#927440] flex items-center justify-center font-editorial text-xl text-[#e0bf7b]">{user.name.slice(0, 1)}</span><div className="min-w-0"><p className="text-[10px] uppercase tracking-widest text-[#b7ac9d]">Traveler</p><p className="font-semibold break-words">{user.name}</p></div>
      </div>
      {error ? <div role="alert" className="space-y-2"><p>{error}</p><button className="min-h-11 border border-[#927440] p-3" onClick={onRetry}>Retry Passport</button></div> : !passport ? <p role="status">Loading passport…</p> : <>
        <div className="space-y-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><p>Landmarks Visited: {passport.visited_eligible_count} of {passport.eligible_site_count}</p><p>{percent}% unlocked</p></div><progress aria-label="Currently eligible heritage sites visited" className="passport-progress w-full h-2" max={passport.eligible_site_count || 1} value={passport.visited_eligible_count} /><p className="text-xs text-[#d1c3b3]">{passport.visited_count} verified sites · Total Heritage Points: <strong className="text-[#e0bf7b]">{passport.total_points} Points</strong></p></div>
        <h2 className="font-editorial text-xl text-[#f6e6c7]">Heritage Stamps</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">{passport.eligible_sites.map(site => stamp(site))}</div>
        {!passport.eligible_site_count && <p className="text-sm">No heritage sites are currently enabled for visit verification.</p>}
        {!passport.visits.length && <p className="text-sm">No verified visits yet.</p>}
        <p className="text-xs text-[#b7ac9d] leading-relaxed">Visit participating sites and select Verify My Visit on the heritage site page. Previously earned stamps remain in your history when a site becomes unavailable.</p>
        {historicVisits.length > 0 && <><h2 className="font-editorial text-xl">Previously earned stamps</h2><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">{historicVisits.map(visit => stamp(visit.site, true))}</div></>}
      </>}
    </>}
  </section>;
}
