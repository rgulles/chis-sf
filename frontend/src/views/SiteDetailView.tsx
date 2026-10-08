import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, Calendar, ArrowLeft } from 'lucide-react';
import type { HeritageSite, VerificationAvailability } from '../types';
import { apiCheckinAvailability } from '../api/client';
import { heritageSiteUrl } from '../utils/heritageNavigation';
import { hasUsableCoordinates } from '../utils/heritageCoordinates';
import { handleHeritageImageError } from '../utils/heritageImages';
import { HeritageReadAloud } from '../components/HeritageReadAloud';
import { VisitVerification } from '../components/VisitVerification';
import { VisitorExperiences } from '../components/VisitorExperiences';
import type { UserProfile } from '../types';

interface SiteDetailViewProps {
  site: HeritageSite;
  onBack: () => void;
  onOpenDirections: (site: HeritageSite) => void;
  isSaved: boolean;
  onToggleSave: (siteId: string) => void;
  onAddToPlan: (siteId: string) => void;
  user?: UserProfile | null;
  onLogin?: () => void;
  onPassport?: () => void;
  onExplore?: () => void;
  onVerified?: () => void;
}

export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  site,
  onBack,
  onOpenDirections,
  isSaved,
  onToggleSave,
  onAddToPlan, user = null, onLogin = () => {}, onPassport = () => {}, onExplore = () => {}, onVerified = () => {}
}) => {
  const images = site.images || [];
  const mainImage = images.find(image => image.isCover) || images[0];
  const galleryImages = images.filter(image => image.id !== mainImage?.id);
  const visitorInformation = [
    { label: 'Address / Location', value: site.address },
    { label: 'Opening Hours', value: site.visitInfo?.openingHours },
    { label: 'Entrance Fee', value: site.visitInfo?.entranceFee },
    { label: 'Accessibility', value: site.visitInfo?.accessibilityNotes },
    { label: 'Visit Notes', value: site.visitInfo?.visitNotes },
    { label: 'Contact', value: site.visitInfo?.contactInformation },
  ].filter(row => typeof row.value === 'string' && row.value.trim().length > 0);
  const [shareMessage, setShareMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const [verificationRevision, setVerificationRevision] = useState(0);
  const [availabilityRetryState, setAvailabilityRetry] = useState({ siteId: site.id, value: 0 });
  const availabilityRetry = availabilityRetryState.siteId === site.id ? availabilityRetryState.value : 0;
  const retryAvailability = () => setAvailabilityRetry(previous => ({ siteId: site.id, value: previous.siteId === site.id ? previous.value + 1 : 1 }));
  const availabilityKey = `${site.id}:${site.visitVerificationEnabled}:${availabilityRetry}`;
  const [availabilityResult, setAvailabilityResult] = useState<{ key: string; enabled?: boolean; error?: string } | null>(null);
  const metadataEnabled = availabilityRetry === 0 ? site.visitVerificationEnabled : undefined;
  const resolvedAvailability = availabilityResult?.key === availabilityKey ? availabilityResult : null;
  const enabled = metadataEnabled ?? resolvedAvailability?.enabled;
  const availability: VerificationAvailability = {
    enabled, loading: enabled === undefined && !resolvedAvailability?.error, error: resolvedAvailability?.error,
  };
  useEffect(() => {
    if (availabilityRetry === 0 && site.visitVerificationEnabled !== undefined) return;
    let current = true;
    apiCheckinAvailability(site.id).then(enabled => {
      if (current) setAvailabilityResult({ key: availabilityKey, enabled });
    }).catch(failure => {
      if (current) setAvailabilityResult({ key: availabilityKey, error: failure instanceof Error ? failure.message : 'Unable to load visit verification. Please try again.' });
    });
    return () => { current = false; };
  }, [site.id, site.visitVerificationEnabled, availabilityRetry, availabilityKey]);
  const verificationAction = useRef<HTMLButtonElement | null>(null);
  const verificationKey = `${site.id}:${user?.id || 'guest'}`;
  const [verifiedVisit, setVerifiedVisit] = useState<{ key: string; verified: boolean } | null>(null);
  const updateEligibility = useCallback((verified: boolean) => setVerifiedVisit({ key: verificationKey, verified }), [verificationKey]);
  const startVerification = () => {
    const action = verificationAction.current;
    if (!action || action.disabled) return false;
    action.scrollIntoView({ behavior: 'smooth', block: 'center' });
    action.focus({ preventScroll: true });
    // Click synchronously within the visitor's gesture: this is the existing geolocation action.
    action.click();
    return true;
  };
  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    setShareMessage('');
    try {
      const url = heritageSiteUrl(site.id, window.location.href);
      if (navigator.share) {
        await navigator.share({ title: site.name, url });
        setShareMessage('Shared');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareMessage('Link copied');
      } else {
        setShareMessage('Sharing is unavailable in this browser. Copy the address bar link.');
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setShareMessage('Unable to share this site. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div id="site-detail-page" className="heritage-document max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10 pb-28 bg-[#fffdf9]">
      <button id="back-to-explore-btn" onClick={onBack} className="ui-button-secondary flex items-center gap-2"><ArrowLeft size={15} aria-hidden="true" />Back</button>

      {shareMessage && <p role="status">{shareMessage}</p>}

      <header className="heritage-identity space-y-4">
        <div className="flex flex-wrap justify-between gap-2 border-y border-[#e7ded4] py-3 text-[10px] uppercase tracking-[0.16em] text-[#7e1925]">
          <span>{site.category}</span>{site.yearBuilt && site.yearBuilt !== 'Unknown' && <span>Year built · {site.yearBuilt}</span>}
        </div>
        <figure className="space-y-2">
          <img src={site.heroImage} alt={site.name} width={1200} height={720} className="w-full aspect-[5/3] object-cover bg-[#f2e9df]" referrerPolicy="no-referrer" onError={handleHeritageImageError} />
          {mainImage?.caption && <figcaption className="text-xs text-[#61564d]">{mainImage.caption}</figcaption>}
        </figure>
        <div className="border-b border-[#e7ded4] pb-5 space-y-3">
          {site.nativeName && site.nativeName !== site.name && <p className="font-editorial italic text-[#7e1925]">{site.nativeName}</p>}
          <h1 id="site-detail-name" className="font-editorial text-3xl sm:text-5xl md:text-6xl leading-tight text-[#1e1b19] break-words">{site.name}</h1>
          {site.address && <p className="flex items-start gap-2 text-sm text-[#61564d]"><MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />{site.address}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button id="directions-btn" disabled={!hasUsableCoordinates(site.coordinates)} title={hasUsableCoordinates(site.coordinates) ? 'Get directions' : 'Location coordinates unavailable'} onClick={() => onOpenDirections(site)} className="ui-button-primary flex items-center gap-2"><Navigation size={15} aria-hidden="true" />Directions</button>
          <button id="add-to-plan-btn" onClick={() => onAddToPlan(site.id)} className="ui-button-secondary flex items-center gap-2"><Calendar size={15} aria-hidden="true" />Add to Plan</button>
          <button id="detail-save-btn" aria-pressed={isSaved} onClick={() => onToggleSave(site.id)} className="ui-button-secondary">{isSaved ? 'Saved' : 'Save'}</button>
          <button id="detail-share-btn" disabled={sharing} onClick={handleShare} className="ui-button-secondary">Share</button>
        </div>
      </header>

      {/* SECTION 1: ABOUT THIS PLACE */}
      {site.fullDescription?.trim() && <section id="section-about-place" className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
          <span className="h-4 w-1 bg-[#7e1925]" />
          <h2 className="section-title font-editorial text-[#1e1b19]">
            About This Landmark
          </h2>
        </div>
        <div className="border border-[#e7ded4] bg-[#fdf9f4] p-4 sm:p-6">
          <p className="body-md text-[#1e1b19] leading-relaxed">
            {site.fullDescription}
          </p>
        </div>
      </section>}


      {/* SECTION 2: THE STORY */}
      {site.story && site.story !== 'No history recorded.' && (
      <section id="section-the-story" className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
          <span className="h-4 w-1 bg-[#b45309]" />
          <h2 className="section-title font-editorial text-[#1e1b19]">
            The Story & Historical Significance
          </h2>
        </div>
        <div className="py-3 sm:py-5">
          <div className="body-md text-[#1e1b19] leading-relaxed">
            <p className="whitespace-pre-line">
              {site.story}
            </p>
          </div>

        </div>
      </section>
      )}

      <HeritageReadAloud key={site.id} site={site} />

      {/* SECTION 3: TIMELINE */}
      {site.timeline && site.timeline.length > 0 && (
      <section id="section-timeline" className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#e7e0d6] pb-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="section-title font-editorial text-[#1e1b19]">
              Historical Timeline
            </h2>
          </div>
          <span className="label-compact text-[#574141]">Historical Milestones</span>
        </div>

        <div className="border border-[#e7ded4] bg-[#fdf9f4] p-4 sm:p-6">
          <div className="relative border-l border-[#e7e0d6] ml-3 sm:ml-4 pl-6 space-y-7 py-1">
            {site.timeline.map((item, idx) => (
              <div key={item.id ?? idx} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-[30px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7e1925] text-white ring-4 ring-white">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
                <span className="inline-block rounded-sm bg-[#faf2ee] border border-[#e7e0d6] px-2 py-0.5 label-compact text-[#7e1925] mb-1">
                  {item.year}
                </span>
                <h3 className="font-sans text-base font-semibold text-[#1e1b19]">
                  {item.title}
                </h3>
                <p className="body-sm text-[#574141] mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {galleryImages.length > 0 && (
        <section id="section-site-gallery" className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="section-title font-editorial text-[#1e1b19]">Gallery</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {galleryImages.map(image => (
              <figure key={image.id} className="border border-[#e7ded4] bg-[#fdf9f4] overflow-hidden">
                <img src={image.imageUrl} alt={image.caption || site.name} loading="lazy" decoding="async" width={640} height={224}
                  onError={handleHeritageImageError} className="w-full h-56 object-cover" />
                {image.caption && <figcaption className="body-sm text-[#574141] p-4">{image.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {visitorInformation.length > 0 && (
        <section id="section-visitor-information" className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="section-title font-editorial text-[#1e1b19]">Visitor Guidelines &amp; Practical Info</h2>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5 border-y border-[#e7ded4] py-5">
            {visitorInformation.map(({ label, value }) => (
              <div key={label}>
                <dt className="font-semibold text-[#1e1b19] body-sm">{label}</dt>
                <dd className="body-sm text-[#574141] mt-1 whitespace-pre-line break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <VisitVerification key={`verification:${verificationKey}`} site={site} user={user} availability={availability} onRetryAvailability={retryAvailability} actionRef={verificationAction} alreadyVerified={verifiedVisit?.key === verificationKey && verifiedVisit.verified} onLogin={onLogin} onPassport={onPassport} onExplore={onExplore} onVerified={() => { updateEligibility(true); setVerificationRevision(value => value + 1); onVerified(); }} />
      <VisitorExperiences key={`experiences:${verificationKey}`} site={site} user={user} availability={availability} onLogin={onLogin} verificationRevision={verificationRevision} onVerifyVisit={startVerification} onEligibility={updateEligibility} />
    </div>
  );
};
