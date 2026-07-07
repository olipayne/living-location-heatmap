import { AMENITY_CATEGORIES, type Amenity, type AmenityCategory, type Bounds } from './domain';

export const AMSTERDAM_BOUNDS: Bounds = {
  south: 52.278,
  west: 4.728,
  north: 52.431,
  east: 5.079,
};

export const AMSTERDAM_CENTER = { lat: 52.3676, lon: 4.9041 };

export function bboxToOverpass(bounds: Bounds): string {
  return `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

function splitAlternativeSelectors(query: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];
    if (char === '[') depth += 1;
    if (char === ']') depth = Math.max(0, depth - 1);
    if (char === '|' && depth === 0) {
      selectors.push(query.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(query.slice(start));
  return selectors.filter(Boolean);
}

function queryForCategory(category: AmenityCategory, bounds: Bounds): string {
  const bbox = bboxToOverpass(bounds);
  return splitAlternativeSelectors(category.query)
    .flatMap((selector) => [`node${selector}(${bbox});`, `way${selector}(${bbox});`, `relation${selector}(${bbox});`])
    .join('\n');
}

export function buildOverpassQuery(categoryIds: string[], bounds: Bounds): string {
  const categories = AMENITY_CATEGORIES.filter((category) => categoryIds.includes(category.id));
  const bodies = categories.map((category) => queryForCategory(category, bounds)).join('\n');
  return `[out:json][timeout:25];\n(\n${bodies}\n);\nout tags center bb;`;
}

type OverpassElement = {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: Record<string, string>;
};

function categoryMatches(tags: Record<string, string>, category: AmenityCategory): boolean {
  switch (category.id) {
    case 'park':
      return ['park', 'garden', 'playground', 'recreation_ground'].includes(tags.leisure ?? '');
    case 'supermarket':
      return ['supermarket', 'greengrocer', 'convenience'].includes(tags.shop ?? '');
    case 'transit':
      return Boolean(tags.public_transport || ['station', 'tram_stop', 'subway_entrance'].includes(tags.railway ?? '') || tags.highway === 'bus_stop');
    case 'healthcare':
      return ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy'].includes(tags.amenity ?? '');
    case 'school':
      return ['school', 'kindergarten', 'childcare', 'university', 'college'].includes(tags.amenity ?? '');
    case 'cafe':
      return ['cafe', 'restaurant', 'bar', 'pub'].includes(tags.amenity ?? '');
    case 'sports':
      return ['fitness_centre', 'sports_centre', 'swimming_pool', 'pitch'].includes(tags.leisure ?? '');
    case 'quiet':
      return ['bar', 'pub', 'nightclub'].includes(tags.amenity ?? '') || tags.club === 'nightclub';
    default:
      return false;
  }
}

export function parseOverpassAmenities(elements: OverpassElement[], selectedCategoryIds: string[]): Amenity[] {
  const selected = AMENITY_CATEGORIES.filter((category) => selectedCategoryIds.includes(category.id));
  const amenities: Amenity[] = [];
  const seen = new Set<string>();

  for (const element of elements) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined || !element.tags) continue;

    for (const category of selected) {
      if (!categoryMatches(element.tags, category)) continue;
      const id = `${category.id}-${element.type}-${element.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const bounds = element.bounds
        ? { south: element.bounds.minlat, west: element.bounds.minlon, north: element.bounds.maxlat, east: element.bounds.maxlon }
        : undefined;
      amenities.push({
        id,
        categoryId: category.id,
        name: element.tags.name || `${category.label} (${element.type} ${element.id})`,
        lat,
        lon,
        bounds,
        tags: element.tags,
      });
    }
  }
  return amenities;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 45_000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  init.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchAmenities(bounds: Bounds, categoryIds: string[], signal?: AbortSignal): Promise<Amenity[]> {
  const query = buildOverpassQuery(categoryIds, bounds);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastError: Error | undefined;

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', accept: 'application/json' },
        signal,
      });
      if (!response.ok) {
        throw new Error(`${endpoint} returned ${response.status}`);
      }
      const data = (await response.json()) as { elements: OverpassElement[] };
      const amenities = parseOverpassAmenities(data.elements, categoryIds);
      if (amenities.length === 0 && data.elements.length > 0) {
        throw new Error(`${endpoint} returned ${data.elements.length} elements but none matched selected categories`);
      }
      return amenities;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('All Overpass endpoints failed');
}

export type GeocodeResult = { label: string; lat: number; lon: number; bounds: Bounds };

export async function geocodePlace(query: string): Promise<GeocodeResult> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
  const response = await fetchWithTimeout(url.toString(), { headers: { accept: 'application/json' } }, 10_000);
  if (!response.ok) throw new Error(`Nominatim failed with ${response.status}`);
  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string; boundingbox?: [string, string, string, string] }>;
  if (!data[0]) throw new Error(`No location found for “${query}”`);
  const item = data[0];
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  const [southRaw, northRaw, westRaw, eastRaw] = item.boundingbox ?? [String(lat - 0.03), String(lat + 0.03), String(lon - 0.05), String(lon + 0.05)];
  return {
    label: item.display_name,
    lat,
    lon,
    bounds: {
      south: Number(southRaw),
      north: Number(northRaw),
      west: Number(westRaw),
      east: Number(eastRaw),
    },
  };
}
