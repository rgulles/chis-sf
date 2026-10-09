import type {
  HeritageSite,
  EventItem,
  CommunityPhoto,
  UserProfile,
  UserPlan,
  Itinerary,
  ItineraryInput,
  HeritagePassport,
  CheckinResult,
  CheckinConfig,
} from '../types';

import { heritageImageUrl, HERITAGE_IMAGE_PLACEHOLDER } from '../utils/heritageImages';
import type { VisitorContribution, MyContribution, AdminContribution, ContributionStatus } from '../types';

const API_BASE = '/api';

export async function apiFetchContributions(id: string): Promise<VisitorContribution[]> {
  const response = await apiFetch(`${API_BASE}/heritage-sites/${encodeURIComponent(id)}/contributions`);
  const data = await response.json();
  if (!Array.isArray(data) || !data.every(item => item && typeof item.id === 'number' && typeof item.visitor_name === 'string'
    && (item.caption === null || typeof item.caption === 'string') && typeof item.created_at === 'string'
    && Array.isArray(item.images) && item.images.every((url: unknown) => typeof url === 'string'))) {
    throw new ApiError('Unable to load visitor experiences. Please try again.');
  }
  return data;
}

export async function apiFetchMyContribution(id: string): Promise<MyContribution> {
  const data = await adminRequest(`/heritage-sites/${encodeURIComponent(id)}/contributions/mine`) as MyContribution;
  if (!data || typeof data.verified !== 'boolean' || typeof data.active !== 'boolean' || typeof data.can_submit !== 'boolean'
    || (data.contribution !== null && (!data.contribution || typeof data.contribution.id !== 'number' || !['pending', 'approved', 'rejected'].includes(data.contribution.status)))) {
    throw new ApiError('Unable to load your contribution status. Please try again.');
  }
  return data;
}

export async function apiSubmitContribution(id: string, images: File[], caption: string): Promise<{ id: number; status: ContributionStatus }> {
  const form = new FormData();
  images.forEach(image => form.append('images[]', image));
  form.append('caption', caption);
  try {
    const data = await adminRequest(`/heritage-sites/${encodeURIComponent(id)}/contributions`, 'POST', form) as { id: number; status: ContributionStatus };
    if (!data || typeof data.id !== 'number' || data.status !== 'pending') throw new ApiError('Unable to confirm your submission. Reload your contribution status before trying again.');
    return data;
  } catch (error) {
    if (error instanceof AdminApiError) {
      if (error.status === 403) error.message = 'Verify your visit before sharing an experience.';
      if (error.status === 409) error.message = 'A contribution already exists or this site is archived. Reload your contribution status.';
      if (error.status === 413) error.message = 'The upload is too large. Choose up to 3 images, no larger than 5 MB each.';
    }
    throw error;
  }
}

export async function apiFetchAdminContributions(status: ContributionStatus): Promise<AdminContribution[]> {
  const data = await adminList(`/admin/contributions?status=${status}`) as AdminContribution[];
  if (!data.every(item => item && typeof item.id === 'number' && ['pending', 'approved', 'rejected'].includes(item.status)
    && typeof item.visitor_name === 'string' && (item.caption === null || typeof item.caption === 'string') && typeof item.created_at === 'string'
    && item.heritage_site && typeof item.heritage_site.name === 'string' && typeof item.heritage_site.status === 'string'
    && Array.isArray(item.images) && item.images.every(url => typeof url === 'string'))) {
    throw new AdminApiError('Unable to load contributions. Please retry.');
  }
  return data;
}
export async function apiModerateContribution(id: number, status: 'approved' | 'rejected'): Promise<void> {
  await adminRequest(`/admin/contributions/${id}`, 'PATCH', { status });
}
export async function apiRemoveContribution(id: number): Promise<void> {
  await adminRequest(`/admin/contributions/${id}`, 'DELETE');
}
let authGeneration = 0;

