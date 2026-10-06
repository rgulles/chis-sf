import { handleHeritageImageError } from '../utils/heritageImages';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
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

// Authentic geographic center and strict boundaries of the City of San Fernando, Pampanga
const SAN_FERNANDO_CENTER: [number, number] = [15.0325, 120.6865];

// Strict bounding box locked exclusively to San Fernando (prevents dragging outside city limits)
const SAN_FERNANDO_BOUNDS: L.LatLngBoundsLiteral = [
  [14.990, 120.630], // South-West border (Bacolor / Santo Tomas boundary)
  [15.075, 120.745]  // North-East border (Mexico / Angeles boundary)
];

// City of San Fernando Municipal Boundary polygon outline
const SAN_FERNANDO_BOUNDARY: [number, number][] = [
  [15.068, 120.645],
  [15.073, 120.675],
  [15.071, 120.710],
  [15.062, 120.738],
  [15.045, 120.742],
  [15.018, 120.735],
  [14.995, 120.705],
  [14.992, 120.672],
  [15.008, 120.640],
  [15.038, 120.632],
  [15.068, 120.645]
];

// Historical San Fernando River (Sapang Balen) flow line
const SAN_FERNANDO_RIVER: [number, number][] = [
  [15.053, 120.655],
  [15.044, 120.669],
  [15.036, 120.681],
  [15.030, 120.688],
  [15.025, 120.696],
  [15.016, 120.710],
  [15.006, 120.725]
];

type MapTileStyle = 'voyager' | 'osm' | 'satellite';

