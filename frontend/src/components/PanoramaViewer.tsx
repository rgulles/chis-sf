import React, { useState } from 'react';
import { Compass, Info, Move, Sparkles } from 'lucide-react';
import type { Hotspot } from '../types';

interface PanoramaViewerProps {
  siteName: string;
  panoramicImage: string;
  hotspots?: Hotspot[];
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  siteName,
  panoramicImage,
  hotspots = []
}) => {
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(hotspots[0] || null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  return (
    <div id="panorama-viewer-container" className="rounded-3xl border border-[#E8DFD5] bg-[#1C1917] p-4 text-white shadow-xl overflow-hidden">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DDA84E]/20 text-[#DDA84E]">
            <Compass className="h-4 w-4 animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#DDA84E]">
              360° Interactive Heritage Inspection
            </h4>
            <p className="text-[11px] text-white/70">Explore architectural details & historical hotspots</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoomLevel((z) => Math.max(1, z - 0.2))}
            className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            title="Zoom out"
          >
            -
          </button>
          <span className="text-[11px] font-mono text-white/70">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.2))}
            className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Viewport with panoramic image and interactive hotspots */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-2xl bg-black/40">
        <div 
          className="h-full w-full transition-transform duration-300"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <img
            src={panoramicImage}
            alt={`${siteName} Panorama`}
            className="h-full w-full object-cover filter brightness-90"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/sites/cathedral-hero.jpg';
            }}
          />
        </div>

        {/* Hotspots */}
        {hotspots.map((spot, idx) => (
          <button
            key={idx}
            onClick={() => setActiveHotspot(spot)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute h-8 w-8 rounded-full bg-[#DDA84E]/40 animate-ping" />
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7A1C30] text-[#DDA84E] border-2 border-white shadow-lg group-hover:scale-110 transition-transform">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
          </button>
        ))}

        {/* Instruction overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] text-white/80 pointer-events-none">
          <Move className="w-3 h-3 text-[#DDA84E]" />
          <span>Tap illuminated gold markers to inspect artifacts</span>
        </div>
      </div>

      {/* Active Hotspot Inspector Card */}
      {activeHotspot && (
        <div className="mt-3 rounded-2xl bg-white/10 backdrop-blur-md p-3.5 border border-white/10 flex items-start gap-3">
          <Info className="h-5 w-5 text-[#DDA84E] flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-[#DDA84E]">{activeHotspot.title}</h5>
            <p className="text-xs text-white/90 mt-0.5 leading-relaxed">{activeHotspot.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};