export class ApiError extends Error {
  status: number | null;
  code: string;
  constructor(message: string, status: number | null = null, code = 'error') { super(message); this.status = status; this.code = code; }
}

const errorMessages: Record<number, string> = {
  401: 'Your session has expired. Please sign in again to continue.',
  403: 'You do not have permission to perform this action.',
  404: 'This record was not found. Return to Explore or try again.',
  409: 'This action is currently unavailable. Please try again.',
  422: 'Please check the information you entered and try again.',
  429: 'Too many attempts. Please wait a minute and try again.',
};
const verificationMessages: Record<string, string> = {
  outside: "You're outside the verification area for this heritage site.",
  weak_accuracy: 'GPS accuracy is weak or unavailable. Move into an open area and try again.',
  disabled: 'Visit verification is currently disabled for this site.',
  unavailable: 'This site is not ready for location verification.',
};

// All API transport errors are safe to display; never forward backend exception text.
function clearCachedProfile(): void {
  try { localStorage.removeItem('sf_user_profile'); } catch { /* Storage may be unavailable. */ }
}

function expireSession(requestToken: string | null): void {
  if (!requestToken || requestToken !== getJwtToken()) return;
  authGeneration++;
  setJwtToken(null);
  clearCachedProfile();
  if (typeof window !== 'undefined') window.dispatchEvent?.(new Event('chis:session-expired'));
}

// Share only concurrent reads, including React's development effect replay. No response cache or auth data persists.
const pendingReads = new Map<string, Promise<Response>>();
async function fetchTransport(input: string, options?: RequestInit): Promise<Response> {
  const execute = () => fetch(input, { ...options, signal: options?.signal ?? AbortSignal.timeout(options?.body instanceof FormData ? 120000 : 30000) });
  if ((options?.method ?? 'GET') !== 'GET' || options?.signal) return execute();
  const key = JSON.stringify([input, options?.headers ?? {}]);
  let pending = pendingReads.get(key);
  if (!pending) {
    const request = execute().finally(() => { if (pendingReads.get(key) === request) pendingReads.delete(key); });
    pending = request;
    pendingReads.set(key, request);
  }
  return (await pending).clone();
}

async function apiFetch(input: string, options?: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetchTransport(input, { ...options, headers: { Accept: 'application/json', ...options?.headers } }); }
  catch { throw new ApiError('Unable to connect to CHIS. Check your internet connection and try again.', null, 'network'); }
  if (response.status === 401 && options?.headers && 'Authorization' in options.headers && !input.includes('/auth/logout')) {
    const requestToken = (options.headers as Record<string, string>).Authorization;
    expireSession(requestToken?.replace(/^Bearer /, '') || null);
  }
  if (!response.ok) {
    const body = await response.clone().json().catch(() => null);
    const code = typeof body?.code === 'string' && verificationMessages[body.code] ? body.code : 'error';
    const message = response.status >= 500 ? 'CHIS is temporarily unavailable. Please try again later.'
      : errorMessages[response.status] || 'Unable to complete this request. Please try again.';
    throw new ApiError((response.status === 409 || response.status === 422) && code !== 'error' ? verificationMessages[code] : message, response.status, code);
  }
  if (response.status === 204) return response;
  try { await response.clone().json(); }
  catch { throw new ApiError('CHIS returned an unexpected response. Please try again.', response.status, 'malformed'); }
  return response;
}

