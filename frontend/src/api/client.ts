import type {
  HeritageSite,
  EventItem,
  CommunityPhoto,
  UserProfile,
  UserPlan,
} from '../types';

const API_BASE = '/api';

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
export async function apiLogin(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Invalid credentials');
  }
  setJwtToken(data.token);
  return data;
}

export async function apiRegister(name: string, email: string, password: string, hometown?: string): Promise<{ token: string; user: UserProfile }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, hometown })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed');
  }
  setJwtToken(data.token);
  return data;
}

export async function apiFetchCurrentUser(): Promise<UserProfile | null> {
  const token = getJwtToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      setJwtToken(null);
      return null;
    }
    const data = await res.json();
    return data.user;
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
  try {
    const res = await fetch(`${API_BASE}/heritage-sites`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    return await res.json();
  } catch {
    return [];
  }
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateSite(data: any): Promise<HeritageSite> {
  const res = await fetch(`${API_BASE}/heritage-sites`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create site');
  return await res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateSite(id: string, data: any): Promise<HeritageSite> {
  const res = await fetch(`${API_BASE}/heritage-sites/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update site');
  return await res.json();
}

export async function apiDeleteSite(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/heritage-sites/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete site');
}

// Admin: Site Images
export async function apiFetchSiteImages(): Promise<unknown[]> {
  try {
    const res = await fetch(`${API_BASE}/site-images`);
    if (!res.ok) throw new Error('Failed to fetch site images');
    return await res.json();
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateSiteImage(data: any): Promise<unknown> {
  const res = await fetch(`${API_BASE}/site-images`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create site image');
  return await res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateSiteImage(id: string, data: any): Promise<unknown> {
  const res = await fetch(`${API_BASE}/site-images/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update site image');
  return await res.json();
}

export async function apiDeleteSiteImage(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/site-images/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete site image');
}

// Admin: Heritage Timelines
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateTimeline(data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/heritage-timelines`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create timeline');
  return await res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateTimeline(id: string, data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/heritage-timelines/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update timeline');
  return await res.json();
}

export async function apiDeleteTimeline(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/heritage-timelines/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete timeline');
}

// Events API
export async function apiFetchEvents(): Promise<EventItem[]> {
  try {
    const res = await fetch(`${API_BASE}/events`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return await res.json();
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiCreateEvent(data: any): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create event');
  return await res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpdateEvent(id: string, data: any): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/events/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update event');
  return await res.json();
}

export async function apiDeleteEvent(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/events/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete event');
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
