import type { Amenity, Bounds, LatLon, PreferenceFilter, ScoredCell } from './domain';

const EARTH_RADIUS_M = 6_371_000;

export type AmenityIndex = Map<string, Amenity[]>;

export function distanceMeters(a: LatLon, b: LatLon): number {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const deltaPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLambda = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distanceToBoundsMeters(point: LatLon, bounds: Bounds): number {
  if (point.lat >= bounds.south && point.lat <= bounds.north && point.lon >= bounds.west && point.lon <= bounds.east) {
    return 0;
  }
  return distanceMeters(point, {
    lat: clamp(point.lat, bounds.south, bounds.north),
    lon: clamp(point.lon, bounds.west, bounds.east),
  });
}

export function distanceToAmenityMeters(point: LatLon, amenity: Amenity): number {
  return amenity.bounds ? distanceToBoundsMeters(point, amenity.bounds) : distanceMeters(point, { lat: amenity.lat, lon: amenity.lon });
}

export function buildAmenityIndex(amenities: Amenity[]): AmenityIndex {
  const index: AmenityIndex = new Map();
  for (const amenity of amenities) {
    const bucket = index.get(amenity.categoryId);
    if (bucket) bucket.push(amenity);
    else index.set(amenity.categoryId, [amenity]);
  }
  return index;
}

export function nearestAmenity(point: LatLon, amenities: Amenity[]): { distance: number; amenity?: Amenity } {
  let best = Number.POSITIVE_INFINITY;
  let bestAmenity: Amenity | undefined;
  for (const amenity of amenities) {
    const d = distanceToAmenityMeters(point, amenity);
    if (d < best) {
      best = d;
      bestAmenity = amenity;
      if (best === 0) break;
    }
  }
  return { distance: best, amenity: bestAmenity };
}

export function contributionForDistance(distance: number | null, filter: PreferenceFilter): number {
  if (distance === null || !Number.isFinite(distance)) {
    return filter.mode === 'away' ? 100 : 0;
  }
  const clamped = Math.max(0, Math.min(1, distance / filter.radiusMeters));
  if (filter.mode === 'near') {
    return Math.round((1 - clamped) * 100);
  }
  return Math.round(clamped * 100);
}

export function scorePointWithIndex(point: LatLon, filters: PreferenceFilter[], amenityIndex: AmenityIndex): { score: number; evidence: ScoredCell['evidence'] } {
  const active = filters.filter((filter) => filter.enabled && filter.weight > 0);
  let weighted = 0;
  let totalWeight = 0;
  const evidence: ScoredCell['evidence'] = {};

  for (const filter of active) {
    const categoryAmenities = amenityIndex.get(filter.categoryId) ?? [];
    const nearest = categoryAmenities.length > 0 ? nearestAmenity(point, categoryAmenities) : { distance: Number.POSITIVE_INFINITY };
    const nearestDistance = Number.isFinite(nearest.distance) ? nearest.distance : null;
    const contribution = contributionForDistance(nearestDistance, filter);
    weighted += contribution * filter.weight;
    totalWeight += filter.weight;
    evidence[filter.categoryId] = {
      nearestMeters: nearestDistance === null ? null : Math.round(nearestDistance),
      contribution,
      amenityName: nearest.amenity?.name,
    };
  }

  return { score: totalWeight === 0 ? 0 : Math.round(weighted / totalWeight), evidence };
}

export function scorePoint(point: LatLon, filters: PreferenceFilter[], amenities: Amenity[]): { score: number; evidence: ScoredCell['evidence'] } {
  return scorePointWithIndex(point, filters, buildAmenityIndex(amenities));
}

export function makeGrid(bounds: Bounds, steps = 28): Array<{ id: string; center: LatLon; bounds: Bounds }> {
  const latStep = (bounds.north - bounds.south) / steps;
  const lonStep = (bounds.east - bounds.west) / steps;
  const cells: Array<{ id: string; center: LatLon; bounds: Bounds }> = [];

  for (let y = 0; y < steps; y += 1) {
    for (let x = 0; x < steps; x += 1) {
      const south = bounds.south + y * latStep;
      const north = south + latStep;
      const west = bounds.west + x * lonStep;
      const east = west + lonStep;
      cells.push({
        id: `${x}-${y}`,
        center: { lat: (south + north) / 2, lon: (west + east) / 2 },
        bounds: { south, west, north, east },
      });
    }
  }

  return cells;
}

export function scoreGrid(bounds: Bounds, filters: PreferenceFilter[], amenities: Amenity[], steps = 28): ScoredCell[] {
  const amenityIndex = buildAmenityIndex(amenities);
  return makeGrid(bounds, steps)
    .map((cell) => {
      const { score, evidence } = scorePointWithIndex(cell.center, filters, amenityIndex);
      return { ...cell, score, evidence };
    })
    .sort((a, b) => b.score - a.score);
}

export function scoreToColor(score: number): string {
  const hue = Math.round((score / 100) * 125);
  return `hsl(${hue} 80% 45%)`;
}
