import type { EventItem, AchievementBadge } from '../types';

export const CULTURAL_EVENTS: EventItem[] = [
  {
    id: 'ligligan-parul-2026',
    title: 'Ligligan Parul: Giant Lantern Festival 2026',
    category: 'Festival',
    date: 'December 19, 2026',
    dateBadge: 'DEC 19',
    time: '6:00 PM – 11:30 PM',
    location: 'Robinsons Starmills & Giant Lantern Center, San Fernando',
    shortDescription: 'The world’s most spectacular festival of lights! Watch 20-foot giant kaleidoscopic lanterns with 10,000 bulbs compete in a synchronized light show.',
    fullDescription: 'The Giant Lantern Festival (Ligligan Parul) is the crowning glory of San Fernando, earning the city its title as the Christmas Capital of the Philippines. Witness competing barangays showcase their mammoth 20-foot lanterns, each an engineering marvel operated by manual rotor drums and thousands of incandescent light bulbs synchronized to live brass band music.',
    bannerImage: '/images/events/giant-lantern-fest.jpg',
    schedule: [
      { time: '5:00 PM', activity: 'Gates Open & Street Performances by City Brass Bands' },
      { time: '6:30 PM', activity: 'Opening Ceremony and Blessing of Lantern Makers' },
      { time: '7:15 PM', activity: 'Round 1: Individual Barangay Synchronized Exhibition' },
      { time: '9:00 PM', activity: 'Round 2: Simultaneous Light Battle & Orchestra Playoff' },
      { time: '10:30 PM', activity: 'Awarding of the Grand Champion & Fireworks Display' }
    ],
    relatedSiteIds: ['giant-lantern-center', 'metropolitan-cathedral'],
    tags: ['Family Friendly', 'Photography', 'Night Event', 'Free Admission']
  },
  {
    id: 'sinukwan-festival-2026',
    title: 'Sinukwan Festival: Spirit of Aring Sinukwan',
    category: 'Festival',
    date: 'December 4 – 6, 2026',
    dateBadge: 'DEC 4-6',
    time: '8:00 AM – 8:00 PM',
    location: 'Pampanga Provincial Capitol Grounds to Poblacion',
    shortDescription: 'Pampanga’s premier cultural street dance festival honoring the legendary Kapampangan deity Aring Sinukwan with vibrant costumes and native rhythms.',
    fullDescription: 'Celebrated every first week of December, the Sinukwan Festival reawakens the cultural soul of Kapampangans. Dancers adorned in colorful headdresses portraying indigenous folklore, agriculture, and mountain spirits parade along Capitol Boulevard dancing to the iconic rhythm of "Atin Cu Pung Singsing".',
    bannerImage: '/images/events/sinukwan-fest.jpg',
    schedule: [
      { time: '8:00 AM', activity: 'Sinukwan Cultural Grand Street Dance Parade' },
      { time: '1:00 PM', activity: 'Traditional Kapampangan Culinary Fair at Capitol Park' },
      { time: '4:00 PM', activity: 'Free-Interpretation Dance Showdown' },
      { time: '7:00 PM', activity: 'Sinukwan Music Jam featuring Kapampangan Indie Artists' }
    ],
    relatedSiteIds: ['pampanga-provincial-capitol', 'metropolitan-cathedral'],
    tags: ['Street Dance', 'Cultural', 'Gastronomy', 'Live Music']
  },
  {
    id: 'poblacion-heritage-walk',
    title: 'Poblacion Twilight Ancestral Mansions Walk',
    category: 'Heritage Tour',
    date: 'Every Saturday & Sunday',
    dateBadge: 'WEEKENDS',
    time: '4:00 PM – 7:00 PM',
    location: 'Starting point: Metropolitan Cathedral Plaza',
    shortDescription: 'Guided walking exploration through San Fernando’s historic core visiting centuries-old bahay-na-bato mansions with Kapampangan heirloom merienda.',
    fullDescription: 'Immerse yourself in 19th-century San Fernando. Guided by licensed local heritage historians, stroll down Consunji and Tiomico streets, entering private ancestral homes including the Henson-Hizon, Lazatin, and Dayrit-Cuyugan mansions with exclusive access to archival artifacts, capped with authentic Tsokolate Batirol and Tamales.',
    bannerImage: '/images/events/heritage-walk.jpg',
    schedule: [
      { time: '4:00 PM', activity: 'Assembly & Historical Briefing at Cathedral Atrium' },
      { time: '4:30 PM', activity: 'Henson-Hizon House: Revolution & Heroine Nicolasa Dayrit' },
      { time: '5:30 PM', activity: 'Lazatin Ancestral Mansion: The Sugar Baron Golden Era' },
      { time: '6:30 PM', activity: 'Sunset Heirloom Merienda (Tsokolate & San Nicolas Cookies)' }
    ],
    relatedSiteIds: ['metropolitan-cathedral', 'lazatin-heritage-house', 'henson-hizon-house'],
    tags: ['Walking Tour', 'Food Included', 'Architecture', 'Curated']
  },
  {
    id: 'bataan-freedom-trail',
    title: 'Valor & Freedom: Km 102 Death March Memorial Ride & Vigil',
    category: 'Exhibition',
    date: 'April 9, 2026 (Araw ng Kagitingan)',
    dateBadge: 'APR 9',
    time: '6:00 AM – 12:00 PM',
    location: 'San Fernando Train Station Historical Shrine',
    shortDescription: 'A solemn commemoration tracing the final leg of the 1942 Death March with historical reenactments, archival photography, and veterans’ salute.',
    fullDescription: 'Marking the National Day of Valor (Araw ng Kagitingan), join civic leaders, youth volunteers, and veterans’ families at the Old PNR Station. The event features a cycling pilgrimage following the historic rail line, wreath laying, and an archival photo gallery of the brave Fernandinos who risked their lives to feed marching soldiers.',
    bannerImage: '/images/events/bataan-trail.jpg',
    schedule: [
      { time: '6:00 AM', activity: 'Bataan-to-San Fernando Commemorative Bike Arrival' },
      { time: '7:30 AM', activity: 'Solemn 21-Gun Veterans Salute at Km 102 Marker' },
      { time: '8:30 AM', activity: 'Unveiling of Restored 1942 Boxcar Rail Car Exhibit' },
      { time: '10:00 AM', activity: 'Living History Roundtable with Descendants of Survivors' }
    ],
    relatedSiteIds: ['san-fernando-train-station', 'death-march-marker-102'],
    tags: ['History', 'Memorial', 'Youth & Veterans', 'Educational']
  },
  {
    id: 'kapampangan-culinary-heritage-expo',
    title: 'Manyaman! San Fernando Heritage Flavors Expo',
    category: 'Community',
    date: 'October 24 – 26, 2026',
    dateBadge: 'OCT 24-26',
    time: '10:00 AM – 9:00 PM',
    location: 'Heroes Hall Grounds, San Fernando, Pampanga',
    shortDescription: 'Taste century-old recipes from Pampanga—the Culinary Capital of the Philippines! Live cooking demos of Bringhe, Sisig, Morcon, and Tibuk-Tibuk.',
    fullDescription: 'Pampanga is celebrated as the undisputed Culinary Capital of the Philippines. The Manyaman Festival showcases San Fernando’s heritage kitchens, tracing how Spanish, Chinese, and native farming cultures converged to create world-famous recipes passed down through five generations.',
    bannerImage: '/images/events/culinary-expo.jpg',
    schedule: [
      { time: '10:00 AM', activity: 'Heritage Master Chef Showcases by Fernandino Culinary Guild' },
      { time: '1:00 PM', activity: 'Artisan San Nicolas Cookie Stamping Workshop' },
      { time: '4:00 PM', activity: 'Sisig Matua (Original Sisig of San Fernando) Cook-Off' },
      { time: '7:00 PM', activity: 'Kapampangan Folk Song Harana and Dinner' }
    ],
    relatedSiteIds: ['pampanga-provincial-capitol', 'lazatin-heritage-house'],
    tags: ['Gastronomy', 'Culinary', 'Workshops', 'Tasting']
  }
];

