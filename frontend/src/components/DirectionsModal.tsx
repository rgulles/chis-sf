import React from 'react';
import { X, Navigation, Bus, MapPin, ExternalLink } from 'lucide-react';
import type { HeritageSite } from '../types';
import { hasUsableCoordinates } from '../utils/heritageCoordinates';

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: HeritageSite | null;
}

export const DirectionsModal: React.FC<DirectionsModalProps> = ({
  isOpen,
  onClose,
  site
}) => {
  if (!isOpen || !site || !hasUsableCoordinates(site.coordinates)) return null;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${site.coordinates.lat},${site.coordinates.lng}`;

  return (
    <div id="directions-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div id="directions-modal-dialog" className="relative w-full max-w-md overflow-hidden rounded border border-[#e7e0d6] bg-[#faf2ee]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e7e0d6] bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#faf2ee] text-[#7e1925] border border-[#e7e0d6]">
              <Navigation className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-semibold text-[#1e1b19]">Getting There</h3>
              <p className="label-compact text-[#574141] truncate max-w-[220px]">{site.name}</p>
            </div>
          </div>
          <button
            id="close-directions-btn"
            onClick={onClose}
            className="rounded p-1 text-[#574141] hover:text-[#1e1b19]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Location Summary */}
          <div className="bg-white p-3.5 rounded border border-[#e7e0d6]">
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-[#7e1925] flex-shrink-0 mt-0.5" />
              <div>
                <span className="body-sm font-semibold text-[#1e1b19] block">{site.address}</span>
                <span className="label-compact text-[#574141]">{site.address}</span>
              </div>
            </div>
          </div>

          {/* San Fernando Local Commuting Tips */}
          <div className="space-y-2.5">
            <h4 className="label-prominent text-[#7e1925] flex items-center gap-1.5">
              <Bus className="h-3.5 w-3.5 text-[#b45309]" />
              San Fernando Transit Guide
            </h4>

            {/* Jeepney option */}
            <div className="rounded border border-[#e7e0d6] bg-white p-3 body-sm space-y-1">
              <div className="flex items-center justify-between font-semibold text-[#1e1b19]">
                <span>Color-Coded Jeepneys (San Fernando Poblacion)</span>
                <span className="text-[#7e1925]">₱13 - ₱18</span>
              </div>
              <p className="body-sm text-[#574141]">
                Board any "Angeles - San Fernando" or "Guagua - San Fernando" jeepney. Request to drop off at Consunji or Intersection / Capitol.
              </p>
            </div>

            {/* Tricycle option */}
            <div className="rounded border border-[#e7e0d6] bg-white p-3 body-sm space-y-1">
              <div className="flex items-center justify-between font-semibold text-[#1e1b19]">
                <span>Local TODA Tricycle</span>
                <span className="text-[#b45309]">₱30 - ₱60 / ride</span>
              </div>
              <p className="body-sm text-[#574141]">
                Available at City Public Market, MacArthur Highway corners, and Cathedral plaza. Direct drop-off at entrance.
              </p>
            </div>

            {/* Bus from Metro Manila / Clark */}
            <div className="rounded border border-[#e7e0d6] bg-white p-3 body-sm space-y-1">
              <div className="flex items-center justify-between font-semibold text-[#1e1b19]">
                <span>From Manila / Clark Airport</span>
                <span className="text-[#574141]">~1 hr 15 mins</span>
              </div>
              <p className="body-sm text-[#574141]">
                Take Victory Liner, Genesis, or Bataan Transit to San Fernando Intersection terminal, then 5 mins tricycle to the site.
              </p>
            </div>
          </div>

          {/* External Google Maps Button */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded bg-[#7e1925] py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#580b14] transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Open in Google Maps Navigation</span>
          </a>
        </div>
      </div>
    </div>
  );
};
