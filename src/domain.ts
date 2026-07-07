export type PreferenceMode = 'near' | 'away';

export type AmenityCategory = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  query: string;
  color: string;
};

export type PreferenceFilter = {
  id: string;
  categoryId: string;
  enabled: boolean;
  radiusMeters: number;
  weight: number;
  mode: PreferenceMode;
};

export type Amenity = {
  id: string;
  categoryId: string;
  name: string;
  lat: number;
  lon: number;
  /** Bounding box for area-like OSM ways/relations. Lets parks count by area, not just centre point. */
  bounds?: Bounds;
  tags: Record<string, string>;
};

export type LatLon = { lat: number; lon: number };

export type Bounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type ScoredCell = {
  id: string;
  center: LatLon;
  bounds: Bounds;
  score: number;
  evidence: Record<string, { nearestMeters: number | null; contribution: number; amenityName?: string }>;
};

export const AMENITY_CATEGORIES: AmenityCategory[] = [
  {
    id: 'park',
    label: 'Parks / green space',
    emoji: '🌳',
    description: 'Parks, gardens, playgrounds and recreation grounds.',
    query: '["leisure"~"park|garden|playground|recreation_ground"]',
    color: '#2ca25f',
  },
  {
    id: 'supermarket',
    label: 'Supermarkets',
    emoji: '🛒',
    description: 'Grocery stores and supermarkets.',
    query: '["shop"~"supermarket|greengrocer|convenience"]',
    color: '#fd8d3c',
  },
  {
    id: 'transit',
    label: 'Public transport',
    emoji: '🚋',
    description: 'Stations, tram stops, bus stops and transit platforms.',
    query: '["public_transport"~"station|stop_position|platform"]|["railway"~"station|tram_stop|subway_entrance"]|["highway"="bus_stop"]',
    color: '#3182bd',
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    emoji: '🏥',
    description: 'Hospitals, clinics, doctors, dentists and pharmacies.',
    query: '["amenity"~"hospital|clinic|doctors|dentist|pharmacy"]',
    color: '#de2d26',
  },
  {
    id: 'school',
    label: 'Schools / childcare',
    emoji: '🎒',
    description: 'Schools, kindergartens, childcare and universities.',
    query: '["amenity"~"school|kindergarten|childcare|university|college"]',
    color: '#756bb1',
  },
  {
    id: 'cafe',
    label: 'Cafes / restaurants',
    emoji: '☕',
    description: 'Cafes, restaurants and bars for neighbourhood life.',
    query: '["amenity"~"cafe|restaurant|bar|pub"]',
    color: '#8c510a',
  },
  {
    id: 'sports',
    label: 'Gyms / sports',
    emoji: '🏋️',
    description: 'Fitness centres, sports centres, swimming pools and pitches.',
    query: '["leisure"~"fitness_centre|sports_centre|swimming_pool|pitch"]',
    color: '#41ab5d',
  },
  {
    id: 'quiet',
    label: 'Avoid nightlife',
    emoji: '🌙',
    description: 'Bars, pubs and nightclubs: useful as an avoid filter.',
    query: '["amenity"~"bar|pub|nightclub"]|["club"="nightclub"]',
    color: '#54278f',
  },
];

export const DEFAULT_FILTERS: PreferenceFilter[] = [
  { id: 'f-park', categoryId: 'park', enabled: true, radiusMeters: 300, weight: 5, mode: 'near' },
  { id: 'f-supermarket', categoryId: 'supermarket', enabled: true, radiusMeters: 450, weight: 5, mode: 'near' },
  { id: 'f-transit', categoryId: 'transit', enabled: true, radiusMeters: 350, weight: 4, mode: 'near' },
  { id: 'f-healthcare', categoryId: 'healthcare', enabled: true, radiusMeters: 1000, weight: 2, mode: 'near' },
  { id: 'f-quiet', categoryId: 'quiet', enabled: false, radiusMeters: 200, weight: 3, mode: 'away' },
];
