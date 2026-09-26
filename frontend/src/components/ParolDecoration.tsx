import React from 'react';

export type ParolId = '1' | '2' | '3' | '4' | '5';

interface ParolImageProps {
  id: ParolId;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ParolImage: React.FC<ParolImageProps> = ({
  id,
  alt = `Filipino Parol Lantern ${id}`,
  className = '',
  style
}) => {
  const [hasError, setHasError] = React.useState(false);

  if (hasError) {
    return null;
  }

  return (
    <img
      src={`/images/lanterns/${id}.png`}
      alt={alt}
      className={`select-none pointer-events-none drop-shadow-xl ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        if (!target.src.endsWith(`/${id}.png`)) {
          target.src = `/${id}.png`;
        } else {
          setHasError(true);
        }
      }}
      style={style}
    />
  );
};

/**
 * HeroParolFraming
 * Positions lantern assets 1–5 around the edges and bottom portions of the Hero section,
 * leaving the central area open for headings, copy, and CTAs.
 */
export const HeroParolFraming: React.FC = () => {
  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden z-10"
      aria-hidden="true"
    >
      {/* ----------------- BOTTOM-LEFT CLUSTER ----------------- */}
      {/* Parol 1: Large vibrant mandala lantern overlapping bottom-left corner */}
      <div 
        className="absolute -bottom-16 -left-16 sm:-bottom-24 sm:-left-24 lg:-bottom-28 lg:-left-28 w-56 sm:w-80 lg:w-96 transition-transform duration-700 hover:scale-105"
        style={{
          filter: 'drop-shadow(0 15px 30px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 40px rgba(246, 190, 38, 0.25))'
        }}
      >
        <ParolImage id="1" alt="Giant Parol Mandala" className="w-full h-auto animate-gentle-float-slow" />
      </div>

      {/* Parol 4: Starburst lantern offset higher on the left edge to create depth */}
      <div 
        className="absolute bottom-28 left-2 sm:bottom-36 sm:left-24 lg:bottom-44 lg:left-40 w-28 sm:w-44 lg:w-52 opacity-95"
        style={{
          filter: 'drop-shadow(0 12px 25px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 25px rgba(227, 38, 54, 0.3))'
        }}
      >
        <ParolImage id="4" alt="Starburst Parol" className="w-full h-auto animate-gentle-float-reverse" />
      </div>

      {/* ----------------- BOTTOM-CENTER ACCENT ----------------- */}
      {/* Parol 3: Floral Poinsettia lantern along the lower bottom edge */}
      <div 
        className="hidden md:block absolute -bottom-14 left-1/2 -translate-x-1/2 w-32 lg:w-40 opacity-85"
        style={{
          filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 20px rgba(220, 39, 48, 0.25))'
        }}
      >
        <ParolImage id="3" alt="Poinsettia Parol" className="w-full h-auto animate-gentle-pulse" />
      </div>

      {/* ----------------- BOTTOM-RIGHT CLUSTER ----------------- */}
      {/* Parol 2: Majestic 8-pointed star parol with finials overlapping bottom-right corner */}
      <div 
        className="absolute -bottom-16 -right-16 sm:-bottom-24 sm:-right-24 lg:-bottom-28 lg:-right-28 w-60 sm:w-84 lg:w-98 transition-transform duration-700 hover:scale-105"
        style={{
          filter: 'drop-shadow(0 15px 30px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 40px rgba(14, 77, 139, 0.3))'
        }}
      >
        <ParolImage id="2" alt="San Fernando Star Parol" className="w-full h-auto animate-gentle-float" />
      </div>

      {/* Parol 5: Kaleidoscope circular medallion parol offset higher on the right edge */}
      <div 
        className="absolute bottom-28 right-2 sm:bottom-36 sm:right-28 lg:bottom-44 lg:right-48 w-32 sm:w-48 lg:w-56 opacity-95"
        style={{
          filter: 'drop-shadow(0 12px 25px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 25px rgba(247, 191, 46, 0.3))'
        }}
      >
        <ParolImage id="5" alt="Kaleidoscope Parol" className="w-full h-auto animate-gentle-float-slow" />
      </div>

      {/* ----------------- TOP CORNER SUBTLE ACCENTS ----------------- */}
      {/* Top-right corner partial peek: adds balance to the frame without encroaching on text */}
      <div 
        className="hidden lg:block absolute -top-16 -right-16 w-44 opacity-60"
        style={{
          filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))'
        }}
      >
        <ParolImage id="5" alt="Framing Parol" className="w-full h-auto" />
      </div>

      {/* Top-left corner partial peek */}
      <div 
        className="hidden lg:block absolute -top-14 -left-14 w-36 opacity-50"
        style={{
          filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))'
        }}
      >
        <ParolImage id="3" alt="Framing Parol" className="w-full h-auto" />
      </div>

      {/* Warm atmospheric light glow from below the lanterns */}
      <div 
        className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#36040a]/80 via-[#36040a]/30 to-transparent pointer-events-none" 
      />
    </div>
  );
};

/**
 * SectionParolAccents
 * Reusable decorative framing for sections such as Festivals, and Storytelling banners.
 */
interface SectionParolAccentsProps {
  leftId?: ParolId;
  rightId?: ParolId;
}

export const SectionParolAccents: React.FC<SectionParolAccentsProps> = ({
  leftId = '1',
  rightId = '2'
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute -bottom-10 -left-10 w-36 sm:w-48 opacity-75">
        <ParolImage id={leftId} className="w-full h-auto" />
      </div>
      <div className="absolute -bottom-10 -right-10 w-36 sm:w-48 opacity-75">
        <ParolImage id={rightId} className="w-full h-auto" />
      </div>
    </div>
  );
};
