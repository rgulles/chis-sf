import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon-only';
  className?: string;
  onClick?: () => void;
  showMarkToggle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none cursor-pointer group ${className}`}
      title="Sa’n Fernando"
    >
      {/* RED STAR LOGO MARK (Matching App Heritage Red #7E1925) */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 48 48"
          className="h-10 w-10 drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main 5-Pointed Star Shape in Heritage Crimson Red */}
          <path
            d="M24 2.5L29.8 15.8L44.5 17.2L33.3 27.2L36.6 42L24 34.4L11.4 42L14.7 27.2L3.5 17.2L18.2 15.8L24 2.5Z"
            fill="#7E1925"
            stroke="#5E0012"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Faceted lighting/shadows to give geometric star dimension */}
          <path
            d="M24 2.5V34.4L11.4 42L14.7 27.2L3.5 17.2L18.2 15.8L24 2.5Z"
            fill="#5E0012"
            opacity="0.45"
          />
          <path
            d="M24 2.5L29.8 15.8L24 24V2.5Z"
            fill="#A63740"
            opacity="0.6"
          />
          <path
            d="M44.5 17.2L33.3 27.2L24 24L44.5 17.2Z"
            fill="#5E0012"
            opacity="0.4"
          />
          <path
            d="M36.6 42L24 34.4V24L36.6 42Z"
            fill="#400009"
            opacity="0.55"
          />
          <path
            d="M11.4 42L24 34.4V24L11.4 42Z"
            fill="#5E0012"
            opacity="0.5"
          />
          <path
            d="M3.5 17.2L14.7 27.2L24 24L3.5 17.2Z"
            fill="#400009"
            opacity="0.45"
          />
          {/* Center Star Subtle Highlight Dot */}
          <circle cx="24" cy="24" r="2.2" fill="#FFDAD9" />
        </svg>
      </div>

      {/* BRAND NAME: RED LIKE, NO SUB-HEADER */}
      {variant !== 'icon-only' && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#7E1925] group-hover:text-[#580B14] transition-colors leading-none">
              Sa’n Fernando?
            </span>
            <span className="rounded bg-[#FAF2EE] border border-[#E7E0D6] px-1.5 py-0.5 text-[9px] font-bold text-[#7E1925] uppercase tracking-wider hidden xs:inline-block">
              PAMPANGA
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
