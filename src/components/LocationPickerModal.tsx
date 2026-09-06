import React, { useState } from 'react';
import { MapPin, Navigation, Search, X, Check, AlertCircle, Loader2, Globe } from 'lucide-react';
import type { EntryLocation } from '../types';
import { getCurrentUserIdToken } from '../lib/firebase';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: EntryLocation | null) => void;
  currentLocation?: EntryLocation | null;
}

const POPULAR_PRESETS: { name: string; city: string; country: string; lat: number; lng: number }[] = [
  { name: 'San Francisco, CA', city: 'San Francisco', country: 'United States', lat: 37.7749, lng: -122.4194 },
  { name: 'New York, NY', city: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060 },
  { name: 'London, UK', city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'Tokyo, Japan', city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Paris, France', city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'Kyoto, Japan', city: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
];

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  currentLocation,
}) => {
  const [activeMode, setActiveMode] = useState<'current' | 'search' | 'manual'>('current');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // Manual inputs
  const [customName, setCustomName] = useState(currentLocation?.name || '');
  const [customLat, setCustomLat] = useState(currentLocation ? String(currentLocation.latitude) : '');
  const [customLng, setCustomLng] = useState(currentLocation ? String(currentLocation.longitude) : '');

  // Search input & results
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { name: string; latitude: number; longitude: number; fullAddress?: string }[]
  >([]);

  // Selected candidate state
  const [candidateLocation, setCandidateLocation] = useState<EntryLocation | null>(
    currentLocation || null
  );

  if (!isOpen) return null;

  const handleDetectBrowserLocation = () => {
    setDetectionError(null);
    if (!navigator.geolocation) {
      setDetectionError('Geolocation is not supported by your current browser.');
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        let locName = `Coordinates (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
        let city = '';
        let country = '';

        try {
          const idToken = await getCurrentUserIdToken();
          const res = await fetch('/api/geocode/reverse', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.location?.name) {
              locName = data.location.name;
              city = data.location.city || '';
              country = data.location.country || '';
            }
          }
        } catch (err) {
          console.warn('Reverse geocode lookup warning:', err);
        }

        const resolved: EntryLocation = {
          latitude: lat,
          longitude: lng,
          name: locName,
          city,
          country,
          timestamp: Date.now(),
        };

        setCandidateLocation(resolved);
        setCustomName(locName);
        setCustomLat(String(lat));
        setCustomLng(String(lng));
        setIsDetecting(false);
      },
      (err) => {
        setIsDetecting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setDetectionError(
            'Browser location permission was denied. You can search or enter your location manually below.'
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setDetectionError('Location position is currently unavailable. Please try manual entry.');
        } else if (err.code === err.TIMEOUT) {
          setDetectionError('Location request timed out. Please try again or search manually.');
        } else {
          setDetectionError(err.message || 'Unable to retrieve location.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleSearchLocations = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;

    setIsSearching(true);
    setDetectionError(null);
    try {
      const idToken = await getCurrentUserIdToken();
      const res = await fetch('/api/geocode/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        if (!data.results || data.results.length === 0) {
          setDetectionError(`No locations found for "${searchQuery}". Try a major city or place name.`);
        }
      } else {
        setDetectionError('Failed to search locations. Please try again.');
      }
    } catch (err: any) {
      console.error('Geocode search error:', err);
      setDetectionError('Failed to connect to location search service.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPreset = (preset: typeof POPULAR_PRESETS[0]) => {
    const loc: EntryLocation = {
      name: preset.name,
      city: preset.city,
      country: preset.country,
      latitude: preset.lat,
      longitude: preset.lng,
      timestamp: Date.now(),
    };
    setCandidateLocation(loc);
    setCustomName(preset.name);
    setCustomLat(String(preset.lat));
    setCustomLng(String(preset.lng));
    setDetectionError(null);
  };

  const handleSelectSearchResult = (result: {
    name: string;
    latitude: number;
    longitude: number;
    fullAddress?: string;
  }) => {
    const loc: EntryLocation = {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      timestamp: Date.now(),
    };
    setCandidateLocation(loc);
    setCustomName(result.name);
    setCustomLat(String(result.latitude));
    setCustomLng(String(result.longitude));
    setDetectionError(null);
  };

  const handleApplyManual = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setDetectionError('Please provide valid coordinates: Latitude (-90 to 90), Longitude (-180 to 180).');
      return;
    }

    const loc: EntryLocation = {
      name: customName.trim() || `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
      latitude: lat,
      longitude: lng,
      timestamp: Date.now(),
    };
    setCandidateLocation(loc);
    setDetectionError(null);
  };

  const handleConfirmAttach = () => {
    if (candidateLocation) {
      onSelectLocation(candidateLocation);
      onClose();
    } else if (customLat && customLng) {
      const lat = parseFloat(customLat);
      const lng = parseFloat(customLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        onSelectLocation({
          name: customName.trim() || `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
          latitude: lat,
          longitude: lng,
          timestamp: Date.now(),
        });
        onClose();
      }
    }
  };

  const handleRemoveLocation = () => {
    onSelectLocation(null);
    onClose();
  };

  return (
    <div
      id="location-picker-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="location-picker-modal-content"
        className="bg-[#fcfbf7] border border-[#e0ddd5] w-full max-w-lg rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e0ddd5] flex items-center justify-between bg-[#f8f6f0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4a5d4e]/10 flex items-center justify-center text-[#4a5d4e]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-base text-[#1a1a1a] font-normal">
                Attach Reflection Location
              </h2>
              <p className="text-[10px] uppercase tracking-[1px] text-[#8e8a82]">
                Optional & Privacy-Controlled
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8e8a82] hover:text-[#1a1a1a] rounded transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Privacy Assurance Banner */}
        <div className="px-6 py-2.5 bg-[#eef5ef] border-b border-[#c8ddcb] text-[11px] text-[#2c5332] flex items-start gap-2">
          <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#4a5d4e]" />
          <span>
            <strong>Zero Continuous Tracking:</strong> Location is only captured when you explicitly choose to attach it. It is private to your account.
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#e0ddd5] bg-white text-xs">
          <button
            type="button"
            onClick={() => setActiveMode('current')}
            className={`flex-1 py-3 px-4 text-center font-medium border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'current'
                ? 'border-[#4a5d4e] text-[#4a5d4e] bg-[#fcfbf7]'
                : 'border-transparent text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Detect Current</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('search')}
            className={`flex-1 py-3 px-4 text-center font-medium border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'search'
                ? 'border-[#4a5d4e] text-[#4a5d4e] bg-[#fcfbf7]'
                : 'border-transparent text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Place</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('manual')}
            className={`flex-1 py-3 px-4 text-center font-medium border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'manual'
                ? 'border-[#4a5d4e] text-[#4a5d4e] bg-[#fcfbf7]'
                : 'border-transparent text-[#8e8a82] hover:text-[#1a1a1a]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Presets / Manual</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Error / Warning Alert */}
          {detectionError && (
            <div className="p-3 bg-[#c44536]/10 border border-[#c44536]/20 rounded text-[#c44536] text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{detectionError}</span>
            </div>
          )}

          {/* Mode 1: Detect Browser Location */}
          {activeMode === 'current' && (
            <div className="space-y-4 text-center py-2">
              <div className="max-w-xs mx-auto text-center space-y-2">
                <p className="text-xs text-[#555]">
                  Click below to request your browser's current coordinates for this entry.
                </p>
                <button
                  id="btn-detect-current-location"
                  type="button"
                  onClick={handleDetectBrowserLocation}
                  disabled={isDetecting}
                  className="w-full py-2.5 px-4 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Detecting Coordinates...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Use My Current Location</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Presets underneath */}
              <div className="pt-4 border-t border-[#e0ddd5]">
                <p className="text-[10px] uppercase tracking-[1px] text-[#8e8a82] mb-2.5">
                  Or select a popular location
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {POPULAR_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className="px-2.5 py-1 bg-white border border-[#e0ddd5] hover:border-[#4a5d4e] hover:text-[#4a5d4e] text-xs rounded text-[#1a1a1a] transition-colors cursor-pointer"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Search by Place */}
          {activeMode === 'search' && (
            <div className="space-y-3">
              <form onSubmit={handleSearchLocations} className="flex gap-2">
                <input
                  id="input-location-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. San Francisco, Tokyo Tower, London, Berlin..."
                  className="flex-1 px-3 py-2 bg-white border border-[#e0ddd5] rounded text-xs text-[#1a1a1a] focus:outline-hidden focus:border-[#4a5d4e]"
                />
                <button
                  id="btn-submit-location-search"
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Search</span>
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[#e0ddd5] rounded p-1 bg-white">
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left p-2 hover:bg-[#fcfbf7] rounded text-xs transition-colors flex items-start justify-between gap-2 border-b border-gray-100 last:border-b-0 cursor-pointer"
                    >
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#4a5d4e] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-[#1a1a1a]">{res.name}</p>
                          {res.fullAddress && (
                            <p className="text-[10px] text-[#8e8a82] line-clamp-1">{res.fullAddress}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#8e8a82] shrink-0">
                        {res.latitude.toFixed(2)}, {res.longitude.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Manual Presets & Custom Coordinates */}
          {activeMode === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[1px] text-[#8e8a82] mb-1">
                  Location / Place Name
                </label>
                <input
                  id="input-manual-location-name"
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Kyoto Tea House, Mountain Cabin, Home Studio"
                  className="w-full px-3 py-2 bg-white border border-[#e0ddd5] rounded text-xs text-[#1a1a1a] focus:outline-hidden focus:border-[#4a5d4e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[1px] text-[#8e8a82] mb-1">
                    Latitude (-90 to 90)
                  </label>
                  <input
                    id="input-manual-latitude"
                    type="number"
                    step="any"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    placeholder="37.7749"
                    className="w-full px-3 py-2 bg-white border border-[#e0ddd5] rounded text-xs text-[#1a1a1a] focus:outline-hidden focus:border-[#4a5d4e]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[1px] text-[#8e8a82] mb-1">
                    Longitude (-180 to 180)
                  </label>
                  <input
                    id="input-manual-longitude"
                    type="number"
                    step="any"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    placeholder="-122.4194"
                    className="w-full px-3 py-2 bg-white border border-[#e0ddd5] rounded text-xs text-[#1a1a1a] focus:outline-hidden focus:border-[#4a5d4e]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyManual}
                className="w-full py-2 px-3 bg-white border border-[#e0ddd5] hover:border-[#4a5d4e] text-xs font-medium rounded text-[#4a5d4e] transition-colors cursor-pointer"
              >
                Apply Coordinates
              </button>
            </div>
          )}

          {/* Selected Location Preview Pill */}
          {candidateLocation && (
            <div className="mt-4 p-3.5 bg-[#f8f6f0] border border-[#c8ddcb] rounded-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#4a5d4e] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#1a1a1a]">
                      {candidateLocation.name || 'Selected Location'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-white border border-[#e0ddd5] rounded text-[#4a5d4e] font-mono">
                      {candidateLocation.latitude.toFixed(4)}, {candidateLocation.longitude.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8e8a82] mt-0.5">
                    Ready to attach to this journal entry
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCandidateLocation(null);
                  setCustomLat('');
                  setCustomLng('');
                  setCustomName('');
                }}
                className="text-[11px] text-[#c44536] hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#e0ddd5] bg-[#f8f6f0] flex items-center justify-between gap-3">
          <div>
            {currentLocation && (
              <button
                id="btn-remove-attached-location"
                type="button"
                onClick={handleRemoveLocation}
                className="text-xs text-[#c44536] hover:underline cursor-pointer"
              >
                Remove from Entry
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-location"
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#e0ddd5] bg-white hover:bg-gray-50 text-xs font-medium text-[#1a1a1a] rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-attach-location"
              type="button"
              onClick={handleConfirmAttach}
              disabled={!candidateLocation && (!customLat || !customLng)}
              className="px-4 py-2 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Attach Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
