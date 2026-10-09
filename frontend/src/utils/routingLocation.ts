export type RoutingPoint = { lat: number; lng: number };
export function locationError(code: number): string {
  if (code === 1) return 'Location permission was denied. Allow location access in your browser to calculate a route.';
  if (code === 3) return 'Location request timed out. Please try again.';
  return 'Your current location is unavailable. Please try again.';
}
export function currentRoutingLocation(): Promise<RoutingPoint> {
  if (!window.isSecureContext) return Promise.reject(new Error('Current location requires HTTPS or localhost.'));
  if (!navigator.geolocation) return Promise.reject(new Error('This browser does not support location access.'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(position => {
    const { latitude: lat, longitude: lng } = position.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) reject(new Error(locationError(2)));
    else resolve({ lat, lng });
  }, error => reject(new Error(locationError(error.code))), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }));
}
export function currentLocationRouteKey(start: RoutingPoint, destination: RoutingPoint): string {
  return `${start.lng.toFixed(5)},${start.lat.toFixed(5)};${destination.lng},${destination.lat}`;
}
