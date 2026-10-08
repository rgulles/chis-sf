// Legacy prototype/reference records only. Never use these as the live public catalogue.
import type { HeritageSite } from '../types';

export const INITIAL_HERITAGE_SITES: HeritageSite[] = [
  {
    id: 'metropolitan-cathedral',
    name: 'Metropolitan Cathedral of San Fernando',
    nativeName: 'Katedral ning San Fernando',
    category: 'Churches',
    yearBuilt: '1755 (Rebuilt 1897)',
    era: 'Spanish Colonial Era',
    address: 'Consunji St., Barangay Sto. Rosario',
    barangay: 'Sto. Rosario (Poblacion)',
    distanceKm: 0.3,
    coordinates: {
      lat: 15.0287,
      lng: 120.6908,
      mapX: 48,
      mapY: 42
    },
    shortDescription: 'The majestic seat of the Roman Catholic Archdiocese of San Fernando and former headquarters of Emilio Aguinaldo’s revolutionary army in 1899.',
    fullDescription: 'The Metropolitan Cathedral of San Fernando stands as both a spiritual beacon and an enduring witness to the Philippine Revolution. Founded in 1755 by Augustinian friars, its present neo-classical facade and monumental dome were rebuilt under Father Antonio Redondo in 1897. In March 1899, President Emilio Aguinaldo transferred the seat of the Philippine Revolutionary Government here.',
    story: 'In the scorching summer of 1899, as American forces pressed northward, General Emilio Aguinaldo stood on the cathedral’s stone steps, declaring San Fernando the wartime capital of the First Philippine Republic. Shortly thereafter, to prevent its strategic use by advancing US troops under General Arthur MacArthur, Filipino revolutionary soldiers under General Antonio Luna were ordered to set fire to church conventos and municipal centers, including portions of this venerable cathedral. Decades later, it was painstakingly restored by the faithful people of Pampanga, retaining its imposing red-brick masonry and soaring baroque dome.',
    heroImage: '/images/sites/cathedral-hero.jpg',
    archivalImage: '/images/sites/cathedral-archival.jpg',
    modernImage: '/images/sites/cathedral-modern.jpg',
    thenNowCaption: 'Comparison of the cathedral dome and atrium after the 1899 revolution fire versus its restored neo-classical facade today.',
    audioStory: {
      title: 'Echoes of the Republic at the Altar',
      duration: '3m 15s',
      durationSeconds: 195,
      narrator: 'Maria Luisa Dayrit (Heritage Historian)',
      transcript: 'Welcome to the Metropolitan Cathedral of San Fernando. In May of 1899, the sound of church bells was silenced by the artillery of General Arthur MacArthur. Stand beneath this high vaulted dome: here, Aguinaldo held cabinet meetings, and from these balconies, revolutionaries watched the dust plumes of history rising over the Pampanga plains...',
      kapampanganTranscript: 'Malaus kayu king Katedral ning San Fernando. Keta Mayo 1899, meputut ing tunug da reng kampana uli na ning kanyon nang Heneral Arthur MacArthur. Tikdo kayu king lalam ning matas a simboryo: keti nemu pigpulungan Aguinaldo reng kayang opisyal...',
      chapters: [
        { title: 'The Augustinian Foundation (1755)', timeSeconds: 0 },
        { title: 'Wartime Capital of the Republic (1899)', timeSeconds: 65 },
        { title: 'Restoration & Silver Bells', timeSeconds: 130 }
      ]
    },
    timeline: [
      { year: '1755', title: 'Augustinian Foundation', description: 'Father Sebastian Moreno founds the original timber and thatch parish dedicated to San Fernando Rey.' },
      { year: '1897', title: 'Monumental Reconstruction', description: 'Rebuilt with stone masonry and iconic round dome supervised by Fr. Antonio Redondo.' },
      { year: '1899', title: 'Seat of Revolutionary Government', description: 'Emilio Aguinaldo moves the capital here; church later burned in tactical retreat by Gen. Antonio Luna.' },
      { year: '1948', title: 'Elevated to Cathedral', description: 'Created as diocese seat by Pope Pius XII, later elevated to Metropolitan Archdiocese in 1975.' }
    ],
    didYouKnow: [
      'The cathedral bell was cast from melted Spanish silver pesos and coins collected from local families.',
      'General Emilio Aguinaldo personally reviewed Filipino infantry brigades from the convento balcony overlooking the plaza.',
      'The dome was intentionally designed to be visible from the distant Candaba swamps to serve as a navigational beacon.'
    ],
    historicalCharacters: [
      {
        name: 'Gen. Emilio Aguinaldo',
        role: 'President of the First Philippine Republic',
        bio: 'Established his wartime capital at the church convento in 1899 during the Philippine-American War.',
        avatar: '/images/characters/aguinaldo.jpg'
      },
      {
        name: 'Fr. Antonio Redondo',
        role: 'Augustinian Parish Priest & Architect',
        bio: 'Engineered the 1897 massive masonry rebuilding and the iconic European-style masonry bell towers.',
        avatar: '/images/sites/cathedral-hero.jpg'
      }
    ],
    visitInfo: {
      address: 'Consunji Street, Poblacion, City of San Fernando, Pampanga',
      openingHours: '6:00 AM – 7:30 PM Daily',
      entranceFee: 'Free (Donations Welcome)',
      accessibility: 'Wheelchair ramp available at side entrance',
      duration: '45 - 60 mins',
      guideAvailable: true,
      bestTime: 'Morning (8:00 AM) or late afternoon lighting'
    },
    nhcpPlaqueCode: '1755',
    householdVaults: [
      {
        id: 'cathedral-v-1',
        title: 'Crypt of Augustinian Priests & Silver Reliquary',
        category: 'Ancestral Heirloom',
        description: 'Chamber beneath the high sanctuary housing ceremonial vestments and colonial silver chalices.',
        historicalSignificance: 'Protected during the 1899 fire by parish sacristans hiding artifacts in dry stone wells.'
      },
      {
        id: 'cathedral-v-2',
        title: 'Belfry Bullet Grazes of 1899',
        category: 'War Relic',
        description: 'Deep stone impact craters from US 20th Kansas Infantry volleys during the siege of Poblacion.',
        historicalSignificance: 'Tangible testament to the defense lines commanded by General Antonio Luna.'
      }
    ],
    etiquetteRules: {
      shoeCoversRequired: false,
      silenceProtocol: true,
      flashPhotographyAllowed: false,
      preservationNotes: [
        'Maintain solemn silence inside the main nave and Blessed Sacrament chapel.',
        'No flash photography during active liturgical services.',
        'Modest attire required (covered shoulders and knees).',
        'Light candles only at designated outdoor candle galleries.'
      ]
    },
    panoramaHotspots: [
      { title: 'The High Altar Retablo', description: 'Baroque wooden craftsmanship adorned in real gold leaf detailing.', x: 50, y: 38 },
      { title: 'Revolutionary Plaque', description: 'Historical bronze marker from the National Historical Institute.', x: 22, y: 70 },
      { title: 'Central Octagonal Cupola', description: 'Allows natural zenith illumination into the transept.', x: 52, y: 15 }
    ],
    scanCount: 1420,
    badgeName: 'San Fernando Cathedral Stamp',
    isFeatured: true
  },
  {
    id: 'san-fernando-train-station',
    name: 'San Fernando Heritage Train Station',
    nativeName: 'Istasyun ning Tren San Fernando',
    category: 'Historical Buildings',
    yearBuilt: '1892',
    era: 'Late Spanish / WWII Era',
    address: 'Km 102, MacArthur Highway, Brgy. Sto. Niño',
    barangay: 'Sto. Niño',
    distanceKm: 1.2,
    coordinates: {
      lat: 15.0321,
      lng: 120.6845,
      mapX: 35,
      mapY: 34
    },
    shortDescription: 'Inaugurated by the Manila-Dagupan Railroad in 1892; visited by Dr. Jose Rizal and the final terminus of the grueling 1942 Bataan Death March.',
    fullDescription: 'The San Fernando Train Station is one of the most poignant historical landmarks in the Philippines. Inaugurated on February 23, 1892 as part of the Ferrocaril de Manila a Dagupan, it was visited by national hero Dr. Jose Rizal in June 1892 while mobilizing reformists for La Liga Filipina. Exactly 50 years later in April 1942, over 60,000 starved Filipino and American prisoners completed their 102-kilometer march on foot here before being crammed into sweltering boxcars bound for Capas.',
    story: 'In the early days of June 1892, Dr. Jose Rizal stepped onto this very wooden platform from Manila, received by prominent Kapampangan patriots. But half a century later, in April 1942, this quiet platform became the backdrop for unimaginable tragedy. Soldiers who had endured days without water or rest collapsed onto the dusty gravel. Brave Fernandino women, braving Japanese bayonets, tossed rice balls (*kalamay*) and sugar canes into the packed cattle boxcars to save dying soldiers. Today, the preserved brick depot and steam locomotive memorialize both the horror and the sheer compassion of the Kapampangan people.',
    heroImage: '/images/sites/train-station-hero.jpg',
    archivalImage: '/images/sites/train-station-archival.jpg',
    modernImage: '/images/sites/train-station-modern.jpg',
    thenNowCaption: 'Archival 1942 wartime photograph of boxcars alongside the preserved red-brick station museum today.',
    audioStory: {
      title: 'The Steel Rails of Sacrifice',
      duration: '4m 02s',
      durationSeconds: 242,
      narrator: 'Captain Carlos Morales (Historian)',
      transcript: 'Listen closely to the gentle wind blowing past these tracks. In 1942, boxcars built for 40 livestock were packed with over 100 dying men. Fernandina mothers risked their lives throwing food and wet cloths through the wooden slats. You are standing on sacred ground where humanity defied tyranny...'
    },
    timeline: [
      { year: '1892', title: 'Station Inauguration & Rizal Visit', description: 'Opened by the Manila Railway Company; Dr. Jose Rizal arrives on June 27, 1892.' },
      { year: '1942', title: 'The Bataan Death March Terminus', description: 'POWs packed into sweltering narrow-gauge boxcars to Camp O’Donnell.' },
      { year: '2004', title: 'Museum & Memorial Restoration', description: 'Restored into a civic historical park and museum featuring preserved vintage steam train engine.' },
      { year: '2019', title: 'Declared National Historical Landmark', description: 'Officially recognized by the National Historical Commission of the Philippines (NHCP).' }
    ],
    didYouKnow: [
      'Dr. Jose Rizal dined with San Fernando prominent families just hours after stepping off the train here.',
      'The boxcars used in 1942 were French-built wooden 19th-century freight wagons with almost zero ventilation in 40°C heat.',
      'Local women disguised themselves as vendors to smuggle quinine and water to the prisoners.'
    ],
    historicalCharacters: [
      {
        name: 'Dr. Jose Rizal',
        role: 'National Hero of the Philippines',
        bio: 'Arrived at the station on June 27, 1892 to recruit key leaders in San Fernando for La Liga Filipina.',
        avatar: '/images/characters/rizal.jpg'
      },
      {
        name: 'Nicolasa Dayrit-Panlilio',
        role: 'Kapampangan Heroine & Humanitarian',
        bio: 'Provided critical food, bandages, and assistance to soldiers and mediated historical revolutionary conflicts.',
        avatar: '/images/characters/nicolasa-dayrit.jpg'
      }
    ],
    visitInfo: {
      address: 'Km 102, MacArthur Highway, Brgy. Sto. Niño, San Fernando',
      openingHours: '8:00 AM – 5:00 PM (Tuesday to Sunday)',
      entranceFee: 'Free (Donations encouraged)',
      accessibility: 'Ground-level ramp access to platform and museum gallery',
      duration: '45 mins',
      guideAvailable: true,
      bestTime: 'Early morning or late afternoon'
    },
    panoramaHotspots: [
      { title: 'The Old Rails', description: 'Original iron tracks that connected Manila and northern Luzon.', x: 45, y: 72 },
      { title: 'Steam Locomotive No. 17', description: 'Preserved Baldwin steam engine museum centerpiece.', x: 68, y: 44 },
      { title: 'Death March Memorial Wall', description: 'Names and chronicles of the 1942 march survivors.', x: 25, y: 35 }
    ],
    scanCount: 1980,
    badgeName: 'Death March Rails Stamp',
    isFeatured: true
  },
  {
    id: 'lazatin-heritage-house',
    name: 'Lazatin Heritage Ancestral House',
    nativeName: 'Bale Lazatin',
    category: 'Historical Buildings',
    yearBuilt: '1925',
    era: 'American Sugar Baron Era',
    address: 'Consunji St., Barangay San Jose',
    barangay: 'San Jose',
    distanceKm: 0.6,
    coordinates: {
      lat: 15.0298,
      lng: 120.6935,
      mapX: 58,
      mapY: 48
    },
    shortDescription: 'Magnificent 1925 Art Deco-Filipino ancestral mansion of sugar baron Don Serafin Lazatin; wartime command residence of Gen. Masaharu Homma.',
    fullDescription: 'Constructed in 1925 by Don Serafin Lazatin y Singian, prominent sugar planter and founding president of PASUDECO, this grand estate represents the pinnacle of Pampanga’s 1920s sugar aristocracy. In 1942, during the Japanese occupation, the mansion was commandeered as the headquarters of the 14th Imperial Japanese Army and residence of Lt. Gen. Masaharu Homma.',
    story: 'Walking up the hand-carved molave grand staircase of the Lazatin House feels like traveling back into the Roaring Twenties in Central Luzon. Don Serafin was not just a landlord; he revolutionized local sugar farming with mechanized steam mills. During WWII, the house was seized by the Japanese military leadership, whose officers gathered in the ornate ballroom. Miraculously, when Japanese forces retreated in 1945, the house was spared from fire, leaving its priceless Capiz sliding windows, European crystal chandeliers, and hardwood parquetry intact.',
    heroImage: '/images/sites/lazatin-house-hero.jpg',
    archivalImage: '/images/sites/lazatin-house-archival.jpg',
    modernImage: '/images/sites/lazatin-house-modern.jpg',
    thenNowCaption: 'The 1920s original carriage driveway compared with the manicured front gardens and restored woodwork today.',
    audioStory: {
      title: 'Whispers in the Grand Salon',
      duration: '3m 40s',
      durationSeconds: 220,
      narrator: 'Enrique Lazatin (Family Custodian)',
      transcript: 'Look up at the high decorative tin ceilings, crafted in Europe and shipped across oceans. In these halls, decisions were made that shaped the sugar industry of the Philippines, and later, the war that tested our resolve...'
    },
    timeline: [
      { year: '1925', title: 'Estate Completed', description: 'Built for Don Serafin Lazatin and Encarnacion Singian by architect Fernando Ocampo.' },
      { year: '1942', title: 'Japanese Military Command', description: 'Served as 14th Army Headquarters and residence of Lt. Gen. Masaharu Homma.' },
      { year: '1945', title: 'Liberation Headquarters', description: 'Used briefly by the US Army 37th Infantry Division during Central Luzon liberation.' },
      { year: '2003', title: 'Heritage House Designation', description: 'Declared an Official Heritage House by the National Historical Institute.' }
    ],
    didYouKnow: [
      'The walls feature double-layered hardwood to insulate against tropical midday heat without air conditioning.',
      'The original hand-cut Capiz shells in the sliding ventanillas are still over 95% intact from 1925.',
      'Don Serafin created a private underground vault disguised beneath the kitchen wine cellar during WWII.'
    ],
    historicalCharacters: [
      {
        name: 'Don Serafin Lazatin',
        role: 'Sugar Magnate & Industrialist',
        bio: 'Pioneered modernized agro-industrial sugar milling and founded philanthropic education trusts in Pampanga.',
        avatar: '/images/characters/serafin-lazatin.jpg'
      }
    ],
    visitInfo: {
      address: 'Consunji Street, Brgy. San Jose, City of San Fernando',
      openingHours: '9:00 AM – 4:30 PM (Advance booking required for interior tours)',
      entranceFee: '₱100 (Maintenance & Preservation contribution)',
      accessibility: 'Ground floor accessible; second floor staircase only',
      duration: '60 mins',
      guideAvailable: true,
      bestTime: 'Morning tours between 9:30 AM – 11:30 AM'
    },
    nhcpPlaqueCode: '1925',
    householdVaults: [
      {
        id: 'lazatin-v-1',
        title: 'Disguised Wine Cellar Sub-Vault',
        category: 'Subterranean Secret',
        description: 'Underground cavity concealed beneath oak wine racks used to hide family jewelry and bank papers during WWII.',
        historicalSignificance: 'Kept hidden from General Homma’s garrison occupying the upper ballroom.'
      },
      {
        id: 'lazatin-v-2',
        title: '1925 PASUDECO Founding Ledger',
        category: 'Sugar Ledger & Treasury',
        description: 'Original handwritten ledger registering shareholdings of the first all-Filipino sugar central in Central Luzon.',
        historicalSignificance: 'Pivotal artifact representing Kapampangan industrial autonomy.'
      }
    ],
    etiquetteRules: {
      shoeCoversRequired: true,
      silenceProtocol: false,
      flashPhotographyAllowed: true,
      preservationNotes: [
        'Shoe covers must be worn when ascending to the second-floor salon.',
        'Flash photography is allowed, but do not lean on capiz ventanillas or crystal sconces.',
        'Pre-booking required for interior guided tours.'
      ]
    },
    panoramaHotspots: [
      { title: 'The Grand Ballroom', description: 'Hardwood narra flooring where high society banquets took place.', x: 48, y: 40 },
      { title: 'Capiz Ventanillas', description: 'Traditional Filipino architectural airflow louvers beneath windows.', x: 18, y: 55 },
      { title: 'Crystal Chandelier', description: 'Directly imported from Bohemian glassworks in 1926.', x: 50, y: 15 }
    ],
    scanCount: 890,
    badgeName: 'Lazatin Mansion Heritage Stamp',
    isFeatured: true
  },
  {
    id: 'hizon-singian-house',
    name: 'Hizon-Singian Heritage Ancestral House',
    nativeName: 'Bale Hizon-Singian',
    category: 'Historical Buildings',
    yearBuilt: '1870',
    era: 'Spanish Colonial / Revolution Era',
    address: 'V. Consunji St., Barangay Sto. Rosario',
    barangay: 'Sto. Rosario (Poblacion)',
    distanceKm: 0.5,
    coordinates: {
      lat: 15.0292,
      lng: 120.6918,
      mapX: 50,
      mapY: 45
    },
    shortDescription: 'Declared NHCP Heritage House; premier 1870 bahay-na-bato featuring subterranean tunnel connections, narra woodwork, and 1899 revolutionary headquarters history.',
    fullDescription: 'Constructed in 1870 by Don Saturnino Hizon (revolutionary military treasurer of Pampanga) and Doña Juana Singian, this majestic bahay-na-bato represents the crowning achievement of 19th-century Spanish-Filipino domestic architecture in Central Luzon. Declared an official Heritage House by the National Historical Institute in 2003, it features thick volcanic tuff ground walls, sweeping narra wood floorboards, intricate calado transoms, and legendary underground escape passages.',
    story: 'In June 1899, during the pivotal months of the First Philippine Republic, General Antonio Luna commandeered the Hizon-Singian House as his forward military headquarters in San Fernando. Underneath the dining room floorboards, a concealed trapdoor led into a brick-lined subterranean tunnel that connected the grand residences of Consunji Street directly to the San Fernando River—providing an emergency escape route and covert courier passageway during military bombardment. Later in 1899, American General Arthur MacArthur established his own command headquarters in these very same wood-paneled chambers.',
    heroImage: '/images/sites/henson-hizon-hero.jpg',
    archivalImage: '/images/sites/henson-hizon-archival.jpg',
    modernImage: '/images/sites/henson-hizon-modern.jpg',
    thenNowCaption: 'Archival c. 1905 photograph of the colonial horse-drawn carriage entrance compared with 2024 restored volcanic tuff masonry, capiz ventanillas, and polished narra woodwork.',
    audioStory: {
      title: 'Secrets of the Narra Floorboards',
      duration: '3m 50s',
      durationSeconds: 230,
      narrator: 'Don Ramon Hizon (Family Custodian)',
      transcript: 'Welcome to the grand sala of Bale Hizon-Singian. Beneath the mirror-polished narra planks on which you stand lies a hidden stone trapdoor. In 1899, while General Antonio Luna planned troop movements in this parlor, messengers slipped through the darkness of the subterranean tunnel to carry revolution dispatches. Look up at the delicate floral calado wood carvings—they provided both ventilation and secret acoustic monitoring between rooms...',
      kapampanganTranscript: 'Malaus kayu king Bale Hizon-Singian. King lalam da reng masalang asias narra a tutuntungan yu, atin makasalikot a pasbul batu. Keta 1899, kabang i Heneral Antonio Luna manayus yang laban keti, deng mensaheru lulub la king lungib lalam gabun bang idala reng sulat ning Rebolusyon. Lawan yula reng kinudkud a calado king babo—panatili lang marimla at makaramdam king pisasabian king sumangid silid...',
      chapters: [
        { title: 'The Sugar Aristocracy (1870)', timeSeconds: 0 },
        { title: 'The 1899 Subterranean Passages', timeSeconds: 75 },
        { title: 'Household Vaults & Heirlooms', timeSeconds: 155 }
      ]
    },
    timeline: [
      { year: '1870', title: 'Estate Completed', description: 'Built for Don Saturnino Hizon and Doña Juana Singian using volcanic tuff, lime mortar, and premier narra timbers.' },
      { year: '1899', title: 'Headquarters of Gen. Antonio Luna', description: 'Used as headquarters for the Philippine Revolutionary Army; subterranean tunnels active.' },
      { year: '1899 (Late)', title: 'Gen. Arthur MacArthur Command', description: 'Commandeer residence for the US 2nd Division after the fall of San Fernando.' },
      { year: '2003', title: 'National Heritage House Declaration', description: 'Officially declared a Heritage House by the National Historical Institute (NHCP).' }
    ],
    didYouKnow: [
      'The subterranean tunnel system connected three prominent houses on Consunji Street to the river for emergency evacuation.',
      'The calado floral wood transoms were hand-carved from single slabs of tindalo and narra hardwoods by master artisans from Betis.',
      'Original 19th-century Viennese Thonet bentwood salon chairs and Austrian crystal chandeliers are still preserved inside.'
    ],
    historicalCharacters: [
      {
        name: 'Don Saturnino Hizon',
        role: 'Military Treasurer of the Revolution',
        bio: 'Philanthropist and revolutionary financier who funded weapons and provisions for General Luna’s forces in Pampanga.',
        avatar: '/images/characters/aguinaldo.jpg'
      },
      {
        name: 'Gen. Antonio Luna',
        role: 'Commander-in-Chief of the Republican Army',
        bio: 'Established his San Fernando headquarters inside the Hizon-Singian estate during the defense of Central Luzon.',
        avatar: '/images/characters/pedro-abad-santos.jpg'
      }
    ],
    visitInfo: {
      address: 'V. Consunji Street, Barangay Sto. Rosario, City of San Fernando, Pampanga',
      openingHours: '9:00 AM – 5:00 PM (Tuesday to Sunday by appointment)',
      entranceFee: '₱100 Preservation Contribution (Students/Seniors ₱50)',
      accessibility: 'Ground floor zaguan accessible; second floor via grand wooden staircase',
      duration: '60 - 75 mins',
      guideAvailable: true,
      bestTime: 'Morning (10:00 AM) or mid-afternoon golden hour'
    },
    nhcpPlaqueCode: '1870',
    householdVaults: [
      {
        id: 'hizon-v-1',
        title: 'Subterranean Escape Tunnel Portal',
        category: 'Subterranean Secret',
        description: 'Concealed brick-lined underground vault opening beneath the kitchen cistern that linked Consunji mansions to the river.',
        historicalSignificance: 'Used by revolutionary couriers to bypass American checkpoints during the 1899 siege.'
      },
      {
        id: 'hizon-v-2',
        title: 'Secret Sugar Treasury Vault',
        category: 'Sugar Ledger & Treasury',
        description: 'Reinforced iron-bound mahogany chest with dual-key locks used by Don Saturnino Hizon to store silver pesos for the revolutionary war effort.',
        historicalSignificance: 'Tangible proof of the private wealth pledged to the First Philippine Republic.'
      },
      {
        id: 'hizon-v-3',
        title: '1899 Battle Bullet Scars',
        category: 'War Relic',
        description: 'Preserved bullet fissures on the second-floor street-facing molave window frame from May 1899 skirmishes.',
        historicalSignificance: 'Firsthand battle damage from the Philippine-American War in San Fernando.'
      },
      {
        id: 'hizon-v-4',
        title: '1870 Viennese Thonet Salon Suite',
        category: 'Ancestral Heirloom',
        description: 'Intact suite of bentwood armchairs imported via Manila galleon trade, featuring floral Betis-carved transoms.',
        historicalSignificance: 'Exceptional preservation of 19th-century Kapampangan interior decorative arts.'
      }
    ],
    etiquetteRules: {
      shoeCoversRequired: true,
      silenceProtocol: true,
      flashPhotographyAllowed: false,
      preservationNotes: [
        'Protective fabric shoe covers (provided at entrance) must be worn over the 150-year-old polished narra planks.',
        'Maintain quiet reverence inside the ancestral prayer chapel and bedroom archives.',
        'No flash photography, selfie sticks, or tripods allowed near fragile capiz ventanillas.',
        'Do not touch or sit on heirloom furniture marked with heritage plaques.'
      ]
    },
    panoramaHotspots: [
      { title: 'The Grand Sala', description: 'Wide narra floorboards where General Antonio Luna convened staff officers.', x: 50, y: 40 },
      { title: 'Subterranean Trapdoor Entry', description: 'Original brick floor portal leading to the underground passage.', x: 25, y: 75 },
      { title: 'Carved Calado Transoms', description: 'Hand-pierced timber vents facilitating cross-breezes and acoustic privacy.', x: 60, y: 18 }
    ],
    scanCount: 1650,
    badgeName: 'Hizon-Singian Ancestral Stamp',
    isFeatured: true
  },
  {
    id: 'giant-lantern-center',
    name: 'Giant Lantern Center & Parul Museum',
    nativeName: 'Sentru ning Ligligan Parul',
    category: 'Cultural Sites',
    yearBuilt: '1908 (Tradition) / 2004 (Center)',
    era: 'Cultural Living Heritage',
    address: 'Jose Abad Santos Avenue (JASA), Brgy. San Juan',
    barangay: 'San Juan',
    distanceKm: 2.4,
    coordinates: {
      lat: 15.0412,
      lng: 120.6721,
      mapX: 20,
      mapY: 22
    },
    shortDescription: 'The pulsing creative heart of the Christmas Capital of the Philippines, celebrating the world-renowned Giant Lantern Festival (Ligligan Parul).',
    fullDescription: 'San Fernando is globally recognized as the "Christmas Capital of the Philippines." The Giant Lantern Center showcases the evolution of the Parul Sampernandu from simple paper lanterns on bamboo frames in 1908 to kaleidoscopic 20-foot motorized works of art composed of 10,000 sparkling incandescent bulbs and intricate manual rotor drums (*tambor*).',
    story: 'In the barrio of Bacolor in 1908, Francisco Estanislao crafted a two-foot lantern made of bamboo and Japanese paper. When the capital moved to San Fernando, the competition grew into a fierce, loving duel between barangays. The genius of San Fernando’s lantern makers lies in the *tambor*—large metal cylinders lined with electrical pins that act like giant analog music boxes. As the makers manually turn the wheels, the circuit switches create pulsating flower patterns, fireworks, and waves of light synchronized to full brass orchestra melodies.',
    heroImage: '/images/sites/giant-lantern-hero.jpg',
    archivalImage: '/images/sites/giant-lantern-archival.jpg',
    modernImage: '/images/sites/giant-lantern-modern.jpg',
    thenNowCaption: 'Vintage 1930s paper parul with candlelights compared with today’s 20-foot, 10,000-bulb illuminated spectacles.',
    audioStory: {
      title: 'The Symphony of 10,000 Lights',
      duration: '3m 10s',
      durationSeconds: 190,
      narrator: 'Master Craftsman Rolando Quiambao',
      transcript: 'Touch the steel drum in front of you. There are no computers inside our giant lanterns. Everything is calculated by hand, wire by wire, beat by beat. When the crowd gasps in December, it is the spirit of San Fernando glowing in the night...'
    },
    timeline: [
      { year: '1908', title: 'First Paper Lanterns', description: 'Francisco Estanislao crafts simple bamboo-and-paper paruls for church novenas.' },
      { year: '1931', title: 'First Electric Parul', description: 'Battery and electrical generators introduce the first illuminated multi-stage patterns.' },
      { year: '1957', title: 'Invention of the Rotor Drum', description: 'Mechanics invent the *tambor* rotor system using recycled metal barrels.' },
      { year: 'Present', title: 'Global Tourism Icon', description: 'Annual Ligligan Parul draws over 100,000 domestic and international spectators.' }
    ],
    didYouKnow: [
      'Each giant lantern weighs between 1.5 to 2.5 metric tons and stands over two stories tall.',
      'A single lantern requires up to 7,000 meters of electrical wiring and over 10,000 light bulbs.',
      'The rotors are operated manually by 4 to 6 strong men rotating wheels in pitch darkness during the festival.'
    ],
    historicalCharacters: [
      {
        name: 'Francisco Estanislao',
        role: 'Pioneering Lantern Artisan',
        bio: 'Created the prototype star lantern that ignited a century-old cultural revolution in Pampanga.',
        avatar: '/images/sites/giant-lantern-archival.jpg'
      },
      {
        name: 'Rolando Quiambao',
        role: 'National Living Treasure Candidate',
        bio: 'Master lantern maker credited with innovating multi-color rotor choreography and mentoring youth.',
        avatar: '/images/sites/giant-lantern-hero.jpg'
      }
    ],
    visitInfo: {
      address: 'Jose Abad Santos Avenue, San Fernando, Pampanga',
      openingHours: '9:00 AM – 6:00 PM Daily',
      entranceFee: '₱50 (Adults), ₱25 (Students/Seniors)',
      accessibility: 'Full wheelchair access with elevator and spacious exhibition halls',
      duration: '60 - 90 mins',
      guideAvailable: true,
      bestTime: 'Evenings or early afternoon'
    },
    panoramaHotspots: [
      { title: 'The Rotor Drum Exhibit', description: 'Interactive mechanical rotor where visitors can try turning the light circuits.', x: 50, y: 55 },
      { title: 'Miniature Lantern Workshop', description: 'Live artisan demonstration room for crafting Capiz shell stars.', x: 75, y: 40 },
      { title: 'The Hall of Champions', description: 'Historic trophies and photos from a century of Ligligan Parul contests.', x: 25, y: 35 }
    ],
    scanCount: 3120,
    badgeName: 'Giant Lantern Explorer Stamp',
    isFeatured: true
  },
  {
    id: 'henson-hizon-house',
    name: 'Henson-Hizon Heritage House',
    nativeName: 'Bale Henson-Hizon',
    category: 'Historical Buildings',
    yearBuilt: '1870',
    era: 'Spanish Colonial / Revolution Era',
    address: 'V. Tiomico St., Barangay Sto. Rosario',
    barangay: 'Sto. Rosario',
    distanceKm: 0.4,
    coordinates: {
      lat: 15.0275,
      lng: 120.6922,
      mapX: 52,
      mapY: 46
    },
    shortDescription: 'Historic bahay-na-bato of hero Saturnino Henson, later home of heroine Nicolasa Dayrit who reconciled Gen. Luna and Gen. Mascardo.',
    fullDescription: 'Built circa 1870 by Saturnino Henson y David, first gobernadorcillo of San Fernando, this iconic bahay-na-bato exemplifies classic Philippine-Spanish residential architecture with solid stone ground floor and sweeping narra wood upper quarters. It later became the home of revolutionary heroine Nicolasa Dayrit-Panlilio.',
    story: 'During the high tensions of the Philippine Revolution in 1899, General Antonio Luna and General Tomas Mascardo were on the brink of an armed civil clash in Pampanga. Knowing that national unity was at stake, Nicolasa Dayrit, together with prominent women of San Fernando, knelt between the rival armies carrying crucifixes, pleading for peace and fraternity. Her courageous diplomacy avoided bloodshed and allowed the Filipino revolutionary army to regroup.',
    heroImage: '/images/sites/henson-hizon-hero.jpg',
    archivalImage: '/images/sites/henson-hizon-archival.jpg',
    modernImage: '/images/sites/henson-hizon-modern.jpg',
    thenNowCaption: 'Archival 1890s stone facade compared with the preserved wood-and-mortar ancestral facade.',
    audioStory: {
      title: 'A Heroine’s Plea for Unity',
      duration: '3m 05s',
      durationSeconds: 185,
      narrator: 'Maria Regina Henson (Descendant)',
      transcript: 'Inside these quiet wooden rooms, Nicolasa Dayrit tended to wounded freedom fighters. In 1899, while men drew revolvers, it was her moral courage that held the Republic together...'
    },
    timeline: [
      { year: '1870', title: 'Constructed by Saturnino Henson', description: 'Built using volcanic tuff, lime mortar, and premier Philippine hardwoods.' },
      { year: '1899', title: 'Revolutionary Mediation', description: 'Nicolasa Dayrit and women of San Fernando arbitrate the historic Luna-Mascardo standoff.' },
      { year: '2003', title: 'National Heritage Landmark', description: 'Honored by the National Historical Institute with a permanent marker.' }
    ],
    didYouKnow: [
      'The house features an authentic *zaguan* where horse-drawn carruajes and carriages were parked in the 19th century.',
      'Nicolasa Dayrit received a special gold medallion from General Emilio Aguinaldo for her humanitarian service.'
    ],
    historicalCharacters: [
      {
        name: 'Nicolasa Dayrit',
        role: 'Heroine of the Revolution',
        bio: 'Philanthropist, nurse to wounded soldiers, and peace diplomat during the Philippine-American War.',
        avatar: '/images/characters/nicolasa-dayrit.jpg'
      }
    ],
    visitInfo: {
      address: 'V. Tiomico Street, Poblacion, San Fernando, Pampanga',
      openingHours: '9:00 AM – 5:00 PM (Monday to Saturday)',
      entranceFee: '₱50 Donation',
      accessibility: 'Ground level wheelchair friendly',
      duration: '45 mins',
      guideAvailable: true,
      bestTime: 'Morning'
    },
    scanCount: 740,
    badgeName: 'Henson-Hizon Heritage Stamp'
  },
  {
    id: 'pampanga-provincial-capitol',
    name: 'Pampanga Provincial Capitol',
    nativeName: 'Kapitolyo ning Pampanga',
    category: 'Historical Buildings',
    yearBuilt: '1907 - 1908',
    era: 'American Colonial Period',
    address: 'Capitol Boulevard, Barangay Sto. Niño',
    barangay: 'Sto. Niño',
    distanceKm: 1.5,
    coordinates: {
      lat: 15.0345,
      lng: 120.6812,
      mapX: 30,
      mapY: 38
    },
    shortDescription: 'Neoclassical architectural jewel of Central Luzon, seat of the provincial government and site of fierce WWII liberation battles.',
    fullDescription: 'Erected between 1907 and 1908 during the American administration, the Pampanga Provincial Capitol showcases grand Ionic columns, expansive balustrades, and lush tree-lined grounds along Capitol Boulevard. It was heavily damaged during the liberation of San Fernando in 1945 and lovingly restored in 1949.',
    story: 'Designed under William E. Parsons’ master plan for provincial capitals, the Capitol was meant to embody democratic governance with its open, majestic facade. During World War II, it was turned into a heavily fortified Japanese garrison. In January 1945, Filipino guerrillas alongside the US 6th Army fought block-by-block up Capitol Boulevard, finally reclaiming the seat of provincial freedom.',
    heroImage: '/images/sites/capitol-hero.jpg',
    archivalImage: '/images/sites/capitol-archival.jpg',
    modernImage: '/images/sites/capitol-modern.jpg',
    thenNowCaption: 'The 1945 war-damaged facade after liberation compared with the stately restored white neoclassical columns today.',
    audioStory: {
      title: 'Pillars of Provincial Glory',
      duration: '2m 50s',
      durationSeconds: 170,
      narrator: 'Atty. Rafael David',
      transcript: 'Stand on the wide lawns of Capitol Boulevard. These ionic columns have seen governors, wartime commanders, and student rallies. They stand as a symbol that Pampanga always rises from ashes...'
    },
    timeline: [
      { year: '1907', title: 'Construction Begins', description: 'Commissioned under the American Insular Government.' },
      { year: '1945', title: 'Battle for San Fernando', description: 'Site of heavy urban combat during Central Luzon liberation.' },
      { year: '1949', title: 'Post-War Reconstruction', description: 'Rebuilt under Governor Jose B. Lingad with neoclassical enhancements.' }
    ],
    didYouKnow: [
      'The Capitol grounds house the monuments of Pampanga’s two Philippine Presidents: Diosdado Macapagal and Gloria Macapagal Arroyo.',
      'The main staircase features polished Romblon marble and Kapampangan iron craftsmanship.'
    ],
    historicalCharacters: [
      {
        name: 'Gov. Jose B. Lingad',
        role: 'WWII Guerrilla Leader & Governor',
        bio: 'Spearheaded the reconstruction of the war-ravaged Capitol and fought against political tyranny.',
        avatar: '/images/characters/jose-lingad.jpg'
      }
    ],
    visitInfo: {
      address: 'Capitol Boulevard, San Fernando, Pampanga',
      openingHours: '8:00 AM – 5:00 PM (Monday to Friday)',
      entranceFee: 'Free',
      accessibility: 'Ramp and elevator available',
      duration: '40 mins',
      guideAvailable: false,
      bestTime: 'Sunset along the Capitol Boulevard promenade'
    },
    scanCount: 1105,
    badgeName: 'Provincial Capitol Stamp'
  },
  {
    id: 'death-march-marker-102',
    name: 'Death March Kilometric Marker 102 & Shrine',
    nativeName: 'Bantayog ning Death March Km 102',
    category: 'Monuments',
    yearBuilt: '1942 (Event) / 1967 (Marker)',
    era: 'World War II Era',
    address: 'Near Old PNR Railway, Brgy. Sto. Niño',
    barangay: 'Sto. Niño',
    distanceKm: 1.3,
    coordinates: {
      lat: 15.0315,
      lng: 120.6858,
      mapX: 37,
      mapY: 36
    },
    shortDescription: 'National historical monument marking the grueling 102nd kilometer where Bataan defenders concluded their grueling forced march.',
    fullDescription: 'Kilometer Marker 102 is the solemn marker of the infamous Bataan Death March in San Fernando. Over 70,000 Filipino and American soldiers marched 102 kilometers from Mariveles and Bagac, Bataan under extreme brutality. Here in San Fernando, the marching stopped, and the agonizing boxcar journey began.',
    story: 'Along the dusty roadside of MacArthur Highway, families in San Fernando threw handkerchiefs dipped in sugarcane juice to dying troops, defying immediate death threats from guard soldiers. This monument is a quiet sanctuary honoring resilience and eternal brotherhood between freedom fighters.',
    heroImage: '/images/sites/death-march-hero.jpg',
    archivalImage: '/images/sites/death-march-archival.jpg',
    modernImage: '/images/sites/death-march-modern.jpg',
    thenNowCaption: 'Wartime columns of exhausted troops compared with the peaceful white memorial obelisk marker today.',
    audioStory: {
      title: 'The Final Kilometer',
      duration: '3m 20s',
      durationSeconds: 200,
      narrator: 'Lt. Dan Ramirez (Bataan Legacy Foundation)',
      transcript: 'Pause for a moment of silence. You are standing at Kilometer 102. After six days under the relentless tropical sun with almost no food or water, soldiers fell here. Remember their names...'
    },
    timeline: [
      { year: '1942', title: 'April 9-15 Death March', description: 'POWs arrive at San Fernando after 102km forced march.' },
      { year: '1967', title: 'First Memorial Marker Erected', description: 'Dedicated by the Battling Bastards of Bataan and Philippine Veterans.' },
      { year: '2015', title: 'Shrine Landscaping & Eternal Flame', description: 'Enhanced with commemorative bas-relief bronze panels.' }
    ],
    didYouKnow: [
      'Each Death March marker along the highway is spaced exactly one kilometer apart.',
      'San Fernando was designated as the transshipment point because of its direct railroad connection to Capas, Tarlac.'
    ],
    historicalCharacters: [
      {
        name: 'Gen. Vicente Lim',
        role: 'Brigadier General & Hero',
        bio: 'First Filipino West Point graduate, leader of the 41st Infantry Division in Bataan.',
        avatar: '/images/characters/vicente-lim.jpg'
      }
    ],
    visitInfo: {
      address: 'MacArthur Highway, Brgy. Sto. Niño, San Fernando',
      openingHours: 'Open 24 Hours (Public Monument)',
      entranceFee: 'Free',
      accessibility: 'Sidewalk accessible',
      duration: '20 - 30 mins',
      guideAvailable: false,
      bestTime: 'Morning or late afternoon'
    },
    scanCount: 650,
    badgeName: 'Bataan Valor Memorial Stamp'
  },
  {
    id: 'pasudeco-sugar-mill',
    name: 'PASUDECO Sugar Central Heritage Landmark',
    nativeName: 'Tutungpan ning PASUDECO',
    category: 'Historical Buildings',
    yearBuilt: '1918',
    era: 'Industrial Heritage',
    address: 'Capitol Boulevard, Brgy. Sto. Niño',
    barangay: 'Sto. Niño',
    distanceKm: 1.8,
    coordinates: {
      lat: 15.0372,
      lng: 120.6785,
      mapX: 25,
      mapY: 42
    },
    shortDescription: 'The first all-Filipino financed sugar mill in Central Luzon, whose towering smokestacks drove Pampanga’s 20th century economic boom.',
    fullDescription: 'The Pampanga Sugar Development Company (PASUDECO) was established in 1918 by visionary Kapampangan sugar planters led by Jose L. de Leon, Serafin Lazatin, and Honorio Ventura. Its colossal twin brick chimneys, iron machinery, and steam locomotives shaped the skyline and fortune of San Fernando for nearly a century.',
    story: 'Before PASUDECO, local farmers depended on small muscovado animal-powered presses with meager yields. PASUDECO changed everything: thousands of hectares of sugarcane fields were linked by narrow-gauge steam railways. It was also a hotbed for early labor rights movements in the 1930s, led by socialist leader Pedro Abad Santos, shaping modern Philippine labor laws.',
    heroImage: '/images/sites/pasudeco-hero.jpg',
    archivalImage: '/images/sites/pasudeco-archival.jpg',
    modernImage: '/images/sites/pasudeco-modern.jpg',
    thenNowCaption: 'The 1920s bustling steam railway depot at the mill compared with the preserved heritage chimney park today.',
    audioStory: {
      title: 'Sweet Sweat: The Story of PASUDECO',
      duration: '3m 35s',
      durationSeconds: 215,
      narrator: 'Tito David (Historian & Author)',
      transcript: 'Smell the faint scent of molasses carried by the breeze. For 80 years, the dawn siren of PASUDECO woke the entire city of San Fernando. It was the beating industrial heart of the province...'
    },
    timeline: [
      { year: '1918', title: 'PASUDECO Incorporated', description: 'Founded by Filipino sugar planters with modern Honolulu Iron Works machinery.' },
      { year: '1930s', title: 'Labor Rights Movement', description: 'Center of agrarian reform rallies organized by Pedro Abad Santos.' },
      { year: '1991', title: 'Pinatubo Eruption Survival', description: 'Surrounded by lahar flows yet continued operations to support displaced workers.' },
      { year: '2016', title: 'Heritage Conservation Adaptive Reuse', description: 'Preserved chimneys and machinery integrated into heritage open-air cultural zone.' }
    ],
    didYouKnow: [
      'The mill had its own private railway system stretching across five municipalities in Pampanga.',
      'PASUDECO’s horn blew at 5:00 AM, 12:00 PM, and 5:00 PM, serving as the city’s official clock for generations.'
    ],
    historicalCharacters: [
      {
        name: 'Pedro Abad Santos',
        role: 'Socialist Party of the Philippines Founder',
        bio: 'Lawyer and champion of agrarian workers who organized the mill hands and tenant farmers of San Fernando.',
        avatar: '/images/characters/pedro-abad-santos.jpg'
      }
    ],
    visitInfo: {
      address: 'Capitol Boulevard, San Fernando, Pampanga',
      openingHours: '8:00 AM – 6:00 PM (Daily)',
      entranceFee: 'Free access to public grounds',
      accessibility: 'Open paved park paths',
      duration: '45 mins',
      guideAvailable: false,
      bestTime: 'Afternoon / Golden Hour photography'
    },
    scanCount: 580,
    badgeName: 'PASUDECO Industrial Stamp'
  }
];

export { HERITAGE_CATEGORIES } from './heritageCategories';
