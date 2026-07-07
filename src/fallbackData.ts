import type { Amenity } from './domain';

export const AMSTERDAM_FALLBACK_AMENITIES: Amenity[] = [
  { id: 'park-vondelpark', categoryId: 'park', name: 'Vondelpark', lat: 52.3579, lon: 4.8686, tags: { source: 'fallback' } },
  { id: 'park-westerpark', categoryId: 'park', name: 'Westerpark', lat: 52.3868, lon: 4.8744, tags: { source: 'fallback' } },
  { id: 'park-oosterpark', categoryId: 'park', name: 'Oosterpark', lat: 52.3601, lon: 4.9207, tags: { source: 'fallback' } },
  { id: 'park-sarphati', categoryId: 'park', name: 'Sarphatipark', lat: 52.3547, lon: 4.8959, tags: { source: 'fallback' } },
  { id: 'park-rembrandt', categoryId: 'park', name: 'Rembrandtpark', lat: 52.3625, lon: 4.8427, tags: { source: 'fallback' } },
  { id: 'supermarket-ah-museumplein', categoryId: 'supermarket', name: 'Albert Heijn Museumplein', lat: 52.3576, lon: 4.8811, tags: { source: 'fallback' } },
  { id: 'supermarket-jumbo-westerstraat', categoryId: 'supermarket', name: 'Jumbo Westerstraat', lat: 52.3802, lon: 4.8847, tags: { source: 'fallback' } },
  { id: 'supermarket-ah-weesperplein', categoryId: 'supermarket', name: 'Albert Heijn Weesperplein', lat: 52.3613, lon: 4.9071, tags: { source: 'fallback' } },
  { id: 'supermarket-lidl-baarsjes', categoryId: 'supermarket', name: 'Lidl Baarsjes', lat: 52.3632, lon: 4.8544, tags: { source: 'fallback' } },
  { id: 'transit-centraal', categoryId: 'transit', name: 'Amsterdam Centraal', lat: 52.3791, lon: 4.9003, tags: { source: 'fallback' } },
  { id: 'transit-zuid', categoryId: 'transit', name: 'Amsterdam Zuid', lat: 52.3389, lon: 4.8730, tags: { source: 'fallback' } },
  { id: 'transit-lelylaan', categoryId: 'transit', name: 'Amsterdam Lelylaan', lat: 52.3579, lon: 4.8336, tags: { source: 'fallback' } },
  { id: 'transit-weesperplein', categoryId: 'transit', name: 'Weesperplein Metro', lat: 52.3612, lon: 4.9072, tags: { source: 'fallback' } },
  { id: 'healthcare-olvg-west', categoryId: 'healthcare', name: 'OLVG West', lat: 52.3626, lon: 4.8370, tags: { source: 'fallback' } },
  { id: 'healthcare-olvg-east', categoryId: 'healthcare', name: 'OLVG East', lat: 52.3598, lon: 4.9178, tags: { source: 'fallback' } },
  { id: 'healthcare-umc', categoryId: 'healthcare', name: 'Amsterdam UMC', lat: 52.2948, lon: 4.9579, tags: { source: 'fallback' } },
  { id: 'quiet-leidseplein', categoryId: 'quiet', name: 'Leidseplein nightlife area', lat: 52.3640, lon: 4.8832, tags: { source: 'fallback' } },
  { id: 'quiet-rembrandtplein', categoryId: 'quiet', name: 'Rembrandtplein nightlife area', lat: 52.3667, lon: 4.8969, tags: { source: 'fallback' } },
  { id: 'quiet-red-light', categoryId: 'quiet', name: 'De Wallen nightlife area', lat: 52.3725, lon: 4.8968, tags: { source: 'fallback' } },
];
