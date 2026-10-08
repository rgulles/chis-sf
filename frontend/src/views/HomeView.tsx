import { handleHeritageImageError, HERITAGE_IMAGE_PLACEHOLDER } from '../utils/heritageImages';
import React from 'react';
import { Compass, Map, ArrowRight, ArrowUpRight, Calendar, Bookmark, Sparkles, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import type { HeritageSite, EventItem, CategoryType } from '../types';
import { SectionParolAccents } from '../components/ParolDecoration';

interface HomeViewProps {
  onExploreClick: () => void;
  onMapClick: () => void;
  onSelectSite: (site: HeritageSite) => void;
  onSelectCategory: (category: CategoryType) => void;
  onSelectEvent: (event: EventItem) => void;
  featuredSites: HeritageSite[];
  upcomingEvents: EventItem[];
  savedSiteIds: string[];
  onToggleSaveSite: (siteId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onExploreClick,
  onMapClick,
  onSelectSite,
  onSelectCategory,
  onSelectEvent,
  featuredSites,
  upcomingEvents,
  savedSiteIds,
  onToggleSaveSite
}) => {
  const highlight = featuredSites[0];

  return (
    <div id="home-page-view" className="pb-16">
      {/* HERO SECTION - Edge-to-Edge and strictly fitted within the first viewport height (1st vh) */}
      <section
        id="home-hero-section"
        className="relative overflow-hidden w-full h-[calc(100vh-5rem)] min-h-[520px] max-h-[calc(100vh-5rem)] border-b border-[#861f2a]/40 bg-lowpoly-maroon shadow-lg flex flex-col items-center justify-start pt-14 sm:pt-18 md:pt-20 lg:pt-24"
      >
        {/* Low-Poly Background with Parols - /images/background/background.png with Preserved Vignette */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src="/images/background/background.png"
            alt="Giant Lanterns and Maroon Low-Poly Background"
            className="h-full w-full object-cover object-[50%_65%] select-none"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/background/background.png';
            }}
          />
          {/* Subtle Radial Vignette for Center Contrast & Readability - PRESERVED */}
          <div className="absolute inset-0 bg-radial from-transparent via-[#400009]/20 to-[#2e0207]/75" />
        </div>

        {/* Center Content Container: Expanded to max-w-6xl with balanced framing */}
        <div className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center justify-start">
          {/* Home of the Giant Lanterns Badge - Fades down first */}
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center rounded-full bg-[#3d0309]/85 border border-[#FCBD15]/50 px-4 sm:px-5 py-1.5 label-compact text-[#fde588] backdrop-blur-md mb-4 sm:mb-5 shadow-lg"
          >
            <span className="font-medium tracking-wide">Home of the Giant Lanterns</span>
          </motion.div>

          {/* Main Title - Fades up after badge */}
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="font-sans text-3xl sm:text-5xl md:text-[56px] lg:text-[64px] font-extrabold text-white leading-[1.12] drop-shadow-md tracking-tight max-w-4xl mx-auto"
          >
            Explore the Heritage of <br />
            <span className="text-[#FCBD15]">
              San Fernando
            </span>
          </motion.h1>

          {/* Subtitle - Fades up after title with updated narrative text */}
          <motion.p
            id="hero-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 sm:mt-5 text-base sm:text-lg lg:text-[19px] text-[#ffeaec]/90 max-w-2xl lg:max-w-3xl leading-relaxed drop-shadow mx-auto"
          >
            Discover the historic places, cultural traditions, and stories that have shaped the identity of San Fernando and continue to bring its rich heritage to life.
          </motion.p>

          {/* Action Buttons - Fades up after subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 sm:gap-5 w-full sm:w-auto"
          >
            <button
              id="hero-explore-btn"
              onClick={onExploreClick}
              className="flex items-center justify-center gap-3 rounded-lg bg-[#FCBD15] px-8 py-3.5 sm:px-9 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#3d0309] hover:brightness-105 active:brightness-95 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
            >
              <Compass className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#3d0309] stroke-[2.5]" />
              <span>Explore Heritage</span>
            </button>

            <button
              id="hero-map-btn"
              onClick={onMapClick}
              className="flex items-center justify-center gap-3 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 active:bg-white/25 backdrop-blur-md px-8 py-3.5 sm:px-9 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-white transition-all shadow-md hover:scale-[1.02]"
            >
              <Map className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#ffd580]" />
              <span>Heritage Map</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* HERITAGE INTRODUCTION SECTION - Two-column editorial introduction directly below Hero */}
      <section
        id="heritage-intro-section"
        className="w-full bg-[#fbf6f1] border-b border-[#e8dfd5] py-14 sm:py-20 lg:py-24 overflow-hidden"
      >
        <div className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10 lg:gap-12 xl:gap-16 items-center">
            {/* LEFT COLUMN: Editorial Text (50% width) - Fades in from the left on scroll */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="w-full flex flex-col items-start text-left"
            >
              {/* Eyebrow */}
              <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[#7e1925] mb-3">
                CITY OF SAN FERNANDO, PAMPANGA
              </p>

              {/* Main Heading */}
              <h2
                id="heritage-intro-heading"
                className="font-sans text-3xl sm:text-4xl lg:text-[44px] xl:text-[48px] font-extrabold text-[#1e1b19] tracking-tight leading-[1.15] mb-5 sm:mb-6"
              >
                Home of the Giant Lanterns
              </h2>

              {/* Narrative Description */}
              <div className="space-y-4 text-base sm:text-lg text-[#554d48] leading-relaxed max-w-xl mb-7 sm:mb-8 font-normal">
                <p>
                  San Fernando is a city rich in history, Kapampangan culture, and tradition, best known as the home of the world-renowned Giant Lantern Festival. From its historical roots to its living traditions, the city continues to preserve the heritage that makes San Fernando unique.
                </p>
                <p>
                  Its historic landmarks, ancestral homes, local crafts, and cultural celebrations reflect generations of stories passed down through time. Today, these places and traditions continue to shape the city’s identity, offering visitors a glimpse into the history, creativity, and enduring spirit of San Fernando.
                </p>
              </div>

              {/* Subtle CTA Button / Link */}
              <button
                id="heritage-intro-explore-btn"
                onClick={onExploreClick}
                className="inline-flex items-center gap-2.5 font-bold text-xs sm:text-sm uppercase tracking-wider text-[#7e1925] hover:text-[#580b14] group transition-colors py-1"
              >
                <span>Explore Our Heritage</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1.5 text-[#7e1925]" />
              </button>
            </motion.div>

            {/* RIGHT COLUMN: Minimalist Elegant Architectural Heritage Frame (50% width) */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.75, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <div className="relative w-full rounded-2xl overflow-hidden bg-white border border-[#e8dfd5] shadow-sm group transition-all duration-300 hover:shadow-md">
                {/* Visual Container without white border padding or badge overlay */}
                <div className="relative aspect-[4/3] sm:aspect-[16/11] w-full overflow-hidden bg-[#1e0206]">
                  <img
                    src={highlight?.heroImage || HERITAGE_IMAGE_PLACEHOLDER}
                    alt={highlight?.name || 'Heritage image unavailable'}
                    className="w-full h-full object-cover filter brightness-[1.02] contrast-[1.03] group-hover:scale-[1.02] transition-transform duration-700 ease-out select-none"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={handleHeritageImageError}
                  />
                </div>

                {/* Refined Heritage Caption Frame Footer matching left side typography */}
                <div className="p-4 sm:p-5 text-left font-sans bg-white border-t border-[#e8dfd5]">
                  <h3 className="font-sans text-lg sm:text-xl font-bold text-[#1e1b19] tracking-tight mb-1.5 group-hover:text-[#7e1925] transition-colors">
                    {highlight?.name || 'Heritage catalogue'}
                  </h3>
                  <p className="font-sans text-xs sm:text-sm text-[#554d48] leading-relaxed font-normal">
                    {highlight?.shortDescription || 'No heritage sites are currently available.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 3: THEMATIC CLASSIFICATION / EXPLORE BY CATEGORY */}
      <section
        id="explore-heritage-categories-section"
        className="w-full bg-[#fbf8f5] py-8 sm:py-10 border-b border-[#e8dfd5]"
      >
        <div className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header - Onscroll Fade */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 sm:mb-6 gap-2 border-b border-[#e8dfd5] pb-3"
          >
            <div>
              <span className="font-sans text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[#7e1925]">
                CITY OF SAN FERNANDO, PAMPANGA
              </span>
              <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#1e1b19] tracking-tight mt-1">
                Explore San Fernando's Heritage
              </h2>
            </div>
            <button
              onClick={onExploreClick}
              className="font-sans text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7e1925] hover:text-[#580b14] flex items-center gap-1 transition-colors pb-0.5 group"
            >
              <span>View All Heritage</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* 4 Category Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[
              {
                id: 'historic-places',
                title: 'Historic Places',
                subtitle: 'Discover ancestral houses, landmarks, churches, and historic sites.',
                image: '/images/sites/cathedral-hero.jpg',
                fallbackImage: '/images/background/background.png',
                onClick: () => onSelectCategory('Historical Buildings'),
              },
              {
                id: 'culture-traditions',
                title: 'Culture & Traditions',
                subtitle: 'Explore traditions, festivals, crafts, and local culture.',
                image: '/images/sites/lazatin-house-hero.jpg',
                fallbackImage: '/images/background/background.png',
                onClick: () => onSelectCategory('Cultural Sites'),
              },
              {
                id: 'giant-lanterns',
                title: 'Giant Lanterns',
                subtitle: "Learn about the artistry and tradition behind San Fernando's iconic lanterns.",
                image: '/images/giant-lanterns.jpg',
                fallbackImage: '/images/lanterns/1.png',
                onClick: onExploreClick,
              },
              {
                id: 'stories-people',
                title: 'Stories & People',
                subtitle: "Discover the people and stories connected to the city's heritage.",
                image: '/images/sites/train-station-hero.jpg',
                fallbackImage: '/images/sites/cathedral-hero.jpg',
                onClick: onExploreClick,
              },
            ].map((cat, idx) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.55, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
                onClick={cat.onClick}
                id={`category-card-${cat.id}`}
                className="group relative h-36 sm:h-38 lg:h-40 w-full rounded-xl overflow-hidden border border-[#e8dfd5] hover:border-[#7e1925]/60 shadow-sm hover:shadow-lg transition-all duration-400 cursor-pointer text-left font-sans"
              >
                {/* Background Image */}
                <img
                  src={cat.image}
                  alt={cat.title}
                  className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.92] group-hover:scale-105 group-hover:brightness-90 transition-all duration-500 ease-out select-none"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={handleHeritageImageError}
                />

                {/* Black fade overlay: subtle at rest, deepens on hover for crisp contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 group-hover:from-black/95 group-hover:via-black/80 group-hover:to-black/65 transition-all duration-350 ease-out" />

                {/* Upper right arrow indicator - appears ONLY when hovered */}
                <div className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transform -translate-y-1 group-hover:translate-y-0 transition-all duration-300 ease-out">
                  <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white/90 group-hover:text-[#fcbd15] group-hover:border-[#fcbd15]/50 group-hover:bg-black/70 shadow-sm transition-colors duration-200">
                    <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                  </div>
                </div>

                {/* Card Content: Shorter fixed height container, header slides to top, description appears at bottom */}
                <div className="relative z-10 h-full p-3.5 sm:p-4 flex flex-col justify-between pointer-events-none">
                  {/* Header that slides to top on hover */}
                  <div className="transform translate-y-7 sm:translate-y-8 group-hover:translate-y-0 transition-transform duration-350 ease-out pr-8">
                    <span className="font-sans text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-[#fcbd15] opacity-90 block mb-0.5">
                      Heritage
                    </span>
                    <h3 className="font-sans text-lg sm:text-xl font-bold text-white tracking-tight leading-snug drop-shadow-sm">
                      {cat.title}
                    </h3>
                  </div>

                  {/* Description that appears at bottom on hover without expanding card height */}
                  <div className="transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out delay-75">
                    <p className="font-sans text-xs sm:text-[13px] text-[#f5dfc6]/95 leading-snug font-normal line-clamp-2">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <div className="space-y-12 sm:space-y-16 pt-12 sm:pt-16">
        {/* FEATURED HERITAGE SITES - Minimalist Elegant Redesign */}
        <section id="featured-heritage-section" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-2 border-b border-[#e8dfd5] pb-3.5 font-sans"
          >
            <div>
              <span className="font-sans text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[#7e1925] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#7e1925]" />
                Archival Highlights
              </span>
              <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#1e1b19] tracking-tight mt-1">
                Featured Heritage Sites
              </h2>
            </div>
            <button
              id="view-all-featured-btn"
              onClick={onExploreClick}
              className="font-sans text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7e1925] hover:text-[#580b14] flex items-center gap-1.5 transition-colors pb-0.5 group"
            >
              <span>View All Sites</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* Heritage Cards Grid - Minimalist Elegant 2xl Rounded with Real Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {featuredSites.map((site, index) => {
              const isSaved = savedSiteIds.includes(site.id);
              return (
                <motion.div
                  key={site.id}
                  id={`featured-site-${site.id}`}
                  onClick={() => onSelectSite(site)}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative flex flex-col rounded-2xl border border-[#e8dfd5] bg-white hover:border-[#7e1925]/60 hover:shadow-[0_16px_36px_-10px_rgba(126,25,37,0.14)] transition-all duration-400 overflow-hidden text-left font-sans cursor-pointer"
                >
                  {/* 16:10 Photo Container with Subtle Smooth Zoom */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#240409]">
                    <img
                      src={site.heroImage}
                      alt={site.name}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] select-none"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={handleHeritageImageError}
                    />
                    {/* Subtle Elegant Gradient Fade */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10 group-hover:from-black/85 transition-colors duration-300" />

                    {/* Category Pill Tag */}
                    {site.category && <span className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur-md px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-[#7e1925] border border-[#e8dfd5] shadow-xs">
                      {site.category}
                    </span>}

                    {/* Bookmark Button */}
                    <button
                      id={`save-featured-${site.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSaveSite(site.id);
                      }}
                      className={`absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-all ${isSaved
                          ? 'bg-[#7e1925] text-white shadow-xs'
                          : 'bg-black/45 text-white/90 hover:bg-black/70 border border-white/20'
                        }`}
                      title={isSaved ? 'Remove from saved' : 'Save site'}
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-white' : ''}`} />
                    </button>

                    {/* Historical Year Badge */}
                    {site.yearBuilt && <div className="absolute bottom-2.5 left-3">
                      <span className="font-sans text-[10px] font-semibold text-[#f5dfc6] bg-black/60 backdrop-blur-xs px-2.5 py-0.5 rounded border border-white/15 tracking-wide">
                        {site.yearBuilt}
                      </span>
                    </div>}
                  </div>

                  {/* Content Area */}
                  <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 font-sans">
                    <div>
                      <div className="flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#7e1925] mb-1">
                        <MapPin className="h-3 w-3 text-[#7e1925] flex-shrink-0" />
                        <span>{site.address}</span>
                      </div>

                      <h3 className="font-sans text-base sm:text-lg font-bold text-[#1e1b19] group-hover:text-[#7e1925] transition-colors leading-snug line-clamp-1">
                        {site.name}
                      </h3>

                      <p className="mt-2 font-sans text-xs sm:text-[13px] text-[#554d48] leading-relaxed font-normal line-clamp-2">
                        {site.shortDescription}
                      </p>
                    </div>

                    {/* Footer metadata */}
                    <div className="mt-4 pt-3.5 border-t border-[#f0e8df] flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#7e1925] group-hover:text-[#580b14] transition-colors">
                        <span>Explore</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* UPCOMING EVENTS PREVIEW - Minimalist Elegant Redesign with Real Photos */}
        <section id="upcoming-events-section" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-2 border-b border-[#e8dfd5] pb-3.5 font-sans"
          >
            <div>
              <span className="font-sans text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[#7e1925]">
                Living Culture & Celebrations
              </span>
              <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#1e1b19] tracking-tight mt-1">
                Upcoming Events
              </h2>
            </div>
            <button
              onClick={() => onSelectEvent(upcomingEvents[0])}
              className="font-sans text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7e1925] hover:text-[#580b14] flex items-center gap-1.5 transition-colors pb-0.5 group"
            >
              <span>All Cultural Festivals</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
            {upcomingEvents.slice(0, 3).map((event, idx) => (
              <motion.div
                key={event.id}
                id={`event-preview-${event.id}`}
                onClick={() => onSelectEvent(event)}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex flex-col rounded-2xl border border-[#e8dfd5] bg-white hover:border-[#7e1925]/60 hover:shadow-[0_16px_36px_-10px_rgba(126,25,37,0.14)] transition-all duration-400 overflow-hidden text-left font-sans cursor-pointer"
              >
                {/* 16:10 Real Photo Container */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#240409]">
                  <img
                    src={event.bannerImage}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] select-none"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={handleHeritageImageError}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10 group-hover:from-black/85 transition-colors duration-300" />

                  {/* Event Date Badge on Top Left */}
                  <span className="absolute top-3 left-3 rounded-lg bg-[#7e1925] px-2.5 py-1 font-sans text-[10px] font-bold text-white uppercase tracking-wider shadow-xs">
                    {event.dateBadge}
                  </span>

                  {/* Category Pill on Top Right */}
                  <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-xs px-2.5 py-0.5 font-sans text-[10px] font-semibold text-[#ffd580] border border-[#fcbd15]/30 uppercase tracking-wider">
                    {event.category}
                  </span>
                </div>

                <div className="p-4 sm:p-5 flex flex-1 flex-col justify-between font-sans">
                  <div>
                    <div className="flex items-center gap-1.5 font-sans text-xs font-semibold text-[#7e1925] mb-1">
                      <Calendar className="h-3.5 w-3.5 text-[#7e1925]" />
                      <span>{event.date}</span>
                    </div>

                    <h3 className="font-sans text-base sm:text-lg font-bold text-[#1e1b19] group-hover:text-[#7e1925] transition-colors leading-snug line-clamp-1">
                      {event.title}
                    </h3>

                    <p className="mt-2 font-sans text-xs sm:text-[13px] text-[#554d48] leading-relaxed font-normal line-clamp-2">
                      {event.shortDescription}
                    </p>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-[#f0e8df] flex items-center justify-between text-xs">
                    <span className="font-sans text-[11px] sm:text-xs text-[#8a7171] line-clamp-1 max-w-[60%]">
                      {event.location.split(',')[0]}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#7e1925] group-hover:text-[#580b14] transition-colors">
                      <span>View Event</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* HERITAGE CALL TO ACTION CARD - Styled with plain-bg.png */}
        <section id="heritage-cta-card-section" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-2xl border border-[#861f2a]/40 p-8 sm:p-12 text-white shadow-xl bg-[#4a0810]"
          >
            {/* Custom Plain Low-Poly Background */}
            <img
              src="/images/background/plain-bg.png"
              alt="San Fernando Heritage"
              className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/background/background.png';
              }}
            />

            {/* Subtle vignette overlay for optimal text contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#2e0307]/85 via-[#36040a]/65 to-[#240205]/80 pointer-events-none" />

            {/* Decorative Framing Parols at corners */}
            <SectionParolAccents leftId="1" rightId="2" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* LEFT SIDE (50% width on large screens) */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="w-full space-y-4 text-left"
              >
                {/* Eyebrow badge without icon as requested */}
                <div className="inline-flex items-center rounded-full bg-[#200205]/80 border border-white/20 px-3.5 py-1 text-xs font-medium text-white/95 backdrop-blur-md shadow-xs">
                  <span className="tracking-wide">City of <span className="text-[#ffd580] font-semibold">San Fernando</span>, Pampanga</span>
                </div>
                <h2 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
                  Your Journey Through <span className="text-[#ffd580]">San Fernando</span> Starts Here.
                </h2>
                <p className="font-sans text-sm sm:text-base text-[#ffeaec]/90 max-w-xl leading-relaxed font-normal">
                  Explore the places, stories, and traditions that keep the city's heritage alive.
                </p>
                <div className="pt-2">
                  <button
                    id="start-journey-btn"
                    onClick={onExploreClick}
                    className="font-sans inline-flex items-center gap-2 rounded-xl bg-[#f5b82a] text-[#3d0309] px-7 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-[#ffc842] transition-all shadow-md hover:scale-[1.02] cursor-pointer"
                  >
                    <span>Explore Heritage</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>

              {/* RIGHT SIDE (50% width on large screens): Heritage Showcase Card */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full flex justify-center lg:justify-end"
              >
                <div className="relative w-full max-w-lg aspect-[16/10] sm:aspect-[16/9] lg:aspect-[16/10] rounded-2xl overflow-hidden border border-white/25 bg-[#2d0206]/80 shadow-2xl group transition-all duration-300">
                  <img
                    src={highlight?.heroImage || HERITAGE_IMAGE_PLACEHOLDER}
                    alt={highlight?.name || 'Heritage image unavailable'}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={handleHeritageImageError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15 pointer-events-none" />

                  {/* Badge on top right */}
                  <div className="absolute top-3.5 right-3.5">
                    <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md px-3 py-1 font-sans text-[11px] font-semibold text-white/95 border border-white/25 uppercase tracking-wider">
                      {highlight?.category || 'Heritage catalogue'}
                    </span>
                  </div>

                  {/* Caption at bottom */}
                  <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-left">
                    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffd580] block mb-1">
                      Living Culture & History
                    </span>
                    <p className="font-sans text-base sm:text-lg font-bold text-white leading-snug">
                      {highlight?.name || 'Heritage catalogue'}
                    </p>
                    <p className="font-sans text-xs text-[#ffeaec]/85 mt-1 line-clamp-2">
                      {highlight?.shortDescription || 'No heritage sites are currently available.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
};
