import { handleHeritageImageError } from '../utils/heritageImages';
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Clock, Plus, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import type { EventItem, HeritageSite } from '../types';
import { SectionParolAccents } from '../components/ParolDecoration';

interface EventsViewProps {
  events: EventItem[];
  sites: HeritageSite[];
  selectedEvent: EventItem | null;
  onSelectEvent: (event: EventItem | null) => void;
  onSelectSite: (site: HeritageSite) => void;
  savedEventIds: string[];
  onToggleSaveEvent: (eventId: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  sites,
  selectedEvent,
  onSelectEvent,
  onSelectSite,
  savedEventIds,
  onToggleSaveEvent
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['All', 'Festival', 'Heritage Tour', 'Exhibition', 'Community'];

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchCat = selectedCategory === 'All' || e.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.shortDescription.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [events, selectedCategory, searchQuery]);

  // EVENT DETAILS VIEW
  if (selectedEvent) {
    const isAdded = savedEventIds.includes(selectedEvent.id);
    const relatedHeritageSites = sites.filter((s) => (selectedEvent.relatedSiteIds || []).includes(s.id));

    return (
      <motion.div 
        id="event-detail-page" 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28 font-sans"
      >
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between border-b border-[#e8dfd5] pb-4">
          <button
            onClick={() => onSelectEvent(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e8dfd5] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1e1b19] hover:border-[#7e1925] hover:text-[#7e1925] transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-4 w-4 text-[#7e1925]" />
            <span>Back to All Events</span>
          </button>

          <button
            id="event-add-to-plan-btn"
            onClick={() => onToggleSaveEvent(selectedEvent.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs hover:scale-[1.02] ${
              isAdded
                ? 'bg-[#b45309] text-white'
                : 'bg-[#7e1925] text-white hover:bg-[#580b14]'
            }`}
          >
            {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isAdded ? 'Added to Plan' : 'Add to Plan'}</span>
          </button>
        </div>

        {/* Hero Event Banner */}
        <div className="relative h-72 sm:h-96 md:h-[440px] w-full overflow-hidden rounded-2xl border border-[#e8dfd5] bg-[#1e1b19] shadow-md">
          <img
            src={selectedEvent.bannerImage}
            alt={selectedEvent.title}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/events/giant-lantern-fest.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Floating Badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            <span className="rounded-full bg-white/95 backdrop-blur-md px-3.5 py-1 font-sans text-xs font-bold uppercase tracking-wider text-[#7e1925] border border-white/40 shadow-xs">
              {selectedEvent.category}
            </span>
            <span className="rounded-full bg-black/75 backdrop-blur-md px-3.5 py-1 font-sans text-xs font-semibold text-[#ffdbca] border border-white/20">
              {selectedEvent.dateBadge}
            </span>
          </div>

          <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-8 right-6 text-white space-y-3">
            <h1 className="font-sans text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm">
              {selectedEvent.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm font-sans text-[#f7efeb]/90">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="h-4 w-4 text-[#ffd580]" />
                {selectedEvent.date}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="h-4 w-4 text-[#ffd580]" />
                {selectedEvent.time}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin className="h-4 w-4 text-[#ffd580]" />
                {selectedEvent.location}
              </span>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="rounded-2xl border border-[#e8dfd5] bg-white p-6 sm:p-8 space-y-4 shadow-xs">
          <h3 className="font-sans text-xl font-bold text-[#1e1b19] tracking-tight">
            About the Event
          </h3>
          <p className="font-sans text-base text-[#574141] leading-relaxed font-normal">
            {selectedEvent.fullDescription}
          </p>

          <div className="pt-2 flex flex-wrap gap-2">
            {(selectedEvent.tags || []).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#faf2ee] border border-[#e8dfd5] px-3.5 py-1 font-sans text-xs font-semibold text-[#7e1925]"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Schedule Breakdown */}
        <div className="rounded-2xl border border-[#e8dfd5] bg-white p-6 sm:p-8 space-y-5 shadow-xs">
          <h3 className="font-sans text-xl font-bold text-[#1e1b19] tracking-tight flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-[#7e1925]" />
            Event Program & Schedule
          </h3>

          <div className="space-y-3">
            {(selectedEvent.schedule || []).map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 rounded-xl border border-[#e8dfd5] bg-[#faf2ee]"
              >
                <span className="rounded-lg bg-[#7e1925] text-white px-3 py-1 font-sans text-xs font-bold whitespace-nowrap tracking-wide">
                  {item.time}
                </span>
                <div className="pt-0.5 space-y-0.5">
                  <p className="font-sans text-sm font-semibold text-[#1e1b19]">
                    {item.activity}
                  </p>
                  {item.description && (
                    <p className="font-sans text-xs text-[#574141]">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {(!selectedEvent.schedule || selectedEvent.schedule.length === 0) && (
              <p className="font-sans text-sm text-[#574141] italic py-2">
                No detailed program schedule available for this event yet.
              </p>
            )}
          </div>
        </div>

        {/* Related Heritage Sites */}
        {relatedHeritageSites.length > 0 && (
          <div className="space-y-5">
            <h3 className="font-sans text-xl font-bold text-[#1e1b19] tracking-tight flex items-center gap-2 border-b border-[#e8dfd5] pb-3">
              <Sparkles className="w-5 h-5 text-[#b45309]" />
              Related Heritage Landmarks in San Fernando
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {relatedHeritageSites.map((site) => (
                <div
                  key={site.id}
                  onClick={() => onSelectSite(site)}
                  className="cursor-pointer flex items-center gap-4 rounded-2xl border border-[#e8dfd5] bg-white p-4 hover:border-[#7e1925] hover:shadow-md transition-all group"
                >
                  <img
                    src={site.heroImage}
                    alt={site.name}
                    className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    onError={handleHeritageImageError}
                  />
                  <div>
                    <span className="font-sans text-xs font-bold uppercase tracking-wider text-[#b45309] block">
                      {site.category}
                    </span>
                    <h4 className="font-sans text-base font-bold text-[#1e1b19] group-hover:text-[#7e1925] transition-colors leading-snug">
                      {site.name}
                    </h4>
                    <p className="font-sans text-xs text-[#574141] mt-1">{site.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // ALL EVENTS DIRECTORY
  return (
    <div id="events-directory-page" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28 font-sans">
      {/* Header Banner with Maroon Low-Poly & Decorative Parols */}
      <motion.div 
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl bg-lowpoly-maroon border border-[#861f2a]/50 p-7 sm:p-11 text-white shadow-xl"
      >
        <div className="absolute inset-0 bg-[#36040a]/40 backdrop-blur-[1px] pointer-events-none" />
        <SectionParolAccents leftId="4" rightId="5" />

        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#36040a]/85 border border-[#f5b82a]/40 px-3.5 py-1 text-xs font-semibold text-[#fde588]">
            <Sparkles className="w-3.5 h-3.5 text-[#f5b82a]" />
            <span className="tracking-wide">San Fernando Cultural Calendar • Festivities & Traditions</span>
          </div>
          <h1 id="events-header-title" className="font-sans text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
            Cultural Events & Festivals
          </h1>
          <p className="font-sans text-sm sm:text-base text-[#ffeaec]/90 leading-relaxed font-normal">
            From the world-renowned kaleidoscopic lights of Ligligan Parul to historic ancestral house twilight walks and Kapampangan culinary expos.
          </p>
        </div>
      </motion.div>

      {/* Filters Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e8dfd5] bg-white p-5 shadow-xs"
      >
        {/* Category Pills */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 rounded-full px-4 py-2 font-sans text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#7e1925] text-white border border-[#7e1925] shadow-xs'
                  : 'bg-[#fbf6f1] border border-[#e8dfd5] text-[#1e1b19] hover:border-[#7e1925] hover:bg-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <input
          type="text"
          placeholder="Filter events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-xl border border-[#e8dfd5] bg-white px-4 py-2 text-sm text-[#1e1b19] focus:outline-none focus:border-[#7e1925] transition-colors"
        />
      </motion.div>

      {/* Event Cards Grid with Staggered Scroll Animations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
        {filteredEvents.map((evt, idx) => {
          const isAdded = savedEventIds.includes(evt.id);
          return (
            <motion.div
              key={evt.id}
              id={`event-card-${evt.id}`}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.55, delay: (idx % 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="group flex flex-col justify-between rounded-2xl border border-[#e8dfd5] bg-white hover:border-[#7e1925]/60 hover:shadow-[0_16px_36px_-10px_rgba(126,25,37,0.14)] transition-all duration-300 overflow-hidden"
            >
              <div>
                {/* 16:10 Banner with date tag */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#faf2ee]">
                  <img
                    src={evt.bannerImage}
                    alt={evt.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/events/giant-lantern-fest.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                  <span className="absolute top-3.5 left-3.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 font-sans text-[11px] font-bold text-[#7e1925] border border-white/40 shadow-xs uppercase tracking-wider">
                    {evt.category}
                  </span>

                  <span className="absolute top-3.5 right-3.5 rounded-md bg-black/65 backdrop-blur-xs px-2.5 py-0.5 font-sans text-xs font-semibold text-white border border-white/20">
                    {evt.dateBadge}
                  </span>

                  <div className="absolute bottom-3 left-3.5 flex items-center gap-1.5 font-sans text-xs font-semibold text-white">
                    <Calendar className="w-3.5 h-3.5 text-[#ffd580]" />
                    <span>{evt.date}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6">
                  <h3 className="font-sans text-lg sm:text-xl font-bold text-[#1e1b19] group-hover:text-[#7e1925] transition-colors leading-snug tracking-tight">
                    {evt.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-1.5 font-sans text-xs text-[#574141]">
                    <MapPin className="h-3.5 w-3.5 text-[#7e1925] flex-shrink-0" />
                    <span className="truncate">{evt.location}</span>
                  </div>
                  <p className="mt-3 font-sans text-sm text-[#574141] line-clamp-3 leading-relaxed font-normal">
                    {evt.shortDescription}
                  </p>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-5 sm:p-6 pt-0">
                <div className="border-t border-[#e8dfd5] pt-4 flex items-center justify-between">
                  <button
                    onClick={() => onToggleSaveEvent(evt.id)}
                    className={`flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      isAdded ? 'text-[#b45309]' : 'text-[#574141] hover:text-[#7e1925]'
                    }`}
                  >
                    {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{isAdded ? 'In Plan' : 'Add to Plan'}</span>
                  </button>

                  <button
                    onClick={() => onSelectEvent(evt)}
                    className="font-sans inline-flex items-center gap-1.5 rounded-xl bg-[#7e1925] hover:bg-[#580b14] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-xs hover:scale-[1.02] cursor-pointer"
                  >
                    <span>Schedule</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
