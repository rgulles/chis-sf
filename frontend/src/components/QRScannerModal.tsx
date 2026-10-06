import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, QrCode, Sparkles, CheckCircle2, AlertCircle, KeyRound, ArrowRight } from 'lucide-react';
import type { HeritageSite } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: HeritageSite[];
  onSelectSite?: (site: HeritageSite) => void;
  onScanSuccess?: (scannedCode: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  sites,
  onSelectSite,
  onScanSuccess
}) => {
  const [useCamera, setUseCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [plaqueCodeInput, setPlaqueCodeInput] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    if (isOpen && useCamera) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
          setCameraError(null);
        })
        .catch((err) => {
          console.warn('Camera permission not granted:', err);
          setCameraError('Camera access unavailable in preview environment. Use the 4-digit NHCP code or quick site selector below.');
          setUseCamera(false);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, useCamera]);

  if (!isOpen) return null;

  const handleSimulatedScan = (site: HeritageSite) => {
    if (onScanSuccess) {
      onScanSuccess(site.qrCodeId || site.id);
    } else if (onSelectSite) {
      onSelectSite(site);
    }
    onClose();
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = plaqueCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    // Match by nhcpPlaqueCode or yearBuilt or qrCodeId
    const foundSite = sites.find(s => 
      s.nhcpPlaqueCode === cleanCode || 
      s.yearBuilt.includes(cleanCode) || 
      s.qrCodeId?.toUpperCase().includes(cleanCode) ||
      s.id.toLowerCase().includes(cleanCode.toLowerCase())
    );

    if (foundSite) {
      setCodeError(null);
      if (onScanSuccess) {
        onScanSuccess(foundSite.qrCodeId || foundSite.id);
      } else if (onSelectSite) {
        onSelectSite(foundSite);
      }
      onClose();
    } else {
      setCodeError(`No registered landmark found for code #${cleanCode}. Try 1870, 1892, or 1755.`);
    }
  };

  return (
    <div 
      id="qr-scanner-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div 
        id="qr-scanner-dialog" 
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-[#e7e0d6] bg-[#faf2ee] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e7e0d6] bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7e1925] text-white">
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-[#1e1b19]">On-Site Discovery Plaque</h3>
              <p className="label-compact text-[#574141]">Scan QR or enter 4-digit NHCP brass plaque code</p>
            </div>
          </div>
          <button
            id="close-qr-scanner-btn"
            onClick={onClose}
            className="rounded p-1.5 text-[#574141] hover:text-[#1e1b19] hover:bg-[#faf2ee] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="p-5 space-y-4">
          <div className="relative mx-auto flex h-56 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-[#e7e0d6] bg-[#1e1b19] text-white">
            {useCamera ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="h-full w-full object-cover" 
              />
            ) : (
              <div className="flex flex-col items-center px-4 text-center relative z-10">
                <div className="relative mb-2">
                  <QrCode className="h-12 w-12 text-[#D49B24] animate-pulse" />
                  {/* Subtle 8-pointed star in reticle center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                    <svg className="w-8 h-8 text-[#F7D070]" viewBox="0 0 100 100" fill="currentColor">
                      <polygon points="50,0 60,35 95,50 60,65 50,100 40,65 5,50 40,35" />
                    </svg>
                  </div>
                </div>
                <p className="body-sm font-semibold text-white/90">Point camera at Heritage Plaque</p>
                <p className="label-compact text-white/60 mt-1 max-w-xs leading-relaxed">
                  Position QR marker inside frame to instantly verify arrival and unlock oral memoirs
                </p>
              </div>
            )}

            {/* Target Reticle Borders with Lantern Gold Accents */}
            <div className="pointer-events-none absolute inset-6 border border-white/20 rounded">
              <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#D49B24]" />
              <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[#D49B24]" />
              <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#D49B24]" />
              <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#D49B24]" />
            </div>

            {/* Live camera toggle */}
            <button
              onClick={() => setUseCamera(!useCamera)}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded border border-white/20 bg-black/40 backdrop-blur-md px-3 py-1 text-xs text-white hover:bg-black/60 transition-colors"
            >
              <Camera className="h-3 w-3" />
              <span>{useCamera ? 'Stop Camera' : 'Use Camera'}</span>
            </button>
          </div>

          {cameraError && (
            <div className="flex items-center gap-2 label-compact text-[#7e1925] bg-[#faf2ee] p-2.5 rounded border border-[#ddbfbf]">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-[#7e1925]" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* 4-Digit NHCP Plaque Manual Entry */}
          <form onSubmit={handleCodeSubmit} className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label htmlFor="nhcp-code-input" className="label-prominent text-[#7e1925] flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-[#D49B24]" />
                Or Enter NHCP 4-Digit Brass Plaque Code:
              </label>
            </div>
            <div className="flex gap-2">
              <input
                id="nhcp-code-input"
                type="text"
                placeholder="e.g. 1870, 1892, 1755..."
                value={plaqueCodeInput}
                onChange={(e) => {
                  setPlaqueCodeInput(e.target.value);
                  setCodeError(null);
                }}
                className="flex-1 rounded-lg border border-[#e7e0d6] bg-white px-3 py-2 text-sm font-semibold tracking-wider text-[#1e1b19] focus:border-[#7e1925] focus:outline-hidden"
              />
              <button
                type="submit"
                className="flex items-center gap-1 rounded-lg bg-[#7e1925] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#580b14] transition-colors"
              >
                <span>Verify</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {codeError && (
              <p className="text-xs text-[#ba1a1a] font-medium">{codeError}</p>
            )}
          </form>

          {/* Quick Simulated Scan Demo Buttons */}
          <div className="pt-2 border-t border-[#e7e0d6]">
            <div className="flex items-center justify-between mb-2">
              <span className="label-prominent text-[#1e1b19] flex items-center gap-1 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-[#D49B24]" />
                Quick Check-in Landmark Plagues
              </span>
              <span className="text-[10px] text-[#8a7171] uppercase font-bold">1-Click Scan</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {sites.map((site) => (
                <button
                  key={site.id}
                  id={`simulate-scan-${site.id}`}
                  onClick={() => handleSimulatedScan(site)}
                  className="flex items-center justify-between rounded-lg border border-[#e7e0d6] bg-white p-2.5 text-left body-sm font-semibold text-[#1e1b19] hover:border-[#7e1925] hover:bg-[#faf2ee] transition-colors group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#D49B24] group-hover:text-[#7e1925] flex-shrink-0" />
                    <span className="truncate text-xs">{site.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#7e1925] bg-[#faf2ee] px-2 py-0.5 rounded border border-[#e7e0d6] flex-shrink-0">
                    #{site.nhcpPlaqueCode || site.yearBuilt.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
