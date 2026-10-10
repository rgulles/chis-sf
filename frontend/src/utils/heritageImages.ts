import type { SyntheticEvent } from 'react';

export const HERITAGE_IMAGE_PLACEHOLDER = '/images/heritage-placeholder.svg';

export function heritageImageUrl(path?: string | null, backendBase = import.meta.env?.VITE_STORAGE_BASE_URL || ''): string {
  const value = (path || '').trim();
  if (!value) return HERITAGE_IMAGE_PLACEHOLDER;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('/images/')) return value;
  const base = backendBase.trim().replace(/\/+$/, '').replace(/(?:\/api)+$/, '');
  const relative = value.replace(/^\/+/, '').replace(/^storage\//, '');
  return `${base}/storage/${relative}`;
}

export function handleHeritageImageError(event: Pick<SyntheticEvent<HTMLImageElement>, 'currentTarget'>): void {
  const img = event.currentTarget;
  img.onerror = null;
  if (img.getAttribute('src') !== HERITAGE_IMAGE_PLACEHOLDER) img.src = HERITAGE_IMAGE_PLACEHOLDER;
}
