import type {
  HeritageSite,
  EventItem,
  CommunityPhoto,
  UserProfile,
  UserPlan,
  Itinerary,
  ItineraryInput,
  HeritagePassport,
  CheckinContext,
  CheckinResult,
  CheckinConfig,
} from '../types';

import { heritageImageUrl, HERITAGE_IMAGE_PLACEHOLDER } from '../utils/heritageImages';

const API_BASE = '/api';
let authGeneration = 0;

export class CheckinApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) { super(message); this.status = status; this.code = code; }
}

async function passportRequest(path: string, method = 'GET', data?: unknown, authenticated = true): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    method, headers: authenticated ? getAuthHeaders() : { Accept: 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof result?.code === 'string' ? result.code : 'error';
    const message = response.status === 401 ? 'Please sign in again to continue.' : response.status === 404 ? 'This QR is invalid, revoked, or the site is unavailable.'
      : response.status === 429 ? 'Too many attempts. Please wait a minute and try again.'
      : ['outside', 'weak_accuracy', 'disabled', 'unavailable'].includes(code) && typeof result?.message === 'string' ? result.message : 'Unable to complete this request. Please try again.';
    throw new CheckinApiError(message, response.status, code);
  }
  if (!result || typeof result !== 'object') throw new Error('The server returned an invalid response.');
  return result;
}

export async function apiResolveCheckin(token: string): Promise<CheckinContext> {
  const data = await passportRequest(`/check-in/${encodeURIComponent(token)}`, 'GET', undefined, false) as Omit<CheckinContext, 'site'> & { site: unknown };
  if (typeof data.enabled !== 'boolean' || typeof data.coordinates_configured !== 'boolean' || !data.site) throw new Error('Invalid check-in response.');
  return { ...data, site: mapBackendSite(data.site) };
}

export async function apiVerifyCheckin(token: string, location: { latitude: number; longitude: number; accuracy: number | null }): Promise<CheckinResult> {
  const data = await passportRequest(`/check-in/${encodeURIComponent(token)}/verify`, 'POST', location) as CheckinResult;
  if (!['verified', 'already_visited'].includes(data.status) || !data.visit || !Number.isFinite(data.points_earned)) throw new Error('Invalid verification response.');
  return data;
}

export async function apiFetchPassport(): Promise<HeritagePassport> {
  const data = await passportRequest('/passport') as HeritagePassport;
  if (![data.total_points, data.visited_count, data.eligible_site_count, data.visited_eligible_count].every(value => Number.isInteger(value) && value >= 0)
    || !Array.isArray(data.visits) || !Array.isArray(data.eligible_sites)) throw new Error('Invalid passport response.');
  return { ...data, visits: data.visits.map(visit => ({ ...visit, site: mapBackendSite(visit.site) })), eligible_sites: data.eligible_sites.map(mapBackendSite) };
}

export async function apiCheckinAvailability(id: string): Promise<boolean> {
  const data = await passportRequest(`/heritage-sites/${encodeURIComponent(id)}/check-in`, 'GET', undefined, false) as { enabled: boolean };
  return data.enabled === true;
}

export async function apiFetchCheckinConfigs(): Promise<CheckinConfig[]> {
  return await adminList('/admin/check-in-configs') as CheckinConfig[];
}

export async function apiSaveCheckinConfig(id: string, enabled: boolean, radius_meters: number): Promise<CheckinConfig> {
  return await adminRequest(`/admin/heritage-sites/${encodeURIComponent(id)}/check-in`, 'PUT', { enabled, radius_meters }) as CheckinConfig;
}

export async function apiRotateCheckinToken(id: string): Promise<CheckinConfig> {
  return await adminRequest(`/admin/heritage-sites/${encodeURIComponent(id)}/check-in/rotate`, 'POST') as CheckinConfig;
}

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

