import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  Map,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  LogOut,
  Plus,
  Trash2,
  Edit3,
  Menu,
  X,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Compass,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  apiFetchRawSites, apiCreateSite, apiUpdateSite, apiDeleteSite,
  apiFetchAdminEvents, apiCreateEvent, apiUpdateEvent, apiDeleteEvent,
  apiFetchSiteImages, apiCreateSiteImage, apiUpdateSiteImage, apiDeleteSiteImage,
  apiCreateTimeline, apiUpdateTimeline, apiDeleteTimeline, AdminApiError
} from '../api/client';
import type { UserProfile } from '../types';
import { eventDateForInput, eventDateForSubmission, replaceEventDate, storageImageUrl } from '../utils/adminData';
import { HERITAGE_CATEGORIES } from '../data/heritageCategories';
import { HERITAGE_IMAGE_PLACEHOLDER, handleHeritageImageError } from '../utils/heritageImages';
import { AdminItineraries } from '../components/AdminItineraries';
import { AdminCheckins } from '../components/AdminCheckins';
import { AdminTravelers } from '../components/AdminTravelers';
import { AdminContributions } from '../components/AdminContributions';
import { AdminDashboard } from '../components/AdminDashboard';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { AdminPhotoManagement } from './AdminPhotoManagement';



interface AdminViewProps {
  user: UserProfile;
  onLogout: () => void;
  onPublicDataChanged?: (kind: 'heritage' | 'events') => void;
}

type TabType = 'dashboard' | 'sites' | 'images' | 'events' | 'timelines' | 'itineraries' | 'checkins' | 'travelers' | 'contributions';
type FormType = 'site' | 'event' | 'image' | 'timeline';

