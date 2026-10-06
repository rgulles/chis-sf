import { handleHeritageImageError } from '../utils/heritageImages';
import React from 'react';
import { motion } from 'motion/react';
import { Bookmark } from 'lucide-react';
import type { HeritageSite } from '../types';

interface PlanViewProps {
  sites: HeritageSite[];
  savedSiteIds: string[];
  onSelectSite: (site: HeritageSite) => void;
  onExploreClick: () => void;
}

export const PlanView: React.FC<PlanViewProps> = ({
  sites,
  savedSiteIds,
  onSelectSite,
  onExploreClick
}) => {
  const savedSitesList = sites.filter(site => savedSiteIds.includes(site.id));
  return (
    <div id="plan-view" className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <h1 className="headline-lg">Plan Your Visit</h1>
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-[#e8dfd5] bg-[#faf2ee] p-6 sm:p-8 space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-5 h-5 text-[#7e1925]" />
            <h3 className="font-outfit text-xl font-bold text-[#1e1b19] tracking-tight">
              Your Saved Landmarks ({savedSitesList.length} bookmarked)
            </h3>
          </div>
          {savedSitesList.length === 0 && (
            <button
              onClick={onExploreClick}
              className="font-outfit text-xs font-bold uppercase tracking-wider text-[#7e1925] hover:text-[#580b14] cursor-pointer"
            >
              Browse & Save Sites &rarr;
            </button>
          )}
        </div>

        {savedSitesList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {savedSitesList.map((site) => (
              <div
                key={site.id}
                onClick={() => onSelectSite(site)}
                className="cursor-pointer flex items-center gap-3 p-3 rounded-xl border border-[#e8dfd5] bg-white hover:border-[#7e1925] hover:shadow-xs transition-all"
              >
                <img
                  src={site.heroImage}
                  alt={site.name}
                  className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={handleHeritageImageError}
                />
                <div className="truncate">
                  <h4 className="font-outfit text-sm font-bold text-[#1e1b19] truncate">{site.name}</h4>
                  <p className="font-outfit text-xs text-[#8a7171]">{site.address}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-outfit text-sm text-[#574141] font-normal">
            Save heritage sites to keep a list of places you would like to visit.
          </p>
        )}
      </motion.div>

    </div>
  );
};
