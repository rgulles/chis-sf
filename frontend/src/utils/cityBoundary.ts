// Geographic reference data only. Heritage content continues to come from Laravel.
export const CITY_BOUNDARY_URL = '/data/san-fernando-pampanga-boundary.geojson';
export type MapPoint = [number, number];
export type CityBounds = [MapPoint, MapPoint];
export const FALLBACK_CITY_CENTER: MapPoint = [15.07, 120.68];
export const FALLBACK_CITY_BOUNDS: CityBounds = [[14.99, 120.60], [15.15, 120.76]];

export interface CityBoundary {
  polygons: MapPoint[][][];
  mask: MapPoint[][];
  bounds: CityBounds;
  navigationBounds: CityBounds;
}

export function parseCityBoundary(value: unknown): CityBoundary {
  const collection = value as { type?: string; features?: { properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } }[] };
  if (collection?.type !== 'FeatureCollection' || collection.features?.length !== 1) throw new Error('Expected one city boundary');
  const { properties, geometry } = collection.features[0];
  if (properties?.adm3_psgc !== 305416000 || properties.adm2_psgc !== 305400000 || properties.adm1_psgc !== 300000000 || properties.adm3_en !== 'City of San Fernando') {
    throw new Error('Incorrect city boundary identity');
  }
  const source = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  if (!Array.isArray(source) || !source.length) throw new Error('Expected Polygon or MultiPolygon');
  const polygons: MapPoint[][][] = source.map(polygon => {
    if (!Array.isArray(polygon) || !polygon.length) throw new Error('Missing polygon rings');
    return polygon.map(ring => {
      if (!Array.isArray(ring) || ring.length < 4) throw new Error('Invalid boundary ring');
      const points: MapPoint[] = ring.map(position => {
        if (!Array.isArray(position) || position.length < 2 || !Number.isFinite(position[0]) || !Number.isFinite(position[1]) || position[0] < 120.4 || position[0] > 120.9 || position[1] < 14.8 || position[1] > 15.3) throw new Error('Invalid city coordinates');
        return [position[1], position[0]];
      });
      const first = points[0], last = points[points.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('Unclosed boundary ring');
      return points;
    });
  });
  const rings = polygons.flat();
  const points = rings.flat();
  const south = Math.min(...points.map(p => p[0])), north = Math.max(...points.map(p => p[0]));
  const west = Math.min(...points.map(p => p[1])), east = Math.max(...points.map(p => p[1]));
  if (south === north || west === east) throw new Error('Empty boundary extent');
  const latPadding = (north - south) * 0.2, lngPadding = (east - west) * 0.2;
  return {
    polygons,
    // Even-odd fill excludes all city exteriors and restores any interior holes.
    mask: [[[-85, -180], [-85, 180], [85, 180], [85, -180], [-85, -180]], ...rings],
    bounds: [[south, west], [north, east]],
    navigationBounds: [[south - latPadding, west - lngPadding], [north + latPadding, east + lngPadding]],
  };
}

export async function loadCityBoundary(): Promise<CityBoundary | null> {
  try {
    const response = await fetch(CITY_BOUNDARY_URL);
    if (!response.ok) return null;
    return parseCityBoundary(await response.json());
  } catch {
    return null;
  }
}
