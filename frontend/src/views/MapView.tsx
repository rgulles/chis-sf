import { HERITAGE_MARKER_STYLES, heritageMarkerHtml } from '../utils/heritageMap';
import { handleHeritageImageError, HERITAGE_IMAGE_PLACEHOLDER } from '../utils/heritageImages';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './heritageMap.css';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Navigation,
  List,
  Map as MapIcon,
  Compass,
  ChevronRight,
  Bookmark,
  Lock,
  Crosshair,
  Info,
  X,
  Layers,
  ChevronDown,
  ListFilter,
  Filter,
  Plus,
  Minus
} from 'lucide-react';
import type { HeritageSite, CategoryType } from '../types';
import { HERITAGE_CATEGORIES } from '../data/heritageCategories';
import { hasUsableCoordinates } from '../utils/heritageCoordinates';
import { loadCityBoundary, FALLBACK_CITY_CENTER, FALLBACK_CITY_BOUNDS, type CityBounds } from '../utils/cityBoundary';

interface MapViewProps {
  sites: HeritageSite[];
  onSelectSite: (site: HeritageSite) => void;
  onPlanRoute: () => void;
  savedSiteIds: string[];
  onToggleSaveSite: (siteId: string) => void;
  initialViewMode?: 'map' | 'list';
  selectedCategory?: CategoryType | 'All';
  onCategoryChange?: (category: CategoryType | 'All') => void;
}

function fitCity(map: L.Map, bounds: CityBounds) {
  // Match the minimum zoom to the viewport, including narrow mobile screens.
  const zoom = map.getBoundsZoom(bounds, false, L.point(24, 24));
  map.setMinZoom(Math.max(10, Math.min(13, zoom)));
  map.fitBounds(bounds, { padding: [12, 12], maxZoom: 14, animate: false });
}

type MapTileStyle = 'osm' | 'satellite';

