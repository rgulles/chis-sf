export type CategoryType = 
  | 'Historical Buildings' 
  | 'Churches' 
  | 'Museums' 
  | 'Monuments' 
  | 'Cultural Sites';

export interface TimelineEvent {
  id?: number | string;
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
}

export interface HeritageImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  isCover: boolean;
  sortOrder: number;
}

export interface VerificationAvailability {
  /** Missing means unresolved, never disabled. */
  enabled?: boolean;
  loading: boolean;
  error?: string;
}

export interface HeritageSite {
  /** Missing metadata is resolved through the compatibility availability endpoint. */
  visitVerificationEnabled?: boolean;
  isSummary?: boolean;
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
  timeline: TimelineEvent[];
  didYouKnow: string[];
  historicalCharacters: HistoricalCharacter[];
  visitInfo: VisitInfo;
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

export interface ItineraryStop {
  id: string;
  siteId: string;
  sortOrder: number;
  site: HeritageSite | null;
}

export interface Itinerary {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  stops: ItineraryStop[];
}

export interface ItineraryInput {
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  stops: { heritage_site_id: number; sort_order: number }[];
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
  | 'not-found'
  | 'passport'
  | 'home'
  | 'explore'
  | 'map'
  | 'site-detail'
  | 'interactive-history'
  | 'events'
  | 'event-detail'
  | 'plan'
  | 'saved'
  | 'about'
  | 'contact'
  | 'tourism-office'
  | 'admin';

export interface PassportVisit {
  id: number;
  heritage_site_id: number;
  verified_at: string;
  points_awarded: number;
  site: HeritageSite;
}

export interface HeritagePassport {
  total_points: number;
  visited_count: number;
  eligible_site_count: number;
  visited_eligible_count: number;
  visits: PassportVisit[];
  eligible_sites: HeritageSite[];
}

export interface CheckinResult {
  status: 'verified' | 'already_visited';
  points_earned: number;
  visit: { id: number; heritage_site_id: number; verified_at: string; points_awarded: number };
}

export interface CheckinConfig {
  id: number | null;
  heritage_site_id: number;
  name: string;
  status: string;
  category: string;
  address: string;
  has_coordinates: boolean;
  enabled: boolean;
  radius_meters: number;
  verified_visitors: number;
}

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
export type ContributionStatus = 'pending' | 'approved' | 'rejected';
export interface VisitorContribution {
  id: number;
  caption: string | null;
  created_at: string;
  visitor_name: string;
  images: string[];
}
export interface MyContribution {
  verified: boolean;
  active: boolean;
  can_submit: boolean;
  contribution: { id: number; status: ContributionStatus } | null;
}
export interface AdminContribution extends VisitorContribution {
  status: ContributionStatus;
  heritage_site: { id: number; name: string; status: string };
}
