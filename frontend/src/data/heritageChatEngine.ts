import type { HeritageSite } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  matchedSiteId?: string;
  suggestedPrompts?: string[];
}

export const INITIAL_CHATBOT_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-msg',
    role: 'assistant',
    content: `**Mayap a aldo! Komusta!** I am **Katulung**, your interactive heritage assistant for the **City of San Fernando, Pampanga**. 

I can answer questions about our Spanish colonial churches, sugar-era ancestral mansions, the historic 1892 Train Station, the Giant Lantern Festival (*Ligligan Parul*), or authentic Kapampangan culinary traditions. 

How may I assist your heritage journey today?`,
    timestamp: 'Just now',
    suggestedPrompts: [
      'Tell me about the Train Station',
      'What is Ligligan Parul?',
      'History of the Cathedral',
      'Best Kapampangan foods',
      'Suggest a 1-day walking tour'
    ]
  }
];

export function getLocalHeritageResponse(userInput: string, sites: HeritageSite[]): { text: string; matchedSiteId?: string } {
  const query = userInput.toLowerCase();

  // 1. Train Station / Death March
  if (query.includes('train') || query.includes('estacion') || query.includes('rail') || query.includes('death march') || query.includes('102') || query.includes('station')) {
    const site = sites.find(s => s.id === 'train-station' || s.id.includes('train'));
    return {
      text: `**San Fernando Old Train Station (Estacion de San Fernando)**
Opened on February 23, 1892 by the *Ferrocarril de Manila-Dagupan*, this station holds two major historical milestones:

1. **Dr. Jose Rizal's Visit**: On June 27, 1892, national hero Dr. Jose Rizal arrived at this station to rally local Kapampangan patriots before founding *La Liga Filipina*.
2. **Bataan Death March Terminal (1942)**: During WWII, following a grueling 102-kilometer forced march from Mariveles and Bagac, tens of thousands of exhausted Filipino and American soldiers reached this station. Here, they were packed tightly into wooden boxcars (*calabozos*) bound for Camp O'Donnell in Capas, Tarlac.

Today, it is a protected National Historical Commission (NHCP) museum showcasing war relics, restored waiting benches, and an authentic steam locomotive tender.`,
      matchedSiteId: site?.id || 'train-station'
    };
  }

  // 2. Metropolitan Cathedral
  if (query.includes('cathedral') || query.includes('church') || query.includes('simbahan') || query.includes('ferdinand') || query.includes('virgin of the remedies')) {
    const site = sites.find(s => s.id === 'metropolitan-cathedral' || s.id.includes('cathedral'));
    return {
      text: `**Metropolitan Cathedral of San Fernando**
Originally founded in **1755** by Augustinian friars and dedicated to King Ferdinand III of Castile, the Cathedral stands as the spiritual cradle of Pampanga.

- **Architecture**: A Spanish-colonial Baroque and Renaissance revival stone masonry edifice featuring an octagonal bell tower and twin levels of arched windows.
- **Revolutionary Era**: In 1899, General Antonio Luna briefly established military headquarters in the convent before retreating northward.
- **The 1939 Great Fire**: Rebuilt with deep devotion after a devastating municipal fire under the architectural stewardship of Fernando Ocampo.
- **Spiritual Seat**: In 1975, Pope Paul VI elevated the cathedral to the seat of the Archdiocese of San Fernando.`,
      matchedSiteId: site?.id || 'metropolitan-cathedral'
    };
  }

  // 3. PASUDECO / Sugar Mill
  if (query.includes('pasudeco') || query.includes('sugar') || query.includes('tubo') || query.includes('mill') || query.includes('central')) {
    const site = sites.find(s => s.id === 'pasudeco-sugar-mill' || s.id.includes('sugar'));
    return {
      text: `**PASUDECO (Pampanga Sugar Development Company)**
Established in **1918** by Don Jose Leoncio de Leon along with visionary Kapampangan sugar barons, PASUDECO was the very first Filipino-financed modern centrifugal sugar mill in Central Luzon.

- **Historical Significance**: It spurred an unprecedented economic renaissance across Pampanga, leading to the creation of the grand ancestral mansions found throughout the Poblacion.
- **Industrial Monument**: The towering brick chimneys, American-engineered steel trusses, and sugar cane rail lines remain majestic testaments to the Golden Sugar Era.`,
      matchedSiteId: site?.id || 'pasudeco-sugar-mill'
    };
  }

  // 4. Henson-Hizon or Lazatin Ancestral Houses
  if (query.includes('henson') || query.includes('hizon') || query.includes('lazatin') || query.includes('ancestral') || query.includes('mansion') || query.includes('house') || query.includes('bahay')) {
    const site = sites.find(s => s.id.includes('lazatin') || s.id.includes('hizon') || s.category === 'Historical Buildings');
    return {
      text: `**Historic Ancestral Mansions of San Fernando**
San Fernando's Heritage District boasts pristine *Bahay-na-bato* (stone-and-hardwood) architecture from the late 19th and early 20th centuries:

- **Henson-Hizon House (c. 1890)**: Built by Saturnino Henson y David, this estate served as military headquarters during the Philippine-American War and was occupied by US Gen. Arthur MacArthur in 1899.
- **Lazatin Ancestral House (1928)**: Built by Don Roman Lazatin, this stately residence showcases neoclassical columns and Art Deco woodwork. In WWII, it was requisitioned by the Japanese 14th Imperial Army as their local command garrison.
- **Consunji & Singian Houses**: Notable for hand-carved floral *calados* (fretwork transoms) facilitating natural breeze circulation.`,
      matchedSiteId: site?.id
    };
  }

  // 5. Giant Lantern / Ligligan Parul
  if (query.includes('lantern') || query.includes('parul') || query.includes('ligligan') || query.includes('christmas') || query.includes('paskua')) {
    const site = sites.find(s => s.id.includes('lantern') || s.name.toLowerCase().includes('lantern'));
    return {
      text: `**Ligligan Parul (Giant Lantern Festival)**
San Fernando is globally celebrated as the **Christmas Capital of the Philippines**!

- **Origin**: Began in **1908** when Francisco Estanislao crafted 2-foot paper lanterns for *Misa de Gallo*.
- **Modern Marvels**: Today, barangays compete with kaleidoscopic lanterns reaching up to **20 feet in diameter**, illuminated by 7,000 to 10,000 light bulbs!
- **Analog Magic**: The patterns are synchronized not by computers, but by master lantern electricians rotating massive hand-turned aluminum rotors (*tambor*) lined with masking tape.
- **When & Where**: Held annually mid-December at Robinsons Starmills or the Giant Lantern Center along Jose Abad Santos Avenue.`,
      matchedSiteId: site?.id || 'giant-lantern-center'
    };
  }

  // 6. Food / Culinary Capital / Delicacies
  if (query.includes('food') || query.includes('eat') || query.includes('sisig') || query.includes('culinary') || query.includes('delicacy') || query.includes('kainan') || query.includes('restaurant') || query.includes('halo-halo')) {
    return {
      text: `**Pampanga: The Culinary Capital of the Philippines**
When visiting San Fernando, you must savor these authentic heritage specialties:

- **Sizzling Sisig**: Originating in nearby Angeles and perfected across Pampanga with seasoned pork jowl, calamansi, chicken liver, and chili peppers.
- **Tibok-Tibok**: Silky white pudding made with fresh *carabao* (water buffalo) milk topped with golden toasted coconut curd (*latik*).
- **Sanikulas Cookies**: Sacred arrowroot biscuits pressed into ornate 17th-century heirloom wooden molds portraying Saint Nicholas of Tolentino.
- **Bringhe**: Traditional Kapampangan fiesta rice made with glutinous rice, turmeric, coconut cream, chorizo, and boiled eggs.
- **Halo-Halo**: Try the creamy, finely shaved ice version at *Razon's of Guagua* or local heritage stalls.`,
    };
  }

  // 7. Walking Tour / Route Plan
  if (query.includes('tour') || query.includes('walk') || query.includes('itinerary') || query.includes('route') || query.includes('day') || query.includes('plan')) {
    return {
      text: `**Recommended 1-Day San Fernando Heritage Walk**

- **8:30 AM**: Begin at the **Old San Fernando Train Station** and Bataan Death March 102 Marker.
- **10:00 AM**: Stroll through the **Provincial Capitol Grounds** and tree-lined Capitol Boulevard.
- **11:30 AM**: Marvel at the industrial grandeur of the historic **PASUDECO Sugar Mill**.
- **12:30 PM**: Enjoy traditional Kapampangan lunch (*Sisig, Tibok-tibok, Bringhe*) at a local heritage café.
- **2:00 PM**: Tour the **Metropolitan Cathedral of San Fernando** in the historic Poblacion.
- **3:30 PM**: Admire the **Henson-Hizon** and **Lazatin Ancestral Houses** along Consunji Street.
- **5:00 PM**: Conclude at the **Giant Lantern Center** to learn about lantern-making craftsmanship!

*Tip: Use our in-app "Plan Route" feature in the top navigation to customize your stops and get step-by-step directions.*`,
    };
  }

  // 8. Nicolasa Dayrit / Heroes
  if (query.includes('nicolasa') || query.includes('dayrit') || query.includes('hero') || query.includes('bayani') || query.includes('luna')) {
    const site = sites.find(s => s.id.includes('nicolasa') || s.id.includes('dayrit'));
    return {
      text: `**Nicolasa Dayrit-Panlilio (1874–1945)**
One of Pampanga's most revered heroines:

- During the 1899 Philippine-American War, she courageously tended to wounded and dying revolutionary soldiers in San Fernando alongside fellow volunteer nurses.
- She played a pivotal diplomatic role in de-escalating the fierce confrontation between General Antonio Luna and General Tomas Mascardo, pleading on bended knees to avert civil bloodshed among Filipino ranks.
- Her bronze monument stands proudly along MacArthur Highway honoring her patriotic devotion.`,
      matchedSiteId: site?.id
    };
  }

  // 9. Hours, fees, visiting etiquette
  if (query.includes('hours') || query.includes('fee') || query.includes('ticket') || query.includes('open') || query.includes('etiquette') || query.includes('cost')) {
    return {
      text: `**Visitor Guidelines & Access**

- **Entrance Fees**: Most outdoor historical monuments, the Metropolitan Cathedral, and the exterior heritage facades are **completely free** to view. Certain private ancestral museums may request a modest conservation contribution (₱50 - ₱100).
- **Visiting Hours**: Morning hours (8:00 AM – 11:30 AM) and late afternoons (3:30 PM – 5:30 PM) offer the most pleasant walking temperatures and best photography light.
- **Etiquette**: Please dress respectfully when visiting active places of worship such as the Cathedral, and avoid touching fragile wooden carvings or antique glass windows in private ancestral homes.`,
    };
  }

  // Default intelligent response with context from sites
  const topSites = sites.slice(0, 3).map(s => `• **${s.name}** (${s.category}, built ${s.yearBuilt})`).join('\n');
  return {
    text: `**Komusta!** San Fernando is rich with stories across four centuries of history. Here are some of our top heritage landmarks:

${topSites}

You can ask me about any landmark's history, directions, visiting tips, the Giant Lantern Festival, or authentic Kapampangan food. What would you like to explore next?`
  };
}
