import type { SyntheticEvent } from 'react';

export function AdminAvatar({ src, name = 'Admin', className = '' }: { src?: string | null; name?: string; className?: string }) {
  const fallback = '/images/default-avatar.svg';
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.getAttribute('src') !== fallback) image.src = fallback;
  };
  return <img src={src?.trim() || fallback} alt={`${name} profile`} width={40} height={40} className={className} referrerPolicy="no-referrer" onError={handleError} />;
}