async function passportRequest(path: string, method = 'GET', data?: unknown, authenticated = true): Promise<unknown> {
  const response = await apiFetch(API_BASE + path, {
    method, headers: authenticated ? getAuthHeaders() : { Accept: 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return response.json();
}

export async function apiVerifyVisit(id: string, location: { latitude: number; longitude: number; accuracy: number | null }): Promise<CheckinResult> {
  const data = await passportRequest('/heritage-sites/' + encodeURIComponent(id) + '/verify-visit', 'POST', location) as CheckinResult;
  if (!data || !['verified', 'already_visited'].includes(data.status) || !data.visit || !Number.isFinite(data.points_earned)) throw new ApiError('CHIS returned an unexpected verification response. Please try again.');
  return data;
}

export async function apiFetchPassport(): Promise<HeritagePassport> {
  const data = await passportRequest('/passport') as HeritagePassport;
  if (!data || ![data.total_points, data.visited_count, data.eligible_site_count, data.visited_eligible_count].every(value => Number.isInteger(value) && value >= 0)
    || !Array.isArray(data.visits) || !Array.isArray(data.eligible_sites)) throw new Error('Invalid passport response.');
  try {
    return { ...data, visits: data.visits.map(visit => ({ ...visit, site: mapBackendSite(visit.site) })), eligible_sites: data.eligible_sites.map(mapBackendSite) };
  } catch { throw new ApiError('Unable to load your passport. Please try again.'); }
}

export async function apiCheckinAvailability(id: string): Promise<boolean> {
  const data = await passportRequest(`/heritage-sites/${encodeURIComponent(id)}/check-in`, 'GET', undefined, false) as { enabled: boolean };
  if (!data || typeof data.enabled !== 'boolean') throw new ApiError('Unable to load visit verification. Please try again.');
  return data.enabled;
}

export async function apiFetchCheckinConfigs(): Promise<CheckinConfig[]> {
  return await adminList('/admin/check-in-configs') as CheckinConfig[];
}

export async function apiSaveCheckinConfig(id: string, enabled: boolean, radius_meters: number): Promise<CheckinConfig> {
  return await adminRequest(`/admin/heritage-sites/${encodeURIComponent(id)}/check-in`, 'PUT', { enabled, radius_meters }) as CheckinConfig;
}


export function getJwtToken(): string | null {
  try { return localStorage.getItem('chis_jwt_token'); } catch { return null; }
}

export function setJwtToken(token: string | null): void {
  try {
    if (token) localStorage.setItem('chis_jwt_token', token);
    else localStorage.removeItem('chis_jwt_token');
  } catch { /* Browsers may disable persistent storage. */ }
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
    const res = await apiFetch(`${API_BASE}/health`);
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
    res = await apiFetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(credentials),
    });
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 401) throw new ApiError('Incorrect email or password.', 401);
    if (failure instanceof ApiError) throw failure;
    throw new ApiError('Unable to connect to CHIS. Check your internet connection and try again.');
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
  clearCachedProfile();
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
    const res = await apiFetch(`${API_BASE}/auth/me`, {
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
  const res = await apiFetch(`${API_BASE}/auth/profile`, {
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
  const isSummary = Object.prototype.hasOwnProperty.call(raw, 'short_description');
  const images = (Array.isArray(raw.images) ? raw.images : raw.cover_image ? [raw.cover_image] : []).map((image: any) => ({
    id: String(image.id),
    imageUrl: heritageImageUrl(typeof (image as any).image_url === 'string' ? (image as any).image_url : (typeof image.image_path === 'string' ? image.image_path : '')),
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
    isSummary,
    visitVerificationEnabled: typeof raw.visit_verification_enabled === 'boolean' ? raw.visit_verification_enabled : undefined,
    ...(raw.status === 'active' || raw.status === 'archived' ? { status: raw.status } : {}),
    name: raw.name || 'Unnamed Site',
    category: raw.category || '',
    yearBuilt: raw.year_built || '',
    address: raw.address || '',
    coordinates: validCoordinates ? {
      lat,
      lng
    } : null,
    shortDescription: raw.short_description ?? raw.description ?? '',
    fullDescription: raw.description || '',
    story: raw.history || '',
    heroImage: heroImg,
    images,
    archivalImage: '',
    modernImage: '',
    thenNowCaption: '',
    timeline: Array.isArray(raw.timelines) ? raw.timelines.map((t: any) => ({
      id: t.id,
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
export async function apiFetchSites(search?: string): Promise<HeritageSite[]> {
  try {
    const res = await apiFetch(`${API_BASE}/heritage-sites${search ? '?search=' + encodeURIComponent(search) : ''}`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Invalid heritage catalogue response');
    return data.map(mapBackendSite);
  } catch (failure) {
    if (failure instanceof ApiError) throw failure;
    throw new ApiError('Unable to load heritage sites. Please try again.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetchRawSites(): Promise<any[]> {
  return adminList('/admin/heritage-sites');
}

export async function apiFetchSiteById(id: string): Promise<HeritageSite | null> {
  try {
    const res = await apiFetch(`${API_BASE}/heritage-sites/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch heritage site');
    const data = await res.json();
    if (!data || String(data.id) !== id || data.status !== 'active') throw new Error('Invalid heritage site response');
    return mapBackendSite(data);
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 404) return null;
    if (failure instanceof ApiError) throw failure;
    throw new ApiError('Unable to load this heritage site. Please try again.');
  }
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
    res = await fetchTransport(`${API_BASE}${path}`, {
      method: actualMethod,
      headers,
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    throw new AdminApiError('Unable to connect to CHIS. Check your internet connection and try again.');
  }
  if (!res.ok) {
    if (res.status === 401) expireSession(token);
    const errors: Record<string, string[]> = {};
    if (res.status === 422) {
      const body = await res.json().catch(() => null);
      if (body?.errors && typeof body.errors === 'object') {
        for (const [field, messages] of Object.entries(body.errors)) {
          if (Array.isArray(messages)) {
            errors[field] = messages.filter((message): message is string =>
              typeof message === 'string' && message.length <= 300 && !/[<>]|SQLSTATE|Exception|Stack trace|[A-Z]:\\|\/var\//i.test(message));
          }
        }
      }
    }
    const message = res.status === 422 ? 'Please correct the form information and try again.'
      : res.status === 401 ? 'Your session is no longer valid. Please sign in again.'
      : res.status === 403 ? 'You do not have permission to perform this action.'
      : res.status === 404 ? 'This record was not found. Reload the data and try again.'
      : res.status >= 500 ? 'CHIS is temporarily unavailable. Please try again later.'
      : errorMessages[res.status] || 'The request failed. Please try again later.';
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

let itineraryListRequest: Promise<Itinerary[]> | undefined;
const itineraryDetailRequests = new Map<string, Promise<Itinerary | null>>();

export function clearItineraryCache(): void {
  itineraryListRequest = undefined;
  itineraryDetailRequests.clear();
}

export function apiFetchItineraries(refresh = false): Promise<Itinerary[]> {
  if (refresh) clearItineraryCache();
  if (!itineraryListRequest) {
    const request = fetchItineraries().then(routes => {
      // Public list/detail share the same ordered summaries; opening a card needs no second download.
      if (itineraryListRequest === request) for (const route of routes) {
        if (!itineraryDetailRequests.has(route.id)) itineraryDetailRequests.set(route.id, Promise.resolve(route));
      }
      return routes;
    }).catch(error => {
      if (itineraryListRequest === request) itineraryListRequest = undefined;
      throw error;
    });
    itineraryListRequest = request;
  }
  return itineraryListRequest;
}

async function fetchItineraries(): Promise<Itinerary[]> {
  try {
    const response = await apiFetch(`${API_BASE}/itineraries`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error();
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error();
    return data.map(mapItinerary).filter(route => route.status === 'active').map(route => ({ ...route, stops: route.stops.filter(stop => stop.site?.status === 'active') }));
  } catch (failure) { if (failure instanceof ApiError) throw failure; throw new ApiError('Unable to load recommended itineraries. Please try again.'); }
}

export function apiFetchItineraryById(id: string, refresh = false): Promise<Itinerary | null> {
  if (refresh) itineraryDetailRequests.delete(id);
  let request = itineraryDetailRequests.get(id);
  if (!request) {
    const pending = fetchItineraryById(id).catch(error => {
      if (itineraryDetailRequests.get(id) === pending) itineraryDetailRequests.delete(id);
      throw error;
    });
    request = pending;
    itineraryDetailRequests.set(id, request);
  }
  return request;
}

async function fetchItineraryById(id: string): Promise<Itinerary | null> {
  try {
    const response = await apiFetch(`${API_BASE}/itineraries/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error();
    const route = mapItinerary(await response.json());
    if (route.id !== id) throw new Error();
    return route.status === 'active' ? { ...route, stops: route.stops.filter(stop => stop.site?.status === 'active') } : null;
  } catch (failure) { if (failure instanceof ApiError && failure.status === 404) return null; if (failure instanceof ApiError) throw failure; throw new ApiError('Unable to load this itinerary. Please try again.'); }
}

export async function apiFetchAdminItineraries(): Promise<Itinerary[]> {
  return (await adminList('/admin/itineraries')).map(mapItinerary);
}

export async function apiSaveItinerary(data: ItineraryInput, id?: string): Promise<Itinerary> {
  const result = await adminRequest(id ? `/itineraries/${encodeURIComponent(id)}` : '/itineraries', id ? 'PUT' : 'POST', data);
  clearItineraryCache();
  return mapItinerary(result);
}

export async function apiArchiveItinerary(id: string): Promise<void> {
  await adminRequest(`/itineraries/${encodeURIComponent(id)}`, 'DELETE');
  clearItineraryCache();
}

export async function apiRestoreItinerary(id: string): Promise<void> {
  await adminRequest(`/itineraries/${encodeURIComponent(id)}`, 'PATCH', { status: 'active' });
  clearItineraryCache();
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

  // Explicit null means the server could not resolve the image. Only old APIs
  // that omit image_url should fall back to the legacy stored path.
  const bannerImage = heritageImageUrl(Object.prototype.hasOwnProperty.call(raw, 'image_url')
    ? (typeof raw.image_url === 'string' ? raw.image_url : '')
    : (typeof raw.image_path === 'string' ? raw.image_path : ''));

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
    const res = await apiFetch(`${API_BASE}/events`);
    if (!res.ok) throw new Error('Failed to fetch events');
    const data = await res.json();
    if (!Array.isArray(data)) throw new ApiError('Unable to load events. Please try again.');
    return data.map(mapBackendEvent);
  } catch (failure) {
    if (failure instanceof ApiError) throw failure;
    throw new ApiError('Unable to load events. Please try again.');
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
    const res = await apiFetch(`${API_BASE}/photos`);
    if (!res.ok) throw new Error('Failed to fetch photos');
    return await res.json();
  } catch {
    return [];
  }
}

export async function apiLikePhoto(photoId: string): Promise<number> {
  const res = await apiFetch(`${API_BASE}/photos/${photoId}/like`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  return data.likes;
}

export async function apiUploadPhoto(photo: Omit<CommunityPhoto, 'id' | 'likes'>): Promise<CommunityPhoto> {
  const res = await apiFetch(`${API_BASE}/photos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(photo)
  });
  return await res.json();
}

// User Plans API
export async function apiFetchUserPlans(): Promise<UserPlan[]> {
  try {
    const res = await apiFetch(`${API_BASE}/user/plans`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function apiSaveUserPlan(title: string, siteIds: string[]): Promise<UserPlan> {
  const res = await apiFetch(`${API_BASE}/user/plans`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, site_ids: siteIds })
  });
  return await res.json();
}

// Gemini AI Katulung Chatbot via Laravel Endpoint
export async function apiSendChatMessage(messages: Array<{ role: string; content: string }>): Promise<{ reply: string; source?: string; useFallback?: boolean }> {
  const res = await apiFetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return await res.json();
}

export async function apiFetchDashboard(): Promise<any> { return adminRequest("/admin/dashboard", "GET"); }