export const MapView: React.FC<MapViewProps> = ({
  sites,
  onSelectSite,
  onPlanRoute,
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
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('voyager');
  const [showCityBoundary, setShowCityBoundary] = useState(true);

  // Sync category with prop if provided
  const activeCategory = propCategory !== undefined ? propCategory : internalCategory;
  const handleCategorySelect = (cat: CategoryType | 'All') => {
    if (propOnCategoryChange) {
      propOnCategoryChange(cat);
    }
    setInternalCategory(cat);
  };

  // Sync initial view mode changes if parent re-routes
  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Map DOM reference and Leaflet instance
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);
  const riverLayerRef = useRef<L.Polyline | null>(null);

  // Filtered & Sorted Sites for Directory & Map (Search bar removed per user request)
  const filteredAndSortedSites = useMemo(() => {
    return sites
      .filter((site) => {
        const matchesCategory = activeCategory === 'All' || site.category === activeCategory;
        return matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, activeCategory]);

  const activeSite = filteredAndSortedSites.find((s) => s.id === selectedSiteId);

  useEffect(() => {
    if (!filteredAndSortedSites.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId('');
    }
  }, [filteredAndSortedSites, selectedSiteId]);

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

  const getCategoryColor = (cat: HeritageSite['category']) => {
    switch (cat) {
      case 'Churches':
        return '#7e1925'; // Primary Maroon
      case 'Historical Buildings':
        return '#b45309'; // Ochre Amber
      case 'Museums':
        return '#2d5a27'; // Heritage Green
      case 'Monuments':
        return '#44413a'; // Slate Charcoal
      case 'Cultural Sites':
        return '#9b4500'; // Terracotta
      default:
        return '#7e1925';
    }
  };

  // Helper to create customized HTML Leaflet DivIcons
  const createSiteIcon = (site: HeritageSite, isSelected: boolean) => {
    const color = getCategoryColor(site.category);
    const shortTitle = site.name.split(' ').slice(0, 2).join(' ');
    const safeTitle = shortTitle.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

    return L.divIcon({
      className: 'heritage-custom-marker',
      html: `
        <div class="relative flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -100%);">
          ${
            isSelected
              ? `<span class="absolute -top-1 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full animate-ping opacity-75" style="background-color: ${color}40;"></span>`
              : ''
          }
          <div class="flex items-center justify-center rounded-full text-white shadow-md transition-transform duration-200 ${
            isSelected
              ? 'h-9 w-9 ring-2 ring-white scale-110'
              : 'h-7 w-7 hover:scale-105 ring-1 ring-white/90'
          }" style="background-color: ${color};">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <!-- Pointer tip triangle -->
          <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] -mt-[1px]" style="border-t-color: ${color};"></div>
          <!-- Label pill -->
          <div class="mt-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold border shadow-xs transition-colors ${
            isSelected
              ? 'bg-[#1e1b19] text-white border-[#1e1b19]'
              : 'bg-[#fff8f5] text-[#1e1b19] border-[#e7e0d6]'
          }">
            ${safeTitle}
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -36]
    });
  };

  // Initialize the real Leaflet map restricted strictly to San Fernando
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create the map with strict bounds locking (zoomControl disabled for custom upper-left buttons)
    const map = L.map(mapContainerRef.current, {
      center: SAN_FERNANDO_CENTER,
      zoom: 14,
      minZoom: 13,
      maxZoom: 18,
      maxBounds: SAN_FERNANDO_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: false,
      attributionControl: true
    });

    // Initial tile layer (CartoDB Voyager: Standard)
    const initialTileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> • San Fernando Heritage'
      }
    ).addTo(map);
    tileLayerRef.current = initialTileLayer;

    // Draw San Fernando Municipal Boundary polygon
    const boundaryPolygon = L.polygon(SAN_FERNANDO_BOUNDARY, {
      color: '#7e1925',
      weight: 2,
      opacity: 0.8,
      dashArray: '6, 6',
      fillColor: '#7e1925',
      fillOpacity: 0.03
    }).addTo(map);
    boundaryLayerRef.current = boundaryPolygon;

    // Draw San Fernando River (Sapang Balen)
    const riverPolyline = L.polyline(SAN_FERNANDO_RIVER, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.6,
      smoothFactor: 1
    }).addTo(map);
    riverLayerRef.current = riverPolyline;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
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

    if (tileStyle === 'voyager') {
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap &copy; CARTO • San Fernando Heritage';
    } else if (tileStyle === 'osm') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors • City of San Fernando';
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
    } else {
      map.removeLayer(boundaryLayerRef.current);
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
        title: site.name
      }).addTo(map);

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
        mapInstanceRef.current?.invalidateSize();
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
      map.setView(SAN_FERNANDO_CENTER, 14, {
        animate: true,
        duration: 0.8
      });
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
            Explore San Fernando’s Heritage
          </h1>
          <p className="font-outfit text-base text-[#574141] max-w-3xl leading-relaxed font-normal">
            Discover Spanish colonial churches, revolutionary command posts, sugar-era ancestral mansions, and living artisan workshops through an interactive city map and curated archive directory.
          </p>
        </div>

        {/* Action Controls: Plan Route & View Mode Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            id="plan-route-map-btn"
            onClick={onPlanRoute}
            className="flex items-center gap-1.5 rounded-xl bg-[#7e1925] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#580b14] transition-all shadow-xs hover:scale-[1.02] cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>Plan Route</span>
          </button>

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
      <div className={viewMode === 'map' ? 'block space-y-4' : 'hidden'}>
        {/* FULL-WIDTH MAP CANVAS */}
        <div className="relative h-[600px] sm:h-[680px] lg:h-[750px] w-full rounded-2xl border border-[#e8dfd5] bg-[#faf2ee] overflow-hidden shadow-xs">
          {/* Leaflet Map Target Div */}
          <div
            id="san-fernando-real-map"
            ref={mapContainerRef}
            className="h-full w-full select-none"
          />

          {/* ===================================================================== */}
          {/* UPPER LEFT CONTROLS: (Horizontally on web, vertically on phone)       */}
          {/* Controls: [+ and -] [Center City] [Style] [Legend]                    */}
          {/* All logo/icon only, with collapsible popovers                         */}
          {/* ===================================================================== */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {/* Zoom Controls (+ and -) */}
            <div className="flex flex-col sm:flex-row items-center rounded-xl bg-white/95 backdrop-blur-md border border-[#e8dfd5] shadow-md overflow-hidden">
              <button
                id="map-zoom-in-btn"
                onClick={handleZoomIn}
                className="p-2 text-[#1e1b19] hover:bg-[#faf2ee] hover:text-[#7e1925] transition-colors cursor-pointer"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="w-4 sm:w-[1px] h-[1px] sm:h-4 bg-[#e8dfd5]" />
              <button
                id="map-zoom-out-btn"
                onClick={handleZoomOut}
                className="p-2 text-[#1e1b19] hover:bg-[#faf2ee] hover:text-[#7e1925] transition-colors cursor-pointer"
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
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 backdrop-blur-md text-[#7e1925] border border-[#e8dfd5] hover:bg-white hover:border-[#7e1925] transition-all shadow-md cursor-pointer"
              title="Center City"
              aria-label="Center City"
            >
              <Crosshair className="w-4 h-4" />
            </button>

            {/* Style (Collapse - Icon Only) */}
            <div className="relative">
              <button
                id="toggle-layers-disclosure-btn"
                onClick={() => {
                  setIsLayersOpen(!isLayersOpen);
                  setIsLegendOpen(false);
                  setIsFilterOpen(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-md cursor-pointer ${
                  isLayersOpen
                    ? 'bg-[#7e1925] text-white border-[#7e1925]'
                    : 'bg-white/95 backdrop-blur-md text-[#1e1b19] border-[#e8dfd5] hover:bg-white hover:border-[#7e1925]'
                }`}
                title="Map Style"
                aria-label="Map Style"
              >
                <Layers className="w-4 h-4" />
              </button>

              {/* Style Popover: Standard, OSM, Satellite */}
              <AnimatePresence>
                {isLayersOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 top-11 w-52 rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md p-3 font-outfit text-xs shadow-2xl space-y-2.5 z-[1010]"
                  >
                    <div className="flex items-center justify-between font-bold text-[#1e1b19] pb-1 border-b border-[#e8dfd5]">
                      <span className="text-[10px] uppercase tracking-wider text-[#8a7171]">Map Style</span>
                      <button
                        onClick={() => setIsLayersOpen(false)}
                        className="text-[#8a7171] hover:text-[#1e1b19] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#faf2ee] p-1 border border-[#e8dfd5]">
                      <button
                        onClick={() => setTileStyle('voyager')}
                        className={`rounded-lg py-1.5 text-center font-bold text-[11px] transition-colors cursor-pointer ${
                          tileStyle === 'voyager' ? 'bg-[#7e1925] text-white shadow-xs' : 'text-[#574141] hover:text-[#1e1b19]'
                        }`}
                        title="Standard map style"
                      >
                        Standard
                      </button>
                      <button
                        onClick={() => setTileStyle('osm')}
                        className={`rounded-lg py-1.5 text-center font-bold text-[11px] transition-colors cursor-pointer ${
                          tileStyle === 'osm' ? 'bg-[#7e1925] text-white shadow-xs' : 'text-[#574141] hover:text-[#1e1b19]'
                        }`}
                        title="OpenStreetMap"
                      >
                        OSM
                      </button>
                      <button
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
                          City Limits
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
            <div className="relative">
              <button
                id="toggle-legend-disclosure-btn"
                onClick={() => {
                  setIsLegendOpen(!isLegendOpen);
                  setIsLayersOpen(false);
                  setIsFilterOpen(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-md cursor-pointer ${
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
                    className="absolute left-0 top-11 w-52 rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md p-3 font-outfit text-xs space-y-2 shadow-2xl z-[1010]"
                  >
                    <div className="flex items-center justify-between font-bold text-[#1e1b19] pb-1.5 border-b border-[#e8dfd5]">
                      <span className="text-[10px] uppercase tracking-wider text-[#8a7171]">Legend</span>
                      <button
                        onClick={() => setIsLegendOpen(false)}
                        className="text-[#8a7171] hover:text-[#1e1b19] p-0.5 rounded cursor-pointer"
                        title="Close legend"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#7e1925]" />
                      <span className="text-[#1e1b19]">Churches</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#b45309]" />
                      <span className="text-[#1e1b19]">Historical Buildings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#2d5a27]" />
                      <span className="text-[#1e1b19]">Museums</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#44413a]" />
                      <span className="text-[#1e1b19]">Monuments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#9b4500]" />
                      <span className="text-[#1e1b19]">Cultural Landmarks</span>
                    </div>
                    <div className="pt-1.5 border-t border-[#e8dfd5] flex items-center gap-1.5 text-[11px] text-[#3b82f6]">
                      <span className="h-0.5 w-3 bg-[#3b82f6]"></span>
                      <span>San Fernando River</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* UPPER RIGHT: Category Filter Collapse Button                          */}
          {/* When clicked, lets user select categories (e.g., Church) to filter    */}
          {/* ===================================================================== */}
          <div className="absolute top-3 right-3 z-[1000]">
            <div className="relative">
              <button
                id="toggle-map-filter-btn"
                onClick={() => {
                  setIsFilterOpen(!isFilterOpen);
                  setIsLayersOpen(false);
                  setIsLegendOpen(false);
                }}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border transition-all shadow-md cursor-pointer ${
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
                    className="absolute right-0 top-11 w-60 rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md p-3 font-outfit text-xs shadow-2xl space-y-2 z-[1010]"
                  >
                    <div className="flex items-center justify-between font-bold text-[#1e1b19] pb-1.5 border-b border-[#e8dfd5]">
                      <span className="text-[10px] uppercase tracking-wider text-[#8a7171]">Filter Locations</span>
                      <button
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
                            id={`map-filter-option-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                            onClick={() => {
                              handleCategorySelect(cat as CategoryType | 'All');
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-semibold transition-colors cursor-pointer ${
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
                className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 z-[1000] w-[calc(100%-1.5rem)] sm:w-[360px] max-h-[82%] overflow-y-auto rounded-2xl border border-[#e8dfd5] bg-white/98 backdrop-blur-md shadow-2xl overflow-hidden font-outfit"
              >
                {/* Image Header with Close Button, Singular Category Badge, Bookmark */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#faf2ee]">
                  <img
                    src={activeSite.heroImage}
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
                      onClick={() => onToggleSaveSite(activeSite.id)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-all cursor-pointer shadow-xs ${
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
                      onClick={() => setIsMapCardDismissed(true)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-xs"
                      title="Close card"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Distance & Year Chips */}
                  <div className="absolute bottom-2.5 left-3 flex items-center gap-2 font-outfit text-[11px] font-semibold text-white">
                    {activeSite.yearBuilt && <span className="rounded-md bg-black/65 backdrop-blur-xs px-2 py-0.5 border border-white/20">
                      {activeSite.yearBuilt}
                    </span>}
                  </div>


                </div>

                {/* Card Lower Part: Name, Description, Direction Button, and Explore Button */}
                <div className="p-4 sm:p-5 space-y-3 font-outfit">
                  <div>
                    <h3 className="font-outfit text-lg font-bold text-[#1e1b19] leading-snug mt-0.5 tracking-tight">
                      {activeSite.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[#574141]">
                      <MapPin className="h-3.5 w-3.5 text-[#7e1925] flex-shrink-0" />
                      <span className="truncate">{activeSite.address}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#574141] line-clamp-2 sm:line-clamp-3 leading-relaxed">
                    {activeSite.shortDescription}
                  </p>

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
                      <span>Explore</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Landmark Jump Bar Below Map */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs no-scrollbar">
          <span className="font-outfit font-bold text-[#574141] whitespace-nowrap flex items-center gap-1 uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-[#7e1925]" />
            Jump to:
          </span>
          {filteredAndSortedSites.map((site) => {
            const isActive = site.id === selectedSiteId && !isMapCardDismissed;
            return (
              <button
                key={site.id}
                id={`quick-jump-${site.id}`}
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
