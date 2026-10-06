import type {
  HeritageSite,
  EventItem,
  CommunityPhoto,
  UserProfile,
  UserPlan,
} from '../types';

const API_BASE = '/api';
let authGeneration = 0;

export function getJwtToken(): string | null {
  return localStorage.getItem('chis_jwt_token');
}

export function setJwtToken(token: string | null): void {
  if (token) {
    localStorage.setItem('chis_jwt_token', token);
  } else {
    localStorage.removeItem('chis_jwt_token');
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getJwtToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Health Check
export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch {
    return { status: 'offline', error: 'Network error' };
  }
}

// Auth API Calls
function mapAuthenticatedUser(raw: unknown): UserProfile {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid authentication response. Please try again.');
  const user = raw as Record<string, unknown>;
  const validId = typeof user.id === 'number'
    ? Number.isSafeInteger(user.id) && user.id > 0
    : typeof user.id === 'string' && /^[1-9]\d*$/.test(user.id);
  if (!validId || typeof user.name !== 'string' || typeof user.email !== 'string'
    || (user.role !== 'admin' && user.role !== 'traveler')) {
    throw new Error('Invalid authentication response. Please try again.');
  }
  return {
    id: String(user.id), name: user.name, email: user.email, role: user.role,
    avatar: typeof user.avatar === 'string' ? user.avatar : '/images/characters/nicolasa-dayrit.jpg',
    savedSites: [], scannedSites: [], badges: [], stamps: [],
  };
}

async function authenticate(path: string, credentials: Record<string, unknown>): Promise<{ token: string; user: UserProfile }> {
  const generation = authGeneration;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(credentials),
    });
  } catch {
    throw new Error('Unable to reach the sign-in server. Check your connection and try again.');
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('Incorrect email or password.');
    if (res.status === 422) throw new Error('Please check the information you entered.');
    if (res.status === 429) throw new Error('Too many attempts. Please try again later.');
    throw new Error('The authentication service is unavailable. Please try again later.');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('The authentication service returned an invalid response. Please try again.');
  }
  if (!data || typeof data.token !== 'string' || !data.token.trim()) {
    throw new Error('Invalid authentication response. Please try again.');
  }
  const user = mapAuthenticatedUser(data.user);
  if (generation !== authGeneration) throw new Error('Sign-in cancelled because you signed out.');
  setJwtToken(data.token);
  return { token: data.token, user };
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  return authenticate('/auth/login', { email, password });
}

export async function apiRegister(name: string, email: string, password: string, hometown?: string): Promise<{ token: string; user: UserProfile }> {
  return authenticate('/auth/register', { name, email, password, hometown });
}

export async function apiLogout(): Promise<void> {
  const token = getJwtToken();
  authGeneration += 1;
  // Clear immediately so refresh and pending authentication cannot restore this session.
  setJwtToken(null);
  localStorage.removeItem('sf_user_profile');
  if (!token) return;

  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Local logout is complete even when revocation is unavailable or times out.
  }
}

export async function apiFetchCurrentUser(): Promise<UserProfile | null> {
  const generation = authGeneration;
  const token = getJwtToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (generation !== authGeneration || getJwtToken() !== token) return null;
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) setJwtToken(null);
      return null;
    }
    const data = await res.json();
    if (generation !== authGeneration || getJwtToken() !== token) return null;
    return mapAuthenticatedUser(data.user);
  } catch {
    return null;
  }
}

export async function apiUpdateProfile(userUpdates: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(userUpdates)
  });
  const data = await res.json();
  return data.user;
}

