import React, { useState } from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fallbackSrc = '/images/sites/cathedral-hero.jpg',
  alt = '',
  className = '',
  onError,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(src);
  const [hasError, setHasError] = useState(false);

  // Update if src prop changes
  React.useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
    if (onError) {
      onError(e);
    }
  };

  return (
    <img
      src={imgSrc || fallbackSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={handleError}
      {...props}
    />
  );
};
