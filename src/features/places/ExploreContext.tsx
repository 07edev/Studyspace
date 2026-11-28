import React, { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { GeoPoint, PlaceCategory, QuietLevel, StudySuitability } from '../../shared/contracts/places';
import type { PlaceSort } from './placeLabels';

export type SelectedLocation = {
  provinceCode?: string;
  provinceName?: string;
  wardCode?: string;
  wardName?: string;
  coords?: GeoPoint;
};

export type ExploreFilters = {
  q: string;
  category?: PlaceCategory;
  amenities: string[];
  quietLevel?: QuietLevel;
  studySuitability?: StudySuitability;
  openNow: boolean;
  minPrice?: number;
  maxPrice?: number;
  attributeFilters: Record<string, string | number | boolean | string[]>;
  sort: PlaceSort;
};

const DEFAULT_FILTERS: ExploreFilters = {
  q: '',
  amenities: [],
  openNow: false,
  attributeFilters: {},
  sort: 'RATING',
};

type ExploreContextValue = {
  location: SelectedLocation;
  setLocation: (next: SelectedLocation) => void;
  filters: ExploreFilters;
  patchFilters: (patch: Partial<ExploreFilters>) => void;
  resetFilters: () => void;
  activeFilterCount: number;
};

const ExploreContext = createContext<ExploreContextValue | null>(null);

export function ExploreProvider({ children }: PropsWithChildren) {
  const [location, setLocation] = useState<SelectedLocation>({});
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);

  const patchFilters = useCallback((patch: Partial<ExploreFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(prev => ({ ...DEFAULT_FILTERS, q: prev.q, sort: prev.sort }));
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) {
      count += 1;
    }
    if (filters.amenities.length > 0) {
      count += 1;
    }
    if (filters.quietLevel) {
      count += 1;
    }
    if (filters.studySuitability) {
      count += 1;
    }
    if (filters.openNow) {
      count += 1;
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      count += 1;
    }
    if (Object.keys(filters.attributeFilters).length > 0) {
      count += 1;
    }
    return count;
  }, [filters]);

  const value = useMemo(
    () => ({ location, setLocation, filters, patchFilters, resetFilters, activeFilterCount }),
    [location, filters, patchFilters, resetFilters, activeFilterCount],
  );

  return <ExploreContext.Provider value={value}>{children}</ExploreContext.Provider>;
}

export function useExplore() {
  const value = useContext(ExploreContext);
  if (!value) {
    throw new Error('useExplore must be used inside ExploreProvider');
  }
  return value;
}
