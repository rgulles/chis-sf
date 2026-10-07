import React, { useState } from 'react';
import { Bookmark, Navigation, MapPin, Calendar, ArrowLeft, Share2 } from 'lucide-react';
import type { HeritageSite } from '../types';
import { heritageSiteUrl } from '../utils/heritageNavigation';
import { hasUsableCoordinates } from '../utils/heritageCoordinates';
import { handleHeritageImageError } from '../utils/heritageImages';
import { SiteCheckinNotice } from '../components/SiteCheckinNotice';

interface SiteDetailViewProps {
  site: HeritageSite;
  onBack: () => void;
  onOpenDirections: (site: HeritageSite) => void;
  isSaved: boolean;
  onToggleSave: (siteId: string) => void;
  onAddToPlan: (siteId: string) => void;
}

export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  site,
  onBack,
  onOpenDirections,
  isSaved,
  onToggleSave,
  onAddToPlan
}) => {
  const images = site.images || [];
  const mainImage = images.find(image => image.isCover) || images[0];
  const galleryImages = images.filter(image => image.id !== mainImage?.id);
  const visitorInformation = [
    { label: 'Opening Hours', value: site.visitInfo?.openingHours },
    { label: 'Entrance Fee', value: site.visitInfo?.entranceFee },
    { label: 'Accessibility', value: site.visitInfo?.accessibilityNotes },
    { label: 'Visit Notes', value: site.visitInfo?.visitNotes },
    { label: 'Contact', value: site.visitInfo?.contactInformation },
  ].filter(row => typeof row.value === 'string' && row.value.trim().length > 0);
  const [shareMessage, setShareMessage] = useState('');
  const [sharing, setSharing] = useState(false);
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
    <div id="site-detail-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10 pb-28">
      <SiteCheckinNotice siteId={site.id} />
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#e7e0d6] pb-3">
        <button
          id="back-to-explore-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded border border-[#e7e0d6] bg-white px-3 py-1.5 label-compact text-[#1e1b19] hover:border-[#7e1925] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[#7e1925]" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            id="detail-share-btn"
            disabled={sharing}
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

      {shareMessage && <p role="status">{shareMessage}</p>}

      {/* Site identity */}
      <div className="rounded-lg border border-[#e7e0d6] bg-white overflow-hidden">
        <div className="relative h-72 sm:h-96 md:h-[420px] w-full bg-[#faf2ee]">
          <img
            src={site.heroImage}
            alt={site.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={handleHeritageImageError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          {/* Floating Category Tag */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            {site.category && <span className="rounded-full bg-[#fff8f5]/95 backdrop-blur-md px-3 py-1 label-compact text-[#7e1925] border border-[#e7e0d6]">
              {site.category}
            </span>}
            {site.yearBuilt && site.yearBuilt !== 'Unknown' && <span className="rounded-full bg-[#1e1b19]/80 backdrop-blur-md px-3 py-1 label-compact text-[#ffdbca] border border-white/10">
              Date: {site.yearBuilt}
            </span>}
          </div>

          {/* Title and location overlay */}
          <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
            {site.nativeName && site.nativeName !== site.name && (
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
            </div>
          </div>
        </div>

        {mainImage?.caption && <p className="body-sm text-[#574141] px-4 py-3">{mainImage.caption}</p>}

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#faf2ee] border-t border-[#e7e0d6]">
          <div className="flex items-center gap-2">
            <button
              id="directions-btn"
              disabled={!hasUsableCoordinates(site.coordinates)}
              title={hasUsableCoordinates(site.coordinates) ? 'Get directions' : 'Location coordinates unavailable'}
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


        </div>
      </div>

      {galleryImages.length > 0 && (
        <section id="section-site-gallery" className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="headline-md text-[#1e1b19]">Gallery</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {galleryImages.map(image => (
              <figure key={image.id} className="rounded border border-[#e7e0d6] bg-white overflow-hidden">
                <img src={image.imageUrl} alt={image.caption || site.name} loading="lazy"
                  onError={handleHeritageImageError} className="w-full h-56 object-cover" />
                {image.caption && <figcaption className="body-sm text-[#574141] p-4">{image.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 1: ABOUT THIS PLACE */}
      {site.fullDescription?.trim() && <section id="section-about-place" className="space-y-3">
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
      </section>}

      {visitorInformation.length > 0 && (
        <section id="section-visitor-information" className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e7e0d6] pb-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="headline-md text-[#1e1b19]">Visitor Information</h2>
          </div>
          <dl className="rounded border border-[#e7e0d6] bg-white p-6 space-y-4">
            {visitorInformation.map(({ label, value }) => (
              <div key={label}>
                <dt className="font-semibold text-[#1e1b19] body-sm">{label}</dt>
                <dd className="body-sm text-[#574141] mt-1 whitespace-pre-line break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* SECTION 2: THE STORY */}
      {site.story && site.story !== 'No history recorded.' && (
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

        </div>
      </section>
      )}

      {/* SECTION 3: TIMELINE */}
      {site.timeline && site.timeline.length > 0 && (
      <section id="section-timeline" className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#e7e0d6] pb-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 bg-[#7e1925]" />
            <h2 className="headline-md text-[#1e1b19]">
              Historical Timeline
            </h2>
          </div>
          <span className="label-compact text-[#574141]">Historical Milestones</span>
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
      )}

    </div>
  );
};
