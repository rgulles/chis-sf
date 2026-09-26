import React, { useState } from 'react';
import { ArrowLeft, Volume2, Sparkles, User, Image, Compass, QrCode, Clock } from 'lucide-react';
import type { HeritageSite } from '../types';
import { ThenNowSlider } from '../components/ThenNowSlider';
import { AudioStoryPlayer } from '../components/AudioStoryPlayer';
import { PanoramaViewer } from '../components/PanoramaViewer';

interface InteractiveHistoryViewProps {
  site: HeritageSite;
  onBack: () => void;
  onLaunchQRMode: (site: HeritageSite) => void;
}

export const InteractiveHistoryView: React.FC<InteractiveHistoryViewProps> = ({
  site,
  onBack,
  onLaunchQRMode
}) => {
  const [activeTab, setActiveTab] = useState<'multimedia' | 'timeline' | 'characters' | 'photos'>('multimedia');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const archivalGallery = [
    {
      url: site.archivalImage,
      caption: `Archival View of ${site.name} during early 20th century`,
      era: site.era
    },
    {
      url: site.heroImage,
      caption: `Preserved architectural details of ${site.name}`,
      era: 'Modern Heritage'
    },
    {
      url: '/images/sites/train-station-archival.jpg',
      caption: 'Historic street life and horse carriage in San Fernando Poblacion',
      era: '1890s'
    }
  ];

  return (
    <div id="interactive-history-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 pb-28">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-site-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-[#E8DFD5] bg-white px-3.5 py-1.5 text-xs font-bold text-[#23201F] hover:bg-[#F4EFEA] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[#7A1C30]" />
          <span>Back to Site Overview</span>
        </button>

        <button
          onClick={() => onLaunchQRMode(site)}
          className="flex items-center gap-1.5 rounded-full bg-[#7A1C30] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#581020]"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>On-Site QR Mode</span>
        </button>
      </div>

      {/* Hero Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#DDA84E]/20 text-[#7A1C30] border border-[#DDA84E]/40 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Immersive Digital History
          </span>
          <span className="text-xs text-[#6B645F]">• Interactive Storytelling</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-[#23201F]">
          Bringing the Story of {site.name} to Life
        </h1>
        <p className="text-xs sm:text-sm text-[#6B645F] max-w-2xl leading-relaxed">
          Experience the history through spatial audio narration, interactive Then & Now photographic sliders, historical character biographies, and 360° architectural exploration.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8DFD5] pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'multimedia', label: '360° & Audio Experience', icon: Compass },
          { id: 'timeline', label: 'Living Timeline', icon: Clock },
          { id: 'characters', label: 'Historical Figures', icon: User },
          { id: 'photos', label: 'Archival Photo Gallery', icon: Image }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold tracking-wide transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#7A1C30] text-white shadow-sm'
                  : 'bg-white border border-[#E8DFD5] text-[#23201F] hover:bg-[#FAF8F5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 360° & AUDIO EXPERIENCE */}
      {activeTab === 'multimedia' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Audio Story Player */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#7A1C30] flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-[#C28E38]" />
              Official Audio Story
            </h3>
            <AudioStoryPlayer
              title={site.audioStory.title}
              narrator={site.audioStory.narrator}
              duration={site.audioStory.duration}
              durationSeconds={site.audioStory.durationSeconds}
              transcript={site.audioStory.transcript}
            />
          </div>

          {/* Interactive Then & Now Slider */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#7A1C30] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#C28E38]" />
              Then & Now Visual Time Portal
            </h3>
            <ThenNowSlider
              archivalImage={site.archivalImage}
              modernImage={site.modernImage}
              caption={site.thenNowCaption}
              thenYear="Archival Era"
              nowYear="Preserved Today"
            />
          </div>

          {/* 360° Visual Inspection Viewer */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#7A1C30] flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#C28E38]" />
              360° / Interactive Inspection
            </h3>
            <PanoramaViewer
              siteName={site.name}
              panoramicImage={site.heroImage}
              hotspots={site.panoramaHotspots}
            />
          </div>
        </div>
      )}

      {/* TAB 2: LIVING TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="rounded-3xl border border-[#E8DFD5] bg-white p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-[#F4EFEA] pb-4">
            <h3 className="text-lg font-bold font-serif text-[#23201F]">
              Chronological Epochs of {site.name}
            </h3>
            <p className="text-xs text-[#6B645F] mt-1">
              Trace how this landmark evolved from Spanish colonial foundations to wartime resistance and contemporary heritage conservation.
            </p>
          </div>

          <div className="relative border-l-2 border-[#DDA84E] ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-8">
            {site.timeline.map((item, idx) => (
              <div key={idx} className="relative group">
                <div className="absolute -left-[31px] sm:-left-[39px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#7A1C30] text-white border-2 border-white shadow">
                  <span className="text-[10px] font-bold">{idx + 1}</span>
                </div>
                <span className="inline-block rounded bg-[#7A1C30]/10 text-[#7A1C30] px-2.5 py-0.5 text-xs font-mono font-bold mb-1">
                  {item.year}
                </span>
                <h4 className="text-base font-bold text-[#23201F]">{item.title}</h4>
                <p className="text-xs sm:text-sm text-[#6B645F] mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORICAL FIGURES */}
      {activeTab === 'characters' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <h3 className="text-lg font-bold font-serif text-[#23201F]">
              Historical Figures Connected to This Site
            </h3>
            <p className="text-xs text-[#6B645F] mt-0.5">
              The revolutionary heroes, artisans, architects, and philanthropists whose lives shaped San Fernando.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {site.historicalCharacters.map((person, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 rounded-3xl border border-[#E8DFD5] bg-white p-5 shadow-sm hover:border-[#7A1C30]/40 transition-colors"
              >
                <img
                  src={person.avatar}
                  alt={person.name}
                  className="h-16 w-16 rounded-2xl object-cover border-2 border-[#DDA84E] flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/characters/nicolasa-dayrit.jpg';
                  }}
                />
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A1C30]">
                    {person.role}
                  </span>
                  <h4 className="text-base font-bold text-[#23201F]">{person.name}</h4>
                  <p className="text-xs text-[#6B645F] leading-relaxed">{person.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ARCHIVAL PHOTO GALLERY */}
      {activeTab === 'photos' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <h3 className="text-lg font-bold font-serif text-[#23201F]">
              Archival Photographic Collection
            </h3>
            <p className="text-xs text-[#6B645F] mt-0.5">
              Preserved high-resolution historical photographs from municipal archives and private collections.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {archivalGallery.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPhoto(item.url)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-[#E8DFD5] bg-white shadow-sm hover:shadow-md"
              >
                <div className="relative h-44 w-full overflow-hidden bg-neutral-900">
                  <img
                    src={item.url}
                    alt={item.caption}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 filter sepia-[0.25]"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/sites/cathedral-archival.jpg';
                    }}
                  />
                  <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                    {item.era}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xs text-[#23201F] font-medium leading-snug">
                    {item.caption}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Lightbox zoom modal */}
          {selectedPhoto && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
              onClick={() => setSelectedPhoto(null)}
            >
              <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl">
                <img
                  src={selectedPhoto}
                  alt="Enlarged Archival Photo"
                  className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl"
                />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