export const INITIAL_BADGES: AchievementBadge[] = [
  {
    id: 'first-discovery',
    title: 'First Discovery',
    description: 'Visited and scanned your very first San Fernando heritage site.',
    iconName: 'Compass',
    unlocked: true,
    unlockedAt: 'September 12, 2026',
    requirement: 'Scan 1 heritage site QR code'
  },
  {
    id: 'history-explorer',
    title: 'History Explorer',
    description: 'Explored 3 or more historic landmarks across the city.',
    iconName: 'MapPin',
    unlocked: true,
    unlockedAt: 'September 13, 2026',
    requirement: 'Scan 3 heritage site QR codes'
  },
  {
    id: 'heritage-hunter',
    title: 'San Fernando Heritage Hunter',
    description: 'Completed visits to all primary heritage sites in San Fernando.',
    iconName: 'Award',
    unlocked: false,
    requirement: 'Scan all 7 heritage sites'
  },
  {
    id: 'revolutionary-patriot',
    title: 'Revolutionary Patriot',
    description: 'Visited both the Metropolitan Cathedral and the Historic Train Station.',
    iconName: 'Flag',
    unlocked: false,
    requirement: 'Scan Cathedral and Train Station'
  },
  {
    id: 'lantern-master',
    title: 'Keeper of the Light',
    description: 'Experienced the Giant Lantern Center and learned the secrets of the rotor drum.',
    iconName: 'Sparkles',
    unlocked: false,
    requirement: 'Scan Giant Lantern Center'
  },
  {
    id: 'heritage-photographer',
    title: 'Heritage Chronicler',
    description: 'Contributed your personal photograph and story to the community heritage album.',
    iconName: 'Camera',
    unlocked: false,
    requirement: 'Upload a community visitor photo'
  }
];