export async function apiGoogleLogin(credential: string): Promise<{ token: string; user: UserProfile }> {
  return authenticate('/auth/google', { credential });
}

export interface RegisteredTraveler {
  id: string;
  name: string;
  email: string;
  loginMethod: 'Google' | 'Email/Password';
  avatar: string | null;
  createdAt: string;
}

export async function apiFetchTravelers(): Promise<RegisteredTraveler[]> {
  const data = await adminList('/admin/travelers') as Array<Record<string, unknown>>;
  return data.map(raw => ({
    id: String(raw.id),
    name: String(raw.name || ''),
    email: String(raw.email || ''),
    loginMethod: raw.login_method === 'Google' ? 'Google' : 'Email/Password',
    avatar: typeof raw.avatar === 'string' && raw.avatar.trim() ? raw.avatar : null,
    createdAt: String(raw.created_at || ''),
  }));
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
  const images = (Array.isArray(raw.images) ? raw.images : []).map((image: any) => ({
    id: String(image.id),
    imageUrl: heritageImageUrl(typeof image.image_path === 'string' ? image.image_path : ''),
    caption: typeof image.caption === 'string' ? image.caption.trim() || null : null,
    isCover: image.is_cover === true || image.is_cover === 1 || image.is_cover === '1',
    sortOrder: Number.isInteger(Number(image.sort_order)) ? Number(image.sort_order) : 0,
  })).sort((a: any, b: any) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
  const heroImg = (images.find((image: any) => image.isCover) || images[0])?.imageUrl || HERITAGE_IMAGE_PLACEHOLDER;
  const lat = raw.latitude == null || String(raw.latitude).trim() === '' ? NaN : Number(raw.latitude);
  const lng = raw.longitude == null || String(raw.longitude).trim() === '' ? NaN : Number(raw.longitude);
  const validCoordinates = Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const visitorText = (value: unknown): string | null => typeof value === 'string' ? value.trim() || null : null;

  return {
    id: String(raw.id),
    ...(raw.status === 'active' || raw.status === 'archived' ? { status: raw.status } : {}),
    name: raw.name || 'Unnamed Site',
    category: raw.category || '',
    yearBuilt: raw.year_built || '',
    address: raw.address || '',
    coordinates: validCoordinates ? {
      lat,
      lng
    } : null,
    shortDescription: raw.description || '',
    fullDescription: raw.description || '',
    story: raw.history || '',
    heroImage: heroImg,
    images,
    archivalImage: '',
    modernImage: '',
    thenNowCaption: '',
    timeline: Array.isArray(raw.timelines) ? raw.timelines.map((t: any) => ({
      year: t.year,
      title: t.title,
      description: t.description
    })) : [], 
    didYouKnow: [],
    historicalCharacters: [],
    visitInfo: {
      address: raw.address || '',
      openingHours: visitorText(raw.opening_hours),
      entranceFee: visitorText(raw.entrance_fee),
      accessibilityNotes: visitorText(raw.accessibility_notes),
      visitNotes: visitorText(raw.visit_notes),
      contactInformation: visitorText(raw.contact_information)
    }
  };
}

// Heritage Sites API
export async function apiFetchSites(): Promise<HeritageSite[]> {
  try {
    const res = await fetch(`${API_BASE}/heritage-sites`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Invalid heritage catalogue response');
    return data.map(mapBackendSite);
  } catch {
    throw new Error('Unable to load heritage sites. Please try again.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetchRawSites(): Promise<any[]> {
  return adminList('/admin/heritage-sites');
}

export async function apiFetchSiteById(id: string): Promise<HeritageSite | null> {
  try {
    const res = await fetch(`${API_BASE}/heritage-sites/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch heritage site');
    const data = await res.json();
    if (!data || String(data.id) !== id || data.status !== 'active') throw new Error('Invalid heritage site response');
    return mapBackendSite(data);
  } catch {
    throw new Error('Unable to load this heritage site. Please try again.');
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
function buildSiteImagePayload(data: Record<string, unknown>): Record<string, unknown> | FormData {
  if (typeof File !== 'undefined' && data.imageFile instanceof File) {
    const form = new FormData();
    form.append('image', data.imageFile);
    for (const key of ['heritage_site_id', 'caption', 'is_cover', 'sort_order']) {
      const value = data[key];
      if (value !== undefined) form.append(key, value == null ? '' : typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
    return form;
  }
  const { imageFile: _imageFile, ...reference } = data;
  return reference;
}

function mapItinerary(value: unknown): Itinerary {
  const raw = value as Record<string, unknown>;
  if (!raw || !/^[1-9]\d*$/.test(String(raw.id)) || typeof raw.name !== 'string'
    || !['active', 'archived'].includes(String(raw.status)) || !Array.isArray(raw.stops)) throw new Error('Invalid itinerary response.');
  return {
    id: String(raw.id), name: raw.name, description: typeof raw.description === 'string' ? raw.description : null,
    status: raw.status as Itinerary['status'],
    // Preserve the relationship order returned by Laravel, including tied sort orders.
    stops: raw.stops.map((value: unknown) => {
      const stop = value as Record<string, unknown>;
      if (!stop || !/^[1-9]\d*$/.test(String(stop.id)) || !/^[1-9]\d*$/.test(String(stop.heritage_site_id)) || !Number.isInteger(stop.sort_order)) throw new Error('Invalid itinerary stop.');
      const site = stop.heritage_site as Record<string, unknown> | null;
      if (site && String(site.id) !== String(stop.heritage_site_id)) throw new Error('Incorrect itinerary site reference.');
      return { id: String(stop.id), siteId: String(stop.heritage_site_id), sortOrder: Number(stop.sort_order), site: site ? mapBackendSite(site) : null };
    }),
  };
}

export async function apiFetchItineraries(): Promise<Itinerary[]> {
  try {
    const response = await fetch(`${API_BASE}/itineraries`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error();
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error();
    return data.map(mapItinerary).filter(route => route.status === 'active').map(route => ({ ...route, stops: route.stops.filter(stop => stop.site?.status === 'active') }));
  } catch { throw new Error('Unable to load recommended itineraries. Please try again.'); }
}

export async function apiFetchItineraryById(id: string): Promise<Itinerary | null> {
  try {
    const response = await fetch(`${API_BASE}/itineraries/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error();
    const route = mapItinerary(await response.json());
    if (route.id !== id) throw new Error();
    return route.status === 'active' ? { ...route, stops: route.stops.filter(stop => stop.site?.status === 'active') } : null;
  } catch { throw new Error('Unable to load this itinerary. Please try again.'); }
}

export async function apiFetchAdminItineraries(): Promise<Itinerary[]> {
  return (await adminList('/admin/itineraries')).map(mapItinerary);
}

export async function apiSaveItinerary(data: ItineraryInput, id?: string): Promise<Itinerary> {
  return mapItinerary(await adminRequest(id ? `/itineraries/${encodeURIComponent(id)}` : '/itineraries', id ? 'PUT' : 'POST', data));
}

export async function apiArchiveItinerary(id: string): Promise<void> {
  await adminRequest(`/itineraries/${encodeURIComponent(id)}`, 'DELETE');
}

export async function apiRestoreItinerary(id: string): Promise<void> {
  await adminRequest(`/itineraries/${encodeURIComponent(id)}`, 'PATCH', { status: 'active' });
}

export async function apiFetchSiteImages(): Promise<unknown[]> {
  return adminList('/admin/site-images');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateSiteImage(data: any): Promise<unknown> {
  return adminRequest('/site-images', 'POST', buildSiteImagePayload(data));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateSiteImage(id: string, data: any): Promise<unknown> {
  return adminRequest(`/site-images/${id}`, 'PUT', buildSiteImagePayload(data));
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
