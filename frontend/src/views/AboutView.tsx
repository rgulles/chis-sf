import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Building2, Users, Heart, Award, ArrowRight } from 'lucide-react';

interface AboutViewProps {
  onExploreClick: () => void;
  onContactClick: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({
  onExploreClick: _onExploreClick,
  onContactClick
}) => {
  return (
    <div id="about-platform-page" className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 pb-28 font-outfit">
      {/* Header with Motion */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3 border-b border-[#e8dfd5] pb-6"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-[#faf2ee] border border-[#e8dfd5] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#7e1925]">
          <Sparkles className="w-3.5 h-3.5 text-[#b45309]" />
          <span>Project Origin & Purpose</span>
        </div>
        <h1 id="about-header-title" className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b19] tracking-tight leading-tight">
          About “Sa’n Fernando”
        </h1>
        <p className="font-outfit text-base text-[#574141] leading-relaxed max-w-3xl font-normal">
          The story, mission, and community behind the digital heritage gateway of the City of San Fernando, Pampanga.
        </p>
      </motion.div>

      {/* Origin of the Name */}
      <motion.section 
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-[#e8dfd5] bg-white p-7 sm:p-9 space-y-5 shadow-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-[#e8dfd5] pb-3">
          <span className="h-5 w-1.5 rounded-full bg-[#7e1925]" />
          <h2 className="font-outfit text-xl sm:text-2xl font-bold text-[#1e1b19] tracking-tight">
            The Name: “Saan sa San Fernando?”
          </h2>
        </div>

        <p className="font-outfit text-base text-[#1e1b19] leading-relaxed">
          The platform’s name is inspired by the common Filipino question: <strong className="text-[#7e1925]">“Saan sa San Fernando?”</strong> (“Where in San Fernando?”). 
        </p>
        <p className="font-outfit text-sm sm:text-base text-[#574141] leading-relaxed font-normal">
          Too often, visitors pass through San Fernando only recognizing it as a busy transit crossroads or during the seasonal spectacle of giant Christmas lanterns. Yet beneath the bustling thoroughfares lies a rich repository of Philippine history—ancestral mansions where revolution was discussed, railroad tracks where national hero Jose Rizal disembarked, and churches that survived wars and volcanic eruptions.
        </p>
        <div className="rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-5 text-sm sm:text-base italic text-[#7e1925] font-normal leading-relaxed">
          “Our mission is to ensure every student, local Fernandino, and traveler can easily answer the question with pride, curiosity, and cultural reverence.”
        </div>
      </motion.section>

      {/* Purpose: Bridge to the New Generation */}
      <motion.section 
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-[#e8dfd5] bg-white p-7 sm:p-9 space-y-5 shadow-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-[#e8dfd5] pb-3">
          <span className="h-5 w-1.5 rounded-full bg-[#b45309]" />
          <h2 className="font-outfit text-xl sm:text-2xl font-bold text-[#1e1b19] tracking-tight">
            A Living Bridge to the Next Generation
          </h2>
        </div>

        <p className="font-outfit text-sm sm:text-base text-[#574141] leading-relaxed font-normal">
          History is not meant to sit dormant in dusty archives or brass markers that go unnoticed. By combining on-site physical QR markers, spatial audio narratives, and Then & Now photographic sliders, <strong>Sa’n Fernando</strong> transforms heritage preservation into an engaging, interactive adventure.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
          <div className="rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-5 space-y-2">
            <h4 className="font-outfit text-sm font-bold uppercase tracking-wider text-[#7e1925]">Accessible</h4>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">
              Direct mobile access for walking tourists and curious passersby on street corners.
            </p>
          </div>
          <div className="rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-5 space-y-2">
            <h4 className="font-outfit text-sm font-bold uppercase tracking-wider text-[#7e1925]">Educational</h4>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">
              Curated timelines and historical figure dossiers designed for youth, students, and educators.
            </p>
          </div>
          <div className="rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-5 space-y-2">
            <h4 className="font-outfit text-sm font-bold uppercase tracking-wider text-[#7e1925]">Community-Driven</h4>
            <p className="font-outfit text-xs sm:text-sm text-[#574141] leading-relaxed font-normal">
              Co-created with local heritage homeowners, historians, and lantern artisan guilds.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Partner Stakeholders */}
      <motion.section 
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-[#e8dfd5] bg-white p-7 sm:p-9 space-y-5 shadow-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-[#e8dfd5] pb-3">
          <span className="h-5 w-1.5 rounded-full bg-[#7e1925]" />
          <h2 className="font-outfit text-xl sm:text-2xl font-bold text-[#1e1b19] tracking-tight">
            Institutional Partners
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex items-start gap-3.5 p-5 rounded-xl border border-[#e8dfd5] bg-[#faf2ee]">
            <Building2 className="w-5 h-5 text-[#7e1925] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-outfit text-sm font-bold text-[#1e1b19]">City Tourism & Heritage Office</h4>
              <p className="font-outfit text-xs text-[#574141] mt-0.5">City Government of San Fernando, Pampanga</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-5 rounded-xl border border-[#e8dfd5] bg-[#faf2ee]">
            <Users className="w-5 h-5 text-[#b45309] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-outfit text-sm font-bold text-[#1e1b19]">San Fernando Heritage District Council</h4>
              <p className="font-outfit text-xs text-[#574141] mt-0.5">Ancestral Homeowners & Historians Association</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-5 rounded-xl border border-[#e8dfd5] bg-[#faf2ee]">
            <Award className="w-5 h-5 text-[#7e1925] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-outfit text-sm font-bold text-[#1e1b19]">Giant Lantern Festival Foundation</h4>
              <p className="font-outfit text-xs text-[#574141] mt-0.5">Ligligan Parul Artisan Guild</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-5 rounded-xl border border-[#e8dfd5] bg-[#faf2ee]">
            <Heart className="w-5 h-5 text-[#7e1925] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-outfit text-sm font-bold text-[#1e1b19]">Center for Kapampangan Studies</h4>
              <p className="font-outfit text-xs text-[#574141] mt-0.5">Linguistic & Historical Research Partner</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Bottom CTA */}
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row items-center justify-between gap-5 p-7 sm:p-9 rounded-2xl border border-[#e8dfd5] bg-[#faf2ee] shadow-xs"
      >
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-outfit text-lg sm:text-xl font-bold text-[#1e1b19] tracking-tight">Need guided group tours or research assistance?</h4>
          <p className="font-outfit text-sm text-[#574141]">Get in touch with the CSFP City Tourism Office.</p>
        </div>
        <button
          onClick={onContactClick}
          className="font-outfit inline-flex items-center gap-2 rounded-xl bg-[#7e1925] hover:bg-[#580b14] px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider text-white transition-all shadow-md hover:scale-[1.02] cursor-pointer whitespace-nowrap"
        >
          <span>Contact Tourism Office</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};
