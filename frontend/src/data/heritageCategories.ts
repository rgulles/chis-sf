export const HERITAGE_CATEGORIES = ['All', 'Historical Buildings', 'Churches', 'Museums', 'Monuments', 'Cultural Sites'] as const;

// Visitor groups are separate from the values accepted by Admin/API validation.
export const HERITAGE_FILTER_CATEGORIES = [
  'All',
  'Landmarks and Monuments',
  'Ancestral Houses',
  'Government Buildings',
  'Religious Sites',
  'Museums and Culture',
  'Educational Institutions',
  'Parks and Plazas',
  'Bridges and Infrastructure',
  'Commercial Heritage',
  'Tourism and Activities',
] as const;

export type HeritageFilterCategory = typeof HERITAGE_FILTER_CATEGORIES[number];
type Group = Exclude<HeritageFilterCategory, 'All'>;

// Explicit aliases inspected in the live catalogue/database. Multiple groups are
// allowed only when the stored category explicitly describes both uses.
export const HERITAGE_CATEGORY_ALIASES: Readonly<Record<string, readonly Group[]>> = {
  Churches: ['Religious Sites'],
  Museums: ['Museums and Culture'],
  Monuments: ['Landmarks and Monuments'],
  'Cultural Sites': ['Museums and Culture'],
  'Government Building / Historical Memorial Park': ['Government Buildings', 'Parks and Plazas', 'Landmarks and Monuments'],
  'Government Building / Historical Landmark': ['Government Buildings', 'Landmarks and Monuments'],
  'Public Park / Historical Monument': ['Parks and Plazas', 'Landmarks and Monuments'],
  'Institutional Heritage / Former Jail and Courthouse': ['Government Buildings'],
  'Cultural Center / Kapampangan Heritage': ['Museums and Culture'],
  'World War II Memorial / Historical Marker': ['Landmarks and Monuments'],
  'Railway Heritage / National Historical Landmark': ['Bridges and Infrastructure', 'Landmarks and Monuments'],
  'Ancestral House / Architectural Heritage': ['Ancestral Houses'],
  'Ancestral House / Political Heritage': ['Ancestral Houses'],
  'Ancestral House / Architectural and World War II Heritage': ['Ancestral Houses'],
  'Ancestral House / Revolutionary and Military Heritage': ['Ancestral Houses'],
  'Ancestral House / Political and Revolutionary Heritage': ['Ancestral Houses'],
  'Ancestral House / Literary and World War II Heritage': ['Ancestral Houses'],
  'Ancestral House / Spanish Colonial Heritage': ['Ancestral Houses'],
  'Ancestral House / World War II Heritage': ['Ancestral Houses'],
  'Historic Building / Commercial and Social Heritage': ['Commercial Heritage'],
  'Religious Heritage / Important Cultural Property': ['Religious Sites'],
  'Government Heritage / Historic Municipal Building': ['Government Buildings'],
  'Commercial Heritage / Public Market': ['Commercial Heritage'],
  'Engineering Heritage / Historic Bridge': ['Bridges and Infrastructure'],
  'Industrial Heritage / Engineering Landmark': ['Bridges and Infrastructure', 'Landmarks and Monuments'],
  'Educational Heritage / Historic School Building': ['Educational Institutions'],
  'Educational Heritage / Gabaldon School Building': ['Educational Institutions'],
  'Religious Heritage / Ecclesiastical Building': ['Religious Sites'],
  'Public Monument / Cultural Heritage': ['Landmarks and Monuments', 'Museums and Culture'],
  'Religious Heritage / Educational Institution': ['Religious Sites', 'Educational Institutions'],
  'Religious Heritage / Historic Church Complex': ['Religious Sites'],
  'Cultural Center / Lantern-Making and Christmas Heritage': ['Museums and Culture'],
  'Intangible Cultural Heritage / Traditional Transportation': ['Museums and Culture'],
  'Intangible Cultural Heritage / Traditional Craftsmanship': ['Museums and Culture'],
};

export function heritageCategoryGroups(category: string | null | undefined): readonly Group[] {
  const value = category?.trim() || '';
  if (HERITAGE_FILTER_CATEGORIES.some(group => group !== 'All' && group === value)) return [value as Group];
  return Object.hasOwn(HERITAGE_CATEGORY_ALIASES, value) ? HERITAGE_CATEGORY_ALIASES[value] : [];
}

export function heritageFilterCategory(category: string): HeritageFilterCategory {
  return heritageCategoryGroups(category)[0] || 'All';
}

export function matchesHeritageCategory(category: string | null | undefined, filter: HeritageFilterCategory): boolean {
  return filter === 'All' || heritageCategoryGroups(category).includes(filter);
}
