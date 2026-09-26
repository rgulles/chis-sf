import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, Trash2, Calendar, MapPin, ChevronRight, Compass, ArrowRight } from 'lucide-react';
import type { HeritageSite, EventItem } from '../types';

interface SavedViewProps {
  savedSites: HeritageSite[];
  savedEvents: EventItem[];
  onSelectSite: (site: HeritageSite) => void;
  onSelectEvent: (event: EventItem) => void;
  onRemoveSite: (siteId: string) => void;
  onRemoveEvent: (eventId: string) => void;
  onExploreClick: () => void;
  onPlanTrip: () => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  savedSites,
  savedEvents,
  onSelectSite,
  onSelectEvent,
  onRemoveSite,
  onRemoveEvent,
  onExploreClick,
  onPlanTrip
}) => {
  const totalSaved = savedSites.length + savedEvents.length;

  return (
    <div id="saved-favorites-page" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28 font-outfit">
      {/* Header Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e8dfd5] pb-6"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-outfit text-xs font-bold uppercase tracking-[0.18em] text-[#7e1925]">
              Personal Travel Bucket
            </span>
            <span className="font-outfit text-xs text-[#8a7171]">• Saved Heritage & Events</span>
          </div>
          <h1 id="saved-header-title" className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b19] tracking-tight mt-1">
            My Saved Landmarks & Events
          </h1>
        </div>

        {savedSites.length > 0 && (
          <button
            onClick={onPlanTrip}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7e1925] hover:bg-[#580b14] px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider text-white transition-all shadow-md hover:scale-[1.02] cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Generate Custom Itinerary</span>
          </button>
        )}
      </motion.div>

      {totalSaved === 0 ? (
        /* EMPTY STATE */
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-dashed border-[#e8dfd5] bg-white p-12 sm:p-16 text-center space-y-4 max-w-lg mx-auto my-12 shadow-xs"
        >
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[#faf2ee] text-[#7e1925] border border-[#e8dfd5]">
            <Bookmark className="h-7 w-7" />
          </div>
          <h3 className="font-outfit text-xl font-bold text-[#1e1b19] tracking-tight">
            No saved landmarks yet
          </h3>
          <p className="font-outfit text-sm text-[#574141] leading-relaxed max-w-sm mx-auto">
            As you explore San Fernando’s heritage buildings, churches, and cultural festivals, tap the bookmark icon to keep them organized here.
          </p>
          <div className="pt-2">
            <button
              onClick={onExploreClick}
              className="font-outfit inline-flex items-center gap-2 rounded-xl bg-[#7e1925] hover:bg-[#580b14] px-7 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider text-white transition-all shadow-md hover:scale-[1.02] cursor-pointer"
            >
              <span>Start Exploring Archive</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        /* CONTENT GRIDS */
        <div className="space-y-12">
          {/* SAVED HERITAGE SITES */}
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#e8dfd5] pb-3">
              <h2 className="font-outfit text-xl sm:text-2xl font-bold text-[#1e1b19] tracking-tight">
                Saved Heritage Landmarks ({savedSites.length})
              </h2>
            </div>

            {savedSites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                {savedSites.map((site, idx) => (
                  <motion.div
                    key={site.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: (idx % 6) * 0.06 }}
                    className="group flex flex-col justify-between rounded-2xl border border-[#e8dfd5] bg-white hover:border-[#7e1925]/60 hover:shadow-[0_16px_36px_-10px_rgba(126,25,37,0.14)] transition-all duration-300 overflow-hidden"
                  >
                    <div>
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#faf2ee]">
                        <img
                          src={site.heroImage}
                          alt={site.name}
                          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/sites/cathedral-hero.jpg';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                        <span className="absolute top-3.5 left-3.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 font-outfit text-[11px] font-bold text-[#7e1925] border border-white/40 shadow-xs uppercase tracking-wider">
                          {site.category}
                        </span>
                        <button
                          onClick={() => onRemoveSite(site.id)}
                          className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 hover:bg-[#ba1a1a] text-white transition-colors cursor-pointer shadow-xs"
                          title="Remove from saved"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="p-5 sm:p-6 space-y-1.5">
                        <h3 className="font-outfit text-lg sm:text-xl font-bold text-[#1e1b19] group-hover:text-[#7e1925] transition-colors leading-snug tracking-tight">
                          {site.name}
                        </h3>
                        <p className="font-outfit text-xs text-[#574141] flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#7e1925]" />
                          <span>{site.barangay}</span>
                        </p>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6 pt-0">
                      <div className="border-t border-[#e8dfd5] pt-4 flex justify-between items-center">
                        <button
                          onClick={() => onRemoveSite(site.id)}
                          className="font-outfit text-xs font-semibold text-[#ba1a1a] hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => onSelectSite(site)}
                          className="font-outfit inline-flex items-center gap-1.5 rounded-xl bg-[#7e1925] hover:bg-[#580b14] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-xs hover:scale-[1.02] cursor-pointer"
                        >
                          <span>Explore</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="font-outfit text-sm text-[#574141]">No heritage sites bookmarked yet.</p>
            )}
          </div>

          {/* SAVED EVENTS */}
          {savedEvents.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#e8dfd5] pb-3">
                <h2 className="font-outfit text-xl sm:text-2xl font-bold text-[#1e1b19] tracking-tight">
                  Saved Events & Tours ({savedEvents.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                {savedEvents.map((evt, idx) => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: (idx % 6) * 0.06 }}
                    className="flex flex-col justify-between rounded-2xl border border-[#e8dfd5] bg-white p-5 hover:border-[#7e1925]/60 hover:shadow-md transition-all shadow-xs"
                  >
                    <div className="flex gap-4">
                      <img
                        src={evt.bannerImage}
                        alt={evt.title}
                        className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/events/giant-lantern-fest.jpg';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-outfit text-xs font-bold uppercase tracking-wider text-[#b45309] block">
                          {evt.category}
                        </span>
                        <h4 className="font-outfit text-base font-bold text-[#1e1b19] leading-snug truncate">
                          {evt.title}
                        </h4>
                        <p className="font-outfit text-xs text-[#574141] mt-1.5 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#7e1925]" />
                          <span>{evt.date}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#e8dfd5] flex justify-between items-center">
                      <button
                        onClick={() => onRemoveEvent(evt.id)}
                        className="font-outfit text-xs font-semibold text-[#ba1a1a] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => onSelectEvent(evt)}
                        className="font-outfit text-xs font-bold text-[#7e1925] hover:text-[#580b14] flex items-center gap-1 cursor-pointer uppercase tracking-wider"
                      >
                        <span>View Schedule</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
