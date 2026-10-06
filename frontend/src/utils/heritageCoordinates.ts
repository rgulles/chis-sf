import type { HeritageSite } from '../types';

export function hasUsableCoordinates(
  coordinates: HeritageSite['coordinates'],
): coordinates is NonNullable<HeritageSite['coordinates']> {
  return coordinates != null
    && Number.isFinite(coordinates.lat) && coordinates.lat >= -90 && coordinates.lat <= 90
    && Number.isFinite(coordinates.lng) && coordinates.lng >= -180 && coordinates.lng <= 180;
}
