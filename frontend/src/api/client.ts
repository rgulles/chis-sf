import type {
  HeritageSite,
  EventItem,
  CommunityPhoto,
  UserProfile,
  UserPlan
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
  } catch (err) {
    return { status: 'offline', error: err };
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
  } catch (err) {
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

// Heritage Sites API
export async function apiFetchSites(): Promise<HeritageSite[]> {
  try {
    const res = await fetch(`${API_BASE}/sites`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function apiFetchSiteById(id: string): Promise<HeritageSite | null> {
  try {
    const res = await fetch(`${API_BASE}/sites/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function apiRecordQrScan(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sites/${id}/scan`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return await res.json();
}

// Events API
export async function apiFetchEvents(): Promise<EventItem[]> {
  try {
    const res = await fetch(`${API_BASE}/events`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return await res.json();
  } catch (err) {
    return [];
  }
}

// Community Photo Wall API
export async function apiFetchPhotos(): Promise<CommunityPhoto[]> {
  try {
    const res = await fetch(`${API_BASE}/photos`);
    if (!res.ok) throw new Error('Failed to fetch photos');
    return await res.json();
  } catch (err) {
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
  } catch (err) {
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
