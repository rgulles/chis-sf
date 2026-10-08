import { handleHeritageImageError } from '../utils/heritageImages';
import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, MapPin, Calendar, ArrowRight, Clock } from 'lucide-react';
import type { HeritageSite, EventItem } from '../types';
import { apiFetchSites } from '../api/client';
import { ErrorState } from './ErrorState';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: HeritageSite[];
  events: EventItem[];
  onSelectSite: (site: HeritageSite) => void;
  onSelectEvent: (event: EventItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  sites,
  events,
  onSelectSite,
  onSelectEvent
}) => {
  const [query, setQuery] = useState<string>('');
  const [lookup, setLookup] = useState<{ query: string; sites?: HeritageSite[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const needsLookup = sites.some(site => site.isSummary);
  useEffect(() => {
    if (!isOpen || !query.trim() || !needsLookup) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      apiFetchSites(query.trim()).then(sites => { if (!cancelled) setLookup({ query, sites }); })
        .catch(failure => { if (!cancelled) setLookup({ query, error: failure instanceof Error ? failure.message : 'Unable to search heritage sites.' }); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOpen, query, needsLookup, retry]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredSites = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    const local = sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.shortDescription.toLowerCase().includes(q) ||
        s.story.toLowerCase().includes(q)
    );
    const remote = needsLookup && lookup?.query === query ? lookup.sites || [] : [];
    const matches = new Map([...local, ...remote].map(site => [site.id, site]));
    return [...matches.values()];
  }, [query, sites, needsLookup, lookup]);

  const filteredEvents = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.shortDescription.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }, [query, events]);

  if (!isOpen) return null;

  const popularSearches = sites.slice(0, 7).map(site => site.name);

  return (
    <div id="search-modal-backdrop" className="fixed inset-0 z-50 flex items-start justify-center bg-[#1c1917]/65 p-4 pt-16 sm:pt-24 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Container: Level 4 Planar, 1px solid #e7e0d6, radius 4px (rounded) */}
      <div id="search-modal-container" className="w-full max-w-xl overflow-hidden rounded bg-[#fff8f5] border border-[#e7e0d6] shadow-none">
        {/* Input Bar */}
        <div className="relative flex items-center border-b border-[#e7e0d6] bg-white px-4 py-3">
          <Search className="h-5 w-5 text-[#7e1925]" />
          <input
            id="search-input-field"
            type="text"
            autoFocus
            placeholder="Search heritage sites, stories, events in San Fernando..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white px-3 py-1 text-sm font-medium text-[#1e1b19] placeholder-[#292524]/50 focus:outline-none focus:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="mr-2 text-xs font-semibold text-[#8a7171] hover:text-[#1e1b19]"
            >
              Clear
            </button>
          )}
          <button
            id="close-search-btn"
            onClick={onClose}
            className="rounded p-1 text-[#8a7171] hover:bg-[#faf2ee] hover:text-[#1e1b19]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-5">
          {!query.trim() ? (
            <div>
              <p className="label-prominent text-[#8a7171] mb-3">
                Current Heritage Sites
              </p>
              {/* Category Chips: Ivory background (#f3ede4), text #1e1b19, border 1px solid #e7e0d6, radius 9999px */}
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="flex items-center gap-1.5 rounded-full border border-[#e7e0d6] bg-[#f3ede4] px-3 py-1 label-compact text-[#1e1b19] hover:bg-[#7e1925] hover:text-white hover:border-[#7e1925] transition-colors"
                  >
                    <Clock className="w-3 h-3 text-[#b45309]" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {needsLookup && lookup?.query !== query && <p role="status">Searching heritage sites…</p>}
              {lookup?.query === query && lookup.error && <ErrorState message={lookup.error} onRetry={() => setRetry(value => value + 1)} />}
              {/* Heritage Sites Matches */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="label-prominent text-[#7e1925]">
                    Heritage Sites ({filteredSites.length})
                  </span>
                </div>
                {filteredSites.length > 0 ? (
                  <div className="space-y-2">
                    {filteredSites.map((site) => (
                      <div
                        key={site.id}
                        id={`search-site-${site.id}`}
                        onClick={() => {
                          onSelectSite(site);
                          onClose();
                        }}
                        className="flex items-center justify-between rounded border border-[#e7e0d6] bg-white p-3 hover:border-[#7e1925] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={site.heroImage}
                              onError={handleHeritageImageError}
                            alt={site.name}
                            className="h-12 w-12 rounded-sm object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 className="font-sans text-sm font-semibold text-[#1e1b19]">{site.name}</h4>
                            <div className="flex items-center gap-2 body-sm text-[#574141] mt-0.5">
                              <span className="text-[#7e1925] font-medium">{site.category}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#b45309]" />
                                {site.address}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#b45309]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="body-sm text-[#8a7171] italic">No heritage sites match this query.</p>
                )}
              </div>

              {/* Cultural Events Matches */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="label-prominent text-[#7e1925]">
                    Cultural Events ({filteredEvents.length})
                  </span>
                </div>
                {filteredEvents.length > 0 ? (
                  <div className="space-y-2">
                    {filteredEvents.map((evt) => (
                      <div
                        key={evt.id}
                        id={`search-event-${evt.id}`}
                        onClick={() => {
                          onSelectEvent(evt);
                          onClose();
                        }}
                        className="flex items-center justify-between rounded border border-[#e7e0d6] bg-white p-3 hover:border-[#7e1925] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={evt.bannerImage}
                            alt={evt.title}
                            className="h-12 w-12 rounded-sm object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/events/giant-lantern-fest.jpg';
                            }}
                          />
                          <div>
                            <h4 className="font-sans text-sm font-semibold text-[#1e1b19]">{evt.title}</h4>
                            <div className="flex items-center gap-2 body-sm text-[#574141] mt-0.5">
                              <span className="flex items-center gap-1 text-[#7e1925]">
                                <Calendar className="w-3 h-3" />
                                {evt.date}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#b45309]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="body-sm text-[#8a7171] italic">No upcoming events match this query.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
