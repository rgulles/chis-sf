import type { HeritageSite } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  matchedSiteId?: string;
  suggestedPrompts?: string[];
}

export const INITIAL_CHATBOT_MESSAGES: ChatMessage[] = [{
  id: 'welcome-msg', role: 'assistant', timestamp: 'Just now',
  content: 'Mayap a aldo! I am Katulung. I can help you find information saved in the current heritage catalogue. Ask about a site by name, or browse Explore to choose a place.',
  suggestedPrompts: ['Show heritage sites', 'How do I plan a visit?'],
}];

// Rule-based catalogue lookup only; no static narratives or generated historical facts.
export function getLocalHeritageResponse(userInput: string, sites: HeritageSite[]): { text: string; matchedSiteId?: string } {
  const query = userInput.trim().toLowerCase();
  const active = sites.filter(site => site.status !== 'archived');
  const exact = active.filter(site => query === site.id || (site.name && query.includes(site.name.toLowerCase())));
  const common = new Set(['the', 'san', 'fernando', 'city', 'site', 'heritage', 'historical', 'house']);
  const matches = exact.length ? exact : active.filter(site => {
    const words: string[] = site.name.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const queryWords: string[] = query.match(/[\p{L}\p{N}]+/gu) || [];
    return words.some(word => word.length >= 4 && !common.has(word) && queryWords.includes(word))
      || Boolean(site.category && query.includes(site.category.toLowerCase()));
  });
  if (matches.length === 1) {
    const site = matches[0];
    const information = [site.name, site.category,
      site.yearBuilt && site.yearBuilt !== 'Unknown' ? `Date: ${site.yearBuilt}` : '',
      site.address, site.fullDescription, site.story,
      ...site.timeline.map(item => [item.year, item.title, item.description].filter(Boolean).join(' — ')),
      ...[
        ['Opening Hours', site.visitInfo.openingHours], ['Entrance Fee', site.visitInfo.entranceFee],
        ['Accessibility', site.visitInfo.accessibilityNotes], ['Visit Notes', site.visitInfo.visitNotes],
        ['Contact', site.visitInfo.contactInformation],
      ].filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value}`),
    ].filter(value => value?.trim());
    return { text: information.join('\n\n'), matchedSiteId: site.id };
  }
  if (!active.length) return { text: 'The heritage catalogue is currently unavailable or empty. Please try again later.' };
  if (/\b(plan|route|tour|walk)\b/.test(query)) {
    return { text: 'Save places from Explore, then open Plan Your Visit to review your saved sites. Check each Site Detail for saved visitor information and directions when a location is available.' };
  }
  const choices = matches.length ? matches : active;
  return { text: `Please choose a site by name. I can only answer from the current catalogue:\n\n${choices.slice(0, 7).map(site => site.category ? `${site.name} (${site.category})` : site.name).join('\n')}` };
}
