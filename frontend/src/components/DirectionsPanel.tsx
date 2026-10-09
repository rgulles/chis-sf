import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeritageSite } from '../types';
import { hasUsableCoordinates } from '../utils/heritageCoordinates';
import { fetchRoadRoute, formatDistance, formatDuration, stepInstruction, type RoadRoute } from '../utils/osrm';
import { currentRoutingLocation, currentLocationRouteKey, type RoutingPoint } from '../utils/routingLocation';
export default function DirectionsPanel({ site, onClose, onRouteChange }: { site: HeritageSite; onClose: () => void; onRouteChange?: (start: RoutingPoint | null, route: RoadRoute | null) => void }) {
  const [start, setStart] = useState<RoutingPoint | null>(null), [route, setRoute] = useState<RoadRoute | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, RoadRoute>());
  const dispose = useCallback(() => { generation.current++; controller.current?.abort(); cache.current.clear(); }, []);
  useEffect(() => () => { dispose(); }, [dispose]);
  useEffect(() => { onRouteChange?.(start, route); }, [start, route, onRouteChange]);
  const locate = async () => {
    const request = ++generation.current;
    controller.current?.abort(); setBusy(true); setError(''); setRoute(null); setStart(null);
    try {
      const point = await currentRoutingLocation();
      if (generation.current !== request) return;
      setStart(point);
      if (!hasUsableCoordinates(site.coordinates)) throw new Error('Destination coordinates are not currently listed.');
      const key = currentLocationRouteKey(point, site.coordinates);
      controller.current = new AbortController();
      const result = cache.current.get(key) || await fetchRoadRoute(key, undefined, controller.current.signal);
      if (generation.current !== request) return;
      cache.current.set(key, result); setRoute(result);
    } catch (failure) {
      if (generation.current === request) setError(failure instanceof Error && !failure.message.startsWith('Road route') ? failure.message : 'Road directions are temporarily unavailable.');
    } finally { if (generation.current === request) setBusy(false); }
  };
  return <section id="map-directions-panel" aria-labelledby="directions-title" className="map-directions-panel" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <header className="flex shrink-0 items-center justify-between border-b p-3 gap-3"><h2 id="directions-title" className="font-semibold">Directions to</h2><button id="close-directions-btn" aria-label="Close directions" className="min-h-11 px-3" onClick={onClose}>Close</button></header>
      {route && <div className="shrink-0 border-b p-3 text-sm" aria-label="Route estimates"><p>Distance: {formatDistance(route.distance)}</p><p>Estimated driving time: {formatDuration(route.duration)}</p></div>}
      <div className="min-h-0 overflow-y-auto p-4 space-y-4">
        <div><h3 className="font-editorial text-xl break-words">{site.name}</h3><p>{site.address || 'Destination address is not currently listed.'}</p></div>
        <button id="use-current-location" className="ui-button-primary w-full" disabled={busy || !hasUsableCoordinates(site.coordinates)} onClick={locate}>{busy ? 'Calculating route…' : 'USE MY CURRENT LOCATION'}</button>
        <p className="text-xs text-[#61564d]">Your location is used to calculate this route and is not saved by CHIS. The routing service receives your coordinates.</p>
        {!hasUsableCoordinates(site.coordinates) && <p role="status">Destination coordinates are not currently listed.</p>}
        {error && <p role="alert">{error}</p>}
        {route && <section aria-label="Driving route" className="space-y-2">
          <h3 className="font-semibold">Driving Route</h3><p>From: Your current location</p><p>Destination: {site.name}</p>
          <p className="text-xs">Route preview. Estimates do not include live traffic.</p>
          {!!route.steps?.length && <ol aria-label="Route preview steps" tabIndex={0} className="max-h-36 sm:max-h-60 overflow-y-auto overscroll-contain list-decimal pl-6 space-y-2 break-words">{route.steps.map((step, index) => <li key={index}>{stepInstruction(step, site.name)}</li>)}</ol>}
        </section>}
      </div>
  </section>;
}
