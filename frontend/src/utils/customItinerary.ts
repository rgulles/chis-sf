import type { HeritageSite } from '../types';

export const CUSTOM_ITINERARY_KEY = 'sf_custom_itinerary';

export function readCustomItinerary(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CUSTOM_ITINERARY_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && /^[1-9]\d*$/.test(id)))];
  } catch { return []; }
}

export function resolveCustomItinerary(ids: string[], sites: HeritageSite[]): HeritageSite[] {
  const active = new Map(sites.filter(site => site.status === 'active').map(site => [site.id, site]));
  return [...new Set(ids)].flatMap(id => active.has(id) ? [active.get(id)!] : []);
}

export function moveItineraryStop(ids: string[], index: number, direction: -1 | 1): string[] {
  const result = [...ids], destination = index + direction;
  if (index >= 0 && index < result.length && destination >= 0 && destination < result.length) {
    [result[index], result[destination]] = [result[destination], result[index]];
  }
  return result;
}
