import React, { useState, useRef, useCallback } from 'react';
import { Eye, Clock } from 'lucide-react';

interface ThenNowSliderProps {
  archivalImage: string;
  modernImage: string;
  caption?: string;
  thenYear?: string;
  nowYear?: string;
}

export const ThenNowSlider: React.FC<ThenNowSliderProps> = ({
  archivalImage,
  modernImage,
  caption,
  thenYear = 'Archival History',
  nowYear = 'Present Day'
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  return (
    <div id="then-now-interactive-container" className="w-full select-none">
      {/* Strict 16:9 / responsive frame bounded by 1px solid border #e7e0d6, radius 4px (rounded) */}
      <div 
        ref={containerRef}
        id="then-now-viewport"
        className="relative aspect-[16/9] w-full overflow-hidden rounded border border-[#e7e0d6] bg-[#1e1b19] cursor-ew-resize touch-none"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onClick={(e) => handleMove(e.clientX)}
      >
        {/* Modern Image (Full Background) */}
        <img
          src={modernImage}
          alt="Present Day San Fernando"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/sites/cathedral-modern.jpg';
          }}
        />

        {/* Pinned year chip: Today - ivory backdrop pill with label-prominent */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-[#fff8f5]/90 backdrop-blur-md px-3 py-1 border border-[#e7e0d6] text-[#1e1b19] label-prominent">
          <Eye className="w-3.5 h-3.5 text-[#b45309]" />
          <span>{nowYear}</span>
        </div>

        {/* Archival Image (Clipped by Slider Position) */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={archivalImage}
            alt="Historical Archival San Fernando"
            className="absolute inset-0 h-full w-full object-cover filter sepia-[0.3] contrast-105"
            style={{ 
              width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100vw',
              maxWidth: 'none'
            }}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/sites/cathedral-archival.jpg';
            }}
          />
          {/* Archival tone overlay */}
          <div className="absolute inset-0 bg-[#5e0012]/10 mix-blend-multiply" />
        </div>

        {/* Pinned year chip: Archival Then - ivory backdrop pill with label-prominent */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-[#fff8f5]/90 backdrop-blur-md px-3 py-1 border border-[#e7e0d6] text-[#7e1925] label-prominent">
          <Clock className="w-3.5 h-3.5 text-[#7e1925]" />
          <span>{thenYear}</span>
        </div>

        {/* Center drag handle: 2px hairline vertical rule in #ffffff */}
        <div 
          className="absolute top-0 bottom-0 z-20 w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] pointer-events-none"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* 32px circular thumb containing dual facing chevrons in #7e1925 */}
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-white text-[#7e1925] border border-[#e7e0d6] shadow-md">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M8.5 6L2.5 12L8.5 18M15.5 6L21.5 12L15.5 18" stroke="#7e1925" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Subtle Helper Hint */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none rounded-full bg-[#1e1b19]/75 backdrop-blur-md px-3 py-0.5 label-compact text-[#faf2ee]">
          Drag handle to compare eras
        </div>
      </div>

      {caption && (
        <p id="then-now-caption" className="mt-2.5 text-center body-sm text-[#574141] italic px-2">
          {caption}
        </p>
      )}
    </div>
  );
};
