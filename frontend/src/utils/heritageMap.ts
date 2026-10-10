import type { HeritageSite } from '../types';
import { heritageImageUrl, HERITAGE_IMAGE_PLACEHOLDER } from './heritageImages';

// Shared vector shapes for map markers and the legend. Unknown categories stay neutral.
export const HERITAGE_MARKER_STYLES = {
  Churches: { color: '#7e1925', icon: 'church', paths: ['M12 2v6m-3-3h6M3 21V11l9-4 9 4v10H3Z', 'M9 21v-6h6v6M6 12v3m12-3v3'] },
  'Historical Buildings': { color: '#92400e', icon: 'building', paths: ['M4 21V3h16v18H4Z', 'M8 7h1m6 0h1M8 11h1m6 0h1M9 21v-6h6v6'] },
  Museums: { color: '#2d5a27', icon: 'museum', paths: ['m3 8 9-5 9 5H3Zm2 3v7m7-7v7m7-7v7M3 21h18M3 18h18'] },
  Monuments: { color: '#44413a', icon: 'monument', paths: ['m10 3-3 15h10L14 3h-4ZM5 21h14v-3H5v3Z'] },
  'Cultural Sites': { color: '#9b4500', icon: 'heritage-star', paths: ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z'] },
};

const neutralStyle = { color: '#574141', icon: 'pin', paths: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', 'M12 7v6'] };
export function heritageMarkerStyle(category: string) {
  return Object.hasOwn(HERITAGE_MARKER_STYLES, category)
    ? HERITAGE_MARKER_STYLES[category as keyof typeof HERITAGE_MARKER_STYLES]
    : neutralStyle;
}

export function escapeMapLabel(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

export function heritageMarkerHtml(site: Pick<HeritageSite, 'name' | 'category'> & Partial<Pick<HeritageSite, 'heroImage' | 'images'>>, selected: boolean) {
  const style = heritageMarkerStyle(site.category);
  const label = escapeMapLabel(site.name);
  const usableImage = (url?: string) => url?.trim() && url !== HERITAGE_IMAGE_PLACEHOLDER;
  const photo = usableImage(site.heroImage) ? site.heroImage
    : site.images?.find(image => image.isCover && usableImage(image.imageUrl))?.imageUrl
      || site.images?.find(image => usableImage(image.imageUrl))?.imageUrl;
  return `<div class="heritage-marker font-sans" data-selected="${selected}" data-category-icon="${style.icon}" style="--heritage-marker-color:${style.color}">
    <div class="heritage-marker-symbol">
      <img class="heritage-marker-photo" src="${escapeMapLabel(heritageImageUrl(photo))}" alt="" aria-hidden="true" width="${selected ? 56 : 44}" height="${selected ? 56 : 44}" loading="lazy" decoding="async" fetchpriority="low" />
    </div>
    <span class="heritage-marker-label" aria-hidden="true">${label}</span>
  </div>`;
}
