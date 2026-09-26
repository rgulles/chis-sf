import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Heart, Sparkles, X, Image as ImageIcon, CheckCircle, Maximize2, Share2, Filter } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { CommunityPhoto } from '../types';
import { getStoredCommunityPhotos, saveStoredCommunityPhotos } from '../data/communityPhotos';

interface VisitorPhotoWallProps {
  siteId: string;
  siteName: string;
  defaultUserName?: string;
  onPhotoUploaded?: (photo: CommunityPhoto) => void;
}

export const VisitorPhotoWall: React.FC<VisitorPhotoWallProps> = ({
  siteId,
  siteName,
  defaultUserName = 'Heritage Explorer',
  onPhotoUploaded
}) => {
  const [photos, setPhotos] = useState<CommunityPhoto[]>([]);
  const [isUploadingOpen, setIsUploadingOpen] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [contributorName, setContributorName] = useState<string>(defaultUserName);
  const [selectedTag, setSelectedTag] = useState<string>('Architecture & Details');
  const [filterMode, setFilterMode] = useState<'all' | 'user' | 'curated'>('all');
  const [likedPhotoIds, setLikedPhotoIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sf_liked_photos');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<CommunityPhoto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load photos from storage
  useEffect(() => {
    const all = getStoredCommunityPhotos();
    setPhotos(all.filter((p) => p.siteId === siteId));
  }, [siteId]);

  // Keep contributor name updated if default changes
  useEffect(() => {
    if (defaultUserName && (!contributorName || contributorName === 'Heritage Explorer')) {
      setContributorName(defaultUserName);
    }
  }, [defaultUserName]);

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle Drop Event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Process File with automatic scaling to save storage
  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      // Create an image element to scale it down before saving
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPreviewImage(compressedDataUrl);
        } else {
          setPreviewImage(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewImage) {
      alert('Please select or drop a photo to upload.');
      return;
    }

    setIsSubmitting(true);

    const newPhoto: CommunityPhoto = {
      id: `cp-user-${Date.now()}`,
      siteId,
      imageUrl: previewImage,
      caption: caption.trim() || `Visiting ${siteName}`,
      contributorName: contributorName.trim() || 'Visiting Traveler',
      date: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      likes: 1,
      tags: [selectedTag],
      isUserUploaded: true
    };

    // Update state and persistence
    const allStored = getStoredCommunityPhotos();
    const updated = [newPhoto, ...allStored];
    saveStoredCommunityPhotos(updated);
    setPhotos(updated.filter((p) => p.siteId === siteId));

    // Also auto-like the user's own upload
    const nextLiked = [...likedPhotoIds, newPhoto.id];
    setLikedPhotoIds(nextLiked);
    try {
      localStorage.setItem('sf_liked_photos', JSON.stringify(nextLiked));
    } catch {}

    // Micro-celebration
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#7e1925', '#D49B24', '#FAF2EE']
    });

    setIsSubmitting(false);
    setSuccessMessage('Your photo has been successfully pinned to the community memory album!');
    setPreviewImage(null);
    setCaption('');
    setIsUploadingOpen(false);

    if (onPhotoUploaded) {
      onPhotoUploaded(newPhoto);
    }

    // Auto-clear message after 5 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleToggleLike = (photoId: string) => {
    const isLiked = likedPhotoIds.includes(photoId);
    const nextLiked = isLiked
      ? likedPhotoIds.filter((id) => id !== photoId)
      : [...likedPhotoIds, photoId];

    setLikedPhotoIds(nextLiked);
    try {
      localStorage.setItem('sf_liked_photos', JSON.stringify(nextLiked));
    } catch {}

    const allStored = getStoredCommunityPhotos();
    const updated = allStored.map((p) => {
      if (p.id === photoId) {
        return {
          ...p,
          likes: isLiked ? Math.max(0, p.likes - 1) : p.likes + 1
        };
      }
      return p;
    });

    saveStoredCommunityPhotos(updated);
    setPhotos(updated.filter((p) => p.siteId === siteId));

    if (activeLightboxPhoto && activeLightboxPhoto.id === photoId) {
      setActiveLightboxPhoto((prev) =>
        prev
          ? {
              ...prev,
              likes: isLiked ? Math.max(0, prev.likes - 1) : prev.likes + 1
            }
          : null
      );
    }
  };

  // Filtered photos
  const filteredPhotos = photos.filter((p) => {
    if (filterMode === 'user') return p.isUserUploaded;
    if (filterMode === 'curated') return !p.isUserUploaded;
    return true;
  });

  const availableTags = [
    'Architecture & Details',
    'Family Heritage Walk',
    'Historical Plaque',
    'Golden Hour Sunset',
    'Night Lanterns'
  ];

  return (
    <section id="section-visitor-photo-wall" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e7e0d6] pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 bg-[#D49B24]" />
            <h2 className="headline-md text-[#1e1b19]">
              Community Photo Wall & Memories
            </h2>
          </div>
          <p className="body-sm text-[#574141]">
            Mga Tala at Larawan ning Balen • Share your personal view, family walk, or architectural snapshot
          </p>
        </div>

        <button
          id="open-upload-photo-btn"
          onClick={() => {
            setIsUploadingOpen(!isUploadingOpen);
            setSuccessMessage(null);
          }}
          className="flex items-center gap-2 rounded-lg bg-[#7e1925] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#580b14] transition-all self-start sm:self-auto shadow-xs"
        >
          <Camera className="h-4 w-4 text-[#F7D070]" />
          <span>{isUploadingOpen ? 'Close Form' : 'Upload Your Photo'}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-lg border border-[#D49B24] bg-[#faf2ee] p-4 text-xs font-medium text-[#7e1925]">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#D49B24]" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-[#8a7171] hover:text-[#1e1b19]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Interactive Upload Tray / Form */}
      {isUploadingOpen && (
        <form
          onSubmit={handleFormSubmit}
          className="rounded-xl border-2 border-dashed border-[#D49B24] bg-white p-5 sm:p-6 space-y-4 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D49B24]" />
              <h3 className="font-serif text-base font-bold text-[#1e1b19]">
                Contribute to the Heritage Archive
              </h3>
            </div>
            <span className="text-[11px] text-[#8a7171]">
              Supported: JPG, PNG, WebP
            </span>
          </div>

          {/* Drag & Drop Zone + Click Handler */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-[#7e1925] bg-[#faf2ee]'
                : previewImage
                ? 'border-[#e7e0d6] bg-[#faf2ee]/50'
                : 'border-[#ddbfbf] hover:border-[#7e1925] bg-[#faf2ee]/30'
            }`}
          >
            <input
              ref={fileInputRef}
              id="visitor-photo-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {previewImage ? (
              <div className="relative group w-full max-w-sm">
                <img
                  src={previewImage}
                  alt="Selected preview"
                  className="h-48 w-full object-cover rounded-md border border-[#e7e0d6]"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImage(null);
                  }}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black transition-colors"
                  title="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="label-compact text-[#7e1925] mt-2 text-center">
                  Click or drop a different file to replace
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#faf2ee] border border-[#e7e0d6] text-[#7e1925]">
                  <Upload className="h-5 w-5 text-[#D49B24]" />
                </div>
                <div>
                  <p className="body-sm font-semibold text-[#1e1b19]">
                    Click to browse or drag and drop your photo here
                  </p>
                  <p className="label-compact text-[#574141] mt-0.5">
                    Share a clear photo of the building facade, architectural details, or your visit
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields: Contributor Name & Caption */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="contributor-name-input"
                className="label-compact text-[#574141] block mb-1"
              >
                Your Name or Family / Group Name:
              </label>
              <input
                id="contributor-name-input"
                type="text"
                required
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                placeholder="e.g. Maria Dayrit & Family"
                className="w-full rounded-lg border border-[#e7e0d6] bg-[#faf2ee]/40 px-3 py-2 text-sm text-[#1e1b19] focus:border-[#7e1925] focus:outline-hidden"
              />
            </div>

            <div>
              <label
                htmlFor="photo-tag-select"
                className="label-compact text-[#574141] block mb-1"
              >
                Category / Tag:
              </label>
              <select
                id="photo-tag-select"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full rounded-lg border border-[#e7e0d6] bg-[#faf2ee]/40 px-3 py-2 text-sm text-[#1e1b19] focus:border-[#7e1925] focus:outline-hidden"
              >
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="photo-caption-input"
              className="label-compact text-[#574141] block mb-1"
            >
              Story or Memory Caption:
            </label>
            <textarea
              id="photo-caption-input"
              rows={2}
              required
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What made this moment special? Describe what you felt or discovered at this landmark..."
              className="w-full rounded-lg border border-[#e7e0d6] bg-[#faf2ee]/40 px-3 py-2 text-sm text-[#1e1b19] focus:border-[#7e1925] focus:outline-hidden resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e7e0d6]">
            <button
              type="button"
              onClick={() => {
                setIsUploadingOpen(false);
                setPreviewImage(null);
              }}
              className="rounded-lg border border-[#e7e0d6] px-4 py-2 text-xs font-semibold text-[#574141] hover:bg-[#faf2ee] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!previewImage || isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-[#7e1925] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#580b14] disabled:opacity-50 transition-colors shadow-xs"
            >
              <Upload className="h-3.5 w-3.5 text-[#F7D070]" />
              <span>{isSubmitting ? 'Publishing...' : 'Publish to Photo Wall'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Gallery Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-[#8a7171]" />
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterMode === 'all'
                ? 'bg-[#7e1925] text-white border-[#7e1925]'
                : 'bg-white text-[#574141] border-[#e7e0d6] hover:border-[#7e1925]'
            }`}
          >
            All Photos ({photos.length})
          </button>
          <button
            onClick={() => setFilterMode('user')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterMode === 'user'
                ? 'bg-[#7e1925] text-white border-[#7e1925]'
                : 'bg-white text-[#574141] border-[#e7e0d6] hover:border-[#7e1925]'
            }`}
          >
            Visitor Uploads ({photos.filter((p) => p.isUserUploaded).length})
          </button>
          <button
            onClick={() => setFilterMode('curated')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterMode === 'curated'
                ? 'bg-[#7e1925] text-white border-[#7e1925]'
                : 'bg-white text-[#574141] border-[#e7e0d6] hover:border-[#7e1925]'
            }`}
          >
            Curated Highlights ({photos.filter((p) => !p.isUserUploaded).length})
          </button>
        </div>

        <span className="text-[11px] text-[#8a7171]">
          {filteredPhotos.length} {filteredPhotos.length === 1 ? 'memory' : 'memories'} displayed
        </span>
      </div>

      {/* Community Photo Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e7e0d6] bg-white p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#faf2ee] text-[#7e1925]">
            <ImageIcon className="h-6 w-6 text-[#D49B24]" />
          </div>
          <div>
            <h4 className="font-serif text-base font-semibold text-[#1e1b19]">
              No photos in this category yet
            </h4>
            <p className="body-sm text-[#574141] mt-0.5 max-w-sm mx-auto">
              Be the first visitor to share your picture of {siteName}!
            </p>
          </div>
          <button
            onClick={() => setIsUploadingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7e1925] px-4 py-2 text-xs font-semibold text-white hover:bg-[#580b14] transition-colors"
          >
            <Camera className="h-3.5 w-3.5 text-[#F7D070]" />
            <span>Upload the First Photo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredPhotos.map((photo) => {
            const isLiked = likedPhotoIds.includes(photo.id);
            return (
              <div
                key={photo.id}
                id={`photo-card-${photo.id}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#e7e0d6] bg-white transition-all duration-200 hover:border-[#D49B24] hover:shadow-sm"
              >
                {/* Photo with Overlay Triggers */}
                <div
                  onClick={() => setActiveLightboxPhoto(photo)}
                  className="relative aspect-4/3 w-full overflow-hidden bg-[#1e1b19] cursor-pointer"
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.caption}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Badge & Like Button on Top */}
                  <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                    {photo.isUserUploaded ? (
                      <span className="rounded-md bg-[#7e1925] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs pointer-events-auto flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-[#F7D070]" />
                        Visitor Upload
                      </span>
                    ) : (
                      <span className="rounded-md bg-[#231416]/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-[#F7D070] border border-[#D49B24]/40 shadow-xs pointer-events-auto">
                        Curated
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLike(photo.id);
                      }}
                      className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold backdrop-blur-md transition-transform active:scale-90 pointer-events-auto ${
                        isLiked
                          ? 'bg-[#7e1925] text-white'
                          : 'bg-black/50 text-white/90 hover:bg-black/70'
                      }`}
                      title={isLiked ? 'Unlike photo' : 'Like photo'}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${isLiked ? 'fill-white text-white' : 'text-white'}`}
                      />
                      <span>{photo.likes}</span>
                    </button>
                  </div>

                  {/* Expand icon on hover */}
                  <div className="absolute bottom-2 right-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    {photo.tags && photo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {photo.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-[#faf2ee] border border-[#e7e0d6] px-1.5 py-0.5 text-[10px] font-medium text-[#7e1925]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="body-sm text-[#1e1b19] line-clamp-2 leading-snug">
                      “{photo.caption}”
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#e7e0d6] flex items-center justify-between text-xs text-[#574141]">
                    <span className="font-semibold text-[#1e1b19] truncate">
                      {photo.contributorName}
                    </span>
                    <span className="text-[11px] text-[#8a7171] flex-shrink-0">
                      {photo.date}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxPhoto && (
        <div
          id="photo-lightbox-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-sm"
          onClick={() => setActiveLightboxPhoto(null)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-white/20 bg-[#1e1b19] text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              id="close-lightbox-btn"
              onClick={() => setActiveLightboxPhoto(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Main Image View */}
            <div className="relative max-h-[65vh] w-full overflow-hidden bg-black flex items-center justify-center">
              <img
                src={activeLightboxPhoto.imageUrl}
                alt={activeLightboxPhoto.caption}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Lightbox Footer Details */}
            <div className="p-5 space-y-3 bg-[#1e1b19]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-sm font-semibold text-white">
                      {activeLightboxPhoto.contributorName}
                    </span>
                    {activeLightboxPhoto.isUserUploaded && (
                      <span className="rounded bg-[#7e1925] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Visitor Upload
                      </span>
                    )}
                  </div>
                  <span className="label-compact text-white/60">
                    Captured at {siteName} • {activeLightboxPhoto.date}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleLike(activeLightboxPhoto.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      likedPhotoIds.includes(activeLightboxPhoto.id)
                        ? 'bg-[#7e1925] text-white'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        likedPhotoIds.includes(activeLightboxPhoto.id)
                          ? 'fill-white text-white'
                          : 'text-white'
                      }`}
                    />
                    <span>{activeLightboxPhoto.likes} Likes</span>
                  </button>

                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `${siteName} Memory`,
                          text: `“${activeLightboxPhoto.caption}” — Shared by ${activeLightboxPhoto.contributorName}`,
                          url: window.location.href
                        }).catch(() => {});
                      } else {
                        navigator.clipboard?.writeText(window.location.href);
                        alert('Photo link copied to clipboard!');
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/5 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              <p className="body-md text-white/90 italic">
                “{activeLightboxPhoto.caption}”
              </p>

              {activeLightboxPhoto.tags && activeLightboxPhoto.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeLightboxPhoto.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-white/10 px-2 py-0.5 text-xs text-[#F7D070]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
