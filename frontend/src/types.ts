export type CategoryType = 
  | 'Historical Buildings' 
  | 'Churches' 
  | 'Museums' 
  | 'Monuments' 
  | 'Cultural Sites';

export interface TimelineEvent {
  year: string;
  title: string;
  description: string;
}

export interface HistoricalCharacter {
  name: string;
  role: string;
  bio: string;
  avatar: string;
}

export interface Hotspot {
  title: string;
  description: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
}

export interface VisitInfo {
  address: string;
  openingHours?: string | null;
  entranceFee?: string | null;
  accessibilityNotes?: string | null;
  visitNotes?: string | null;
  contactInformation?: string | null;
  // Legacy local dataset fields; the live API does not supply these.
  accessibility?: string;
  duration?: string;
  guideAvailable?: boolean;
  bestTime?: string;
}

export interface HouseholdVault {
  id: string;
  title: string;
  category: 'Subterranean Secret' | 'Sugar Ledger & Treasury' | 'War Relic' | 'Ancestral Heirloom';
  description: string;
  historicalSignificance: string;
}

export interface SiteEtiquette {
  shoeCoversRequired: boolean;
  silenceProtocol: boolean;
  flashPhotographyAllowed: boolean;
  preservationNotes: string[];
}

export interface AudioStoryData {
  title: string;
  duration: string;
  durationSeconds: number;
  narrator: string;
  transcript: string;
  kapampanganTranscript?: string;
  chapters?: Array<{ title: string; timeSeconds: number }>;
}

export interface HeritageImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  isCover: boolean;
  sortOrder: number;
}

export interface HeritageSite {
  id: string;
  status?: 'active' | 'archived';
  name: string;
  nativeName?: string;
  category: CategoryType | '';
  yearBuilt: string;
  era?: string;
  address: string;
  barangay?: string;
  distanceKm?: number;
  coordinates: {
    lat: number;
    lng: number;
    mapX?: number; // 0 to 100% on schematic map
    mapY?: number; // 0 to 100% on schematic map
  } | null;
  shortDescription: string;
  fullDescription: string;
  story: string;
  heroImage: string;
  images?: HeritageImage[];
  archivalImage: string;
  modernImage: string;
  thenNowCaption: string;
  audioStory?: AudioStoryData;
  timeline: TimelineEvent[];
  didYouKnow: string[];
  historicalCharacters: HistoricalCharacter[];
  visitInfo: VisitInfo;
  householdVaults?: HouseholdVault[];
  etiquetteRules?: SiteEtiquette;
  nhcpPlaqueCode?: string; // 4-digit code e.g. "1870"
  panoramaHotspots?: Hotspot[];
  qrCodeId?: string;
  scanCount?: number;
  badgeName?: string;
  isFeatured?: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  category: 'Festival' | 'Heritage Tour' | 'Exhibition' | 'Community' | string;
  date: string;
  dateBadge: string;
  time: string;
  location: string;
  shortDescription: string;
  fullDescription: string;
  bannerImage: string;
  schedule: Array<{ id?: number | string; time: string; activity: string; description?: string }>;
  relatedSiteIds: string[];
  tags: string[];
  status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | string;
  start_time?: string;
  end_time?: string;
  event_date?: string;
  end_date?: string;
}

export interface UserPlan {
  id: string;
  title: string;
  createdAt: string;
  siteIds: string[];
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlocked: boolean;
  unlockedAt?: string;
  requirement: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatar: string;
  hometown?: string;
  memberSince?: string;
  savedSites: string[];
  scannedSites: string[];
  badges: string[];
  stamps: Array<{
    siteId: string;
    siteName: string;
    collectedAt: string;
  }>;
}

export type ViewType = 
  | 'home'
  | 'explore'
  | 'map'
  | 'site-detail'
  | 'interactive-history'
  | 'qr-experience'
  | 'events'
  | 'event-detail'
  | 'plan'
  | 'saved'
  | 'about'
  | 'contact'
  | 'tourism-office'
  | 'admin';

export interface CommunityPhoto {
  id: string;
  siteId: string;
  imageUrl: string;
  caption: string;
  contributorName: string;
  date: string;
  likes: number;
  tags?: string[];
  isUserUploaded?: boolean;
}