// Backend to Frontend Data Mapper for Heritage Sites
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBackendSite(raw: any): HeritageSite {
  const images = Array.isArray(raw.images) ? raw.images : [];
  const heroImg = images.length > 0 ? `/storage/${images[0].image_path}` : '/images/sites/cathedral-hero.jpg';
  const archivalImg = images.length > 1 ? `/storage/${images[1].image_path}` : heroImg;
  const modernImg = images.length > 2 ? `/storage/${images[2].image_path}` : heroImg;

  return {
    id: String(raw.id),
    name: raw.name || 'Unnamed Site',
    nativeName: raw.name,
    category: raw.category || 'Cultural Sites',
    yearBuilt: raw.year_built || 'Unknown',
    era: 'Unknown',
    address: raw.address || 'San Fernando, Pampanga',
    barangay: 'Poblacion',
    distanceKm: 0,
    coordinates: {
      lat: raw.latitude !== null ? Number(raw.latitude) : 15.0287,
      lng: raw.longitude !== null ? Number(raw.longitude) : 120.6908,
      mapX: 50,
      mapY: 50
    },
    shortDescription: raw.description || 'No description available.',
    fullDescription: raw.description || '',
    story: raw.history || 'No history recorded.',
    heroImage: heroImg,
    archivalImage: archivalImg,
    modernImage: modernImg,
    thenNowCaption: images.length > 1 ? 'Comparison' : '',
    audioStory: {
      title: 'Story of ' + (raw.name || 'Site'),
      duration: '0m',
      durationSeconds: 0,
      narrator: 'System',
      transcript: raw.description || ''
    },
    timeline: Array.isArray(raw.timelines) ? raw.timelines.map((t: any) => ({
      year: t.year,
      title: t.title,
      description: t.description
    })) : [], 
    didYouKnow: [],
    historicalCharacters: [],
    visitInfo: {
      address: raw.address || '',
      openingHours: '8:00 AM - 5:00 PM',
      entranceFee: 'Free',
      accessibility: 'Varies',
      duration: '1 hr',
      guideAvailable: false,
      bestTime: 'Morning'
    },
    qrCodeId: `qr-${raw.id}`,
    scanCount: 0,
    badgeName: 'heritage-explorer'
  };
}

