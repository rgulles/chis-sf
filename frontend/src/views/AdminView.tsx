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
  Clock,
  Users
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

const TIME_OPTIONS = [
  '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM',
  '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM'
];

interface AdminViewProps {
  user: UserProfile;
  onLogout: () => void;
}

type TabType = 'dashboard' | 'sites' | 'images' | 'events' | 'timelines' | 'itineraries' | 'checkins' | 'travelers';
type FormType = 'site' | 'event' | 'image' | 'timeline';

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sites, setSites] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [siteImages, setSiteImages] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<FormType, AdminApiError>>>({});
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
    setNotice(null);
    open();
  };

  const runMutation = async (key: string, request: () => Promise<unknown>, message: string,
    close?: () => void, form?: FormType) => {
    if (pendingRequests.current.has(key)) return;
    pendingRequests.current.add(key);
    setPending(new Set(pendingRequests.current));
    setNotice(null);
    if (form) setFormErrors((previous) => ({ ...previous, [form]: undefined }));
    try {
      await request();
      close?.();
      setNotice({ type: 'success', message });
      await fetchData();
    } catch (error) {
      const failure = error instanceof AdminApiError ? error : new AdminApiError('The request failed. Please try again.');
      if (form) setFormErrors((previous) => ({ ...previous, [form]: failure }));
      else setNotice({ type: 'error', message: failure.message });
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
  const handleDeleteSite = async (id: string) => {
    if (pendingRequests.current.has(`delete:site:${id}`)) return;
    if (confirm('Are you sure you want to archive this site?')) {
      await runMutation(`delete:site:${id}`, () => apiDeleteSite(id), 'Heritage site archived successfully.');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (pendingRequests.current.has(`delete:event:${id}`)) return;
    if (confirm('Are you sure you want to cancel this event?')) {
      await runMutation(`delete:event:${id}`, () => apiDeleteEvent(id), 'Event cancelled successfully.');
    }
  };

  const handleDeleteImage = async (id: string) => {
    if (pendingRequests.current.has(`delete:image:${id}`)) return;
    if (confirm('Remove this image reference? The stored file will not be deleted.')) {
      await runMutation(`delete:image:${id}`, () => apiDeleteSiteImage(id), 'Image removed successfully.');
    }
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
  const [siteForm, setSiteForm] = useState<any>({});
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [draftTimelines, setDraftTimelines] = useState<DraftTimeline[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [removedTimelineIds, setRemovedTimelineIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const [timelineSubModalOpen, setTimelineSubModalOpen] = useState(false);
  const [editingTimelineKey, setEditingTimelineKey] = useState<string | null>(null);
  const [timelineSubError, setTimelineSubError] = useState<string | null>(null);
  const [timelineItemForm, setTimelineItemForm] = useState<{ year: string; title: string; description: string }>({
    year: '',
    title: '',
    description: '',
  });

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const validateBasicInfo = (): boolean => {
    if (!siteForm.name?.trim() || !siteForm.address?.trim() || !siteForm.description?.trim() || !siteForm.history?.trim()) {
      setStepError('Please fill out all required Basic Information fields (Name, Address, Description, and History).');
      return false;
    }
    setStepError(null);
    return true;
  };

  const goToStep = (step: number) => {
    if (step > 1 && !validateBasicInfo()) return;
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

  const openAddTimelineSubModal = () => {
    setEditingTimelineKey(null);
    setTimelineSubError(null);
    setTimelineItemForm({ year: '', title: '', description: '' });
    setTimelineSubModalOpen(true);
  };

  const openEditTimelineSubModal = (key: string) => {
    const item = draftTimelines.find(t => t.key === key);
    if (!item) return;
    setEditingTimelineKey(key);
    setTimelineSubError(null);
    setTimelineItemForm({
      year: item.year || '',
      title: item.title || '',
      description: item.description || '',
    });
    setTimelineSubModalOpen(true);
  };

  const handleSaveTimelineSubItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineItemForm.year.trim() || !timelineItemForm.title.trim() || !timelineItemForm.description.trim()) {
      setTimelineSubError('Please fill out Year, Title, and Description for the timeline item.');
      return;
    }
    if (editingTimelineKey) {
      setDraftTimelines(prev =>
        prev.map(item =>
          item.key === editingTimelineKey
            ? { ...item, year: timelineItemForm.year.trim(), title: timelineItemForm.title.trim(), description: timelineItemForm.description.trim() }
            : item
        )
      );
    } else {
      setDraftTimelines(prev => [
        ...prev,
        {
          key: `temp_t_${Date.now()}_${Math.random()}`,
          year: timelineItemForm.year.trim(),
          title: timelineItemForm.title.trim(),
          description: timelineItemForm.description.trim(),
        },
      ]);
    }
    setTimelineSubModalOpen(false);
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
        category: 'Festival',
        tags: [],
        schedules: [],
      });
      setIsDateRange(false);
      setImageFile(null);
      setImagePreview(null);
      setTagInput('');
      setEventModalOpen(true);
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
      setImagePreview(e.image_path ? storageImageUrl(e.image_path) : (e.bannerImage || null));
      setTagInput('');
      setEventModalOpen(true);
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

  const handleDeleteTimeline = async (id: string) => {
    if (pendingRequests.current.has(`delete:timeline:${id}`)) return;
    if (confirm('Delete this timeline?')) {
      await runMutation(`delete:timeline:${id}`, () => apiDeleteTimeline(id), 'Timeline deleted successfully.');
    }
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const sortedTimelines = [...draftTimelines].sort((a, b) => parseYearNumber(a.year) - parseYearNumber(b.year));

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
      onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        activeTab === tab 
          ? 'bg-[#7e1925] text-white font-semibold'
          : 'text-[#574141] hover:bg-[#faf2ee] hover:text-[#7e1925]'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );

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
          <span className="text-[#7A1C30] font-bold text-xl tracking-tight">CHIS Admin</span>
          <button aria-label="Close admin navigation" className="ml-auto min-h-11 min-w-11 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {renderSidebarItem('dashboard', 'Dashboard', LayoutDashboard)}
          {renderSidebarItem('sites', 'Heritage Sites', Map)}
          {renderSidebarItem('images', 'Site Images', ImageIcon)}
          {renderSidebarItem('timelines', 'Timelines', Clock)}
          {renderSidebarItem('events', 'Events', CalendarIcon)}
          {renderSidebarItem('itineraries', 'Recommended Itineraries', Map)}
          {renderSidebarItem('checkins', 'Visit Verification', Map)}
          {renderSidebarItem('travelers', 'Travelers', Users)}
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
              <img src={user.avatar || '/images/default-avatar.png'} alt="Admin" className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
            </div>
            <button aria-label="Sign out of Admin" onClick={onLogout} className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {notice && (
            <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mb-4 ${notice.type === 'error' ? 'status-error' : 'status-success'}`}>
              {notice.message}
            </div>
          )}
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
          ) : (
            <div className="max-w-6xl mx-auto">
              
              {/* DASHBOARD TAB */}
              {activeTab === 'itineraries' && <AdminItineraries sites={sites} />}
              {activeTab === 'checkins' && <AdminCheckins sites={sites} />}
              {activeTab === 'travelers' && <AdminTravelers />}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <h1 className="page-title text-gray-900">Admin Dashboard</h1>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="ui-card p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 rounded-lg"><Map className="w-6 h-6 text-[#7A1C30]" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Total Heritage Sites</p>
                          <p className="text-2xl font-bold text-gray-900">{sites.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#e8dfd5] p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg"><ImageIcon className="w-6 h-6 text-blue-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Total Site Images</p>
                          <p className="text-2xl font-bold text-gray-900">{siteImages.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#e8dfd5] p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-lg"><CalendarIcon className="w-6 h-6 text-emerald-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Total Events</p>
                          <p className="text-2xl font-bold text-gray-900">{events.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-[#e8dfd5] p-6">
                      <h3 className="section-title text-gray-900 mb-4">Quick Actions</h3>
                      <div className="space-y-3">
                        <button onClick={openCreateSiteModal} className="w-full text-left px-4 py-3 rounded-lg border border-[#e8dfd5] hover:bg-gray-50 flex items-center justify-between transition-colors">
                          <span className="font-medium text-gray-700">Add Heritage Site</span>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                        <button onClick={openEventCreateModal} className="w-full text-left px-4 py-3 rounded-lg border border-[#e8dfd5] hover:bg-gray-50 flex items-center justify-between transition-colors">
                          <span className="font-medium text-gray-700">Add Event</span>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                        <button onClick={() => openForm('image', () => { setSiteImageFile(null); setImageForm({}); setImageModalOpen(true); })} className="w-full text-left px-4 py-3 rounded-lg border border-[#e8dfd5] hover:bg-gray-50 flex items-center justify-between transition-colors">
                          <span className="font-medium text-gray-700">Add Image Reference</span>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#e8dfd5] p-6">
                      <h3 className="section-title text-gray-900 mb-4">Recent Heritage Sites</h3>
                      <div className="space-y-4">
                        {sites.slice(-5).reverse().map(s => {
                          const mainImg = (s.images?.find((image: any) => image.is_cover) || s.images?.[0])?.image_path;
                          return (
                          <div key={s.id} className="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                            <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-[#e8dfd5]">
                              <img src={mainImg ? storageImageUrl(mainImg) : HERITAGE_IMAGE_PLACEHOLDER} onError={handleHeritageImageError} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                              <p className="text-xs text-gray-500 truncate">{s.address} • {s.status}</p>
                            </div>
                          </div>
                        )})}
                        {sites.length === 0 && <p className="text-sm text-gray-500">No sites available.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SITES TAB */}
              {activeTab === 'sites' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="page-title text-gray-900">Heritage Sites</h1>
                    <button onClick={openCreateSiteModal} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors">
                      <Plus className="w-4 h-4" /> Add Site
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-[#e8dfd5] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-[#e8dfd5] text-gray-600">
                          <tr>
                            <th className="px-6 py-3 font-medium">Name</th>
                            <th className="px-6 py-3 font-medium">Address</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sites.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                              <td className="px-6 py-4 text-gray-500">{s.address}</td>
                              <td className="px-6 py-4 text-gray-500">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>{s.status}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => openEditSiteModal(s)} className="text-blue-600 hover:text-blue-850 p-1.5 mr-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                <button disabled={pending.has(`delete:site:${s.id}`)} aria-busy={pending.has(`delete:site:${s.id}`)} onClick={() => handleDeleteSite(s.id)} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Archive" aria-label="Archive">{pending.has(`delete:site:${s.id}`) ? <span className="text-xs">Processing...</span> : <Trash2 className="w-4 h-4" />}</button>
                              </td>
                            </tr>
                          ))}
                          {sites.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No heritage sites found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SITE IMAGES TAB */}
              {activeTab === 'images' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="page-title text-gray-900">Site Images</h1>
                    <button onClick={() => openForm('image', () => { setSiteImageFile(null); setImageForm({}); setImageModalOpen(true); })} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors">
                      <Plus className="w-4 h-4" /> Add Image Reference
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {siteImages.map(img => {
                      const site = sites.find(s => s.id === img.heritage_site_id);
                      return (
                        <div key={img.id} className="bg-white border border-[#e8dfd5] rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                          <img src={storageImageUrl(img.image_path)} onError={handleHeritageImageError} alt={img.caption || 'Site image'} className="w-full h-44 object-cover" />
                          <div className="p-4 flex-1 flex flex-col">
                            <p className="text-sm font-bold text-gray-900 truncate mb-1">{img.caption || 'No Caption'}</p>
                            <p className="text-xs text-gray-500 mb-2">{img.is_cover ? 'Cover image · ' : ''}Order: {img.sort_order ?? 0}</p>
                            <p className="text-xs text-gray-500 truncate mb-4 bg-gray-50 p-1.5 rounded-md border border-gray-100">Site: {site?.name || img.heritage_site_id}</p>
                            <div className="mt-auto flex justify-end gap-2">
                              <button onClick={() => openForm('image', () => { setSiteImageFile(null); setImageForm(img); setImageModalOpen(true); })} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Edit3 className="w-4 h-4" /></button>
                              <button disabled={pending.has(`delete:image:${img.id}`)} aria-busy={pending.has(`delete:image:${img.id}`)} title="Remove Image Reference" aria-label="Remove Image Reference" onClick={() => handleDeleteImage(img.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">{pending.has(`delete:image:${img.id}`) ? <span className="text-xs">Processing...</span> : <Trash2 className="w-4 h-4" />}</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {siteImages.length === 0 && (
                      <div className="col-span-full py-12 text-center text-gray-500 bg-white border border-[#e8dfd5] rounded-xl border-dashed">
                        No image references added yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EVENTS TAB */}
              {activeTab === 'events' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="page-title text-gray-900">Events</h1>
                    <button onClick={openEventCreateModal} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer">
                      <Plus className="w-4 h-4" /> Add Event
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
                            <th className="px-6 py-3 font-medium">Schedules</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {events.map(e => {
                            const timeStr = e.start_time && e.end_time 
                              ? `${e.start_time} - ${e.end_time}` 
                              : (e.start_time || e.time || 'TBA');
                            const schedCount = Array.isArray(e.schedules) ? e.schedules.length : 0;
                            return (
                              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-gray-900">
                                  <div>{e.title}</div>
                                  <div className="text-xs font-normal text-gray-500">{e.status || 'upcoming'}</div>
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
                                <td className="px-6 py-4 text-gray-500">
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 border border-[#e8dfd5] px-2 py-0.5 rounded-md">
                                    <Clock className="w-3 h-3 text-gray-400" /> {schedCount} item{schedCount !== 1 ? 's' : ''}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button onClick={() => openEventEditModal(e)} className="text-blue-600 hover:text-blue-800 p-1.5 mr-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                  <button disabled={pending.has(`delete:event:${e.id}`)} aria-busy={pending.has(`delete:event:${e.id}`)} onClick={() => handleDeleteEvent(e.id)} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer" title="Delete Event" aria-label="Delete Event">{pending.has(`delete:event:${e.id}`) ? <span className="text-xs">Processing...</span> : <Trash2 className="w-4 h-4" />}</button>
                                </td>
                              </tr>
                            );
                          })}
                          {events.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No events found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TIMELINES TAB */}
              {activeTab === 'timelines' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="page-title text-gray-900">Historical Timelines</h1>
                    <button onClick={() => openForm('timeline', () => { setTimelineForm({}); setTimelineModalOpen(true); })} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors">
                      <Plus className="w-4 h-4" /> Add Timeline
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-[#e8dfd5] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-[#e8dfd5] text-gray-600">
                          <tr>
                            <th className="px-6 py-3 font-medium">Site</th>
                            <th className="px-6 py-3 font-medium">Year</th>
                            <th className="px-6 py-3 font-medium">Title</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sites.flatMap(s => (s.timelines || []).map((t: any) => ({ ...t, siteName: s.name }))).map((t: any) => (
                            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-gray-900">{t.siteName}</td>
                              <td className="px-6 py-4 font-bold text-gray-900">{t.year}</td>
                              <td className="px-6 py-4 text-gray-500">{t.title}</td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => openForm('timeline', () => { setTimelineForm(t); setTimelineModalOpen(true); })} className="text-blue-600 hover:text-blue-800 p-1.5 mr-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                <button disabled={pending.has(`delete:timeline:${t.id}`)} aria-busy={pending.has(`delete:timeline:${t.id}`)} onClick={() => handleDeleteTimeline(t.id)} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Delete">{pending.has(`delete:timeline:${t.id}`) ? <span className="text-xs">Processing...</span> : <Trash2 className="w-4 h-4" />}</button>
                              </td>
                            </tr>
                          ))}
                          {sites.flatMap(s => s.timelines || []).length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No timelines found.</td></tr>
                          )}
                        </tbody>
                      </table>
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
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 rounded-t-2xl">
              <div>
                <h2 className="section-title text-gray-900">{siteForm.id ? 'Edit Heritage Site' : 'Add Heritage Site'}</h2>
                <h3 className="text-sm font-semibold text-[#7A1C30] mt-0.5">
                  {currentStep === 1 ? 'Basic Information' : currentStep === 2 ? 'Historical Timeline' : currentStep === 3 ? 'Visitor Information' : 'Images'}
                </h3>
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
                      className="min-h-11 min-w-11 flex items-center justify-center"
                      title={`${step}. ${label}`}
                      aria-label={`Step ${step}: ${label}`}
                      aria-current={currentStep === step ? 'step' : undefined}
                    ><span aria-hidden="true" className={`h-2.5 rounded-full ${currentStep === step ? 'w-9 bg-[#7e1925]' : currentStep > step ? 'w-7 bg-[#7e1925]/70' : 'w-7 bg-gray-200'}`} /></button>
                  ))}
                </div>

                <button type="button" disabled={pending.has('save:site')} onClick={() => setSiteModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 shadow-xs border border-[#e8dfd5] transition-colors ml-1" aria-label="Close editor" title="Close"><X className="w-4 h-4"/></button>
              </div>
            </div>

            <form id="admin-site-form" onSubmit={handleSaveSite} className="flex-1 overflow-auto p-6 space-y-5 text-sm">
              {renderFormError('site')}
              {stepError && (
                <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p>{stepError}</p>
                </div>
              )}
              <fieldset disabled={pending.has('save:site')} className="contents">

              {/* PAGE 1: BASIC INFORMATION */}
              <div className={currentStep === 1 ? 'space-y-5' : 'hidden'}>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5 col-span-2">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-1">Name</label>
                    <input id="admin-field-1" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.name || ''} onChange={e => setSiteForm((prev: any) => ({...prev, name: e.target.value}))} placeholder="Site Name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-2">Category</label>
                    <select id="admin-field-2" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 outline-none bg-white" value={siteForm.category || ''} onChange={e => setSiteForm((prev: any) => ({...prev, category: e.target.value}))}>
                      <option value="">Unspecified</option>
                      {siteForm.category && !HERITAGE_CATEGORIES.some(category => category !== 'All' && category === siteForm.category) && (
                        <option value={siteForm.category}>{siteForm.category} (choose a supported category)</option>
                      )}
                      {HERITAGE_CATEGORIES.filter(category => category !== 'All').map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-3">Year Built</label>
                    <input id="admin-field-3" type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.year_built || ''} onChange={e => setSiteForm((prev: any) => ({...prev, year_built: e.target.value}))} placeholder="e.g. 1755" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-4">Address</label>
                    <input id="admin-field-4" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.address || ''} onChange={e => setSiteForm((prev: any) => ({...prev, address: e.target.value}))} placeholder="Full address" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-5">Status</label>
                    <select id="admin-field-5" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={siteForm.status || 'active'} onChange={e => setSiteForm((prev: any) => ({...prev, status: e.target.value}))}>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-6">Latitude</label>
                    <input id="admin-field-6" type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.latitude ?? ''} onChange={e => setSiteForm((prev: any) => ({...prev, latitude: e.target.value}))} placeholder="e.g. 15.031" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-7">Longitude</label>
                    <input id="admin-field-7" type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.longitude ?? ''} onChange={e => setSiteForm((prev: any) => ({...prev, longitude: e.target.value}))} placeholder="e.g. 120.689" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-8">Description</label>
                  <textarea id="admin-field-8" required rows={3} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={siteForm.description || ''} onChange={e => setSiteForm((prev: any) => ({...prev, description: e.target.value}))} placeholder="Brief description..." />
                </div>

                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-9">History</label>
                  <textarea id="admin-field-9" required rows={4} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={siteForm.history || ''} onChange={e => setSiteForm((prev: any) => ({...prev, history: e.target.value}))} placeholder="Full historical context..." />
                </div>
              </div>

              {/* PAGE 2: HISTORICAL TIMELINE */}
              <section className={currentStep === 2 ? 'space-y-4' : 'hidden'}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Historical Timeline</h3>
                    <p className="text-xs text-gray-500">Optional. Items automatically order by year ascending.</p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddTimelineSubModal}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A1C30] hover:text-[#581020] bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Timeline Item
                  </button>
                </div>

                {draftTimelines.length > 0 ? (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {[...draftTimelines]
                      .sort((a, b) => parseYearNumber(a.year) - parseYearNumber(b.year))
                      .map((item) => (
                        <div key={item.key} className="p-3.5 bg-gray-50 border border-[#e8dfd5] rounded-xl flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-[#7A1C30]/10 text-[#7A1C30] text-xs font-bold rounded-md border border-[#7A1C30]/20">
                                {item.year}
                              </span>
                              <h4 className="text-sm font-bold text-gray-900 truncate">{item.title}</h4>
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{item.description}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditTimelineSubModal(item.key)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTimelineItem(item.key)}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic text-center py-8 bg-gray-50 border border-[#e8dfd5] border-dashed rounded-xl">
                    No timeline items added. Click "+ Add Timeline Item" above to add historical events.
                  </div>
                )}
              </section>

              {/* PAGE 3: VISITOR INFORMATION */}
              <section className={currentStep === 3 ? 'space-y-4' : 'hidden'} aria-labelledby="admin-visitor-information-title">
                <div>
                  <h3 id="admin-visitor-information-title" className="font-bold text-gray-900 text-base">Visitor Information</h3>
                  <p className="text-xs text-gray-500">Optional. Leave unknown information blank.</p>
                </div>
                {[
                  { field: 'opening_hours', label: 'Opening Hours', maxLength: 1000, rows: 2 },
                  { field: 'entrance_fee', label: 'Entrance Fee / Admission', maxLength: 1000, rows: 2 },
                  { field: 'accessibility_notes', label: 'Accessibility Notes', maxLength: 3000, rows: 3 },
                  { field: 'visit_notes', label: 'Visit Notes', maxLength: 3000, rows: 3 },
                  { field: 'contact_information', label: 'Contact Information', maxLength: 2000, rows: 2 },
                ].map(({ field, label, maxLength, rows }) => (
                  <div key={field} className="space-y-1.5">
                    <label htmlFor={`admin-site-${field}`} className="font-semibold text-gray-700">{label}</label>
                    <textarea id={`admin-site-${field}`} name={field} rows={rows} maxLength={maxLength}
                      className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none"
                      value={siteForm[field] ?? ''} onChange={e => setSiteForm({ ...siteForm, [field]: e.target.value })} />
                  </div>
                ))}
              </section>

              {/* PAGE 4: IMAGES */}
              <section className={currentStep === 4 ? 'space-y-4' : 'hidden'}>
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
                            className="w-full border border-[#e8dfd5] rounded-lg p-2 text-xs focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none bg-white"
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
                            Remove
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
            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-2xl text-xs">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    disabled={pending.has('save:site')}
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="px-4 py-2 border border-[#e8dfd5] rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    ← Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentStep < 4 && (
                  <button
                    type="button"
                    onClick={() => goToStep(currentStep + 1)}
                    className="px-5 py-2 bg-gray-900 hover:bg-black text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    Next →
                  </button>
                )}

                {currentStep === 4 && (
                  <button
                    type="submit"
                    form="admin-site-form"
                    disabled={pending.has('save:site')}
                    className="px-5 py-2 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors cursor-pointer"
                  >
                    {pending.has('save:site') ? 'Saving...' : 'Save Heritage Site'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIMELINE SUB-MODAL */}
      {timelineSubModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingTimelineKey ? 'Edit Timeline Item' : 'Add Timeline Item'}
              </h3>
              <button
                type="button"
                onClick={() => setTimelineSubModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTimelineSubItem} className="space-y-4 text-sm">
              {timelineSubError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <p>{timelineSubError}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-11">Year</label>
                <input id="admin-field-11"
                  required
                  type="text"
                  className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none"
                  placeholder="e.g. 1755"
                  value={timelineItemForm.year}
                  onChange={(e) => setTimelineItemForm({ ...timelineItemForm, year: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-12">Title</label>
                <input id="admin-field-12"
                  required
                  type="text"
                  className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none"
                  placeholder="e.g. Augustinian Foundation"
                  value={timelineItemForm.title}
                  onChange={(e) => setTimelineItemForm({ ...timelineItemForm, title: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-13">Description</label>
                <textarea id="admin-field-13"
                  required
                  rows={3}
                  className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none resize-none"
                  placeholder="Describe the historical event..."
                  value={timelineItemForm.description}
                  onChange={(e) => setTimelineItemForm({ ...timelineItemForm, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTimelineSubModalOpen(false)}
                  className="px-4 py-2 border border-[#e8dfd5] rounded-xl text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors"
                >
                  {editingTimelineKey ? 'Save Changes' : 'Add Timeline Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {eventModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Event editor" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="section-title text-gray-900">{eventForm.id ? 'Edit Event' : 'Add Event'}</h2>
              <button type="button" disabled={pending.has('save:event')} onClick={() => setEventModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 border border-[#e8dfd5] transition-colors cursor-pointer"><X className="w-4 h-4"/></button>
            </div>
            <form id="admin-event-form" onSubmit={handleSaveEvent} className="p-6 space-y-5 text-sm overflow-y-auto flex-1">
              {renderFormError('event')}
              <fieldset disabled={pending.has('save:event')} className="contents">
              
              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-14">Title</label>
                  <input id="admin-field-14" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={eventForm.title || ''} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="Event Title" />
                </div>
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-15">Category</label>
                  <select id="admin-field-15" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={eventForm.category || 'Festival'} onChange={e => setEventForm({...eventForm, category: e.target.value})}>
                    <option value="Festival">Festival</option>
                    <option value="Heritage Tour">Heritage Tour</option>
                    <option value="Exhibition">Exhibition</option>
                    <option value="Community">Community</option>
                  </select>
                </div>
              </div>

              {/* Date Setup: Single Date vs Date Range */}
              <div className="space-y-2 p-3.5 bg-gray-50/70 rounded-xl border border-[#e8dfd5]">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-gray-700">Date Setup</label>
                  <div className="inline-flex rounded-lg p-0.5 bg-gray-200/80 border border-[#e8dfd5]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDateRange(false);
                        setEventForm({ ...eventForm, end_date: null });
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        !isDateRange ? 'bg-white text-[#7A1C30] shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Single Date
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDateRange(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        isDateRange ? 'bg-white text-[#7A1C30] shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
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
                        required
                        type="date"
                        className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none bg-white"
                        value={eventDateForInput(eventForm.event_date)}
                        onChange={(e) => setEventForm({ ...eventForm, event_date: replaceEventDate(events.find(event => String(event.id) === String(eventForm.id))?.event_date || eventForm.event_date, e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-17">End Date</label>
                      <input id="admin-field-17"
                        required
                        type="date"
                        className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none bg-white"
                        value={eventDateForInput(eventForm.end_date)}
                        onChange={(e) => setEventForm({ ...eventForm, end_date: replaceEventDate(eventForm.end_date, e.target.value) })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 pt-1">
                    <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-18">Event Date</label>
                    <input id="admin-field-18"
                      required
                      type="date"
                      className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none bg-white"
                      value={eventDateForInput(eventForm.event_date)}
                      onChange={(e) => setEventForm({ ...eventForm, event_date: replaceEventDate(events.find(event => String(event.id) === String(eventForm.id))?.event_date || eventForm.event_date, e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {/* Start Time & End Time Selection Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-19">Start Time</label>
                  <select id="admin-field-19"
                    className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none bg-white"
                    value={eventForm.start_time || ''}
                    onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                  >
                    <option value="">Select Start Time...</option>
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-20">End Time</label>
                  <select id="admin-field-20"
                    className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none bg-white"
                    value={eventForm.end_time || ''}
                    onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                  >
                    <option value="">Select End Time...</option>
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-21">Location</label>
                  <input id="admin-field-21" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={eventForm.location || ''} onChange={e => setEventForm({...eventForm, location: e.target.value})} placeholder="Event Location" />
                </div>
                <div className="space-y-1.5">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-22">Status</label>
                  <select id="admin-field-22" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={eventForm.status || 'upcoming'} onChange={e => setEventForm({...eventForm, status: e.target.value})}>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Image Input with File Upload & Live Preview */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">Event Image</label>

                {imagePreview ? (
                  <div className="relative group rounded-xl overflow-hidden border border-[#e8dfd5] bg-gray-50 max-h-48">
                    <img src={imagePreview} alt="Event Preview" className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-md">
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
                          setEventForm({ ...eventForm, image_path: '' });
                        }}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer"
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

              {/* Description */}
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-23">Description</label>
                <textarea id="admin-field-23" required rows={3} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={eventForm.description || ''} onChange={e => setEventForm({...eventForm, description: e.target.value})} placeholder="Event description..." />
              </div>

              {/* Input-Chip Field for Tags */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">Tags</label>
                <div className="flex flex-wrap gap-2 min-h-[38px] p-2 border border-[#e8dfd5] rounded-xl bg-gray-50/50 items-center">
                  {(eventForm.tags || []).map((tag: string, index: number) => (
                    <span key={index} className="inline-flex items-center gap-1.5 bg-[#7A1C30]/10 text-[#7A1C30] border border-[#7A1C30]/20 text-xs font-semibold px-2.5 py-1 rounded-full">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = (eventForm.tags || []).filter((_: any, i: number) => i !== index);
                          setEventForm({ ...eventForm, tags: newTags });
                        }}
                        className="hover:bg-[#7A1C30]/20 rounded-full p-0.5 transition-colors cursor-pointer"
                        title="Remove tag"
                      >
                        <X className="w-3 h-3" />
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
                    className="flex-1 border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none"
                    placeholder="Type tag and press Enter (e.g. Family Friendly)..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = tagInput.trim();
                        if (trimmed && !(eventForm.tags || []).includes(trimmed)) {
                          setEventForm({
                            ...eventForm,
                            tags: [...(eventForm.tags || []), trimmed],
                          });
                          setTagInput('');
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
                        setTagInput('');
                      }
                    }}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>
              </div>

              {/* Multi-Item Event Schedule Editor */}
              <div className="space-y-3 pt-3 border-t border-[#e8dfd5]">
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
                        schedules: [...currentSchedules, { schedule_time: '', title: '', description: '' }],
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A1C30] hover:text-[#581020] bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Schedule Item
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
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
                          value={sch.schedule_time || sch.time || ''}
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
                          value={sch.title || sch.activity || ''}
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
                        value={sch.description || ''}
                        onChange={(e) => {
                          const updated = [...(eventForm.schedules || [])];
                          updated[index] = { ...updated[index], description: e.target.value };
                          setEventForm({ ...eventForm, schedules: updated });
                        }}
                      />
                    </div>
                  ))}
                  {(!eventForm.schedules || eventForm.schedules.length === 0) && (
                    <div className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 border border-[#e8dfd5] border-dashed rounded-xl">
                      No schedule items added yet. Click "+ Add Schedule Item" above to add program timeline activities.
                    </div>
                  )}
                </div>
              </div>

              </fieldset>
            </form>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" disabled={pending.has('save:event')} onClick={() => setEventModalOpen(false)} className="px-5 py-2.5 border border-[#e8dfd5] rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors cursor-pointer">Cancel</button>
              <button type="submit" form="admin-event-form" disabled={pending.has('save:event')} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors cursor-pointer">{pending.has('save:event') ? 'Saving...' : 'Save Event'}</button>
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
              <button type="button" disabled={pending.has('save:image')} onClick={() => { setImageModalOpen(false); setSiteImageFile(null); }} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 border border-[#e8dfd5] transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <form id="admin-image-form" onSubmit={handleSaveImage} className="p-6 space-y-5 text-sm">
              {renderFormError('image')}
              <fieldset disabled={pending.has('save:image')} className="contents">
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-24">Heritage Site</label>
                <select id="admin-field-24" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={imageForm.heritage_site_id || ''} onChange={e => setImageForm({...imageForm, heritage_site_id: parseInt(e.target.value)})}>
                  <option value="">Select a Heritage Site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-25">Image Path or URL</label>
                <input id="admin-field-25" required={!siteImageFile} type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" placeholder="e.g. heritage-sites/photo.jpg" value={imageForm.image_path || ''} onChange={e => setImageForm({...imageForm, image_path: e.target.value})} />
                <p className="text-xs text-gray-500 mt-1">Use an existing URL/path or upload a file. A selected upload takes precedence.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-site-image-upload" className="font-semibold text-gray-700">Upload Image</label>
                <input id="admin-site-image-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={e => setSiteImageFile(e.target.files?.[0] || null)} />
                <p className="text-xs text-gray-500">JPEG, PNG, WEBP or GIF. Maximum 5 MB.</p>
                {siteImageFile && <p className="text-xs text-gray-700">Selected: {siteImageFile.name}</p>}
                {((siteImageFile && siteImagePreview) || imageForm.image_path) && <img id="admin-site-image-preview"
                  src={(siteImageFile && siteImagePreview) || storageImageUrl(imageForm.image_path)} onError={handleHeritageImageError}
                  alt="Image preview" className="w-full h-40 object-contain rounded border border-[#e8dfd5]" />}
              </div>
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-26">Caption</label>
                <input id="admin-field-26" type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={imageForm.caption || ''} onChange={e => setImageForm({...imageForm, caption: e.target.value})} placeholder="Image caption..." />
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
              <button type="button" disabled={pending.has('save:timeline')} onClick={() => setTimelineModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 border border-[#e8dfd5] transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <form id="admin-timeline-form" onSubmit={handleSaveTimeline} className="p-6 space-y-5 text-sm">
              {renderFormError('timeline')}
              <fieldset disabled={pending.has('save:timeline')} className="contents">
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-27">Heritage Site</label>
                <select id="admin-field-27" required className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={timelineForm.heritage_site_id || ''} onChange={e => setTimelineForm({...timelineForm, heritage_site_id: parseInt(e.target.value)})}>
                  <option value="">Select a Heritage Site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5 col-span-2">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-28">Title</label>
                  <input id="admin-field-28" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" placeholder="Timeline Event Title" value={timelineForm.title || ''} onChange={e => setTimelineForm({...timelineForm, title: e.target.value})} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-29">Year</label>
                  <input id="admin-field-29" required type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" placeholder="e.g. 1920 or circa 1920" value={timelineForm.year || ''} onChange={e => setTimelineForm({...timelineForm, year: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-30">Description</label>
                <textarea id="admin-field-30" required rows={4} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={timelineForm.description || ''} onChange={e => setTimelineForm({...timelineForm, description: e.target.value})} placeholder="Event description..." />
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
