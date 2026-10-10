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
      title="Sa'n Fernando"
    >
      {/* Transparent logo shared by the header and footer. */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <img
          src="/images/logo-transparent.png"
          alt="CHIS logo"
          width={48}
          height={48}
          className="h-12 w-12 object-contain transition-transform duration-200 group-hover:scale-105"
        />
      </div>

      {/* BRAND NAME: RED LIKE, NO SUB-HEADER */}
      {variant !== 'icon-only' && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#7E1925] group-hover:text-[#580B14] transition-colors leading-none">
              Sa'n Fernando
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