// Heritage Sites API
export async function apiFetchSites(): Promise<HeritageSite[]> {
  try {
    const res = await fetch(`${API_BASE}/heritage-sites`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    const data = await res.json();
    return data.map(mapBackendSite);
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetchRawSites(): Promise<any[]> {
  return adminList('/heritage-sites');
}

export async function apiFetchSiteById(id: string): Promise<HeritageSite | null> {
  try {
    const res = await fetch(`${API_BASE}/heritage-sites/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return mapBackendSite(data);
  } catch {
    return null;
  }
}

export async function apiRecordQrScan(id: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/heritage-sites/${id}/scan`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return await res.json();
}

// Admin: Heritage Sites
export class AdminApiError extends Error {
  status: number | null;
  validationErrors: Record<string, string[]>;

  constructor(message: string, status: number | null = null, validationErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

async function adminRequest(path: string, method = 'GET', data?: unknown): Promise<unknown> {
  let res: Response;
  const token = getJwtToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body: BodyInit | null | undefined = undefined;
  let actualMethod = method;

  if (data !== undefined) {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      if (method.toUpperCase() === 'PUT') {
        actualMethod = 'POST';
        data.append('_method', 'PUT');
      }
      body = data;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(data);
    }
  }

  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: actualMethod,
      headers,
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    throw new AdminApiError('Unable to reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    const errors: Record<string, string[]> = {};
    if (res.status === 422) {
      const body = await res.json().catch(() => null);
      if (body?.errors && typeof body.errors === 'object') {
        for (const [field, messages] of Object.entries(body.errors)) {
          if (Array.isArray(messages)) {
            errors[field] = messages.filter((message): message is string =>
              typeof message === 'string' && message.length <= 300 && !/[<>]/.test(message));
          }
        }
      }
    }
    const message = res.status === 422 ? 'Please correct the form information and try again.'
      : res.status === 401 ? 'Your session is no longer valid. Please sign in again.'
      : res.status === 403 ? 'You do not have permission to perform this action.'
      : res.status === 404 ? 'This record was not found. Reload the data and try again.'
      : 'The request failed. Please try again later.';
    throw new AdminApiError(message, res.status, errors);
  }
  if (method === 'DELETE' || res.status === 204) return undefined;
  try {
    return await res.json();
  } catch {
    throw new AdminApiError('The server returned an invalid response. Please reload the data.', res.status);
  }
}

async function adminList(path: string): Promise<unknown[]> {
  const data = await adminRequest(path);
  if (!Array.isArray(data)) throw new AdminApiError('The server returned an invalid list. Please retry.');
  return data;
}

export async function apiFetchAdminEvents(): Promise<unknown[]> {
  return adminList('/events');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateSite(data: any): Promise<HeritageSite> {
  return await adminRequest('/heritage-sites', 'POST', data) as HeritageSite;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateSite(id: string, data: any): Promise<HeritageSite> {
  return await adminRequest(`/heritage-sites/${id}`, 'PUT', data) as HeritageSite;
}

export async function apiDeleteSite(id: string): Promise<void> {
  await adminRequest(`/heritage-sites/${id}`, 'DELETE');
}

// Admin: Site Images
export async function apiFetchSiteImages(): Promise<unknown[]> {
  return adminList('/site-images');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateSiteImage(data: any): Promise<unknown> {
  return adminRequest('/site-images', 'POST', data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateSiteImage(id: string, data: any): Promise<unknown> {
  return adminRequest(`/site-images/${id}`, 'PUT', data);
}

export async function apiDeleteSiteImage(id: string): Promise<void> {
  await adminRequest(`/site-images/${id}`, 'DELETE');
}

// Admin: Heritage Timelines
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateTimeline(data: any): Promise<any> {
  return adminRequest('/heritage-timelines', 'POST', data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateTimeline(id: string, data: any): Promise<any> {
  return adminRequest(`/heritage-timelines/${id}`, 'PUT', data);
}

export async function apiDeleteTimeline(id: string): Promise<void> {
  await adminRequest(`/heritage-timelines/${id}`, 'DELETE');
}

// Events API
function formatDateString(startDateStr?: string | null, endDateStr?: string | null): string {
  if (!startDateStr) return '';
  try {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return startDateStr;
    const startFormatted = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    if (!endDateStr) return startFormatted;
    const end = new Date(endDateStr);
    if (isNaN(end.getTime()) || start.getTime() === end.getTime()) return startFormatted;

    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();

    if (sameMonth) {
      const monthStr = start.toLocaleDateString('en-US', { month: 'long' });
      return `${monthStr} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
    } else if (sameYear) {
      const startM = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endM = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startM} – ${endM}, ${start.getFullYear()}`;
    } else {
      const endFormatted = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      return `${startFormatted} – ${endFormatted}`;
    }
  } catch {
    return startDateStr || '';
  }
}

function formatDateBadgeString(startDateStr?: string | null, endDateStr?: string | null): string {
  if (!startDateStr) return 'EVENT';
  try {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return 'EVENT';
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const startDay = start.getDate();

    if (!endDateStr) return `${startMonth} ${startDay}`;
    const end = new Date(endDateStr);
    if (isNaN(end.getTime()) || start.getTime() === end.getTime()) return `${startMonth} ${startDay}`;

    if (start.getMonth() === end.getMonth()) {
      return `${startMonth} ${startDay}-${end.getDate()}`;
    } else {
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      return `${startMonth} ${startDay} - ${endMonth} ${end.getDate()}`;
    }
  } catch {
    return 'EVENT';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBackendEvent(raw: any): EventItem {
  const dateFormatted = formatDateString(raw.event_date, raw.end_date);
  const badgeFormatted = formatDateBadgeString(raw.event_date, raw.end_date);

  let timeFormatted = '';
  if (raw.start_time && raw.end_time) {
    timeFormatted = `${raw.start_time} – ${raw.end_time}`;
  } else if (raw.start_time) {
    timeFormatted = raw.start_time;
  } else if (raw.time) {
    timeFormatted = raw.time;
  } else {
    timeFormatted = 'TBA';
  }

  let bannerImage = '/images/events/giant-lantern-fest.jpg';
  if (raw.image_path) {
    if (/^(https?:)?\/\//i.test(raw.image_path) || raw.image_path.startsWith('/images/')) {
      bannerImage = raw.image_path;
    } else {
      const relative = raw.image_path.replace(/^\/+/, '').replace(/^storage\//, '');
      bannerImage = `/storage/${relative}`;
    }
  }

  const rawSchedules = Array.isArray(raw.schedules) ? raw.schedules : [];
  const schedule = rawSchedules.map((item: any) => ({
    id: item.id,
    time: item.schedule_time || item.time || '',
    activity: item.title || item.activity || '',
    description: item.description || ''
  }));

  let tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags;
  } else if (typeof raw.tags === 'string' && raw.tags.trim()) {
    try {
      tags = JSON.parse(raw.tags);
    } catch {
      tags = [];
    }
  }

  return {
    id: String(raw.id),
    title: raw.title || '',
    category: raw.category || 'Festival',
    date: dateFormatted,
    dateBadge: badgeFormatted,
    time: timeFormatted,
    location: raw.location || '',
    shortDescription: raw.description ? (raw.description.length > 150 ? raw.description.substring(0, 147) + '...' : raw.description) : '',
    fullDescription: raw.description || '',
    bannerImage: bannerImage,
    schedule: schedule,
    relatedSiteIds: Array.isArray(raw.relatedSiteIds) ? raw.relatedSiteIds : [],
    tags: tags,
    status: raw.status || 'upcoming',
    start_time: raw.start_time || '',
    end_time: raw.end_time || '',
    event_date: raw.event_date || '',
    end_date: raw.end_date || '',
  };
}

export async function apiFetchEvents(): Promise<EventItem[]> {
  try {
    const res = await fetch(`${API_BASE}/events`);
    if (!res.ok) throw new Error('Failed to fetch events');
    const data = await res.json();
    return data.map(mapBackendEvent);
  } catch {
    return [];
  }
}

// Helper to convert event object + image file into FormData
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEventPayload(data: any): unknown {
  if (data.imageFile instanceof File) {
    const formData = new FormData();
    for (const key of Object.keys(data)) {
      if (key === 'imageFile') {
        formData.append('image', data.imageFile);
      } else if (key === 'tags' || key === 'schedules') {
        formData.append(key, JSON.stringify(data[key] || []));
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    }
    return formData;
  }
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateEvent(data: any): Promise<EventItem> {
  const payload = buildEventPayload(data);
  const raw = await adminRequest('/events', 'POST', payload);
  return mapBackendEvent(raw);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateEvent(id: string, data: any): Promise<EventItem> {
  const payload = buildEventPayload(data);
  const raw = await adminRequest(`/events/${id}`, 'PUT', payload);
  return mapBackendEvent(raw);
}

export async function apiDeleteEvent(id: string): Promise<void> {
  await adminRequest(`/events/${id}`, 'DELETE');
}

// Community Photo Wall API
export async function apiFetchPhotos(): Promise<CommunityPhoto[]> {
  try {
    const res = await fetch(`${API_BASE}/photos`);
    if (!res.ok) throw new Error('Failed to fetch photos');
    return await res.json();
  } catch {
    return [];
  }
}

export async function apiLikePhoto(photoId: string): Promise<number> {
  const res = await fetch(`${API_BASE}/photos/${photoId}/like`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  return data.likes;
}

export async function apiUploadPhoto(photo: Omit<CommunityPhoto, 'id' | 'likes'>): Promise<CommunityPhoto> {
  const res = await fetch(`${API_BASE}/photos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(photo)
  });
  return await res.json();
}

// User Plans API
export async function apiFetchUserPlans(): Promise<UserPlan[]> {
  try {
    const res = await fetch(`${API_BASE}/user/plans`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function apiSaveUserPlan(title: string, siteIds: string[]): Promise<UserPlan> {
  const res = await fetch(`${API_BASE}/user/plans`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, site_ids: siteIds })
  });
  return await res.json();
}

// Gemini AI Katulung Chatbot via Laravel Endpoint
export async function apiSendChatMessage(messages: Array<{ role: string; content: string }>): Promise<{ reply: string; source?: string; useFallback?: boolean }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return await res.json();
}
