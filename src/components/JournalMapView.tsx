// Source: Google Maps Platform Code Assist
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  Pin,
} from '@vis.gl/react-google-maps';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { decryptJournalEntries } from '../lib/encryption';
import type { UserProfile, JournalInteraction, EntryLocation } from '../types';
import {
  MapPin,
  Navigation,
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Layers,
  Compass,
  ArrowRight,
  Filter,
  Globe2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
} from 'lucide-react';

interface JournalMapViewProps {
  user: UserProfile;
  onOpenEntry: (interactionId: string) => void;
  onCreateNewWithLocation?: () => void;
}

// Calculate Haversine distance in kilometers
function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const JournalMapView: React.FC<JournalMapViewProps> = ({
  user,
  onOpenEntry,
  onCreateNewWithLocation,
}) => {
  const [entries, setEntries] = useState<JournalInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<JournalInteraction | null>(null);

  // Filters & Exploration State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [radiusFilterKm, setRadiusFilterKm] = useState<number>(0); // 0 = unlimited
  const [referenceLocation, setReferenceLocation] = useState<{
    lat: number;
    lng: number;
    name?: string;
  } | null>(null);
  const [isDetectingNearMe, setIsDetectingNearMe] = useState(false);

  // Map camera state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 37.7749,
    lng: -122.4194,
  });
  const [mapZoom, setMapZoom] = useState<number>(3);

  // Check for Google Maps API Key (gracefully falls back to standalone Monograph cartography if not configured)
  const rawMapsKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  const googleMapsApiKey = typeof rawMapsKey === 'string' && rawMapsKey.trim().length > 5 && !rawMapsKey.includes('YOUR_') ? rawMapsKey.trim() : '';

  // Subscribe to real-time interactions for current authenticated user
  useEffect(() => {
    if (!user.uid) return;

    setIsLoading(true);
    const interactionsRef = collection(db, 'users', user.uid, 'interactions');
    const q = query(interactionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const fetched: JournalInteraction[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          fetched.push({
            id: docSnap.id,
            ...data,
          } as JournalInteraction);
        });

        let resolvedEntries = fetched;
        try {
          resolvedEntries = await decryptJournalEntries(fetched, user);
        } catch (decryptErr) {
          console.warn('Journal map decryption warning:', decryptErr);
        }

        setEntries(resolvedEntries);
        setIsLoading(false);

        // Auto-center on latest geotagged entry if available
        const latestWithLoc = resolvedEntries.find((e) => e.location?.latitude && e.location?.longitude);
        if (latestWithLoc && latestWithLoc.location) {
          setMapCenter({
            lat: latestWithLoc.location.latitude,
            lng: latestWithLoc.location.longitude,
          });
          setMapZoom(6);
        }
      },
      (err) => {
        console.warn('Journal map Firestore subscription warning:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Extract all geotagged entries
  const locationEntries = useMemo(() => {
    return entries.filter(
      (e) =>
        e.location &&
        typeof e.location.latitude === 'number' &&
        typeof e.location.longitude === 'number' &&
        !isNaN(e.location.latitude) &&
        !isNaN(e.location.longitude)
    );
  }, [entries]);

  // Extract unique cities/regions for filter dropdown
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    locationEntries.forEach((e) => {
      if (e.location?.city) set.add(e.location.city);
      else if (e.location?.name) {
        const parts = e.location.name.split(',');
        set.add(parts[0].trim());
      }
    });
    return Array.from(set).filter(Boolean);
  }, [locationEntries]);

  // Filtered entries based on search, city, and radius
  const filteredEntries = useMemo(() => {
    return locationEntries.filter((entry) => {
      const loc = entry.location!;
      const titleMatch = (entry.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const promptMatch = (entry.prompt || '').toLowerCase().includes(searchQuery.toLowerCase());
      const locNameMatch = (loc.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const queryMatches = !searchQuery || titleMatch || promptMatch || locNameMatch;

      if (!queryMatches) return false;

      // City filter
      if (selectedCity !== 'all') {
        const entryCity = loc.city || (loc.name ? loc.name.split(',')[0].trim() : '');
        if (entryCity.toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }
      }

      // Proximity / Radius filter
      if (radiusFilterKm > 0 && referenceLocation) {
        const dist = getDistanceFromLatLonInKm(
          referenceLocation.lat,
          referenceLocation.lng,
          loc.latitude,
          loc.longitude
        );
        if (dist > radiusFilterKm) {
          return false;
        }
      }

      return true;
    });
  }, [locationEntries, searchQuery, selectedCity, radiusFilterKm, referenceLocation]);

  // Handle "Near Me" detection
  const handleDetectNearMe = () => {
    if (!navigator.geolocation) return;
    setIsDetectingNearMe(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setReferenceLocation({ lat, lng, name: 'Current Location' });
        setRadiusFilterKm(100); // default to 100km radius
        setMapCenter({ lat, lng });
        setMapZoom(9);
        setIsDetectingNearMe(false);
      },
      (err) => {
        console.warn('Near me geolocation error:', err);
        setIsDetectingNearMe(false);
      },
      { timeout: 8000 }
    );
  };

  const handleSelectEntryOnMap = (entry: JournalInteraction) => {
    setSelectedEntry(entry);
    if (entry.location) {
      setMapCenter({
        lat: entry.location.latitude,
        lng: entry.location.longitude,
      });
      setMapZoom(11);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCity('all');
    setRadiusFilterKm(0);
    setReferenceLocation(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full flex-1 flex flex-col">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-[#e0ddd5] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[2px] text-[#4a5d4e] font-semibold">
              Geographic Cartography
            </span>
            <span className="w-1 h-1 rounded-full bg-[#8e8a82]"></span>
            <span className="text-[10px] uppercase tracking-[2px] text-[#8e8a82]">
              Private Location Archive
            </span>
          </div>
          <h1 className="font-serif italic font-normal text-3xl sm:text-4xl text-[#1a1a1a] mt-1 tracking-tight">
            Journal Map
          </h1>
          <p className="text-xs text-[#555] mt-1 max-w-xl">
            Explore your reflections mapped across geography. Every location is strictly private, owner-isolated, and optional.
          </p>
        </div>

        {/* Top Metrics Cards */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#e0ddd5] rounded-md px-3.5 py-2 text-center min-w-20">
            <span className="block font-serif text-lg text-[#4a5d4e] font-medium leading-none">
              {locationEntries.length}
            </span>
            <span className="text-[9px] uppercase tracking-[1px] text-[#8e8a82]">
              Geotagged
            </span>
          </div>
          <div className="bg-white border border-[#e0ddd5] rounded-md px-3.5 py-2 text-center min-w-20">
            <span className="block font-serif text-lg text-[#1a1a1a] font-medium leading-none">
              {uniqueCities.length}
            </span>
            <span className="text-[9px] uppercase tracking-[1px] text-[#8e8a82]">
              Cities
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#e0ddd5] bg-[#f8f6f0] px-4 -mx-4 sm:mx-0 sm:px-4 sm:rounded-t-lg">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Keyword Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#8e8a82] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-map-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, place, or notes..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#e0ddd5] rounded text-xs text-[#1a1a1a] focus:outline-hidden focus:border-[#4a5d4e]"
            />
          </div>

          {/* City / Region Selector */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8e8a82]" />
            <select
              id="select-map-city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-[#e0ddd5] rounded text-xs text-[#1a1a1a] focus:outline-hidden focus:border-[#4a5d4e]"
            >
              <option value="all">All Cities ({locationEntries.length})</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Near Me Button */}
          <button
            id="btn-filter-near-me"
            type="button"
            onClick={handleDetectNearMe}
            disabled={isDetectingNearMe}
            className={`px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              referenceLocation
                ? 'bg-[#4a5d4e] text-white border-[#4a5d4e]'
                : 'bg-white border-[#e0ddd5] text-[#1a1a1a] hover:border-[#4a5d4e]'
            }`}
          >
            <Navigation className="w-3 h-3" />
            <span>{isDetectingNearMe ? 'Locating...' : 'Near Me'}</span>
          </button>

          {/* Radius Selector (if reference location set) */}
          {referenceLocation && (
            <div className="flex items-center gap-1.5 text-xs bg-white px-2 py-1 border border-[#e0ddd5] rounded">
              <span className="text-[#8e8a82]">Radius:</span>
              <select
                value={radiusFilterKm}
                onChange={(e) => setRadiusFilterKm(Number(e.target.value))}
                className="bg-transparent text-xs text-[#1a1a1a] font-medium focus:outline-hidden"
              >
                <option value={25}>Within 25 km</option>
                <option value={50}>Within 50 km</option>
                <option value={100}>Within 100 km</option>
                <option value={500}>Within 500 km</option>
                <option value={0}>Any Distance</option>
              </select>
            </div>
          )}

          {(searchQuery || selectedCity !== 'all' || referenceLocation) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-[#c44536] hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-[#8e8a82]">
          Showing <span className="font-semibold text-[#1a1a1a]">{filteredEntries.length}</span> of{' '}
          <span>{locationEntries.length}</span> mapped reflections
        </div>
      </div>

      {/* Main Map + Sidebar Split View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 min-h-[560px]">
        {/* Left Side: Interactive Map Container */}
        <div className="lg:col-span-8 bg-white border border-[#e0ddd5] rounded-lg overflow-hidden flex flex-col relative shadow-xs min-h-[420px] lg:min-h-[560px]">
          {/* If Google Maps API key is available, use official Google Maps Platform components */}
          {googleMapsApiKey ? (
            <div className="w-full h-full flex-1 relative">
              <APIProvider apiKey={googleMapsApiKey}>
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={mapCenter}
                  center={mapCenter}
                  defaultZoom={mapZoom}
                  zoom={mapZoom}
                  onCameraChanged={(ev) => {
                    setMapCenter(ev.detail.center);
                    setMapZoom(ev.detail.zoom);
                  }}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  className="w-full h-full min-h-[420px]"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  {filteredEntries.map((entry) => {
                    const loc = entry.location!;
                    const isSelected = selectedEntry?.id === entry.id;
                    return (
                      <AdvancedMarker
                        key={entry.id}
                        position={{ lat: loc.latitude, lng: loc.longitude }}
                        onClick={() => handleSelectEntryOnMap(entry)}
                        title={entry.title || 'Reflection'}
                      >
                        <Pin
                          background={isSelected ? '#c44536' : '#4a5d4e'}
                          glyphColor="#ffffff"
                          borderColor="#ffffff"
                          scale={isSelected ? 1.25 : 1.0}
                        />
                      </AdvancedMarker>
                    );
                  })}

                  {/* InfoWindow for selected entry */}
                  {selectedEntry && selectedEntry.location && (
                    <InfoWindow
                      position={{
                        lat: selectedEntry.location.latitude,
                        lng: selectedEntry.location.longitude,
                      }}
                      onCloseClick={() => setSelectedEntry(null)}
                    >
                      <div className="p-2 max-w-xs text-[#1a1a1a]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#8e8a82] mb-1">
                          <Calendar className="w-3 h-3 text-[#4a5d4e]" />
                          <span>
                            {new Date(selectedEntry.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h4 className="font-serif font-medium text-sm text-[#1a1a1a] mb-1">
                          {selectedEntry.title || 'Untitled Reflection'}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-[#4a5d4e] mb-2 font-medium">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-1">{selectedEntry.location.name}</span>
                        </div>
                        <p className="text-xs text-[#555] line-clamp-2 mb-3 bg-[#f8f6f0] p-1.5 rounded italic">
                          "{selectedEntry.prompt || selectedEntry.response?.slice(0, 100)}"
                        </p>
                        {selectedEntry.id && (
                          <button
                            type="button"
                            onClick={() => onOpenEntry(selectedEntry.id!)}
                            className="w-full py-1.5 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>Open in Journal</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>
            </div>
          ) : (
            /* Interactive Graphical Geographic Monograph Canvas (Graceful Fallback & Standalone) */
            <div className="w-full h-full flex-1 flex flex-col bg-[#f5f2e9] relative overflow-hidden select-none">
              {/* Map Canvas Background with Subtle Coordinates Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#dcd8cb_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />

              {/* Top Map Overlay Toolbar */}
              <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-xs border border-[#e0ddd5] px-3 py-1.5 rounded text-[11px] text-[#4a5d4e] flex items-center gap-2 shadow-xs">
                <Compass className="w-3.5 h-3.5 text-[#4a5d4e] animate-spin-slow" />
                <span className="font-serif italic font-medium">Monograph Cartography</span>
                <span className="text-[#8e8a82]">({filteredEntries.length} pins)</span>
              </div>

              {/* Interactive SVG Projection Plane */}
              <div className="w-full h-full flex-1 relative flex items-center justify-center p-6">
                <svg
                  viewBox="-180 -90 360 180"
                  className="w-full h-full max-h-[500px] transition-transform duration-300"
                  style={{ transform: `scale(${Math.min(1.8, Math.max(0.9, mapZoom / 3))})` }}
                >
                  {/* Subtle World Equator & Meridians */}
                  <line x1="-180" y1="0" x2="180" y2="0" stroke="#d5d0c2" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1="0" y1="-90" x2="0" y2="90" stroke="#d5d0c2" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1="-90" y1="-90" x2="-90" y2="90" stroke="#e3dfd3" strokeWidth="0.3" strokeDasharray="2 2" />
                  <line x1="90" y1="-90" x2="90" y2="90" stroke="#e3dfd3" strokeWidth="0.3" strokeDasharray="2 2" />

                  {/* World Continent Silhouettes (Geometric Stylized) */}
                  <path
                    d="M -130 50 Q -100 40 -80 20 Q -60 10 -70 -20 Q -80 -50 -60 -50 Q -40 -30 -35 10 Q -50 40 -60 60 Z"
                    fill="#eae6dc"
                    stroke="#d0cbbe"
                    strokeWidth="0.5"
                  />
                  <path
                    d="M -10 60 Q 30 70 60 50 Q 80 60 140 60 Q 150 30 110 10 Q 80 20 40 30 Q 10 35 -10 60 Z"
                    fill="#eae6dc"
                    stroke="#d0cbbe"
                    strokeWidth="0.5"
                  />
                  <path
                    d="M -15 35 Q 20 30 40 10 Q 50 -30 20 -40 Q 0 -20 -15 35 Z"
                    fill="#eae6dc"
                    stroke="#d0cbbe"
                    strokeWidth="0.5"
                  />
                  <path
                    d="M 110 -15 Q 140 -10 150 -30 Q 130 -40 115 -35 Z"
                    fill="#eae6dc"
                    stroke="#d0cbbe"
                    strokeWidth="0.5"
                  />

                  {/* Render Pins for Filtered Entries */}
                  {filteredEntries.map((entry) => {
                    const loc = entry.location!;
                    // Map coords: longitude -> x (-180..180), latitude -> y (90..-90 inverted for SVG)
                    const svgX = loc.longitude;
                    const svgY = -loc.latitude;
                    const isSelected = selectedEntry?.id === entry.id;

                    return (
                      <g
                        key={entry.id}
                        className="cursor-pointer transition-transform hover:scale-125"
                        onClick={() => handleSelectEntryOnMap(entry)}
                      >
                        {/* Pulse Ring if selected */}
                        {isSelected && (
                          <circle
                            cx={svgX}
                            cy={svgY}
                            r="8"
                            fill="none"
                            stroke="#c44536"
                            strokeWidth="1.2"
                            className="animate-ping opacity-75"
                          />
                        )}

                        {/* Outer Glow */}
                        <circle
                          cx={svgX}
                          cy={svgY}
                          r={isSelected ? '4.5' : '3.5'}
                          fill={isSelected ? '#c44536' : '#4a5d4e'}
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                        <circle
                          cx={svgX}
                          cy={svgY}
                          r="1.2"
                          fill="#ffffff"
                        />

                        {/* Text Label on hover / selection */}
                        {isSelected && (
                          <text
                            x={svgX}
                            y={svgY - 7}
                            textAnchor="middle"
                            fill="#1a1a1a"
                            fontSize="4"
                            fontFamily="serif"
                            fontWeight="bold"
                            className="bg-white"
                          >
                            {entry.title || 'Reflection'}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Bottom Fallback Notice & Map Controls */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto bg-white/90 backdrop-blur-xs border border-[#e0ddd5] px-3 py-1.5 rounded text-[10px] text-[#8e8a82]">
                  Interactive Geolocation Canvas • Click any marker to view entry
                </div>

                <div className="pointer-events-auto flex items-center gap-1 bg-white border border-[#e0ddd5] rounded shadow-xs p-1">
                  <button
                    type="button"
                    onClick={() => setMapZoom((z) => Math.min(z + 1, 8))}
                    className="p-1 hover:bg-gray-100 rounded text-[#1a1a1a] cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapZoom((z) => Math.max(z - 1, 1))}
                    className="p-1 hover:bg-gray-100 rounded text-[#1a1a1a] cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Geotagged Reflections List / Inspector */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Selected Entry Inspector Detail */}
          {selectedEntry ? (
            <div className="bg-white border-2 border-[#4a5d4e]/40 rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[1px] text-[#4a5d4e] font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Selected Location</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="text-xs text-[#8e8a82] hover:text-[#1a1a1a] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div>
                <h3 className="font-serif text-lg text-[#1a1a1a] font-normal leading-snug">
                  {selectedEntry.title || 'Untitled Reflection'}
                </h3>
                <p className="text-xs font-medium text-[#4a5d4e] mt-1">
                  {selectedEntry.location?.name || 'Geographic Tag'}
                </p>
                <p className="text-[10px] text-[#8e8a82] mt-0.5 font-mono">
                  {selectedEntry.location?.latitude.toFixed(4)}, {selectedEntry.location?.longitude.toFixed(4)}
                </p>
              </div>

              <div className="bg-[#fcfbf7] border border-[#e0ddd5] rounded p-3 text-xs text-[#444] space-y-2 max-h-48 overflow-y-auto">
                <p className="italic text-[#1a1a1a] font-serif">
                  "{selectedEntry.prompt}"
                </p>
                {selectedEntry.response && (
                  <div className="pt-2 border-t border-[#e0ddd5] text-[11px] text-[#555] line-clamp-3">
                    {selectedEntry.response}
                  </div>
                )}
              </div>

              {selectedEntry.id && (
                <button
                  id="btn-open-selected-map-entry"
                  type="button"
                  onClick={() => onOpenEntry(selectedEntry.id!)}
                  className="w-full py-2 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Open Full Entry in Workspace</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-[#f8f6f0] border border-[#e0ddd5] rounded-lg p-4 text-xs text-[#555] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white border border-[#e0ddd5] flex items-center justify-center text-[#4a5d4e] shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <p>
                Click any marker on the map or select an entry below to inspect details and open in your workspace.
              </p>
            </div>
          )}

          {/* List of Mapped Entries */}
          <div className="bg-white border border-[#e0ddd5] rounded-lg p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#e0ddd5]">
              <h3 className="font-serif text-sm text-[#1a1a1a]">
                Mapped Reflections ({filteredEntries.length})
              </h3>
              <span className="text-[10px] uppercase tracking-[1px] text-[#8e8a82]">
                Chronological
              </span>
            </div>

            <div className="divide-y divide-[#f0ede6] overflow-y-auto flex-1 max-h-[460px] pr-1 mt-1">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => {
                  const loc = entry.location!;
                  const isSelected = selectedEntry?.id === entry.id;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => handleSelectEntryOnMap(entry)}
                      className={`py-3 px-2 rounded cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#f8f6f0] border-l-2 border-[#4a5d4e]'
                          : 'hover:bg-[#fcfbf7]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-serif text-xs font-medium text-[#1a1a1a] line-clamp-1">
                          {entry.title || 'Untitled Entry'}
                        </h4>
                        <span className="text-[10px] text-[#8e8a82] shrink-0">
                          {new Date(entry.createdAt).toLocaleDateString(undefined, {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-[#4a5d4e] mt-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="line-clamp-1">{loc.name || `${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}`}</span>
                      </div>

                      <p className="text-[11px] text-[#777] line-clamp-2 mt-1 italic">
                        "{entry.prompt}"
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-[#8e8a82] space-y-2">
                  <Globe2 className="w-8 h-8 text-[#c0bcb0] mx-auto" />
                  <p className="font-serif italic text-sm text-[#1a1a1a]">
                    No Geotagged Entries Found
                  </p>
                  <p className="text-[11px] max-w-xs mx-auto">
                    {locationEntries.length === 0
                      ? "You haven't attached a location to any journal reflections yet. In your workspace, click 'Add Location' when writing."
                      : 'No reflections match the selected filter criteria.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
