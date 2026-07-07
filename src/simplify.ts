import type { Amenity, Bounds } from './domain';

export type SimplifiedAmenities = {
  all: Amenity[];
  visible: Amenity[];
  hiddenCount: number;
};

const MARKER_LIMIT_BY_CATEGORY: Record<string, number> = {
  park: 450,
  supermarket: 700,
  transit: 550,
  healthcare: 450,
  school: 450,
  cafe: 500,
  sports: 450,
  quiet: 350,
};

function inBounds(amenity: Amenity, bounds: Bounds): boolean {
  const amenityBounds = amenity.bounds ?? { south: amenity.lat, west: amenity.lon, north: amenity.lat, east: amenity.lon };
  return amenityBounds.north >= bounds.south && amenityBounds.south <= bounds.north && amenityBounds.east >= bounds.west && amenityBounds.west <= bounds.east;
}

function areaScore(amenity: Amenity): number {
  if (!amenity.bounds) return 0;
  return Math.abs((amenity.bounds.north - amenity.bounds.south) * (amenity.bounds.east - amenity.bounds.west));
}

/**
 * Keep all amenities for scoring, but drastically reduce marker count.
 * Prefer area-like features (parks/large facilities) and named POIs, then sample
 * the remainder evenly so the UI stays responsive with 10k+ Overpass elements.
 */
export function simplifyAmenitiesForDisplay(amenities: Amenity[], viewportBounds: Bounds): SimplifiedAmenities {
  const byCategory = new Map<string, Amenity[]>();
  for (const amenity of amenities) {
    if (!inBounds(amenity, viewportBounds)) continue;
    const bucket = byCategory.get(amenity.categoryId);
    if (bucket) bucket.push(amenity);
    else byCategory.set(amenity.categoryId, [amenity]);
  }

  const visible: Amenity[] = [];
  let hiddenCount = 0;

  for (const [categoryId, categoryAmenities] of byCategory) {
    const limit = MARKER_LIMIT_BY_CATEGORY[categoryId] ?? 400;
    if (categoryAmenities.length <= limit) {
      visible.push(...categoryAmenities);
      continue;
    }

    const ranked = [...categoryAmenities].sort((a, b) => {
      const areaDelta = areaScore(b) - areaScore(a);
      if (areaDelta !== 0) return areaDelta;
      const nameDelta = Number(Boolean(b.tags.name)) - Number(Boolean(a.tags.name));
      if (nameDelta !== 0) return nameDelta;
      return a.id.localeCompare(b.id);
    });
    const important = ranked.slice(0, Math.ceil(limit * 0.65));
    const rest = ranked.slice(important.length);
    const sampleCount = limit - important.length;
    const step = Math.max(1, Math.floor(rest.length / sampleCount));
    const sampled = rest.filter((_, index) => index % step === 0).slice(0, sampleCount);
    visible.push(...important, ...sampled);
    hiddenCount += categoryAmenities.length - important.length - sampled.length;
  }

  return { all: amenities, visible, hiddenCount };
}
