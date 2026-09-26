import React from 'react';
import type { HeritageSite, CategoryType } from '../types';
import { MapView } from './MapView';

interface ExploreViewProps {
  sites: HeritageSite[];
  onSelectSite: (site: HeritageSite) => void;
  savedSiteIds: string[];
  onToggleSaveSite: (siteId: string) => void;
  selectedCategory: CategoryType | 'All';
  onCategoryChange: (category: CategoryType | 'All') => void;
  onPlanRoute?: () => void;
}

/**
 * ExploreView is unified with MapView.
 * It renders the Explore San Fernando's Heritage directory list by default with instant toggle to Map.
 */
export const ExploreView: React.FC<ExploreViewProps> = ({
  sites,
  onSelectSite,
  savedSiteIds,
  onToggleSaveSite,
  selectedCategory,
  onCategoryChange,
  onPlanRoute = () => {}
}) => {
  return (
    <MapView
      sites={sites}
      onSelectSite={onSelectSite}
      onPlanRoute={onPlanRoute}
      savedSiteIds={savedSiteIds}
      onToggleSaveSite={onToggleSaveSite}
      initialViewMode="list"
      selectedCategory={selectedCategory}
      onCategoryChange={onCategoryChange}
    />
  );
};
