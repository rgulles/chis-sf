import React from 'react';
import { Bookmark, Navigation, QrCode, MapPin, Sparkles, Calendar, ArrowLeft, Share2, Compass, KeyRound, Footprints, VolumeX, CameraOff, ShieldCheck, CheckSquare } from 'lucide-react';
import type { HeritageSite, CommunityPhoto } from '../types';
import { ThenNowSlider } from '../components/ThenNowSlider';
import { AudioStoryPlayer } from '../components/AudioStoryPlayer';
import { VisitorPhotoWall } from '../components/VisitorPhotoWall';

interface SiteDetailViewProps {
  site: HeritageSite;
  onBack: () => void;
  onOpenDirections: (site: HeritageSite) => void;
  onOpenInteractiveHistory: (site: HeritageSite) => void;
  onTriggerQRScan: (site: HeritageSite) => void;
  isSaved: boolean;
  onToggleSave: (siteId: string) => void;
  onAddToPlan: (siteId: string) => void;
  userName?: string;
  onPhotoUploaded?: (photo: CommunityPhoto) => void;
}

export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  site,
  onBack,
  onOpenDirections,
  onOpenInteractiveHistory,
  onTriggerQRScan,
  isSaved,
  onToggleSave,
  onAddToPlan,
  userName,
  onPhotoUploaded
}) => {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${site.name} — San Fernando Heritage Platform`,
        text: `Discover the story of ${site.name} in San Fernando, Pampanga.`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  };

  return (
    <div id="site-detail-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10 pb-28">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#e7e0d6] pb-3">
        <button
          id="back-to-explore-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded border border-[#e7e0d6] bg-white px-3 py-1.5 label-compact text-[#1e1b19] hover:border-[#7e1925] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[#7e1925]" />
          <span>Back to Archive</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#e7e0d6] bg-white text-[#574141] hover:text-[#7e1925] transition-colors"
            title="Share this site"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          <button
            id="detail-save-btn"
            onClick={() => onToggleSave(site.id)}
            className={`flex items-center gap-1.5 rounded px-3.5 py-1.5 label-compact transition-colors ${
              isSaved
                ? 'bg-[#7e1925] text-white border border-[#7e1925]'
                : 'border border-[#e7e0d6] bg-white text-[#1e1b19] hover:border-[#7e1925]'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-white' : ''}`} />
            <span>{isSaved ? 'Saved in Plan' : 'Save Landmark'}</span>
          </button>
        </div>
      </div>

      {/* HERO SECTION - Archival Presentation */}
      <div className="rounded-lg border border-[#e7e0d6] bg-white overflow-hidden">
        <div className="relative h-72 sm:h-96 md:h-[420px] w-full bg-[#faf2ee]">
          <img
            src={site.heroImage}
            alt={site.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/sites/cathedral-hero.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          {/* Floating Category Tag */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#fff8f5]/95 backdrop-blur-md px-3 py-1 label-compact text-[#7e1925] border border-[#e7e0d6]">
              {site.category}
            </span>
            <span className="rounded-full bg-[#1e1b19]/80 backdrop-blur-md px-3 py-1 label-compact text-[#ffdbca] border border-white/10">
              Circa {site.yearBuilt}
            </span>
          </div>

          {/* Title and location overlay */}
          <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
            {site.nativeName && (
              <span className="font-serif italic text-sm text-[#ffdbca] block">
                {site.nativeName}
              </span>
            )}
            <h1 id="site-detail-name" className="headline-lg text-white leading-tight">
              {site.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 body-sm text-[#f7efeb]/85">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#fd8a42]" />
                {site.address}
              </span>
              <span>•</span>
              <span className="label-compact text-white">{site.era}</span>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#faf2ee] border-t border-[#e7e0d6]">
          <div className="flex items-center gap-2">
            <button
              id="directions-btn"
              onClick={() => onOpenDirections(site)}
              className="flex items-center gap-1.5 rounded bg-[#7e1925] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#580b14] transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Directions</span>
            </button>

            <button
              id="add-to-plan-btn"
              onClick={() => onAddToPlan(site.id)}
              className="flex items-center gap-1.5 rounded border border-[#e7e0d6] bg-white px-3.5 py-2 label-compact text-[#1e1b19] hover:border-[#7e1925] transition-colors"
            >
              <Calendar className="h-3.5 w-3.5 text-[#7e1925]" />
              <span>Add to Plan</span>
            </button>
          </div>

          <button
            id="deep-dive-story-btn"
            onClick={() => onOpenInteractiveHistory(site)}
            className="flex items-center gap-1.5 label-compact text-[#7e1925] hover:text-[#580b14]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#b45309]" />
            <span>Open Immersive Story Page</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: ABOUT THIS PLACE */}
      <section id="section-about-place" className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
          <span className="h-4 w-1 bg-[#7e1925]" />
          <h2 className="headline-md text-[#1e1b19]">
            About This Landmark
          </h2>
        </div>
        <div className="rounded border border-[#e7e0d6] bg-white p-6">
          <p className="body-md text-[#1e1b19] leading-relaxed">
            {site.fullDescription}
          </p>
        </div>
      </section>

      {/* SECTION 2: THE STORY */}
      <section id="section-the-story" className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
          <span className="h-4 w-1 bg-[#b45309]" />
          <h2 className="headline-md text-[#1e1b19]">
            The Story & Historical Significance
          </h2>
        </div>
        <div className="rounded border border-[#e7e0d6] bg-white p-6 sm:p-8">
          <div className="body-md text-[#1e1b19] leading-relaxed">
            <p className="first-letter:text-4xl first-letter:font-serif first-letter:font-semibold first-letter:text-[#7e1925] first-letter:float-left first-letter:mr-2.5">
              {site.story}
            </p>
          </div>

          {/* Inline Audio Narrative Player - Voices of Pampanga */}
          <div className="mt-8 pt-6 border-t border-[#e7e0d6]">
            <AudioStoryPlayer
              title={site.audioStory.title}
              narrator={site.audioStory.narrator}
              duration={site.audioStory.duration}
              durationSeconds={site.audioStory.durationSeconds}
              transcript={site.audioStory.transcript}
              kapampanganTranscript={site.audioStory.kapampanganTranscript}
              chapters={site.audioStory.chapters}
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: TIMELINE */}
      <section id="section-timeline" className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#e7e0d6] pb-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="headline-md text-[#1e1b19]">
              Historical Timeline
            </h2>
          </div>
          <span className="label-compact text-[#574141]">Chronological Milestones</span>
        </div>

        <div className="rounded border border-[#e7e0d6] bg-white p-6">
          <div className="relative border-l border-[#e7e0d6] ml-3 sm:ml-4 pl-6 space-y-7 py-1">
            {site.timeline.map((item, idx) => (
              <div key={idx} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-[30px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7e1925] text-white ring-4 ring-white">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
                <span className="inline-block rounded-sm bg-[#faf2ee] border border-[#e7e0d6] px-2 py-0.5 label-compact text-[#7e1925] mb-1">
                  {item.year}
                </span>
                <h3 className="font-serif text-base font-semibold text-[#1e1b19]">
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

      {/* SECTION 4: THEN & NOW (Interactive Slider) */}
      <section id="section-then-now" className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#e7e0d6] pb-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="headline-md text-[#1e1b19]">
              Then & Now
            </h2>
          </div>
          <span className="label-prominent text-[#7e1925]">
            Archival Photographic Comparison
          </span>
        </div>

        <ThenNowSlider
          archivalImage={site.archivalImage}
          modernImage={site.modernImage}
          caption={site.thenNowCaption}
          thenYear={`Archival (${site.yearBuilt.split(' ')[0]})`}
          nowYear="Present Day"
        />
      </section>

      {/* SECTION 5: DID YOU KNOW? */}
      <section id="section-did-you-know" className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
          <span className="h-4 w-1 bg-[#b45309]" />
          <h2 className="headline-md text-[#1e1b19]">
            Archival Annotations
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {site.didYouKnow.map((fact, idx) => (
            <div
              key={idx}
              className="rounded border border-[#e7e0d6] bg-white p-4 space-y-2 flex flex-col justify-between"
            >
              <div className="flex items-center gap-1.5 label-compact text-[#b45309]">
                <Sparkles className="w-3.5 h-3.5 text-[#b45309]" />
                <span>Historical Note #{idx + 1}</span>
              </div>
              <p className="body-sm text-[#1e1b19] leading-relaxed">
                {fact}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6: UNLOCKING HOUSEHOLD VAULTS (Subterranean Secrets & Ancestral Heirlooms) */}
      {site.householdVaults && site.householdVaults.length > 0 && (
        <section id="section-household-vaults" className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#e7e0d6] pb-2">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 bg-[#7e1925]" />
              <h2 className="headline-md text-[#1e1b19]">
                Unlocking Household Vaults
              </h2>
            </div>
            <span className="label-compact text-[#D49B24] font-semibold flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-[#D49B24]" />
              Subterranean Passages & Heirlooms
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {site.householdVaults.map((vault) => (
              <div
                key={vault.id}
                className="rounded-lg border border-[#e7e0d6] bg-white p-5 space-y-2.5 hover:border-[#D49B24] transition-colors shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-[#faf2ee] border border-[#e7e0d6] px-2 py-0.5 text-[10px] font-bold text-[#7e1925] uppercase tracking-wider">
                    {vault.category}
                  </span>
                  <span className="text-[10px] text-[#8a7171] font-serif italic">
                    Curated Archive
                  </span>
                </div>

                <h3 className="font-serif text-base font-bold text-[#1e1b19]">
                  {vault.title}
                </h3>

                <p className="body-sm text-[#574141] leading-relaxed">
                  {vault.description}
                </p>

                <div className="pt-2 border-t border-[#e7e0d6]/70 flex items-start gap-1.5 text-xs text-[#231416] bg-[#faf2ee]/60 rounded p-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D49B24] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#7e1925]">Significance: </span>
                    <span className="text-[#574141]">{vault.historicalSignificance}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 7: VISIT INFORMATION & SITE ETIQUETTE */}
      <section id="section-visit-info" className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
          <span className="h-4 w-1 bg-[#7e1925]" />
          <h2 className="headline-md text-[#1e1b19]">
            Visitor Guidelines & Practical Info
          </h2>
        </div>

        <div className="rounded border border-[#e7e0d6] bg-white p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 body-sm">
            <div>
              <span className="label-compact text-[#574141] block mb-1">
                Location
              </span>
              <p className="text-[#1e1b19] font-medium">{site.visitInfo.address}</p>
            </div>

            <div>
              <span className="label-compact text-[#574141] block mb-1">
                Visiting Hours
              </span>
              <p className="text-[#1e1b19] font-medium">{site.visitInfo.openingHours}</p>
            </div>

            <div>
              <span className="label-compact text-[#574141] block mb-1">
                Entrance Fee
              </span>
              <p className="text-[#7e1925] font-semibold">{site.visitInfo.entranceFee}</p>
            </div>

            <div>
              <span className="label-compact text-[#574141] block mb-1">
                Accessibility
              </span>
              <p className="text-[#1e1b19] font-medium">{site.visitInfo.accessibility}</p>
            </div>

            <div>
              <span className="label-compact text-[#574141] block mb-1">
                Recommended Duration
              </span>
              <p className="text-[#1e1b19] font-medium">{site.visitInfo.duration}</p>
            </div>

            <div>
              <span className="label-compact text-[#574141] block mb-1">
                Optimal Visiting Time
              </span>
              <p className="text-[#1e1b19] font-medium">{site.visitInfo.bestTime}</p>
            </div>
          </div>

          {/* On-Site Etiquette Guidelines (Shoe covers, quiet reflection, photography restrictions) */}
          {site.etiquetteRules && (
            <div className="pt-5 border-t border-[#e7e0d6] space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-prominent text-[#7e1925]">
                  Heritage Conservation Etiquette
                </span>
                <span className="text-[11px] text-[#8a7171]">Official Preservation Protocol</span>
              </div>

              {/* Protocol Badges */}
              <div className="flex flex-wrap gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs border ${
                  site.etiquetteRules.shoeCoversRequired
                    ? 'bg-[#faf2ee] border-[#D49B24] text-[#231416] font-medium'
                    : 'bg-[#faf2ee] border-[#e7e0d6] text-[#574141]'
                }`}>
                  <Footprints className="w-3.5 h-3.5 text-[#D49B24]" />
                  <span>{site.etiquetteRules.shoeCoversRequired ? 'Shoe Covers Required' : 'Standard Footwear Permitted'}</span>
                </div>

                <div className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs border ${
                  site.etiquetteRules.silenceProtocol
                    ? 'bg-[#faf2ee] border-[#7e1925] text-[#7e1925] font-medium'
                    : 'bg-[#faf2ee] border-[#e7e0d6] text-[#574141]'
                }`}>
                  <VolumeX className="w-3.5 h-3.5 text-[#7e1925]" />
                  <span>{site.etiquetteRules.silenceProtocol ? 'Quiet Reflection Protocol' : 'Normal Voice Volume'}</span>
                </div>

                <div className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs border ${
                  !site.etiquetteRules.flashPhotographyAllowed
                    ? 'bg-[#faf2ee] border-[#574141] text-[#1e1b19] font-medium'
                    : 'bg-[#faf2ee] border-[#e7e0d6] text-[#574141]'
                }`}>
                  <CameraOff className="w-3.5 h-3.5 text-[#574141]" />
                  <span>{site.etiquetteRules.flashPhotographyAllowed ? 'Photography Allowed' : 'No Flash / Tripods'}</span>
                </div>
              </div>

              {/* Specific Preservation Notes */}
              <ul className="space-y-1.5 pt-1">
                {site.etiquetteRules.preservationNotes.map((note, nIdx) => (
                  <li key={nIdx} className="flex items-start gap-2 text-xs text-[#574141]">
                    <CheckSquare className="w-3.5 h-3.5 text-[#D49B24] flex-shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 8: COMMUNITY PHOTO WALL & VISITOR MEMORIES */}
      <VisitorPhotoWall
        siteId={site.id}
        siteName={site.name}
        defaultUserName={userName}
        onPhotoUploaded={onPhotoUploaded}
      />

      {/* SECTION 9: INTERACTIVE EXPERIENCE (ON-SITE QR CTA & NHCP BRONZE PLAQUE) */}
      <section id="section-interactive-experience" className="rounded-lg border-2 border-[#D49B24] bg-[#faf2ee] p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle Decorative Star Pattern in Background */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 pointer-events-none text-[#D49B24]">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <polygon points="50,0 60,35 95,50 60,65 50,100 40,65 5,50 40,35" />
          </svg>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="label-prominent text-[#7e1925] flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-[#7e1925]" />
                On-Site Discovery Plaque
              </span>
              <span className="rounded bg-[#231416] text-[#F7D070] border border-[#D49B24] px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                NHCP Marker #{site.nhcpPlaqueCode || site.yearBuilt.split(' ')[0]}
              </span>
            </div>

            <h3 className="headline-md text-[#1e1b19]">
              Standing at this landmark? Scan or Enter #{site.nhcpPlaqueCode || site.yearBuilt.split(' ')[0]}.
            </h3>
            <p className="body-sm text-[#574141] max-w-md leading-relaxed">
              Scan the official brass QR plaque installed at the facade or enter the 4-digit NHCP code to verify your visit and unlock historical testimonies.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              id="simulate-onsite-scan-btn"
              onClick={() => onTriggerQRScan(site)}
              className="flex items-center gap-2 rounded bg-[#7e1925] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#580b14] transition-colors shadow-xs"
            >
              <QrCode className="h-4 w-4" />
              <span>Simulate On-Site Scan</span>
            </button>

            <button
              id="view-full-multimedia-btn"
              onClick={() => onOpenInteractiveHistory(site)}
              className="flex items-center gap-2 rounded border border-[#e7e0d6] bg-white px-5 py-2.5 label-compact text-[#1e1b19] hover:border-[#7e1925] transition-colors"
            >
              <Compass className="h-4 w-4 text-[#D49B24]" />
              <span>360° & Figures</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
