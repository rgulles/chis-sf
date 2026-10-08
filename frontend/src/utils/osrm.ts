import type { HeritageSite } from '../types';
import { hasUsableCoordinates } from './heritageCoordinates';

export interface RoadRoute { coordinates: [number, number][]; distance: number; duration: number }
export const ROAD_ROUTE_UNAVAILABLE = 'Road route is temporarily unavailable. Heritage stops are still shown on the map.';
const cache = new Map<string, Promise<RoadRoute>>();
let nextDemoRequestAt = 0;
export function routeKey(sites: HeritageSite[]): string {
  return sites.flatMap(site => hasUsableCoordinates(site.coordinates) ? [`${site.coordinates.lng},${site.coordinates.lat}`] : []).join(';');
}
export function clearRoadRouteCache() { cache.clear(); nextDemoRequestAt = 0; }
export function fetchRoadRoute(key: string, baseUrl = import.meta.env?.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org'): Promise<RoadRoute> {
  if (key.split(';').length < 2) return Promise.reject(new Error(ROAD_ROUTE_UNAVAILABLE));
  const base = baseUrl.replace(/\/+$/, '');
  const cacheKey = `${base}:${key}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;
  const request = (async () => {
    // Respect the public demo's one-request-per-second policy within this session.
    if (base === 'https://router.project-osrm.org') {
      const now = Date.now(), wait = Math.max(0, nextDemoRequestAt - now);
      nextDemoRequestAt = now + wait + 1000;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${base}/route/v1/driving/${key}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(ROAD_ROUTE_UNAVAILABLE);
      const data = await response.json();
      const route = data?.routes?.[0];
      const coordinates = route?.geometry?.coordinates;
      if (data.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(coordinates) || coordinates.length < 2
        || !coordinates.every(point => Array.isArray(point) && point.length === 2 && typeof point[0] === 'number' && typeof point[1] === 'number' && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)
        || typeof route.distance !== 'number' || !Number.isFinite(route.distance) || route.distance < 0
        || typeof route.duration !== 'number' || !Number.isFinite(route.duration) || route.duration < 0) throw new Error(ROAD_ROUTE_UNAVAILABLE);
      return { coordinates: coordinates as [number, number][], distance: route.distance, duration: route.duration };
    } catch { throw new Error(ROAD_ROUTE_UNAVAILABLE); }
    finally { clearTimeout(timer); }
  })();
  cache.set(cacheKey, request);
  request.catch(() => { if (cache.get(cacheKey) === request) cache.delete(cacheKey); });
  return request;
}
