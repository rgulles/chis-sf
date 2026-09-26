import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Compass, Navigation, Sparkles, ChevronRight, Bookmark } from 'lucide-react';
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
  const [activeItineraryId, setActiveItineraryId] = useState<string>('half-day');

  const itineraries = [
    {
      id: 'half-day',
      title: 'Poblacion Walking Heritage Trail',
      badge: 'Core Route',
      duration: '3.5 Hours • Walking (~1.4 km)',
      target: 'First-time visitors, photography & architecture enthusiasts',
      description: 'Explore the monumental heart of San Fernando. Walk between Spanish colonial baroque churches and the opulent sugar-era ancestral mansions along historic V. Consunji Street.',
      stops: [
        {
          siteId: 'cathedral',
          time: '08:30 AM',
          name: 'Metropolitan Cathedral of San Fernando',
          tip: 'Admire the monumental dome rebuilt by Arch. Fernando Ocampo.'
        },
        {
          siteId: 'consunji-house',
          time: '09:45 AM',
          name: 'Consunji Ancestral House',
          tip: 'Examine intact capiz slide windows and ventanillas.'
        },
        {
          siteId: 'lazatin-house',
          time: '10:45 AM',
          name: 'Lazatin Heritage Residence',
          tip: 'Site of the Japanese military headquarters during WWII.'
        },
        {
          siteId: 'hizon-singian-house',
          time: '11:30 AM',
          name: 'Hizon-Singian Ancestral House',
          tip: 'Where General Antonio Luna was welcomed by the town elite.'
        }
      ],
      transportAdvice: '100% walkable once you alight at the Metropolitan Cathedral patio or City Hall.',
      mealStop: 'Stop for breakfast or early lunch at historic Kapampangan bakeries nearby for fresh pan de sal and hot tsokolate de batirol.'
    },
    {
      id: 'full-day',
      title: 'Full-Day Heroes, Rails & Lanterns Trail',
      badge: 'Comprehensive',
      duration: '7 Hours • Walking & Transit',
      target: 'History scholars, families, and educational study visits',
      description: 'Journey from the solemn WWII railroad terminal where national hero Dr. Jose Rizal and Death March soldiers passed, to the dazzling artistry of the Giant Lantern and Pampanga Provincial Capitol.',
      stops: [
        {
          siteId: 'train-station',
          time: '09:00 AM',
          name: 'San Fernando Train Station Museum',
          tip: 'Inspect original railroad tracks, Jose Rizal monument, and WWII boxcar memorial.'
        },
        {
          siteId: 'death-march-marker',
          time: '10:30 AM',
          name: 'Bataan Death March KM 102 Shrine',
          tip: 'Solemn memorial marker at the end of the 102km forced march.'
        },
        {
          siteId: 'capitol',
          time: '01:30 PM',
          name: 'Pampanga Provincial Capitol',
          tip: 'Neo-classical facade and historic legislative halls.'
        },
        {
          siteId: 'giant-lantern-center',
          time: '03:30 PM',
          name: 'Giant Lantern and Cultural Center',
          tip: 'Marvel at giant rotor drums and 10,000 interlocking colored light bulbs.'
        }
      ],
      transportAdvice: 'Take short local tricycles between the Old Train Station, Capitol Boulevard, and the Giant Lantern Center (fares typically ₱30–₱50 per ride).',
      mealStop: 'Enjoy traditional Kapampangan lunch (Pork Sisig, Bringhe, or Tibok-tibok) around Dolores or Poblacion heritage diners.'
    },
    {
      id: 'food-culture',
      title: 'Culinary Heritage & Living Traditions',
      badge: 'Gastronomy Focus',
      duration: '4.5 Hours • Leisurely Pace',
      target: 'Foodies, cultural travelers, culinary researchers',
      description: 'Pampanga is celebrated as the Culinary Capital of the Philippines. Connect historical mansions with authentic local gastronomic landmarks.',
      stops: [
        {
          siteId: 'cathedral',
          time: '09:00 AM',
          name: 'San Fernando Cathedral & Market Plaza',
          tip: 'Sample freshly steamed tamales and hot bibingka from local plaza vendors.'
        },
        {
          siteId: 'consunji-house',
          time: '10:30 AM',
          name: 'Consunji Street Heritage Corridor',
          tip: 'Learn how sugar fortunes funded both opulent architecture and elaborate feasts.'
        },
        {
          siteId: 'giant-lantern-center',
          time: '02:00 PM',
          name: 'Giant Lantern Center & Heritage Souvenir Hub',
          tip: 'Browse artisanal San Fernando delicacies (turrones de casuy, sans rival).'
        }
      ],
      transportAdvice: 'Easily navigated via jeepney along the main Dolores-Poblacion corridor.',
      mealStop: 'Indulge in authentic Fernandino halo-halo with slow-cooked pastillas milk and sweetened corn.'
    }
  ];

  const currentItinerary = itineraries.find((it) => it.id === activeItineraryId) || itineraries[0];
  const savedSitesList = sites.filter((s) => savedSiteIds.includes(s.id));

  return (
    <div id="plan-tour-page" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 pb-28 font-outfit">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3 border-b border-[#e8dfd5] pb-6"
      >
        <div className="flex items-center gap-2">
          <span className="font-outfit text-xs font-bold uppercase tracking-[0.18em] text-[#7e1925]">
            Curated Itineraries & Practical Guide
          </span>
          <span className="font-outfit text-xs text-[#8a7171]">• Fernandino Travel Handbook</span>
        </div>
        <h1 id="plan-header-title" className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b19] tracking-tight leading-tight">
          Plan Your Heritage Tour
        </h1>
        <p className="font-outfit text-base text-[#574141] max-w-3xl leading-relaxed font-normal">
          Crafted self-guided routes, verified walking durations, public transit advice, and cultural etiquette to maximize your discovery of San Fernando.
        </p>
      </motion.div>

      {/* ITINERARY SELECTION TABS */}
      <motion.div 
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {itineraries.map((it) => {
          const isSelected = activeItineraryId === it.id;
          return (
            <div
              key={it.id}
              onClick={() => setActiveItineraryId(it.id)}
              className={`cursor-pointer rounded-2xl border p-6 transition-all duration-300 shadow-xs ${
                isSelected
                  ? 'border-[#7e1925] bg-[#faf2ee] shadow-md scale-[1.01]'
                  : 'border-[#e8dfd5] bg-white hover:border-[#7e1925]/60 hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-outfit text-xs font-bold uppercase tracking-wider bg-[#7e1925] text-white px-3 py-1 rounded-full shadow-xs">
                  {it.badge}
                </span>
                <span className="font-outfit text-xs font-semibold text-[#574141]">{it.duration.split('•')[0]}</span>
              </div>
              <h3 className="font-outfit text-lg font-bold text-[#1e1b19] mt-3.5 leading-snug">
                {it.title}
              </h3>
              <p className="font-outfit text-xs sm:text-sm text-[#574141] mt-2 line-clamp-2 leading-relaxed font-normal">
                {it.description}
              </p>
            </div>
          );
        })}
      </motion.div>

      {/* SELECTED ITINERARY DETAIL CARD */}
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-[#e8dfd5] bg-white p-6 sm:p-9 space-y-7 shadow-xs"
      >
        <div className="border-b border-[#e8dfd5] pb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-outfit text-2xl sm:text-3xl font-extrabold text-[#1e1b19] tracking-tight">
              {currentItinerary.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 font-outfit text-xs sm:text-sm text-[#574141] mt-1.5">
              <span className="flex items-center gap-1.5 font-bold text-[#7e1925]">
                <Clock className="w-4 h-4" />
                {currentItinerary.duration}
              </span>
              <span>•</span>
              <span className="font-medium">Target: {currentItinerary.target}</span>
            </div>
          </div>
        </div>

        {/* Stops Sequence */}
        <div className="space-y-5">
          <h3 className="font-outfit text-sm font-bold uppercase tracking-wider text-[#7e1925] flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#b45309]" />
            Recommended Tour Route Sequence
          </h3>

          <div className="relative border-l-2 border-[#e8dfd5] ml-4 pl-7 space-y-7">
            {currentItinerary.stops.map((stop, idx) => {
              const matchedSite = sites.find((s) => s.id === stop.siteId);
              return (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[37px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#7e1925] text-white ring-4 ring-white text-xs font-bold shadow-xs">
                    {idx + 1}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-md bg-[#faf2ee] border border-[#e8dfd5] px-2.5 py-0.5 font-outfit text-xs font-bold text-[#7e1925]">
                        {stop.time}
                      </span>
                      <h4 className="font-outfit text-base font-bold text-[#1e1b19]">{stop.name}</h4>
                    </div>

                    {matchedSite && (
                      <button
                        onClick={() => onSelectSite(matchedSite)}
                        className="font-outfit text-xs font-bold uppercase tracking-wider text-[#7e1925] hover:text-[#580b14] flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="font-outfit text-sm text-[#574141] mt-1.5 italic font-normal">
                    Tip: {stop.tip}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transportation & Food Advice Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-[#e8dfd5]">
          <div className="rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-5 space-y-1.5">
            <span className="font-outfit text-sm font-bold text-[#1e1b19] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#7e1925]" />
              Transit & Route Tip
            </span>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">{currentItinerary.transportAdvice}</p>
          </div>

          <div className="rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-5 space-y-1.5">
            <span className="font-outfit text-sm font-bold text-[#1e1b19] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#b45309]" />
              Gastronomic Recommendation
            </span>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">{currentItinerary.mealStop}</p>
          </div>
        </div>
      </motion.div>

      {/* CUSTOM ITINERARY FROM SAVED SITES */}
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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/sites/cathedral-hero.jpg';
                  }}
                />
                <div className="truncate">
                  <h4 className="font-outfit text-sm font-bold text-[#1e1b19] truncate">{site.name}</h4>
                  <p className="font-outfit text-xs text-[#8a7171]">{site.barangay}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-outfit text-sm text-[#574141] font-normal">
            Bookmark sites across the website to generate your personalized tour route and time estimates.
          </p>
        )}
      </motion.div>

      {/* PRACTICAL VISITOR TIPS & CAPAMPANGAN ETIQUETTE */}
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
      >
        <h3 className="font-outfit text-xl sm:text-2xl font-bold text-[#1e1b19] border-b border-[#e8dfd5] pb-3 tracking-tight">
          Practical Travel Tips for Visitors
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-[#e8dfd5] bg-white p-5 sm:p-6 space-y-2 shadow-xs">
            <span className="font-outfit text-xs font-bold uppercase tracking-wider text-[#7e1925] block">
              1. Best Visiting Hours
            </span>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">
              Begin heritage walks early between <strong>7:30 AM and 10:30 AM</strong> to avoid midday heat. For the Giant Lanterns, visit at dusk (6:00 PM - 9:00 PM).
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dfd5] bg-white p-5 sm:p-6 space-y-2 shadow-xs">
            <span className="font-outfit text-xs font-bold uppercase tracking-wider text-[#7e1925] block">
              2. Local Transport
            </span>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">
              Look for <strong>“Poblacion”</strong> jeepneys or hail motorized tricycles. Consunji Street and the plaza grounds are best explored on foot.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dfd5] bg-white p-5 sm:p-6 space-y-2 shadow-xs">
            <span className="font-outfit text-xs font-bold uppercase tracking-wider text-[#7e1925] block">
              3. Sacred Sites Etiquette
            </span>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">
              When entering the Metropolitan Cathedral, dress respectfully (covered shoulders and knees). Avoid flash photography during ongoing masses.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dfd5] bg-white p-5 sm:p-6 space-y-2 shadow-xs">
            <span className="font-outfit text-xs font-bold uppercase tracking-wider text-[#7e1925] block">
              4. Useful Kapampangan
            </span>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">
              <em>“Mayap a aldo!”</em> = Good day!<br/>
              <em>“Saan sa San Fernando?”</em> = Where in San Fernando?<br/>
              <em>“Salamat pu!”</em> = Thank you!
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