const computeEventStatus = (e: any) => {
  if (e.status === 'cancelled') return 'cancelled';
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = (e.event_date || '').split(' ')[0] || todayStr;
    const endDateStr = (e.end_date || '').split(' ')[0] || startDateStr;

    const parseTime = (timeStr: string, defaultTime: string) => {
      if (!timeStr) return defaultTime;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return defaultTime;
      let [_, h, m, ampm] = match;
      let hours = parseInt(h);
      if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${m}:00`;
    };

    const startDateTime = new Date(`${startDateStr}T${parseTime(e.start_time || e.time, '00:00:00')}`);
    const endDateTime = new Date(`${endDateStr}T${parseTime(e.end_time, '23:59:59')}`);
    const now = new Date();

    if (now > endDateTime) return 'completed';
    if (now >= startDateTime && now <= endDateTime) return 'ongoing';
    return 'upcoming';
  } catch {
    return e.status || 'upcoming';
  }
};

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout, onPublicDataChanged }) => {
  const { addToast } = useToast();

  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [managingPhotosForSite, setManagingPhotosForSite] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sites, setSites] = useState<any[]>([]);
  const [siteSearch, setSiteSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [sitePage, setSitePage] = useState(1);
  const [siteSortBy, setSiteSortBy] = useState<'asc' | 'desc' | 'newest' | 'oldest'>('newest');
  const [siteCategoryFilter, setSiteCategoryFilter] = useState<string>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const SITES_PER_PAGE = 10;

  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled'>('all');
  const [eventPage, setEventPage] = useState(1);
  const [eventSortBy, setEventSortBy] = useState<'asc' | 'desc' | 'newest' | 'oldest'>('newest');
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('all');
  const [eventFilterMenuOpen, setEventFilterMenuOpen] = useState(false);
  const EVENTS_PER_PAGE = 10;

  const [events, setEvents] = useState<any[]>([]);
  const [siteImages, setSiteImages] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Partial<Record<FormType, AdminApiError>>>({});


  useEffect(() => {
    // Clear old errors
    document.querySelectorAll(".inline-error-msg").forEach(e => e.remove());
    document.querySelectorAll(".error-field-highlight").forEach(e => {
      e.classList.remove("error-field-highlight", "border-red-500", "bg-red-50", "text-red-900");
      e.classList.add("border-[#e8dfd5]");
    });

    Object.entries(formErrors).forEach(([formType, err]) => {
      const formEl = document.getElementById(`admin-${formType}-form`);
      if (!formEl || !err || !err.validationErrors) return;

      Object.entries(err.validationErrors).forEach(([field, messages]) => {
        // Some backend fields might map to different frontend names, but mostly they match
        const inputEl = formEl.querySelector(`[name="${field}"]`);
        if (inputEl) {
          inputEl.classList.add("error-field-highlight", "border-red-500", "bg-red-50", "text-red-900");
          inputEl.classList.remove("border-[#e8dfd5]");

          const errorText = document.createElement("p");
          errorText.className = "inline-error-msg text-xs font-semibold text-red-600 mt-1.5 animate-fade-slide-in";
          errorText.innerText = messages.join(", ");

          // Append to parent, or if parent is a flex row (like opening hours), append to grandparent
          let container = inputEl.parentElement;
          if (container && container.classList.contains("flex") && container.classList.contains("items-center")) {
            container = container.parentElement;
          }
          container?.appendChild(errorText);
        }
      });
    });
  }, [formErrors]);

  const pendingRequests = useRef(new Set<string>());
  const [pending, setPending] = useState(new Set<string>());
  const loadRevision = useRef(0);

  const fetchData = useCallback(async () => {
    const revision = ++loadRevision.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [fetchedSites, fetchedEvents, fetchedImages] = await Promise.all([
        apiFetchRawSites(), apiFetchAdminEvents(), apiFetchSiteImages(),
      ]);
      if (revision !== loadRevision.current) return;
      setSites(fetchedSites);
      setEvents(fetchedEvents);
      setSiteImages(fetchedImages);
    } catch (error) {
      if (revision === loadRevision.current) {
        setLoadError(error instanceof AdminApiError ? error.message : 'Unable to load admin data. Please retry.');
      }
    } finally {
      if (revision === loadRevision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openForm = (form: FormType, open: () => void) => {
    if (pendingRequests.current.has(`save:${form}`)) return;
    setFormErrors((previous) => ({ ...previous, [form]: undefined }));
    open();
  };

  const runMutation = async (key: string, request: () => Promise<unknown>, message: string,
    close?: () => void, form?: FormType) => {
    if (pendingRequests.current.has(key)) return;
    pendingRequests.current.add(key);
    setPending(new Set(pendingRequests.current));
    if (form) setFormErrors((previous) => ({ ...previous, [form]: undefined }));
    try {
      await request();
      onPublicDataChanged?.(key.includes('event') ? 'events' : 'heritage');
      close?.();
      addToast('success', message);
      await fetchData();
    } catch (error) {
      // Multi-step site edits may have committed some requests before a later request failed.
      onPublicDataChanged?.(key.includes('event') ? 'events' : 'heritage');
      const failure = error instanceof AdminApiError ? error : new AdminApiError('The request failed. Please try again.');
      if (form) setFormErrors((previous) => ({ ...previous, [form]: failure }));
      else addToast('error', failure.message);
    } finally {
      pendingRequests.current.delete(key);
      setPending(new Set(pendingRequests.current));
    }
  };

  const renderFormError = (form: FormType) => {
    const error = formErrors[form];
    return error ? (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p>{error.message}</p>
        {Object.entries(error.validationErrors).map(([field, messages]) => messages.map((message, index) => (
          <p key={`${field}-${index}`}>{message}</p>
        )))}
      </div>
    ) : null;
  };

  // Handlers for deleting
  const handleDeleteSite = (id: string) => {
    if (pendingRequests.current.has(`delete:site:${id}`)) return;
    confirm({
      title: 'Archive Site',
      message: 'Are you sure you want to archive this site?',
      confirmText: 'Archive',
      onConfirm: async () => {
        await runMutation(`delete:site:${id}`, () => apiDeleteSite(id), 'Heritage site archived successfully.');
      }
    });
  };

  const handleDeleteEvent = (id: string) => {
    if (pendingRequests.current.has(`delete:event:${id}`)) return;
    confirm({
      title: 'Cancel Event',
      message: 'Are you sure you want to cancel this event?',
      confirmText: 'Cancel Event',
      onConfirm: async () => {
        await runMutation(`delete:event:${id}`, () => apiDeleteEvent(id), 'Event cancelled successfully.');
      }
    });
  };

  

  interface DraftImage {
    key: string;
    id?: string | number;
    image_path?: string;
    imageFile?: File | null;
    previewUrl: string;
    caption: string;
    is_cover: boolean;
  }

  interface DraftTimeline {
    key: string;
    id?: string | number;
    year: string;
    title: string;
    description: string;
  }

  function parseYearNumber(yearStr: string): number {
    if (!yearStr) return 9999;
    const match = yearStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 9999;
  }

  // --- MODAL STATE ---
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteForm, setSiteForm] = useState<Record<string, string>>({});
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [draftTimelines, setDraftTimelines] = useState<DraftTimeline[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [removedTimelineIds, setRemovedTimelineIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepError, setStepError] = useState<string | null>(null);



  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const validateBasicInfo = (): boolean => {
    const lat = siteForm.latitude?.toString().trim();
    const lng = siteForm.longitude?.toString().trim();

    if (!siteForm.name?.trim() || !siteForm.address?.trim() || !siteForm.description?.trim() || !siteForm.history?.trim() || !lat || !lng) {
      setStepError('Please fill out all required Basic Information fields');
      return false;
    }

    if (isNaN(Number(lat)) || isNaN(Number(lng))) {
      setStepError('Latitude and Longitude must be valid numbers.');
      return false;
    }

    if (siteForm.year_built && siteForm.year_built.trim() !== '' && isNaN(Number(siteForm.year_built))) {
      setStepError('Year Built must be a valid number.');
      return false;
    }

    setStepError(null);
    return true;
  };

  const goToStep = (step: number) => {
    if (currentStep === 1 && step !== 1) {
      if (!validateBasicInfo()) return;
    }

    if (currentStep === 2) {
      // Filter out completely empty timelines
      const cleaned = draftTimelines.filter(t => t.title?.trim() || t.year?.trim() || t.description?.trim());

      // Validate remaining timelines
      for (const t of cleaned) {
        if (!t.title?.trim() || !t.year?.trim() || !t.description?.trim()) {
          setStepError('Please complete all fields (Title, Year, Description) for every timeline entry you added, or delete the incomplete ones.');
          return;
        }
      }
      setDraftTimelines(cleaned);
    }

    // Always re-validate step 1 before allowing forward progression to steps 2, 3, or 4
    if (step > 1 && !validateBasicInfo()) {
      setCurrentStep(1);
      return;
    }

    setStepError(null);
    setCurrentStep(step);
  };

  const openCreateSiteModal = () => {
    openForm('site', () => {
      setSiteForm({ status: 'active', category: '' });
      setDraftImages([]);
      setDraftTimelines([]);
      setRemovedImageIds([]);
      setRemovedTimelineIds([]);
      setStepError(null);
      setCurrentStep(1);
      setSiteModalOpen(true);
    });
  };

  const openEditSiteModal = (s: any) => {
    openForm('site', () => {
      setSiteForm({ ...s });
      setDraftImages(
        (s.images || []).map((img: any) => ({
          key: `img_${img.id}`,
          id: img.id,
          image_path: img.image_path,
          imageFile: null,
          previewUrl: storageImageUrl(img.image_path),
          caption: img.caption || '',
          is_cover: Boolean(img.is_cover),
        }))
      );
      setDraftTimelines(
        (s.timelines || []).map((t: any) => ({
          key: `t_${t.id}`,
          id: t.id,
          year: t.year || '',
          title: t.title || '',
          description: t.description || '',
        }))
      );
      setRemovedImageIds([]);
      setRemovedTimelineIds([]);
      setStepError(null);
      setCurrentStep(1);
      setSiteModalOpen(true);
    });
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newDrafts: DraftImage[] = [];
    const maxBytes = 5 * 1024 * 1024;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validTypes.includes(file.type)) {
        setStepError(`File "${file.name}" is not a supported image format (JPEG, PNG, WEBP, GIF).`);
        continue;
      }
      if (file.size > maxBytes) {
        setStepError(`File "${file.name}" exceeds the maximum size limit of 5MB.`);
        continue;
      }
      const currentCoverExists = draftImages.some(img => img.is_cover) || newDrafts.some(img => img.is_cover);
      newDrafts.push({
        key: `temp_img_${Date.now()}_${Math.random()}`,
        imageFile: file,
        previewUrl: URL.createObjectURL(file),
        caption: '',
        is_cover: !currentCoverExists,
      });
    }

    if (newDrafts.length > 0) {
      setDraftImages(prev => [...prev, ...newDrafts]);
    }
    e.target.value = '';
  };

  const handleToggleCover = (key: string) => {
    setDraftImages(prev =>
      prev.map(img => ({
        ...img,
        is_cover: img.key === key ? !img.is_cover : false,
      }))
    );
  };

  const handleRemoveImage = (key: string) => {
    const target = draftImages.find(img => img.key === key);
    if (target?.id) {
      setRemovedImageIds(prev => [...prev, String(target.id)]);
    }
    setDraftImages(prev => prev.filter(img => img.key !== key));
  };



  const handleRemoveTimelineItem = (key: string) => {
    const target = draftTimelines.find(t => t.key === key);
    if (target?.id) {
      setRemovedTimelineIds(prev => [...prev, String(target.id)]);
    }
    setDraftTimelines(prev => prev.filter(t => t.key !== key));
  };

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<any>({});
  const [tagInput, setTagInput] = useState('');
  const [isDateRange, setIsDateRange] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const openEventCreateModal = () => {
    openForm('event', () => {
      setEventForm({
        status: 'upcoming',
        category: '',
        tags: [],
        schedules: [],
      });
      setIsDateRange(false);
      setImageFile(null);
      setImagePreview(null);
      setTagInput('');
      setEventModalOpen(true);
      setCurrentStep(1);
    });
  };

  const openEventEditModal = (e: any) => {
    openForm('event', () => {
      let parsedTags: string[] = [];
      if (Array.isArray(e.tags)) {
        parsedTags = e.tags;
      } else if (typeof e.tags === 'string' && e.tags.trim()) {
        try { parsedTags = JSON.parse(e.tags); } catch { parsedTags = []; }
      }

      let parsedSchedules: any[] = [];
      if (Array.isArray(e.schedules)) {
        parsedSchedules = e.schedules.map((s: any) => ({
          id: s.id,
          schedule_time: s.schedule_time || s.time || '',
          title: s.title || s.activity || '',
          description: s.description || ''
        }));
      }

      const hasRange = !!e.end_date && e.end_date !== e.event_date;

      setEventForm({
        ...e,
        category: e.category || 'Festival',
        tags: parsedTags,
        schedules: parsedSchedules,
      });
      setIsDateRange(hasRange);
      setImageFile(null);
      setImagePreview(e.image_url || e.image_path ? storageImageUrl(e.image_url || e.image_path) : (e.bannerImage || null));
      setTagInput('');
      setEventModalOpen(true);
      setCurrentStep(1);
    });
  };

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageForm, setImageForm] = useState<any>({});
  const [siteImageFile, setSiteImageFile] = useState<File | null>(null);
  const [siteImagePreview, setSiteImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!siteImageFile) { setSiteImagePreview(null); return; }
    const url = URL.createObjectURL(siteImageFile);
    setSiteImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [siteImageFile]);

  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineForm, setTimelineForm] = useState<any>({});

  const handleSaveTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...timelineForm, sort_order: timelineForm.sort_order ?? 0 };
    await runMutation('save:timeline', () => timelineForm.id
      ? apiUpdateTimeline(timelineForm.id, payload) : apiCreateTimeline(payload),
      `Timeline ${timelineForm.id ? 'updated' : 'created'} successfully.`, () => setTimelineModalOpen(false), 'timeline');
  };



  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBasicInfo()) {
      setCurrentStep(1);
      return;
    }

    const cleanedTimelines = draftTimelines.filter(t => t.title?.trim() || t.year?.trim() || t.description?.trim());
    for (const t of cleanedTimelines) {
      if (!t.title?.trim() || !t.year?.trim() || !t.description?.trim()) {
        setCurrentStep(2);
        setStepError('Please complete all fields (Title, Year, Description) for every timeline entry you added, or delete the incomplete ones.');
        return;
      }
    }

    const sitePayload = {
      name: siteForm.name,
      category: siteForm.category || null,
      year_built: siteForm.year_built || null,
      description: siteForm.description,
      history: siteForm.history,
      address: siteForm.address,
      status: siteForm.status || 'active',
      latitude: String(siteForm.latitude ?? '').trim() || null,
      longitude: String(siteForm.longitude ?? '').trim() || null,
      opening_hours: siteForm.opening_hours?.trim() || null,
      entrance_fee: siteForm.entrance_fee?.trim() || null,
      accessibility_notes: siteForm.accessibility_notes?.trim() || null,
      visit_notes: siteForm.visit_notes?.trim() || null,
      contact_information: siteForm.contact_information?.trim() || null,
    };

    const sortedTimelines = [...cleanedTimelines].sort((a, b) => parseYearNumber(a.year || '') - parseYearNumber(b.year || ''));

    await runMutation('save:site', async () => {
      // 1. Create or update heritage site
      let siteId: string | number;
      if (siteForm.id) {
        await apiUpdateSite(siteForm.id, sitePayload);
        siteId = siteForm.id;
      } else {
        const created = await apiCreateSite(sitePayload);
        siteId = created.id;
      }

      // 2. Remove deleted images
      for (const imgId of removedImageIds) {
        await apiDeleteSiteImage(imgId);
      }

      // 3. Process draft images (create / update)
      for (let i = 0; i < draftImages.length; i++) {
        const img = draftImages[i];
        if (img.imageFile) {
          await apiCreateSiteImage({
            heritage_site_id: siteId,
            imageFile: img.imageFile,
            caption: img.caption?.trim() || null,
            is_cover: Boolean(img.is_cover),
            sort_order: i,
          });
        } else if (img.id) {
          await apiUpdateSiteImage(String(img.id), {
            heritage_site_id: siteId,
            caption: img.caption?.trim() || null,
            is_cover: Boolean(img.is_cover),
            sort_order: i,
          });
        }
      }

      // 4. Remove deleted timeline entries
      for (const tId of removedTimelineIds) {
        await apiDeleteTimeline(tId);
      }

      // 5. Process draft timeline items (create / update)
      for (let i = 0; i < sortedTimelines.length; i++) {
        const t = sortedTimelines[i];
        const tPayload = {
          heritage_site_id: siteId,
          year: t.year,
          title: t.title,
          description: t.description,
          sort_order: i,
        };
        if (t.id) {
          await apiUpdateTimeline(String(t.id), tPayload);
        } else {
          await apiCreateTimeline(tPayload);
        }
      }
    }, `Heritage site ${siteForm.id ? 'updated' : 'created'} successfully.`, () => setSiteModalOpen(false), 'site');
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...eventForm,
      event_date: eventDateForSubmission(eventForm.event_date),
      end_date: isDateRange && eventForm.end_date ? eventDateForSubmission(eventForm.end_date) : null,
      start_time: eventForm.start_time || null,
      end_time: eventForm.end_time || null,
      tags: Array.isArray(eventForm.tags) ? eventForm.tags : [],
      schedules: Array.isArray(eventForm.schedules) ? eventForm.schedules : [],
      imageFile: imageFile || null,
      created_by: parseInt(user.id, 10),
    };
    await runMutation('save:event', () => eventForm.id
      ? apiUpdateEvent(eventForm.id, payload) : apiCreateEvent(payload),
      `Event ${eventForm.id ? 'updated' : 'created'} successfully.`, () => setEventModalOpen(false), 'event');
  };

  const handleSaveImage = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      heritage_site_id: imageForm.heritage_site_id,
      image_path: imageForm.image_path,
      caption: imageForm.caption?.trim() || null,
      is_cover: Boolean(imageForm.is_cover),
      sort_order: imageForm.sort_order ?? 0,
      imageFile: siteImageFile,
    };
    await runMutation('save:image', () => imageForm.id
      ? apiUpdateSiteImage(imageForm.id, payload) : apiCreateSiteImage(payload),
      `Image ${imageForm.id ? 'updated' : 'created'} successfully.`, () => { setImageModalOpen(false); setSiteImageFile(null); }, 'image');
  };

  const renderSidebarItem = (tab: TabType, label: string, Icon: any) => (
    <button
      aria-current={activeTab === tab ? 'page' : undefined}
      onClick={() => { setActiveTab(tab); setSidebarOpen(false); setManagingPhotosForSite(null); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab
        ? 'bg-[#7e1925] text-white font-semibold'
        : 'text-[#574141] hover:bg-[#faf2ee] hover:text-[#7e1925]'
        }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
    </button>
  );

  let filteredSites = sites.filter(s => {
    if (siteFilter !== 'all' && s.status !== siteFilter) return false;
    if (siteCategoryFilter !== 'all' && s.category !== siteCategoryFilter) return false;
    if (siteSearch.trim()) {
      const q = siteSearch.toLowerCase();
      return s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q);
    }
    return true;
  });

  filteredSites = filteredSites.sort((a, b) => {
    if (siteSortBy === 'asc') return (a.name || '').localeCompare(b.name || '');
    if (siteSortBy === 'desc') return (b.name || '').localeCompare(a.name || '');
    if (siteSortBy === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  const totalSitePages = Math.ceil(filteredSites.length / SITES_PER_PAGE);
  const paginatedSites = filteredSites.slice((sitePage - 1) * SITES_PER_PAGE, sitePage * SITES_PER_PAGE);

  let filteredEvents = events.filter(e => {
    const computedStatus = computeEventStatus(e);
    if (eventFilter !== 'all' && computedStatus !== eventFilter) return false;
    if (eventCategoryFilter !== 'all' && e.category !== eventCategoryFilter) return false;
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase();
      return e.title?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q);
    }
    return true;
  });

  filteredEvents = filteredEvents.sort((a, b) => {
    if (eventSortBy === 'asc') return (a.title || '').localeCompare(b.title || '');
    if (eventSortBy === 'desc') return (b.title || '').localeCompare(a.title || '');
    if (eventSortBy === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  const totalEventPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice((eventPage - 1) * EVENTS_PER_PAGE, eventPage * EVENTS_PER_PAGE);

  return (
    <div className="admin-shell min-h-screen bg-[#faf2ee] flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-[#e8dfd5] z-50 transform transition-transform duration-200 ease-in-out flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center px-6 border-b border-[#e8dfd5] flex-shrink-0">
          <span className="text-[#7A1C30] font-bold text-xl tracking-tight">SA'N FERNANDO</span>
          <button aria-label="Close admin navigation" className="ml-auto min-h-11 min-w-11 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {renderSidebarItem('dashboard', 'Dashboard', LayoutDashboard)}
          {renderSidebarItem('sites', 'Heritage Sites', Map)}
          

          {renderSidebarItem('events', 'Events', CalendarIcon)}
          {renderSidebarItem('itineraries', 'Recommended Itineraries', Compass)}
          {renderSidebarItem('checkins', 'Visit Verification', ShieldCheck)}
          {renderSidebarItem('travelers', 'Travelers', Users)}
          {renderSidebarItem('contributions', 'Visitor Contributions', ImageIcon)}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-[#e8dfd5] flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center">
            <button aria-label="Open admin navigation" onClick={() => setSidebarOpen(true)} className="min-h-11 min-w-11 text-gray-500 hover:text-gray-700 lg:hidden">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 font-bold text-gray-900 capitalize lg:hidden">{activeTab.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-right">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900 leading-none">{user.name}</span>
                <span className="text-xs text-gray-500">{user.role || 'Administrator'}</span>
              </div>
              {user.avatar ? (
                <img src={user.avatar} alt="Admin" className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-[#7A1C30]">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
            <button aria-label="Sign out of Admin" onClick={onLogout} className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative">

          {loading ? (
            <div role="status" className="flex justify-center items-center gap-3 h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A1C30]"></div>
              <span>Loading admin data...</span>
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
              <p className="font-semibold">Unable to load admin data.</p>
              <p className="mt-1 text-sm">{loadError}</p>
              <button type="button" onClick={() => void fetchData()} className="mt-3 rounded-lg bg-[#7A1C30] px-4 py-2 text-sm font-semibold text-white">Retry</button>
            </div>
          ) : managingPhotosForSite ? (
              <AdminPhotoManagement 
                site={managingPhotosForSite} 
                siteImages={siteImages} 
                onBack={() => setManagingPhotosForSite(null)} 
                onRefresh={fetchData} 
              />
          ) : (
            <div className="max-w-6xl mx-auto">

              {/* DASHBOARD TAB */}
              {activeTab === 'itineraries' && <AdminItineraries sites={sites} />}
              {activeTab === 'checkins' && <AdminCheckins onManageHeritage={() => setActiveTab('sites')} />}
              {activeTab === 'travelers' && <AdminTravelers />}
              {activeTab === 'contributions' && <AdminContributions />}
              {activeTab === 'dashboard' && (
                <AdminDashboard onNavigate={(tab, form) => {
                  setActiveTab(tab as TabType);
                  if (form === 'create') {
                    if (tab === 'events') {
                        setEventForm({});
                        openForm('event', () => setEventModalOpen(true));
                    } else if (tab === 'sites') {
                        setSiteForm({});
                        openForm('site', () => setSiteModalOpen(true));
                    }
                  }
                }} />
              )}

              {activeTab === 'sites' && (
                <div className="space-y-6 animate-fade-slide-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h1 className="page-title text-gray-900">Heritage Sites</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage the city's cultural landmarks, historical places, and heritage information.</p>
                  </div>
                    <button onClick={openCreateSiteModal} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors">
                      <Plus className="w-4 h-4" /> Add Site
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Top Row: Search and Filter Button */}
                    <div className="flex items-center gap-3 relative">
                      <div className="relative flex-1">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search heritage sites..."
                          value={siteSearch}
                          onChange={e => { setSiteSearch(e.target.value); setSitePage(1); }}
                          className="w-full pl-10 pr-4 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900"
                        />
                      </div>

                      <div className="relative">
                        <button onClick={() => setFilterMenuOpen(!filterMenuOpen)} className="flex items-center gap-2 px-4 py-2 border border-[#e8dfd5] rounded-xl text-gray-700 bg-white hover:bg-red-50 hover:text-[#7A1C30] font-medium transition-colors">
                          <Filter className="w-4 h-4" /> Filter
                        </button>

                        {filterMenuOpen && (
                          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-[#e8dfd5] rounded-xl shadow-lg z-10 p-4 animate-fade-slide-in">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sort By</h4>
                                <select value={siteSortBy} onChange={e => setSiteSortBy(e.target.value as any)} className="w-full border border-[#e8dfd5] rounded-lg p-2 text-sm focus:outline-none focus:border-[#7A1C30] focus:ring-1 focus:ring-[#7A1C30]" style={{ paddingRight: '2.5rem', backgroundPosition: 'right 1rem center' }}>
                                  <option value="newest">Newest First</option>
                                  <option value="oldest">Oldest First</option>
                                  <option value="asc">Alphabetical (A-Z)</option>
                                  <option value="desc">Alphabetical (Z-A)</option>
                                </select>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</h4>
                                <select value={siteCategoryFilter} onChange={e => { setSiteCategoryFilter(e.target.value); setSitePage(1); }} className="w-full border border-[#e8dfd5] rounded-lg p-2 text-sm focus:outline-none focus:border-[#7A1C30] focus:ring-1 focus:ring-[#7A1C30]" style={{ paddingRight: '2.5rem', backgroundPosition: 'right 1rem center' }}>
                                  <option value="all">All Categories</option>
                                  {HERITAGE_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Filter Tabs */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSiteFilter('all'); setSitePage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${siteFilter === 'all' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        All Sites
                      </button>
                      <button
                        onClick={() => { setSiteFilter('active'); setSitePage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${siteFilter === 'active' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => { setSiteFilter('archived'); setSitePage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${siteFilter === 'archived' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        Archived
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#e8dfd5] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-[#e8dfd5] text-gray-600">
                          <tr>
                            <th className="px-6 py-3 font-medium">Cover Page</th>
                            <th className="px-6 py-3 font-medium">Name</th>
                            <th className="px-6 py-3 font-medium">Category</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Last Updated</th>
                            <th className="px-6 py-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {paginatedSites.map(s => {
                            const mainImg = (s.images?.find((image: any) => image.is_cover) || s.images?.[0]);
                            const mainImgPath = mainImg ? (mainImg.image_url || mainImg.image_path) : undefined;
                            return (
                              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-[#e8dfd5]">
                                    <img src={mainImgPath ? storageImageUrl(mainImgPath) : HERITAGE_IMAGE_PLACEHOLDER} onError={handleHeritageImageError} alt="" className="w-full h-full object-cover" />
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                                <td className="px-6 py-4 text-gray-500">{s.category || 'Unspecified'}</td>
                                <td className="px-6 py-4 text-gray-500">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>{s.status}</span>
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                  {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => setManagingPhotosForSite(s)} className="text-purple-600 hover:text-purple-800 p-1.5 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors" title="Manage Photos"><ImageIcon className="w-4 h-4" /></button>
                                    <button onClick={() => openEditSiteModal(s)} className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                    <button disabled={pending.has(`delete:site:${s.id}`)} aria-busy={pending.has(`delete:site:${s.id}`)} onClick={() => handleDeleteSite(s.id)} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Archive" aria-label="Archive">{pending.has(`delete:site:${s.id}`) ? <span className="text-xs">Processing...</span> : <Trash2 className="w-4 h-4" />}</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {paginatedSites.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No heritage sites found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filteredSites.length > 10 && (
                      <div className="px-6 py-4 border-t border-[#e8dfd5] bg-gray-50 flex items-center justify-between">
                        <p className="text-sm text-gray-600">Showing <span className="font-semibold text-gray-900">{(sitePage - 1) * SITES_PER_PAGE + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(sitePage * SITES_PER_PAGE, filteredSites.length)}</span> of <span className="font-semibold text-gray-900">{filteredSites.length}</span> sites</p>
                        <div className="flex gap-2">
                          <button onClick={() => setSitePage(p => Math.max(1, p - 1))} disabled={sitePage === 1} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                          <button onClick={() => setSitePage(p => Math.min(totalSitePages, p + 1))} disabled={sitePage === totalSitePages} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EVENTS TAB */}
              {activeTab === 'events' && (
                <div className="space-y-6 animate-fade-slide-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h1 className="page-title text-gray-900">Events</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage local events, cultural activities, and upcoming celebrations.</p>
                  </div>
                    <button onClick={openEventCreateModal} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer">
                      <Plus className="w-4 h-4" /> Add Event
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Top Row: Search and Filter Button */}
                    <div className="flex items-center gap-3 relative">
                      <div className="relative flex-1">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search events..."
                          value={eventSearch}
                          onChange={e => { setEventSearch(e.target.value); setEventPage(1); }}
                          className="w-full pl-10 pr-4 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900"
                        />
                      </div>

                      <div className="relative">
                        <button onClick={() => setEventFilterMenuOpen(!eventFilterMenuOpen)} className="flex items-center gap-2 px-4 py-2 border border-[#e8dfd5] rounded-xl text-gray-700 bg-white hover:bg-red-50 hover:text-[#7A1C30] font-medium transition-colors">
                          <Filter className="w-4 h-4" /> Filter
                        </button>

                        {eventFilterMenuOpen && (
                          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-[#e8dfd5] rounded-xl shadow-lg z-10 p-4 animate-fade-slide-in">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sort By</h4>
                                <select value={eventSortBy} onChange={e => setEventSortBy(e.target.value as any)} className="w-full border border-[#e8dfd5] rounded-lg p-2 text-sm focus:outline-none focus:border-[#7A1C30] focus:ring-1 focus:ring-[#7A1C30]" style={{ paddingRight: '2.5rem', backgroundPosition: 'right 1rem center' }}>
                                  <option value="newest">Newest First</option>
                                  <option value="oldest">Oldest First</option>
                                  <option value="asc">Alphabetical (A-Z)</option>
                                  <option value="desc">Alphabetical (Z-A)</option>
                                </select>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</h4>
                                <select value={eventCategoryFilter} onChange={e => { setEventCategoryFilter(e.target.value); setEventPage(1); }} className="w-full border border-[#e8dfd5] rounded-lg p-2 text-sm focus:outline-none focus:border-[#7A1C30] focus:ring-1 focus:ring-[#7A1C30]" style={{ paddingRight: '2.5rem', backgroundPosition: 'right 1rem center' }}>
                                  <option value="all">All Categories</option>
                                  {Array.from(new Set(events.map(e => e.category).filter(Boolean))).map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Filter Tabs */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEventFilter('all'); setEventPage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${eventFilter === 'all' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        All Events
                      </button>
                      <button
                        onClick={() => { setEventFilter('upcoming'); setEventPage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${eventFilter === 'upcoming' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        Upcoming
                      </button>
                      <button
                        onClick={() => { setEventFilter('ongoing'); setEventPage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${eventFilter === 'ongoing' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        Ongoing
                      </button>
                      <button
                        onClick={() => { setEventFilter('completed'); setEventPage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${eventFilter === 'completed' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        Completed
                      </button>
                      <button
                        onClick={() => { setEventFilter('cancelled'); setEventPage(1); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${eventFilter === 'cancelled' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
                      >
                        Cancelled
                      </button>
                    </div>

                    <div className="bg-white rounded-xl border border-[#e8dfd5] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 border-b border-[#e8dfd5] text-gray-600">
                            <tr>
                              <th className="px-6 py-3 font-medium">Event Title</th>
                              <th className="px-6 py-3 font-medium">Category</th>
                              <th className="px-6 py-3 font-medium">Date & Time</th>
                              <th className="px-6 py-3 font-medium">Location</th>
                              <th className="px-6 py-3 font-medium">Status</th>
                              <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {paginatedEvents.map(e => {
                              const timeStr = e.start_time && e.end_time
                                ? `${e.start_time} - ${e.end_time}`
                                : (e.start_time || e.time || 'TBA');
                              const getStatusBadge = (status: string) => {
                                if (status === 'ongoing') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Ongoing</span>;
                                if (status === 'completed') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">Completed</span>;
                                if (status === 'cancelled') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">Cancelled</span>;
                                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Upcoming</span>;
                              };
                              return (
                                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="min-w-0">
                                        <p className="font-bold text-gray-900 truncate">{e.title}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-600">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-[#e8dfd5]">
                                      {e.category || 'Festival'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-gray-500">
                                    <div>{e.event_date ? String(e.event_date).split(' ')[0] : 'TBA'}</div>
                                    <div className="text-xs text-gray-400">{timeStr}</div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-500">{e.location}</td>
                                  <td className="px-6 py-4">{getStatusBadge(computeEventStatus(e))}</td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button onClick={() => openEventEditModal(e)} className="text-gray-400 hover:text-[#7A1C30] p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                      <button
                                        disabled={pending.has(`delete:event:${e.id}`)}
                                        aria-busy={pending.has(`delete:event:${e.id}`)}
                                        onClick={() => handleDeleteEvent(e.id)}
                                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Delete"
                                      >
                                        {pending.has(`delete:event:${e.id}`) ? <span className="text-xs">Processing...</span> : <Trash2 className="w-4 h-4" />}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {paginatedEvents.length === 0 && (
                              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No events found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {filteredEvents.length > 10 && (
                        <div className="px-6 py-4 border-t border-[#e8dfd5] bg-gray-50 flex items-center justify-between">
                          <p className="text-sm text-gray-600">Showing <span className="font-semibold text-gray-900">{(eventPage - 1) * EVENTS_PER_PAGE + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(eventPage * EVENTS_PER_PAGE, filteredEvents.length)}</span> of <span className="font-semibold text-gray-900">{filteredEvents.length}</span> events</p>
                          <div className="flex gap-2">
                            <button onClick={() => setEventPage(p => Math.max(1, p - 1))} disabled={eventPage === 1} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setEventPage(p => Math.min(totalEventPages, p + 1))} disabled={eventPage === totalEventPages} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* --- MODALS --- */}

      {/* Site Modal */}
      {siteModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Heritage site editor" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col relative">
            <button type="button" disabled={pending.has('save:site')} onClick={() => setSiteModalOpen(false)} style={{ minHeight: '2rem' }} className="absolute -top-4 -right-4 sm:top-0 sm:-right-12 w-8 h-8 flex items-center justify-center shrink-0 rounded-full bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 border border-[#e8dfd5] shadow-md z-50 transition-colors" aria-label="Close editor" title="Close"><X className="w-4 h-4" /></button>
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">{siteForm.id ? 'Edit Heritage Site' : 'Add Heritage Site'}</h2>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {/* Step Bar Indicator matching photo */}
                <div className="flex items-center gap-1.5" aria-label="Form progress">
                  {[
                    { step: 1, label: 'Basic Information' },
                    { step: 2, label: 'Timeline' },
                    { step: 3, label: 'Visitor Information' },
                    { step: 4, label: 'Images' },
                  ].map(({ step, label }) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => goToStep(step)}
                      className="flex items-center justify-center py-2 px-0.5"
                      title={`${step}. ${label}`}
                      aria-label={`Step ${step}: ${label}`}
                      aria-current={currentStep === step ? 'step' : undefined}
                    ><span aria-hidden="true" className={`h-1.5 rounded-full transition-all duration-300 ${currentStep === step ? 'w-20 bg-[#7A1C30]' : currentStep > step ? 'w-10 bg-[#7A1C30]' : 'w-10 bg-gray-200'}`} /></button>
                  ))}
                </div>
              </div>
            </div>

            <form id="admin-site-form" onSubmit={handleSaveSite} className="flex-1 overflow-auto p-6 space-y-5 text-sm">
              <div className="text-center mb-5">
                <h3 className="text-2xl font-bold text-[#7A1C30] tracking-tight">
                  {currentStep === 1 ? 'Basic Information' : currentStep === 2 ? 'Historical Timeline' : currentStep === 3 ? 'Visitor Information' : 'Images'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {currentStep === 1 ? 'Enter the primary details for the heritage site.' : currentStep === 2 ? 'Document key historical events.' : currentStep === 3 ? 'Provide visitor guidelines and schedules.' : 'Upload photos of the site.'}
                </p>
              </div>
              {renderFormError('site')}
              {stepError && (
                <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p>{stepError}</p>
                </div>
              )}
              <fieldset disabled={pending.has('save:site')} className="contents">

                {/* PAGE 1: BASIC INFORMATION */}
                <div className={currentStep === 1 ? 'space-y-5 animate-fade-slide-in' : 'hidden'}>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5 col-span-2">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-1">Name</label>
                      <input id="admin-field-1" required type="text" className={`w-full border rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none ${!siteForm.name && stepError === 'Please fill out all required Basic Information fields' ? 'border-red-500 bg-red-50' : 'border-[#e8dfd5]'}`} name="name" value={siteForm.name || ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="Site Name" />
                      {!siteForm.name && stepError === 'Please fill out all required Basic Information fields' && <p className="text-xs text-red-600 mt-1 font-medium">Name is required.</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-2">Category</label>
                      <select id="admin-field-2" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 outline-none bg-white" name="category" value={siteForm.category || ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, category: e.target.value }))}>
                        <option value="">Unspecified</option>
                        {siteForm.category && !HERITAGE_CATEGORIES.some(category => category !== 'All' && category === siteForm.category) && (
                          <option value={siteForm.category}>{siteForm.category} (choose a supported category)</option>
                        )}
                        {HERITAGE_CATEGORIES.filter(category => category !== 'All').map(category => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-3">Year Built</label>
                      <input id="admin-field-3" type="text" className={`w-full rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none border ${stepError === 'Year Built must be a valid number.' ? 'border-red-500 bg-red-50' : 'border-[#e8dfd5]'}`} name="year_built" value={siteForm.year_built || ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, year_built: e.target.value }))} placeholder="e.g. 1755" />
                      {stepError === 'Year Built must be a valid number.' && <p className="text-xs text-red-600 mt-1 font-medium">Year Built must be a valid number.</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-4">Address</label>
                      <input id="admin-field-4" required type="text" className={`w-full border rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none ${!siteForm.address && stepError === 'Please fill out all required Basic Information fields' ? 'border-red-500 bg-red-50' : 'border-[#e8dfd5]'}`} name="address" value={siteForm.address || ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, address: e.target.value }))} placeholder="Full address" />
                      {!siteForm.address && stepError === 'Please fill out all required Basic Information fields' && <p className="text-xs text-red-600 mt-1 font-medium">Address is required.</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-5">Status</label>
                      <select id="admin-field-5" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white" name="status" value={siteForm.status || 'active'} onChange={e => setSiteForm((prev: any) => ({ ...prev, status: e.target.value }))}>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-6">Latitude</label>
                      <input id="admin-field-6" required type="text" className={`w-full border rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none ${(!siteForm.latitude?.toString().trim() && stepError === 'Please fill out all required Basic Information fields') || (stepError === 'Latitude and Longitude must be valid numbers.' && isNaN(Number(siteForm.latitude?.toString().trim()))) ? 'border-red-500 bg-red-50' : 'border-[#e8dfd5]'}`} value={siteForm.latitude ?? ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, latitude: e.target.value }))} placeholder="e.g. 15.031" />
                      {!siteForm.latitude?.toString().trim() && stepError === 'Please fill out all required Basic Information fields' && <p className="text-xs text-red-600 mt-1 font-medium">Latitude is required.</p>}
                      {stepError === 'Latitude and Longitude must be valid numbers.' && isNaN(Number(siteForm.latitude?.toString().trim())) && <p className="text-xs text-red-600 mt-1 font-medium">Latitude must be a valid number.</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-7">Longitude</label>
                      <input id="admin-field-7" required type="text" className={`w-full border rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none ${(!siteForm.longitude?.toString().trim() && stepError === 'Please fill out all required Basic Information fields') || (stepError === 'Latitude and Longitude must be valid numbers.' && isNaN(Number(siteForm.longitude?.toString().trim()))) ? 'border-red-500 bg-red-50' : 'border-[#e8dfd5]'}`} value={siteForm.longitude ?? ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, longitude: e.target.value }))} placeholder="e.g. 120.689" />
                      {!siteForm.longitude?.toString().trim() && stepError === 'Please fill out all required Basic Information fields' && <p className="text-xs text-red-600 mt-1 font-medium">Longitude is required.</p>}
                      {stepError === 'Latitude and Longitude must be valid numbers.' && isNaN(Number(siteForm.longitude?.toString().trim())) && <p className="text-xs text-red-600 mt-1 font-medium">Longitude must be a valid number.</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-8">Description</label>
                    <textarea id="admin-field-8" required rows={3} className={`w-full border rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none resize-y ${!siteForm.description && stepError === 'Please fill out all required Basic Information fields' ? 'border-red-500 bg-red-50' : 'border-[#e8dfd5]'}`} name="description" value={siteForm.description || ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, description: e.target.value }))} placeholder="Brief description..." />
                    {!siteForm.description && stepError === 'Please fill out all required Basic Information fields' && <p className="text-xs text-red-600 mt-1 font-medium">Description is required.</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-9">History</label>
                    <textarea id="admin-field-9" required rows={4} className={`w-full border rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none resize-y ${!siteForm.history && stepError === 'Please fill out all required Basic Information fields' ? 'border-red-500 bg-red-50' : 'border-[#e8dfd5]'}`} name="history" value={siteForm.history || ''} onChange={e => setSiteForm((prev: any) => ({ ...prev, history: e.target.value }))} placeholder="Full historical context..." />
                    {!siteForm.history && stepError === 'Please fill out all required Basic Information fields' && <p className="text-xs text-red-600 mt-1 font-medium">History is required.</p>}
                  </div>
                </div>

                {/* PAGE 2: HISTORICAL TIMELINE */}
                <section className={currentStep === 2 ? 'space-y-4 animate-fade-slide-in' : 'hidden'}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">Historical Timeline</h3>
                      <p className="text-xs text-gray-500">Optional. Items automatically order by year ascending.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftTimelines(prev => [
                          ...prev,
                          { key: `temp_t_${Date.now()}_${Math.random()}`, year: '', title: '', description: '' }
                        ]);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A1C30] hover:text-[#581020] bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Timeline Item
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {draftTimelines.map((item, index) => (
                      <div key={item.key} className="p-3 bg-gray-50 border border-[#e8dfd5] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#7A1C30]">Timeline Item #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTimelineItem(item.key)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Timeline Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            required
                            type="text"
                            placeholder="Year (e.g. 1950)"
                            className="border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                            value={item.year}
                            onChange={(e) => {
                              const updated = [...draftTimelines];
                              updated[index] = { ...updated[index], year: e.target.value };
                              setDraftTimelines(updated);
                            }}
                          />
                          <input
                            required
                            type="text"
                            placeholder="Title (e.g. Construction Started)"
                            className="sm:col-span-2 border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                            value={item.title}
                            onChange={(e) => {
                              const updated = [...draftTimelines];
                              updated[index] = { ...updated[index], title: e.target.value };
                              setDraftTimelines(updated);
                            }}
                          />
                        </div>
                        <textarea
                          required
                          rows={2}
                          placeholder="Optional details or description..."
                          className="w-full border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none resize-y"
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...draftTimelines];
                            updated[index] = { ...updated[index], description: e.target.value };
                            setDraftTimelines(updated);
                          }}
                        />
                      </div>
                    ))}
                    {draftTimelines.length === 0 && (
                      <div className="text-xs text-gray-400 italic text-center py-8 bg-gray-50 border border-[#e8dfd5] border-dashed rounded-xl">
                        No timeline items added. Click "+ Add Timeline Item" above to add historical events.
                      </div>
                    )}
                  </div>
                </section>

                {/* PAGE 3: VISITOR INFORMATION */}
                <section className={currentStep === 3 ? 'space-y-4 animate-fade-slide-in' : 'hidden'} aria-labelledby="admin-visitor-information-title">
                  <div>
                    <h3 id="admin-visitor-information-title" className="font-bold text-gray-900 text-base">Visitor Information</h3>
                    <p className="text-xs text-gray-500">Optional. Leave unknown information blank.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="admin-site-opening_hours" className="font-semibold text-gray-700">Opening Hours</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        className="border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none flex-1"
                        value={siteForm.opening_hours?.split(' - ')[0] || ''}
                        onChange={e => {
                          const parts = (siteForm.opening_hours || ' - ').split(' - ');
                          setSiteForm({ ...siteForm, opening_hours: `${e.target.value} - ${parts[1] || ''}` });
                        }}
                      />
                      <span className="text-gray-500 font-medium">to</span>
                      <input
                        type="time"
                        className="border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none flex-1"
                        value={siteForm.opening_hours?.split(' - ')[1] || ''}
                        onChange={e => {
                          const parts = (siteForm.opening_hours || ' - ').split(' - ');
                          setSiteForm({ ...siteForm, opening_hours: `${parts[0] || ''} - ${e.target.value}` });
                        }}
                      />
                    </div>
                  </div>
                  {[
                    { field: 'entrance_fee', label: 'Entrance Fee / Admission', maxLength: 1000, rows: 2 },
                    { field: 'accessibility_notes', label: 'Accessibility Notes', maxLength: 3000, rows: 3 },
                    { field: 'visit_notes', label: 'Visit Notes', maxLength: 3000, rows: 3 },
                    { field: 'contact_information', label: 'Contact Information', maxLength: 2000, rows: 2 },
                  ].map(({ field, label, maxLength, rows }) => (
                    <div key={field} className="space-y-1.5">
                      <label htmlFor={`admin-site-${field}`} className="font-semibold text-gray-700">{label}</label>
                      <textarea id={`admin-site-${field}`} name={field} rows={rows} maxLength={maxLength}
                        className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none"
                        value={siteForm[field] ?? ''} onChange={e => setSiteForm({ ...siteForm, [field]: e.target.value })} />
                    </div>
                  ))}
                </section>

                {/* PAGE 4: IMAGES */}
                <section className={currentStep === 4 ? 'space-y-4 animate-fade-slide-in' : 'hidden'}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">Images</h3>
                      <p className="text-xs text-gray-500">Optional. Select images from your device.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A1C30] hover:text-[#581020] bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Image
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageFileSelect}
                    />
                  </div>

                  {draftImages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-1">
                      {draftImages.map((img) => (
                        <div key={img.key} className="bg-gray-50 border border-[#e8dfd5] rounded-xl p-3 flex flex-col space-y-2.5">
                          <div className="relative h-36 rounded-lg overflow-hidden border border-[#e8dfd5] bg-white">
                            <img src={img.previewUrl} onError={handleHeritageImageError} alt="Preview" className="w-full h-full object-cover" />
                            {img.is_cover && (
                              <span className="absolute top-2 left-2 bg-[#7A1C30] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shadow-sm">
                                Cover Image
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="ui-label text-xs font-semibold text-gray-700" htmlFor="admin-field-10">Caption</label>
                            <input id="admin-field-10"
                              type="text"
                              placeholder="Image caption (e.g. Front view)"
                              className="w-full border border-[#e8dfd5] rounded-lg p-2 text-xs focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                              value={img.caption}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftImages(prev => prev.map(item => item.key === img.key ? { ...item, caption: val } : item));
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={img.is_cover}
                                onChange={() => handleToggleCover(img.key)}
                                className="rounded border-[#e8dfd5] text-[#7A1C30] focus:ring-[#7A1C30]"
                              />
                              Cover Image
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(img.key)}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic text-center py-8 bg-gray-50 border border-[#e8dfd5] border-dashed rounded-xl">
                      No images added yet. Click "+ Add Image" above to select images.
                    </div>
                  )}
                </section>

              </fieldset>
            </form>

            {/* Modal Footer with Navigation */}
            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-white rounded-b-2xl">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    disabled={pending.has('save:site')}
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="group px-6 py-2.5 bg-white border border-[#e8dfd5] rounded-full text-gray-700 hover:bg-gray-50 hover:text-black font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-2 text-sm"
                  >
                    <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">←</span> Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStep < 4 && (
                  <button
                    type="button"
                    onClick={() => goToStep(currentStep + 1)}
                    className="group px-7 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 text-sm"
                  >
                    Next <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </button>
                )}

                {currentStep === 4 && (
                  <button
                    type="submit"
                    form="admin-site-form"
                    disabled={pending.has('save:site')}
                    className="px-7 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-full font-bold shadow-md hover:shadow-lg transition-all cursor-pointer text-sm"
                  >
                    {pending.has('save:site') ? 'Saving...' : 'Save Heritage Site'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Event Modal */}
      {eventModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Event editor" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col relative">
            <button type="button" disabled={pending.has("save:event")} onClick={() => setEventModalOpen(false)} style={{ minHeight: "2rem" }} className="absolute -top-4 -right-4 sm:top-0 sm:-right-12 w-8 h-8 flex items-center justify-center shrink-0 rounded-full bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 border border-[#e8dfd5] shadow-md z-50 transition-colors" aria-label="Close editor" title="Close"><X className="w-4 h-4" /></button>
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">{eventForm.id ? "Edit Event" : "Add Event"}</h2>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {/* Step Bar Indicator */}
                <div className="flex items-center gap-1.5" aria-label="Form progress">
                  {[
                    { step: 1, label: "Event Details" },
                    { step: 2, label: "Date & Place" },
                    { step: 3, label: "Schedule" },
                  ].map(({ step, label }) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setCurrentStep(step)}
                      className="flex items-center justify-center py-2 px-0.5 cursor-pointer"
                      title={`${step}. ${label}`}
                      aria-label={`Step ${step}: ${label}`}
                      aria-current={currentStep === step ? "step" : undefined}
                    ><span aria-hidden="true" className={`h-1.5 rounded-full transition-all duration-300 ${currentStep === step ? "w-20 bg-[#7A1C30]" : currentStep > step ? "w-10 bg-[#7A1C30]" : "w-10 bg-gray-200"}`} /></button>
                  ))}
                </div>
              </div>
            </div>

            <form id="admin-event-form" onSubmit={handleSaveEvent} className="flex-1 overflow-auto p-6 space-y-5 text-sm">
              <div className="text-center mb-5">
                <h3 className="text-2xl font-bold text-[#7A1C30] tracking-tight">
                  {currentStep === 1 ? "Event Details" : currentStep === 2 ? "Date & Place" : "Schedule"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {currentStep === 1 ? "Enter the primary details, category, tags, and cover image." : currentStep === 2 ? "Specify when and where the event takes place." : "Add multiple program schedule items with times and activity details."}
                </p>
              </div>
              {renderFormError("event")}
              {stepError && (
                <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p>{stepError}</p>
                </div>
              )}
              <fieldset disabled={pending.has("save:event")} className="contents">

                {/* PAGE 1: EVENT DETAILS */}
                <div className={currentStep === 1 ? "space-y-5 animate-fade-slide-in" : "hidden"}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-14">Title</label>
                      <input id="admin-field-14" required={currentStep === 1} type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" name="title" value={eventForm.title || ""} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Event Title" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-15">Category</label>
                      <select id="admin-field-15" required={currentStep === 1} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white" name="category" value={eventForm.category || ""} onChange={e => setEventForm({ ...eventForm, category: e.target.value })}>
                        <option value="">Unspecified</option>
                        <option value="Festival">Festival</option>
                        <option value="Heritage Tour">Heritage Tour</option>
                        <option value="Exhibition">Exhibition</option>
                        <option value="Community">Community</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-gray-700">Event Image</label>
                    {imagePreview ? (
                      <div className="relative group rounded-xl overflow-hidden border border-[#e8dfd5] bg-gray-50 max-h-48">
                        <img src={imagePreview} alt="Event Preview" className="w-full h-44 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <label className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs rounded-full cursor-pointer transition-colors shadow-md">
                            Change Image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setImageFile(file);
                                  setImagePreview(URL.createObjectURL(file));
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                              setEventForm({ ...eventForm, image_path: "" });
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full transition-colors shadow-md cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-[#e8dfd5] hover:border-[#7A1C30] rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer text-center p-4">
                        <ImageIcon className="w-8 h-8 text-gray-400 mb-1" />
                        <span className="text-xs font-semibold text-gray-700">Click to select and upload event image</span>
                        <span className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, WEBP, GIF up to 5MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImageFile(file);
                              setImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-23">Description</label>
                    <textarea id="admin-field-23" required={currentStep === 1} rows={3} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none resize-y" name="description" value={eventForm.description || ""} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Event description..." />
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-gray-700">Tags</label>
                    <div className="flex flex-wrap gap-2 min-h-[38px] p-2 border border-[#e8dfd5] rounded-xl bg-gray-50/50 items-center">
                      {(eventForm.tags || []).map((tag: string, index: number) => (
                        <span key={index} className="inline-flex items-center gap-1 bg-[#7A1C30]/10 text-[#7A1C30] border border-[#7A1C30]/20 text-[11px] font-semibold px-2.5 py-0 rounded-full leading-none">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => {
                              const newTags = (eventForm.tags || []).filter((_: any, i: number) => i !== index);
                              setEventForm({ ...eventForm, tags: newTags });
                            }}
                            className="rounded-full p-0.5 transition-colors cursor-pointer flex items-center justify-center hover:opacity-70"
                            title="Remove tag"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {(!eventForm.tags || eventForm.tags.length === 0) && (
                        <span className="text-xs text-gray-400">No tags added yet. Type tag below and press Enter.</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none"
                        placeholder="Type tag and press Enter (e.g. Family Friendly)..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = tagInput.trim();
                            if (trimmed && !(eventForm.tags || []).includes(trimmed)) {
                              setEventForm({
                                ...eventForm,
                                tags: [...(eventForm.tags || []), trimmed],
                              });
                              setTagInput("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = tagInput.trim();
                          if (trimmed && !(eventForm.tags || []).includes(trimmed)) {
                            setEventForm({
                              ...eventForm,
                              tags: [...(eventForm.tags || []), trimmed],
                            });
                            setTagInput("");
                          }
                        }}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                </div>

                {/* PAGE 2: DATE & PLACE */}
                <div className={currentStep === 2 ? "space-y-5 animate-fade-slide-in" : "hidden"}>
                  <div className="space-y-1.5 px-3 py-3 bg-gray-50/70 rounded-xl border border-[#e8dfd5]">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-gray-700">Date Setup</label>
                      <div className="inline-flex rounded-lg p-0.5 bg-gray-200/80 border border-[#e8dfd5]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDateRange(false);
                            setEventForm({ ...eventForm, end_date: null });
                          }}
                          className={`px-3 h-7 text-xs leading-none font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center ${!isDateRange ? "bg-white text-[#7A1C30] shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                          Single Date
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDateRange(true)}
                          className={`px-3 h-7 text-xs leading-none font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center ${isDateRange ? "bg-white text-[#7A1C30] shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                          Date Range
                        </button>
                      </div>
                    </div>

                    {isDateRange ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-16">Start Date</label>
                          <input id="admin-field-16"
                            required={currentStep === 2}
                            type="date"
                            className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                            value={eventDateForInput(eventForm.event_date)}
                            onChange={(e) => setEventForm({ ...eventForm, event_date: replaceEventDate(events.find(event => String(event.id) === String(eventForm.id))?.event_date || eventForm.event_date, e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-17">End Date</label>
                          <input id="admin-field-17"
                            required={currentStep === 2}
                            type="date"
                            className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                            value={eventDateForInput(eventForm.end_date)}
                            onChange={(e) => setEventForm({ ...eventForm, end_date: replaceEventDate(eventForm.end_date, e.target.value) })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 pt-1">
                        <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-18">Event Date</label>
                        <input id="admin-field-18"
                          required={currentStep === 2}
                          type="date"
                          className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                          value={eventDateForInput(eventForm.event_date)}
                          onChange={(e) => setEventForm({ ...eventForm, event_date: replaceEventDate(events.find(event => String(event.id) === String(eventForm.id))?.event_date || eventForm.event_date, e.target.value) })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-19">Event Hours</label>
                      <div className="flex items-center gap-3">
                        <input id="admin-field-19"
                          type="time"
                          className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white flex-1"
                          name="start_time" value={eventForm.start_time || ""}
                          onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                        />
                        <span className="text-gray-500 font-medium">to</span>
                        <input id="admin-field-20"
                          type="time"
                          className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white flex-1"
                          name="end_time" value={eventForm.end_time || ""}
                          onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-3"><label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-21">Location</label>
                      <input id="admin-field-21" required={currentStep === 2} type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" name="location" value={eventForm.location || ""} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Event Location" />
                    </div>

                  </div>
                </div>

                {/* PAGE 3: SCHEDULE */}
                <div className={currentStep === 3 ? "space-y-5 animate-fade-slide-in" : "hidden"}>
                  <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-semibold text-gray-700 block">Event Schedule Program</label>
                        <span className="text-xs text-gray-500">Add multiple schedule items with time and activity details.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const currentSchedules = Array.isArray(eventForm.schedules) ? eventForm.schedules : [];
                          setEventForm({
                            ...eventForm,
                            schedules: [...currentSchedules, { schedule_time: "", title: "", description: "" }],
                          });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A1C30] hover:text-[#581020] bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Schedule Item
                      </button>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {(eventForm.schedules || []).map((sch: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 border border-[#e8dfd5] rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#7A1C30]">Schedule #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextSchedules = (eventForm.schedules || []).filter((_: any, i: number) => i !== index);
                                setEventForm({ ...eventForm, schedules: nextSchedules });
                              }}
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Schedule Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Time (e.g. 5:00 PM)"
                              className="border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                              value={sch.schedule_time || sch.time || ""}
                              onChange={(e) => {
                                const updated = [...(eventForm.schedules || [])];
                                updated[index] = { ...updated[index], schedule_time: e.target.value, time: e.target.value };
                                setEventForm({ ...eventForm, schedules: updated });
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Activity / Title (e.g. Gates Open)"
                              className="sm:col-span-2 border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                              value={sch.title || sch.activity || ""}
                              onChange={(e) => {
                                const updated = [...(eventForm.schedules || [])];
                                updated[index] = { ...updated[index], title: e.target.value, activity: e.target.value };
                                setEventForm({ ...eventForm, schedules: updated });
                              }}
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Optional details or description..."
                            className="w-full border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                            value={sch.description || ""}
                            onChange={(e) => {
                              const updated = [...(eventForm.schedules || [])];
                              updated[index] = { ...updated[index], description: e.target.value };
                              setEventForm({ ...eventForm, schedules: updated });
                            }}
                          />
                        </div>
                      ))}

                    </div>
                  </div>
                </div>

              </fieldset>
            </form>

            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-white rounded-b-2xl">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    disabled={pending.has("save:event")}
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="group px-6 py-2.5 bg-white border border-[#e8dfd5] rounded-full text-gray-700 hover:bg-gray-50 hover:text-black font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-2 text-sm"
                  >
                    <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">&lt;</span> Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {currentStep < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Basic validation before next
                      if (currentStep === 1) {
                        if (!eventForm.title || !eventForm.description) {
                          setStepError("Please fill out Title and Description.");
                          return;
                        }
                      } else if (currentStep === 2) {
                        if (!eventForm.event_date || !eventForm.location) {
                          setStepError("Please provide a Date and Location.");
                          return;
                        }
                      }
                      setStepError(null);
                      setCurrentStep(currentStep + 1);
                    }}
                    className="group px-7 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 text-sm"
                  >
                    Next <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&gt;</span>
                  </button>
                )}
                {currentStep === 3 && (
                  <button
                    type="submit"
                    form="admin-event-form"
                    disabled={pending.has("save:event")}
                    className="px-7 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 text-sm"
                  >
                    {pending.has("save:event") ? "Saving..." : "Save Event"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Site image editor" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="section-title text-gray-900">{imageForm.id ? 'Edit Image Reference' : 'Add Image Reference'}</h2>
              <button type="button" disabled={pending.has('save:image')} onClick={() => { setImageModalOpen(false); setSiteImageFile(null); }} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 border border-[#e8dfd5] transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form id="admin-image-form" onSubmit={handleSaveImage} className="p-6 space-y-5 text-sm">
              {renderFormError('image')}
              <fieldset disabled={pending.has('save:image')} className="contents">
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-24">Heritage Site</label>
                  <select id="admin-field-24" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white" name="heritage_site_id" value={imageForm.heritage_site_id || ''} onChange={e => setImageForm({ ...imageForm, heritage_site_id: parseInt(e.target.value) })}>
                    <option value="">Select a Heritage Site...</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-25">Image Path or URL</label>
                  <input id="admin-field-25" required={!siteImageFile} type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" placeholder="e.g. heritage-sites/photo.jpg" name="image_path" value={imageForm.image_path || ''} onChange={e => setImageForm({ ...imageForm, image_path: e.target.value })} />
                  <p className="text-xs text-gray-500 mt-1">Use an existing URL/path or upload a file. A selected upload takes precedence.</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-site-image-upload" className="font-semibold text-gray-700">Upload Image</label>
                  <input id="admin-site-image-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={e => setSiteImageFile(e.target.files?.[0] || null)} />
                  <p className="text-xs text-gray-500">JPEG, PNG, WEBP or GIF. Maximum 5 MB.</p>
                  {siteImageFile && <p className="text-xs text-gray-700">Selected: {siteImageFile.name}</p>}
                  {((siteImageFile && siteImagePreview) || imageForm.image_path || imageForm.image_url) && <img id="admin-site-image-preview"
                    src={(siteImageFile && siteImagePreview) || storageImageUrl(imageForm.image_url || imageForm.image_path)} onError={handleHeritageImageError}
                    alt="Image preview" className="w-full h-40 object-contain rounded border border-[#e8dfd5]" />}
                </div>
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-26">Caption</label>
                  <input id="admin-field-26" type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" name="caption" value={imageForm.caption || ''} onChange={e => setImageForm({ ...imageForm, caption: e.target.value })} placeholder="Image caption..." />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 font-semibold text-gray-700">
                    <input name="is_cover" type="checkbox" checked={Boolean(imageForm.is_cover)}
                      onChange={e => setImageForm({ ...imageForm, is_cover: e.target.checked })} />
                    Cover Image
                  </label>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-image-sort-order" className="font-semibold text-gray-700">Sort Order</label>
                  <input id="admin-image-sort-order" name="sort_order" type="number" min={0} max={2147483647} step={1} required
                    className="w-full border border-[#e8dfd5] rounded-xl p-2.5 outline-none" value={imageForm.sort_order ?? 0}
                    onChange={e => setImageForm({ ...imageForm, sort_order: e.target.value })} />
                </div>
              </fieldset>
            </form>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" disabled={pending.has('save:image')} onClick={() => { setImageModalOpen(false); setSiteImageFile(null); }} className="px-5 py-2.5 border border-[#e8dfd5] rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="admin-image-form" disabled={pending.has('save:image')} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors">{pending.has('save:image') ? 'Saving...' : 'Save Image'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {timelineModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Timeline editor" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="section-title text-gray-900">{timelineForm.id ? 'Edit Timeline' : 'Add Timeline'}</h2>
              <button type="button" disabled={pending.has('save:timeline')} onClick={() => setTimelineModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 border border-[#e8dfd5] transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form id="admin-timeline-form" onSubmit={handleSaveTimeline} className="p-6 space-y-5 text-sm">
              {renderFormError('timeline')}
              <fieldset disabled={pending.has('save:timeline')} className="contents">
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-27">Heritage Site</label>
                  <select id="admin-field-27" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white" name="heritage_site_id" value={timelineForm.heritage_site_id || ''} onChange={e => setTimelineForm({ ...timelineForm, heritage_site_id: parseInt(e.target.value) })}>
                    <option value="">Select a Heritage Site...</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5 col-span-2">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-28">Title</label>
                    <input id="admin-field-28" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" placeholder="Timeline Event Title" name="title" value={timelineForm.title || ''} onChange={e => setTimelineForm({ ...timelineForm, title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-29">Year</label>
                    <input id="admin-field-29" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" placeholder="e.g. 1920 or circa 1920" name="year" value={timelineForm.year || ''} onChange={e => setTimelineForm({ ...timelineForm, year: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-30">Description</label>
                  <textarea id="admin-field-30" required rows={4} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none resize-y" name="description" value={timelineForm.description || ''} onChange={e => setTimelineForm({ ...timelineForm, description: e.target.value })} placeholder="Event description..." />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-timeline-order" className="font-semibold text-gray-700">Sort Order</label>
                  <input id="admin-timeline-order" type="number" min={0} max={2147483647} step={1} required
                    value={timelineForm.sort_order ?? 0} onChange={e => setTimelineForm({ ...timelineForm, sort_order: e.target.value })}
                    className="w-full border border-[#e8dfd5] rounded-xl p-2.5 outline-none" />
                </div>
              </fieldset>
            </form>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" disabled={pending.has('save:timeline')} onClick={() => setTimelineModalOpen(false)} className="px-5 py-2.5 border border-[#e8dfd5] rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="admin-timeline-form" disabled={pending.has('save:timeline')} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors">{pending.has('save:timeline') ? 'Saving...' : 'Save Timeline'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
