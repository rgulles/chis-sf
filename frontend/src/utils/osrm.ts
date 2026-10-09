import type { HeritageSite } from '../types';
import { hasUsableCoordinates } from './heritageCoordinates';

export interface RouteStep { name: string; distance: number; maneuver: { type: string; modifier?: string } }
export interface RoadRoute { coordinates: [number, number][]; distance: number; duration: number; steps?: RouteStep[] }
export function formatDistance(meters: number): string { return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`; }
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}
export function stepInstruction(step: RouteStep, destination: string): string {
  const { type, modifier } = step.maneuver;
  if (type === 'arrive') return `Arrive at ${destination}`;
  const direction = /^(left|right|slight left|slight right|sharp left|sharp right|straight|uturn)$/.test(modifier || '') ? modifier : '';
  if (step.name && type === 'depart') return `Head${direction ? ` ${direction}` : ''} on ${step.name}`;
  if (step.name && type === 'turn' && direction) return `Turn ${direction} onto ${step.name}`;
  return `Continue${step.name ? ` on ${step.name}` : ''} for ${formatDistance(step.distance)}`;
}
export const ROAD_ROUTE_UNAVAILABLE = 'Road route is temporarily unavailable. Heritage stops are still shown on the map.';
const cache = new Map<string, Promise<RoadRoute>>();
let nextDemoRequestAt = 0;
export function routeKey(sites: HeritageSite[]): string {
  return sites.flatMap(site => hasUsableCoordinates(site.coordinates) ? [`${site.coordinates.lng},${site.coordinates.lat}`] : []).join(';');
}
export function clearRoadRouteCache() { cache.clear(); nextDemoRequestAt = 0; }
export function fetchRoadRoute(key: string, baseUrl = import.meta.env?.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org', signal?: AbortSignal): Promise<RoadRoute> {
  if (key.split(';').length < 2) return Promise.reject(new Error(ROAD_ROUTE_UNAVAILABLE));
  const base = baseUrl.replace(/\/+$/, '');
  const cacheKey = `${base}:${key}`;
  // Location-based requests belong to the map route-mode lifetime, never the session-wide itinerary cache.
  const existing = signal ? undefined : cache.get(cacheKey);
  if (existing) return existing;
  const request = (async () => {
    // Respect the public demo's one-request-per-second policy within this session.
    if (base === 'https://router.project-osrm.org') {
      const now = Date.now(), wait = Math.max(0, nextDemoRequestAt - now);
      nextDemoRequestAt = now + wait + 1000;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${base}/route/v1/driving/${key}?overview=full&geometries=geojson&steps=true`, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(ROAD_ROUTE_UNAVAILABLE);
      const data = await response.json();
      const route = data?.routes?.[0];
      const coordinates = route?.geometry?.coordinates;
      if (data.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(coordinates) || coordinates.length < 2
        || !coordinates.every(point => Array.isArray(point) && point.length === 2 && typeof point[0] === 'number' && typeof point[1] === 'number' && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)
        || typeof route.distance !== 'number' || !Number.isFinite(route.distance) || route.distance < 0
        || typeof route.duration !== 'number' || !Number.isFinite(route.duration) || route.duration < 0) throw new Error(ROAD_ROUTE_UNAVAILABLE);
      const steps: RouteStep[] = (Array.isArray(route.legs) ? route.legs : []).flatMap((leg: { steps?: RouteStep[] }) => Array.isArray(leg?.steps) ? leg.steps : [])
        .filter((step: RouteStep) => Number.isFinite(step?.distance) && step.distance >= 0 && typeof step.maneuver?.type === 'string')
        .map((step: RouteStep) => ({ ...step, name: typeof step.name === 'string' ? step.name : '' }));
      return { coordinates: coordinates as [number, number][], distance: route.distance, duration: route.duration, steps };
    } catch { throw new Error(ROAD_ROUTE_UNAVAILABLE); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  })();
  if (!signal) cache.set(cacheKey, request);
  request.catch(() => { if (cache.get(cacheKey) === request) cache.delete(cacheKey); });
  return request;
}
