// Compatibility export only. Prototype content is quarantined in backend/database/data/legacy_heritage_prototype_archive.json.
// The live catalogue and itinerary stops must come from Laravel; never supply a static fallback.
import type { HeritageSite } from '../types';
export const INITIAL_HERITAGE_SITES: HeritageSite[] = [];
export { HERITAGE_CATEGORIES } from './heritageCategories';
