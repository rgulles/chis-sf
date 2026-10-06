// Prototype/reference photo data only; detached from the live public heritage experience.
import type { CommunityPhoto } from '../types';

export const INITIAL_COMMUNITY_PHOTOS: CommunityPhoto[] = [
  // Metropolitan Cathedral
  {
    id: 'cp-cathedral-1',
    siteId: 'metropolitan-cathedral',
    imageUrl: '/images/sites/cathedral-hero.jpg',
    caption: 'Sunset prayer under the historic octagonal cupola. The golden light hits the brickwork so serenely.',
    contributorName: 'Maria Santos',
    date: 'February 12, 2026',
    likes: 24,
    tags: ['Golden Hour', 'Architecture'],
    isUserUploaded: false
  },
  {
    id: 'cp-cathedral-2',
    siteId: 'metropolitan-cathedral',
    imageUrl: '/images/sites/cathedral-modern.jpg',
    caption: 'Walking in the footsteps of General Aguinaldo during our Sunday walking tour around Poblacion.',
    contributorName: 'Carlito Dayrit',
    date: 'January 28, 2026',
    likes: 19,
    tags: ['Heritage Tour', 'Family Visit'],
    isUserUploaded: false
  },

  // Old Train Station
  {
    id: 'cp-train-1',
    siteId: 'san-fernando-train-station',
    imageUrl: '/images/sites/train-station-hero.jpg',
    caption: 'Paying respects at Kilometer 102. The preserved tracks and Baldwin engine tell a solemn, unforgettable story.',
    contributorName: 'Rizalina David',
    date: 'February 18, 2026',
    likes: 38,
    tags: ['Death March Memorial', 'History'],
    isUserUploaded: false
  },
  {
    id: 'cp-train-2',
    siteId: 'san-fernando-train-station',
    imageUrl: '/images/sites/train-station-modern.jpg',
    caption: 'Inspecting the original 1892 brick station platform where Dr. Jose Rizal arrived to inspect La Liga Filipina branches.',
    contributorName: 'Enrique Henson',
    date: 'January 15, 2026',
    likes: 17,
    tags: ['Rizal Trail', 'Railways'],
    isUserUploaded: false
  },

  // Lazatin House
  {
    id: 'cp-lazatin-1',
    siteId: 'lazatin-heritage-house',
    imageUrl: '/images/sites/lazatin-house-hero.jpg',
    caption: 'The sweeping capiz ventanillas on Consunji Street. You can feel the breeze cooling the high-ceilinged ballroom.',
    contributorName: 'Theresa Ocampo',
    date: 'February 04, 2026',
    likes: 31,
    tags: ['Bahay na Bato', 'Details'],
    isUserUploaded: false
  },
  {
    id: 'cp-lazatin-2',
    siteId: 'lazatin-heritage-house',
    imageUrl: '/images/sites/lazatin-house-modern.jpg',
    caption: 'Learned about Don Serafin Lazatin and the wartime sugar ledgers on the guided tour.',
    contributorName: 'Mark Villanueva',
    date: 'January 30, 2026',
    likes: 14,
    tags: ['Sugar Legacy', 'Preservation'],
    isUserUploaded: false
  },

  // Hizon-Singian House
  {
    id: 'cp-hizon-1',
    siteId: 'hizon-singian-house',
    imageUrl: '/images/sites/henson-hizon-hero.jpg',
    caption: 'Stood right where General Antonio Luna set up his 1899 headquarters. The narra floorboards are 150+ years old!',
    contributorName: 'Beatrice Singian',
    date: 'February 22, 2026',
    likes: 42,
    tags: ['Revolutionary Era', 'Ancestral Heirlooms'],
    isUserUploaded: false
  },

  // Giant Lantern Center
  {
    id: 'cp-lantern-1',
    siteId: 'giant-lantern-center',
    imageUrl: '/images/sites/giant-lantern-hero.jpg',
    caption: 'Marveling at the intricate rotor mechanisms behind the giant kaleidoscope paruls. True Kapampangan craftsmanship!',
    contributorName: 'Arnel Quiambao',
    date: 'February 10, 2026',
    likes: 56,
    tags: ['Ligligan Parul', 'Cultural Pride'],
    isUserUploaded: false
  }
];

export function getStoredCommunityPhotos(): CommunityPhoto[] {
  try {
    const raw = localStorage.getItem('sf_community_photos');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading community photos from localStorage', err);
  }
  return INITIAL_COMMUNITY_PHOTOS;
}

export function saveStoredCommunityPhotos(photos: CommunityPhoto[]): void {
  try {
    localStorage.setItem('sf_community_photos', JSON.stringify(photos));
  } catch (err) {
    console.warn('Error saving community photos to localStorage', err);
  }
}
