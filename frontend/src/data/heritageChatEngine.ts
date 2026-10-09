import type { HeritageSite } from '../types';
export interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string; timestamp: string;
  matchedSiteId?: string; choiceSiteIds?: string[]; suggestedPrompts?: string[];
}
export const INITIAL_CHATBOT_MESSAGES: ChatMessage[] = [{
  id: 'welcome-msg', role: 'assistant', timestamp: 'Just now',
  content: 'Welcome to Katulung, your San Fernando Heritage Guide. I answer using the current City Tourism heritage catalogue. Ask about history, addresses, visitor information or directions.',
  suggestedPrompts: ['What heritage sites can I visit?', 'Show churches', 'Plan my visit'],
}];
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const aliases: [RegExp, string[]][] = [
  [/cathedral/i, ['cathedral', 'metropolitan cathedral', 'san fernando cathedral']],
  [/san fernando train station/i, ['train station', 'railway station']],
  [/lazatin/i, ['lazatin house', 'lazatin residence', 'lazatin']],
  [/death march marker/i, ['death march marker']],
  [/augusto.*hizon/i, ['augusto paras hizon house', 'augusto p hizon house']],
  [/dayrit.*galang/i, ['dayrit galang house', 'dayrit galang residence']],
  [/datu.*bundalian/i, ['datu bundalian house', 'datu bundalian residence']],
  [/dayrit.*cuyugan/i, ['dayrit cuyugan house', 'dayrit cuyugan residence']],
  [/giant lantern.*(center|office)/i, ['giant lantern center', 'giant lantern and tourist information office']],
];
const ignored = new Set(['house', 'city', 'san', 'fernando', 'heritage', 'the', 'site', 'residence', 'of', 'and', 'pampanga', 'about', 'history', 'where', 'what', 'is', 'tell', 'me', 'show', 'visit', 'can', 'how', 'get', 'to', 'does', 'this', 'open', 'time', 'directions', 'located', 'location', 'please', 'hours']);
export interface HeritageResponse { text: string; matchedSiteId?: string; choiceSiteIds?: string[] }
export function getLocalHeritageResponse(userInput: string, sites: HeritageSite[], contextSiteId?: string): HeritageResponse {
  const query = normalize(userInput), active = sites.filter(site => site.status !== 'archived');
  if (!active.length) return { text: 'The heritage catalogue is currently unavailable or empty. Please try again later.' };
  const category = /\b(church|churches)\b/.test(query) ? 'Churches' : /\b(museum|museums)\b/.test(query) ? 'Museums' : /\b(monument|monuments)\b/.test(query) ? 'Monuments' : /\b(building|buildings)\b/.test(query) ? 'Historical Buildings' : /\b(cultural)\b/.test(query) ? 'Cultural Sites' : '';
  if (category && (query === normalize(category) || /^(show|list|browse)\s+(church(?:es)?|museums?|monuments?|(?:historical )?buildings?|cultural sites?)(?: please)?$/.test(query))) {
    const choices = active.filter(site => site.category === category).slice(0, 5);
    return { text: choices.length ? 'Here are heritage sites in the current catalogue:\n\n' + choices.map(site => site.name).join('\n') : 'No matching sites are listed in the current catalogue.', choiceSiteIds: choices.map(site => site.id) };
  }
  const tokens = query.split(' ').filter(word => word.length > 2 && !ignored.has(word));
  const namesFor = (site: HeritageSite) => [normalize(site.name), ...aliases.filter(([pattern]) => pattern.test(site.name)).flatMap(([, values]) => values)];
  const exact = active.filter(site => query === site.id || namesFor(site).some(name => (` ${query} `).includes(` ${normalize(name)} `)));
  let matches = exact.length ? exact : tokens.length ? active.filter(site => {
    const words = normalize(site.name).split(' ').filter(word => !ignored.has(word));
    return tokens.every(token => words.includes(token));
  }) : [];
  if (!matches.length && contextSiteId && /\b(this site|this place|here)\b/.test(query)) matches = active.filter(site => site.id === contextSiteId);
  if (matches.length > 1) return { text: 'Several catalogue records match. Please choose a heritage site:', choiceSiteIds: matches.slice(0, 5).map(site => site.id) };
  if (matches.length === 1) {
    const site = matches[0];
    const answer = (text: string): HeritageResponse => ({ text, matchedSiteId: site.id });
    if (/\b(hours|opening|open|close|time)\b/.test(query)) return answer(site.visitInfo?.openingHours?.trim() || 'Opening hours are not currently listed in the City Tourism heritage record.');
    if (/\b(fee|fees|cost|entrance|price)\b/.test(query)) return answer(site.visitInfo?.entranceFee?.trim() || 'Entrance fees are not currently listed in the City Tourism heritage record.');
    if (/\b(where|address|location|located)\b/.test(query)) return answer(site.address?.trim() ? `${site.name} is located at ${site.address}.` : 'The address is not currently listed in the City Tourism heritage record.');
    if (/\b(directions|route|drive|travel)\b|how do i get/.test(query)) return answer(`Use Directions to preview a driving route to ${site.name} from your current location.`);
    if (/\b(history|historical|story)\b/.test(query)) return answer(site.story?.trim() && site.story !== 'No history recorded.' ? site.story : site.fullDescription?.trim() || 'History is not currently listed in the City Tourism heritage record.');
    if (/\b(tell|about|describe|information)\b/.test(query) || namesFor(site).includes(query) || query === site.id) return answer(site.fullDescription?.trim() || site.story?.trim() || 'Details are not currently listed in the City Tourism heritage record.');
    return answer('I can help with the saved history, address, opening hours, entrance fee and directions for this site. Which would you like?');
  }
  if (/\b(plan|itinerary)\b/.test(query)) return { text: 'Save places from Explore, then open Plan Your Visit to arrange your stops. Check saved visitor information and use Directions for a driving route preview.' };
  if (category || /\b(sites|catalogue|catalog|recommend|downtown)\b/.test(query)) {
    // Downtown is address-backed; do not infer proximity from invented districts or travel times.
    const choices = active.filter(site => (!category || site.category === category) && (!query.includes('downtown') || /sto\.? rosario|santo rosario|poblacion|consunji/i.test(site.address)));
    return { text: choices.length ? `Here are heritage sites in the current catalogue${query.includes('downtown') ? ' with addresses mentioning Sto. Rosario, Poblacion or Consunji' : ''}:\n\n${choices.slice(0, 5).map(site => site.name).join('\n')}` : 'No matching sites are listed in the current catalogue.', choiceSiteIds: choices.slice(0, 5).map(site => site.id) };
  }
  return { text: 'I could not find that information in the current heritage catalogue. Ask about a site by name, or ask to show churches, museums or heritage sites.' };
}