export const MapView: React.FC<MapViewProps> = ({
  sites,
  onSelectSite,
  savedSiteIds,
  onToggleSaveSite,
  initialViewMode = 'list',
  selectedCategory: propCategory,
  onCategoryChange: propOnCategoryChange
}) => {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(sites[0]?.id || '');
  const [viewMode, setViewMode] = useState<'map' | 'list'>(initialViewMode);
  const [internalCategory, setInternalCategory] = useState<CategoryType | 'All'>('All');

  // Progressive Disclosure states
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMapCardDismissed, setIsMapCardDismissed] = useState(false);

  // Map Tile & Layer States
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('osm');
  const [showCityBoundary, setShowCityBoundary] = useState(true);

  // Sync category with prop if provided
  const activeCategory = propCategory !== undefined ? propCategory : internalCategory;
  const handleCategorySelect = (cat: CategoryType | 'All') => {
    if (propOnCategoryChange) {
      propOnCategoryChange(cat);
    }
    setInternalCategory(cat);
  };

  // Reconcile parent navigation before rendering to avoid a stale view.
  const [previousInitialViewMode, setPreviousInitialViewMode] = useState(initialViewMode);
  if (previousInitialViewMode !== initialViewMode) {
    setPreviousInitialViewMode(initialViewMode);
    setViewMode(initialViewMode);
  }

  // Map DOM reference and Leaflet instance
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);
  const outsideFocusLayerRef = useRef<L.Polygon | null>(null);
  const cityBoundsRef = useRef<CityBounds>(FALLBACK_CITY_BOUNDS);
  const needsInitialFitRef = useRef(true);
  const visibleMapRef = useRef(initialViewMode === 'map');
  const boundaryVisibleRef = useRef(true);
  useEffect(() => { visibleMapRef.current = viewMode === 'map'; }, [viewMode]);
  useEffect(() => { boundaryVisibleRef.current = showCityBoundary; }, [showCityBoundary]);

  // Filtered & Sorted Sites for Directory & Map (Search bar removed per user request)
  const filteredAndSortedSites = useMemo(() => {
    return sites
      .filter((site) => {
        const matchesCategory = activeCategory === 'All' || site.category === activeCategory;
        return site.status === 'active' && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, activeCategory]);

  const activeSite = filteredAndSortedSites.find((s) => s.id === selectedSiteId);

  // Clear filtered or removed selections before rendering.
  if (selectedSiteId && !activeSite) setSelectedSiteId('');

  const formatCategoryLabel = (category: HeritageSite['category']) => {
    switch (category) {
      case 'Churches':
        return 'Church';
      case 'Monuments':
        return 'Monument';
      case 'Museums':
        return 'Museum';
      case 'Historical Buildings':
        return 'Historical Building';
      case 'Cultural Sites':
        return 'Cultural Landmark';
      default:
        return category;
    }
  };

  const createSiteIcon = (site: HeritageSite, isSelected: boolean) => L.divIcon({
    className: 'heritage-custom-marker',
    html: heritageMarkerHtml(site, isSelected),
    iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20]
  });

  // Initialize the real Leaflet map focused to San Fernando
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // The fallback keeps the map usable while the local geographic asset loads.
    const map = L.map(mapContainerRef.current, {
      center: FALLBACK_CITY_CENTER,
      zoom: 12,
      minZoom: 10,
      maxZoom: 18,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBounds: FALLBACK_CITY_BOUNDS,
      maxBoundsViscosity: 0.75,
      zoomControl: false,
      attributionControl: true
    });

    mapInstanceRef.current = map;
    // Update presentation without rebuilding markers or changing geographic positions.
    const updateLabelZoom = () => mapContainerRef.current?.classList?.toggle('heritage-map-close-zoom', (map.getZoom?.() ?? 12) >= 15);
    map.on?.('zoomend', updateLabelZoom);
    updateLabelZoom();
    let cancelled = false;
    void loadCityBoundary().then(boundary => {
      if (cancelled || !boundary) return;
      cityBoundsRef.current = boundary.bounds;
      map.setMaxBounds(boundary.navigationBounds);
      outsideFocusLayerRef.current = L.polygon(boundary.mask, {
        stroke: false, fillColor: '#413b38', fillOpacity: 0.24,
        fillRule: 'evenodd', interactive: false,
      });
      boundaryLayerRef.current = L.polygon(boundary.polygons, {
        color: '#7e1925', weight: 3, opacity: 0.9, fill: false, interactive: false,
      });
      if (boundaryVisibleRef.current) {
        outsideFocusLayerRef.current.addTo(map);
        boundaryLayerRef.current.addTo(map);
      }
      needsInitialFitRef.current = true;
      if (visibleMapRef.current) {
        map.invalidateSize();
        fitCity(map, boundary.bounds);
        needsInitialFitRef.current = false;
      }
    });

    return () => {
      cancelled = true;
      map.off?.('zoomend', updateLabelZoom);
      map.remove();
      mapInstanceRef.current = null;
      boundaryLayerRef.current = null;
      outsideFocusLayerRef.current = null;
    };
  }, []);

  // Update Tile Layer when tileStyle state changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = '';
    let attribution = '';

    if (tileStyle === 'osm') {
      url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> • City of San Fernando';
    } else if (tileStyle === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    }

    const newLayer = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current = newLayer;
  }, [tileStyle]);

  // Toggle City Boundary Overlay
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !boundaryLayerRef.current) return;
    if (showCityBoundary) {
      map.addLayer(boundaryLayerRef.current);
      if (outsideFocusLayerRef.current) map.addLayer(outsideFocusLayerRef.current);
    } else {
      map.removeLayer(boundaryLayerRef.current);
      if (outsideFocusLayerRef.current) map.removeLayer(outsideFocusLayerRef.current);
    }
  }, [showCityBoundary]);

  // Update Site Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    (Object.values(markersRef.current) as L.Marker[]).forEach((marker) => marker.remove());
    markersRef.current = {};

    // Render filtered markers
    filteredAndSortedSites.forEach((site) => {
      if (!hasUsableCoordinates(site.coordinates)) return;
      const { lat, lng } = site.coordinates;
      const isSelected = site.id === selectedSiteId;
      const customIcon = createSiteIcon(site, isSelected);

      const marker = L.marker([lat, lng], {
        icon: customIcon,
        title: site.name,
        alt: `${site.name}, ${site.category}`,
        keyboard: true,
        riseOnHover: true,
        riseOffset: 600,
        zIndexOffset: isSelected ? 1000 : 0
      }).addTo(map);
      const element = marker.getElement?.();
      element?.setAttribute('aria-pressed', String(isSelected));
      element?.setAttribute('aria-label', `${site.name}, ${site.category}`);
      element?.addEventListener('focus', () => marker.setZIndexOffset(isSelected ? 1000 : 600));
      element?.addEventListener('blur', () => marker.setZIndexOffset(isSelected ? 1000 : 0));

      // Clicking marker selects site and brings up the in-map card in the lower left
      marker.on('click', () => {
        setSelectedSiteId(site.id);
        setIsMapCardDismissed(false);
        map.panTo([lat, lng], {
          animate: true,
          duration: 0.6
        });
      });

      markersRef.current[site.id] = marker;
    });
  }, [filteredAndSortedSites, selectedSiteId]);

  // Recalculate Leaflet size when toggling to Map View
  useEffect(() => {
    if (viewMode === 'map' && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        map.invalidateSize();
        if (needsInitialFitRef.current) {
          fitCity(map, cityBoundsRef.current);
          needsInitialFitRef.current = false;
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  const handleSelectSiteFromCardOrChip = (site: HeritageSite) => {
    setSelectedSiteId(site.id);
    setIsMapCardDismissed(false);
    const map = mapInstanceRef.current;
    if (map && hasUsableCoordinates(site.coordinates)) {
      map.setView([site.coordinates.lat, site.coordinates.lng], 16, {
        animate: true,
        duration: 0.8
      });
    }
  };

  const handleRecenterSanFernando = () => {
    const map = mapInstanceRef.current;
    if (map) {
      fitCity(map, cityBoundsRef.current);
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div id="explore-map-combined-page" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28 font-outfit">
      {/* Header Banner - Editorial & Modern */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#e8dfd5] pb-6"
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-outfit text-xs font-bold uppercase tracking-[0.18em] text-[#7e1925]">
              Heritage Directory & Interactive Map
            </span>
            <span className="font-outfit text-xs text-[#8a7171]">• City of San Fernando, Pampanga</span>
          </div>
          <h1 id="explore-map-header-title" className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b19] tracking-tight leading-tight">
            Explore San Fernando Heritage
          </h1>
          <p className="font-outfit text-base text-[#574141] max-w-3xl leading-relaxed font-normal">
            Discover heritage sites across the City of San Fernando, Pampanga.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* List / Map View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-[#e8dfd5] bg-[#faf2ee] p-1 shadow-xs">
            <button
              id="toggle-map-view"
              onClick={() => {
                setViewMode('map');
                setIsMapCardDismissed(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-[#7e1925] text-white shadow-xs'
                  : 'text-[#574141] hover:text-[#1e1b19] hover:bg-white/60'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Map View</span>
            </button>
            <button
              id="toggle-list-view"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#7e1925] text-white shadow-xs'
                  : 'text-[#574141] hover:text-[#1e1b19] hover:bg-white/60'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Directory List ({filteredAndSortedSites.length})</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* 1. DIRECTORY LIST VIEW (Explore Heritage Content & Cards)                  */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-8">
          {/* Archival Curation Notice */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start gap-3 rounded-2xl bg-[#faf2ee] border border-[#e8dfd5] p-4 text-sm font-outfit text-[#1e1b19] shadow-xs"
          >
            <Info className="w-5 h-5 flex-shrink-0 text-[#7e1925] mt-0.5" />
            <p className="leading-relaxed">
              Browse the current heritage catalogue. Open a site for its recorded history and available visitor information.
            </p>
          </motion.div>

          {/* Filter Controls Container (Search bar removed per user request) */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5 rounded-2xl border border-[#e8dfd5] bg-white p-5 sm:p-6 shadow-xs"
          >
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
              {HERITAGE_CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    aria-pressed={activeCategory === cat}
                    id={`filter-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => handleCategorySelect(cat as CategoryType | 'All')}
                    className={`flex-shrink-0 rounded-full px-4 py-2 font-outfit text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#7e1925] text-white border border-[#7e1925] shadow-xs'
                        : 'border border-[#e8dfd5] bg-[#fbf6f1] text-[#1e1b19] hover:border-[#7e1925] hover:bg-white'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Map View Switch */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#e8dfd5] font-outfit text-sm">
              <div className="flex items-center gap-5">


                <button
                  onClick={() => {
                    setViewMode('map');
                    setIsMapCardDismissed(false);
                  }}
                  className="text-xs font-semibold text-[#7e1925] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Switch to Map</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Results Count Bar */}
          <div className="flex items-center justify-between font-outfit text-xs font-semibold text-[#574141] px-1 uppercase tracking-wider">
            <span>Showing <strong>{filteredAndSortedSites.length}</strong> heritage destinations</span>
            {activeCategory !== 'All' && (
              <span className="text-[#7e1925]">Category: {activeCategory}</span>
            )}
          </div>

          {/* Heritage Cards Grid with Staggered Scroll Animation */}
          {filteredAndSortedSites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
              {filteredAndSortedSites.map((site, idx) => {
                const isSaved = savedSiteIds.includes(site.id);
                return (
                  <motion.div
                    key={site.id}
                    id={`heritage-card-${site.id}`}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.55, delay: (idx % 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="group relative flex flex-col justify-between rounded-2xl border border-[#e8dfd5] bg-white hover:border-[#7e1925]/60 hover:shadow-[0_16px_36px_-10px_rgba(126,25,37,0.14)] transition-all duration-300 overflow-hidden"
                  >
                    <div>
                      {/* 16:10 Image container */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#faf2ee]">
                        <img
                          src={site.heroImage}
                          alt={site.name}
                          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={handleHeritageImageError}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                        {/* Category Badge with Singular Label */}
                        <span className="absolute top-3.5 left-3.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 font-outfit text-[11px] font-bold text-[#7e1925] border border-white/40 shadow-xs uppercase tracking-wider">
                          {formatCategoryLabel(site.category)}
                        </span>

                        {/* Bookmark Button */}
                        <button
                          id={`save-btn-${site.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSaveSite(site.id);
                          }}
                          className={`absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all cursor-pointer shadow-xs ${
                            isSaved ? 'bg-[#7e1925] text-white' : 'bg-black/50 text-white hover:bg-black/75 border border-white/20'
                          }`}
                          title={isSaved ? 'Remove from saved' : 'Save site'}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-white' : ''}`} />
                        </button>

                        {/* Known Date */}
                        <div className="absolute bottom-3 left-3.5 flex items-center gap-2 font-outfit text-xs font-semibold text-white">
                          {site.yearBuilt && <span className="rounded-md bg-black/65 backdrop-blur-xs px-2.5 py-0.5 border border-white/20">
                            {site.yearBuilt}
                          </span>}
                        </div>

                        {/* Audio guide badge */}

                      </div>

                      {/* Body Content */}
                      <div className="p-5 sm:p-6">
                        {site.nativeName && site.nativeName !== site.name && (
                          <span className="font-outfit text-xs font-medium text-[#b45309] block mb-1">
                            {site.nativeName}
                          </span>
                        )}
                        <h3 className="font-outfit text-lg sm:text-xl font-bold text-[#1e1b19] group-hover:text-[#7e1925] transition-colors leading-snug tracking-tight">
                          {site.name}
                        </h3>
                        <div className="mt-1.5 flex items-center gap-1.5 font-outfit text-xs text-[#574141]">
                          <MapPin className="h-3.5 w-3.5 text-[#7e1925] flex-shrink-0" />
                          <span className="truncate">{site.address}</span>
                        </div>
                        <p className="mt-3 font-outfit text-sm text-[#574141] line-clamp-3 leading-relaxed">
                          {site.shortDescription}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-5 sm:p-6 pt-0">
                      <div className="border-t border-[#e8dfd5] pt-4 flex items-center justify-between">

                        <button
                          id={`view-details-${site.id}`}
                          onClick={() => onSelectSite(site)}
                          className="font-outfit inline-flex items-center gap-1.5 rounded-xl bg-[#7e1925] hover:bg-[#580b14] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-xs hover:scale-[1.02] cursor-pointer"
                        >
                          <span>Explore</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-[#e8dfd5] p-12 text-center bg-white space-y-3 font-outfit"
            >
              <p className="text-lg font-bold text-[#1e1b19]">No heritage sites matched your criteria</p>
              <p className="text-sm text-[#574141] max-w-sm mx-auto">
                Try switching category filters to discover more historical sites.
              </p>
              <button
                onClick={() => {
                  handleCategorySelect('All');
                }}
                className="rounded-xl bg-[#7e1925] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#580b14] transition-all cursor-pointer shadow-xs"
              >
                Reset Filters
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. INTERACTIVE MAP VIEW (Full-Width Map Only + In-Map Controls & Card)    */}
      {/* ========================================================================= */}
      <div className={viewMode === 'map' ? 'block space-y-4' : 'hidden'} onKeyDown={event => {
        if (event.key === 'Escape') {
          setIsLayersOpen(false);
          setIsLegendOpen(false);
          setIsFilterOpen(false);
        }
      }}>
        {/* FULL-WIDTH MAP CANVAS */}
        <div className="relative pt-32 sm:pt-0 h-[680px] sm:h-[680px] lg:h-[750px] w-full rounded-2xl border border-[#e8dfd5] bg-[#faf2ee] overflow-hidden shadow-xs">
          {/* Leaflet Map Target Div */}
          <div
            id="san-fernando-real-map"
            ref={mapContainerRef}
            className="h-full w-full select-none"
            aria-label="Heritage map focused on San Fernando, Pampanga"
          />

          {/* ===================================================================== */}
          {/* Zoom, recenter, layers and legend; separate filter row on mobile. */}
          {/* Controls: [+ and -] [Center City] [Style] [Legend]                    */}
          {/* All logo/icon only, with collapsible popovers                         */}
          {/* ===================================================================== */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-row items-center gap-2">
            {/* Zoom Controls (+ and -) */}
            <div className="flex flex-row items-center rounded-xl bg-white/95 backdrop-blur-md border border-[#e8dfd5] shadow-sm overflow-hidden">
              <button
                id="map-zoom-in-btn"
                onClick={handleZoomIn}
                className="p-3 text-[#1e1b19] hover:bg-[#faf2ee] hover:text-[#7e1925] transition-colors cursor-pointer"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-[#e8dfd5]" />
              <button
                id="map-zoom-out-btn"
                onClick={handleZoomOut}
                className="p-3 text-[#1e1b19] hover:bg-[#faf2ee] hover:text-[#7e1925] transition-colors cursor-pointer"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>

            {/* Center City (Icon Only) */}
            <button
              id="recenter-san-fernando-btn"
              onClick={handleRecenterSanFernando}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 backdrop-blur-md text-[#7e1925] border border-[#e8dfd5] hover:bg-white hover:border-[#7e1925] transition-all shadow-sm cursor-pointer"
              title="Center City"
              aria-label="Center City"
            >
              <Crosshair className="w-4 h-4" />
            </button>

            {/* Style (Collapse - Icon Only) */}
            <div className="static sm:relative">
              <button
                id="toggle-layers-disclosure-btn"
                aria-expanded={isLayersOpen}
                onClick={() => {
                  setIsLayersOpen(!isLayersOpen);
                  setIsLegendOpen(false);
                  setIsFilterOpen(false);
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all shadow-sm cursor-pointer ${
                  isLayersOpen
                    ? 'bg-[#7e1925] text-white border-[#7e1925]'
                    : 'bg-white/95 backdrop-blur-md text-[#1e1b19] border-[#e8dfd5] hover:bg-white hover:border-[#7e1925]'
                }`}
                title="Map Style"
                aria-label="Map Style"
              >
                <Layers className="w-4 h-4" />
              </button>

              {/* Style Popover: OpenStreetMap, Satellite */}
              <AnimatePresence>
                {isLayersOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 sm:left-auto sm:right-0 top-28 sm:top-12 w-52 rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md p-3 font-outfit text-xs shadow-2xl space-y-2.5 z-[1010]"
                  >
                    <div className="flex items-center justify-between font-bold text-[#1e1b19] pb-1 border-b border-[#e8dfd5]">
                      <span className="text-[10px] uppercase tracking-wider text-[#8a7171]">Map Style</span>
                      <button
                        aria-label="Close map styles"
                        onClick={() => setIsLayersOpen(false)}
                        className="text-[#8a7171] hover:text-[#1e1b19] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#faf2ee] p-1 border border-[#e8dfd5]">
                      <button
                        aria-pressed={tileStyle === 'osm'}
                        onClick={() => setTileStyle('osm')}
                        className={`rounded-lg py-1.5 text-center font-bold text-[11px] transition-colors cursor-pointer ${
                          tileStyle === 'osm' ? 'bg-[#7e1925] text-white shadow-xs' : 'text-[#574141] hover:text-[#1e1b19]'
                        }`}
                        title="OpenStreetMap"
                      >
                        OSM
                      </button>
                      <button
                        aria-pressed={tileStyle === 'satellite'}
                        onClick={() => setTileStyle('satellite')}
                        className={`rounded-lg py-1.5 text-center font-bold text-[11px] transition-colors cursor-pointer ${
                          tileStyle === 'satellite' ? 'bg-[#7e1925] text-white shadow-xs' : 'text-[#574141] hover:text-[#1e1b19]'
                        }`}
                        title="Satellite photography"
                      >
                        Satellite
                      </button>
                    </div>

                    <div className="border-t border-[#e8dfd5] pt-2 space-y-1.5">
                      <span className="text-[10px] font-bold text-[#8a7171] uppercase tracking-wider block">
                        Overlays
                      </span>

                      <label className="flex items-center justify-between cursor-pointer select-none py-0.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1e1b19]">
                          <Lock className="w-3.5 h-3.5 text-[#7e1925]" />
                          City boundary and outside dimming
                        </span>
                        <input
                          type="checkbox"
                          checked={showCityBoundary}
                          onChange={(e) => setShowCityBoundary(e.target.checked)}
                          className="h-3.5 w-3.5 rounded text-[#7e1925] accent-[#7e1925] cursor-pointer"
                        />
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Legend (Collapse - Icon Only) */}
            <div className="static sm:relative">
              <button
                id="toggle-legend-disclosure-btn"
                aria-expanded={isLegendOpen}
                onClick={() => {
                  setIsLegendOpen(!isLegendOpen);
                  setIsLayersOpen(false);
                  setIsFilterOpen(false);
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all shadow-sm cursor-pointer ${
                  isLegendOpen
                    ? 'bg-[#7e1925] text-white border-[#7e1925]'
                    : 'bg-white/95 backdrop-blur-md text-[#1e1b19] border-[#e8dfd5] hover:bg-white hover:border-[#7e1925]'
                }`}
                title="Map Legend"
                aria-label="Map Legend"
              >
                <ListFilter className="w-4 h-4" />
              </button>

              {/* Legend Popover */}
              <AnimatePresence>
                {isLegendOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 sm:left-auto sm:right-0 top-28 sm:top-12 w-52 max-h-60 sm:max-h-none overflow-y-auto rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md p-3 font-outfit text-xs space-y-1 shadow-2xl z-[1010]"
                  >
                    <div className="flex items-center justify-between font-bold text-[#1e1b19] pb-1.5 border-b border-[#e8dfd5]">
                      <span className="text-[10px] uppercase tracking-wider text-[#8a7171]">Legend</span>
                      <button
                        aria-label="Close legend"
                        onClick={() => setIsLegendOpen(false)}
                        className="text-[#8a7171] hover:text-[#1e1b19] p-0.5 rounded cursor-pointer"
                        title="Close legend"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {HERITAGE_CATEGORIES.filter(category => category !== 'All').map(category => {
                      const style = HERITAGE_MARKER_STYLES[category];
                      return <div key={category} className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: style.color }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {style.paths.map(path => <path key={path} d={path} />)}
                          </svg>
                        </span>
                        <span className="text-[#1e1b19]">{category}</span>
                      </div>;
                    })}
                    <p className="border-t border-[#e8dfd5] pt-2 text-[#574141]">City of San Fernando, Pampanga boundary</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* UPPER RIGHT: Category Filter Collapse Button                          */}
          {/* When clicked, lets user select categories (e.g., Church) to filter    */}
          {/* ===================================================================== */}
          <div className="absolute top-16 left-3 sm:top-3 sm:left-auto sm:right-3 z-[1000]">
            <div className="static sm:relative">
              <button
                id="toggle-map-filter-btn"
                aria-expanded={isFilterOpen}
                onClick={() => {
                  setIsFilterOpen(!isFilterOpen);
                  setIsLayersOpen(false);
                  setIsLegendOpen(false);
                }}
                className={`flex items-center gap-1.5 h-11 px-3 rounded-xl border transition-all shadow-sm cursor-pointer ${
                  isFilterOpen || activeCategory !== 'All'
                    ? 'bg-[#7e1925] text-white border-[#7e1925]'
                    : 'bg-white/95 backdrop-blur-md text-[#1e1b19] border-[#e8dfd5] hover:bg-white hover:border-[#7e1925]'
                }`}
                title="Filter by category"
                aria-label="Filter locations"
              >
                <Filter className="w-4 h-4" />
                <span className="text-xs font-bold">
                  {activeCategory === 'All' ? 'Filter' : activeCategory}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Filter Dropdown Popover */}
              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 sm:left-auto sm:right-0 top-12 w-60 max-h-60 sm:max-h-none overflow-y-auto rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md p-3 font-outfit text-xs shadow-2xl space-y-2 z-[1010]"
                  >
                    <div className="flex items-center justify-between font-bold text-[#1e1b19] pb-1.5 border-b border-[#e8dfd5]">
                      <span className="text-[10px] uppercase tracking-wider text-[#8a7171]">Filter Locations</span>
                      <button
                        aria-label="Close category filters"
                        onClick={() => setIsFilterOpen(false)}
                        className="text-[#8a7171] hover:text-[#1e1b19] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      {HERITAGE_CATEGORIES.map((cat) => {
                        const isSelected = activeCategory === cat;
                        const count = cat === 'All'
                          ? sites.length
                          : sites.filter(s => s.category === cat).length;
                        return (
                          <button
                            key={cat}
                            aria-pressed={activeCategory === cat}
                            id={`map-filter-option-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                            onClick={() => {
                              handleCategorySelect(cat as CategoryType | 'All');
                            }}
                            className={`w-full min-h-11 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#7e1925] text-white'
                                : 'text-[#1e1b19] hover:bg-[#faf2ee]'
                            }`}
                          >
                            <span>{cat}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#faf2ee] text-[#8a7171]'}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>


                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* LOWER LEFT: HERITAGE SITE CARD (When a heritage is clicked)          */}
          {/* Features Name, Description, Direction Button, and Explore Button      */}
          {/* ===================================================================== */}
          <AnimatePresence>
            {activeSite && hasUsableCoordinates(activeSite.coordinates) && !isMapCardDismissed && (
              <motion.div
                key={activeSite.id}
                id="map-floating-site-card"
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-7 left-3 sm:bottom-8 sm:left-5 z-[1000] w-[calc(100%-1.5rem)] sm:w-[310px] max-h-[270px] sm:max-h-[300px] overflow-y-auto rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md shadow-lg font-outfit"
              >
                {/* Image Header with Close Button, Singular Category Badge, Bookmark */}
                <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-[#faf2ee]">
                  <img
                    src={activeSite.heroImage || HERITAGE_IMAGE_PLACEHOLDER}
                    alt={activeSite.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={handleHeritageImageError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                  {/* Category Badge (e.g., Church, Monument, Museum, etc.) */}
                  <span className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur-md px-2.5 py-0.5 font-outfit text-[10px] font-bold text-[#7e1925] border border-white/40 shadow-xs uppercase tracking-wider">
                    {formatCategoryLabel(activeSite.category)}
                  </span>

                  {/* Top-Right Close & Bookmark buttons */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <button
                      id={`map-card-save-${activeSite.id}`}
                      aria-label={savedSiteIds.includes(activeSite.id) ? 'Unsave site' : 'Save site'}
                      aria-pressed={savedSiteIds.includes(activeSite.id)}
                      onClick={() => onToggleSaveSite(activeSite.id)}
                      className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all cursor-pointer shadow-xs ${
                        savedSiteIds.includes(activeSite.id)
                          ? 'bg-[#7e1925] text-white'
                          : 'bg-black/50 text-white hover:bg-black/75 border border-white/20'
                      }`}
                      title={savedSiteIds.includes(activeSite.id) ? 'Remove bookmark' : 'Save site'}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>

                    <button
                      id="close-in-map-card-btn"
                      aria-label="Close site card"
                      onClick={() => setIsMapCardDismissed(true)}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-xs"
                      title="Close card"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Recorded Year */}
                  <div className="absolute bottom-2.5 left-3 flex items-center gap-2 font-outfit text-[11px] font-semibold text-white">
                    {activeSite.yearBuilt && <span className="rounded-md bg-black/65 backdrop-blur-xs px-2 py-0.5 border border-white/20">
                      {activeSite.yearBuilt}
                    </span>}
                  </div>


                </div>

                {/* Card Lower Part: Name, Description, Direction Button, and Explore Button */}
                <div className="p-3 sm:p-4 space-y-2 font-outfit">
                  <div>
                    <h3 className="font-outfit text-lg font-bold text-[#1e1b19] leading-snug mt-0.5 tracking-tight">
                      {activeSite.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[#574141]">
                      <MapPin className="h-3.5 w-3.5 text-[#7e1925] flex-shrink-0" />
                      <span className="break-words">{activeSite.address}</span>
                    </div>
                  </div>

                  {/* Lower Part Buttons: Direction button and Explore button */}
                  <div className="flex items-center gap-2 pt-1">
                    {/* Direction Button */}
                    <a
                      id="map-card-directions-link"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${activeSite.coordinates.lat},${activeSite.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#e8dfd5] bg-[#faf2ee] hover:bg-[#ebdcd3] py-2 text-xs font-bold text-[#1e1b19] transition-all cursor-pointer shadow-xs"
                      title="Get directions in Google Maps"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#7e1925]" />
                      <span>Directions</span>
                    </a>

                    {/* Explore Button */}
                    <button
                      id="map-floating-explore-btn"
                      onClick={() => onSelectSite(activeSite)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#7e1925] hover:bg-[#580b14] py-2 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-xs hover:scale-[1.01] cursor-pointer"
                      title="Explore heritage site details"
                    >
                      <span>View Site</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-xs text-[#574141]">City of San Fernando, Pampanga</p>
        {filteredAndSortedSites.length === 0 && <p role="status" className="rounded-xl border border-[#e8dfd5] bg-white p-4 text-sm text-[#574141]">No heritage sites in this category. Choose another category or All.</p>}
        {filteredAndSortedSites.length > 0 && !filteredAndSortedSites.some(site => hasUsableCoordinates(site.coordinates)) && <p role="status" className="text-sm text-[#574141]">No mapped locations in this category. Recorded sites are available in the directory.</p>}
        {/* Quick Landmark Jump Bar Below Map */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs no-scrollbar">
          <span className="font-outfit font-bold text-[#574141] whitespace-nowrap flex items-center gap-1 uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-[#7e1925]" />
            Jump to:
          </span>
          {filteredAndSortedSites.filter(site => hasUsableCoordinates(site.coordinates)).map((site) => {
            const isActive = site.id === selectedSiteId;
            return (
              <button
                key={site.id}
                id={`quick-jump-${site.id}`}
                aria-pressed={isActive}
                onClick={() => handleSelectSiteFromCardOrChip(site)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 font-outfit text-xs font-bold transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-[#7e1925] text-white border-[#7e1925] shadow-xs'
                    : 'bg-white text-[#1e1b19] border-[#e8dfd5] hover:border-[#7e1925]'
                }`}
              >
                {site.name.split(' ')[0]} {site.name.split(' ')[1] || ''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
