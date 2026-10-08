import type { HeritageSite } from '../types';

/** Build speech from API description/history fields, never prototype audio metadata. */
export function heritageSpeechText(site: Pick<HeritageSite, 'name' | 'shortDescription' | 'fullDescription' | 'story'>): string {
  const clean = (value: string | undefined) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  const meaningful = (value: string) => /[\p{L}\p{N}]/u.test(value) && !/^no (?:history recorded|description available)[.!]?$/i.test(value);
  const description = clean(site.shortDescription) || clean(site.fullDescription);
  const content = [description, clean(site.story)].filter(meaningful);
  if (!content.length) return '';
  const seen = new Set<string>();
  return [clean(site.name), ...content].filter(Boolean).filter(value => {
    const key = value.replace(/[.!?]+$/, '').toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(value => value.replace(/\.+$/, '')).join('. ');
}
