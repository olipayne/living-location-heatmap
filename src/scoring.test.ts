import { describe, expect, it } from 'vitest';
import type { Amenity, PreferenceFilter } from './domain';
import { buildOverpassQuery, parseOverpassAmenities } from './osm';
import { contributionForDistance, distanceMeters, makeGrid, scoreGrid, scorePoint, scoreToColor } from './scoring';

const parkFilter: PreferenceFilter = { id: 'park', categoryId: 'park', enabled: true, mode: 'near', radiusMeters: 500, weight: 5 };
const quietFilter: PreferenceFilter = { id: 'quiet', categoryId: 'quiet', enabled: true, mode: 'away', radiusMeters: 200, weight: 5 };

const amenities: Amenity[] = [
  { id: 'vondelpark', categoryId: 'park', name: 'Vondelpark', lat: 52.3579, lon: 4.8686, tags: {} },
  { id: 'bar', categoryId: 'quiet', name: 'Noisy bar', lat: 52.358, lon: 4.8687, tags: {} },
];

describe('scoring', () => {
  it('computes plausible Amsterdam distances', () => {
    const d = distanceMeters({ lat: 52.3676, lon: 4.9041 }, { lat: 52.3791, lon: 4.9003 });
    expect(d).toBeGreaterThan(1_200);
    expect(d).toBeLessThan(1_600);
  });

  it('scores near and away preferences in opposite directions', () => {
    expect(contributionForDistance(0, parkFilter)).toBe(100);
    expect(contributionForDistance(500, parkFilter)).toBe(0);
    expect(contributionForDistance(0, quietFilter)).toBe(0);
    expect(contributionForDistance(200, quietFilter)).toBe(100);
  });

  it('combines weighted filters and records evidence', () => {
    const result = scorePoint({ lat: 52.3579, lon: 4.8686 }, [parkFilter, quietFilter], amenities);
    expect(result.score).toBeGreaterThan(40);
    expect(result.evidence.park.nearestMeters).toBeLessThan(5);
    expect(result.evidence.quiet.contribution).toBeLessThan(10);
  });

  it('creates sorted heatmap cells', () => {
    const cells = scoreGrid({ south: 52.35, west: 4.86, north: 52.37, east: 4.89 }, [parkFilter], amenities, 4);
    expect(cells).toHaveLength(16);
    expect(cells[0].score).toBeGreaterThanOrEqual(cells.at(-1)!.score);
  });

  it('generates stable grid geometry and colour scale', () => {
    const grid = makeGrid({ south: 0, west: 0, north: 1, east: 1 }, 2);
    expect(grid[0].center).toEqual({ lat: 0.25, lon: 0.25 });
    expect(scoreToColor(100)).toContain('hsl(125');
  });
});

describe('osm parsing', () => {
  it('builds an Overpass query for selected categories', () => {
    const query = buildOverpassQuery(['park', 'supermarket'], { south: 1, west: 2, north: 3, east: 4 });
    expect(query).toContain('[out:json]');
    expect(query).toContain('node["leisure"');
    expect(query).toContain('way["shop"');
    expect(query).toContain('(1,2,3,4)');
  });

  it('does not split regex alternation pipes when building Overpass queries', () => {
    const query = buildOverpassQuery(['transit'], { south: 1, west: 2, north: 3, east: 4 });
    expect(query).toContain('node["public_transport"~"station|stop_position|platform"]');
    expect(query).toContain('node["railway"~"station|tram_stop|subway_entrance"]');
    expect(query).toContain('node["highway"="bus_stop"]');
  });

  it('normalises Overpass nodes and way centres into amenities', () => {
    const parsed = parseOverpassAmenities([
      { id: 1, type: 'node', lat: 52, lon: 4, tags: { leisure: 'park', name: 'Tiny Park' } },
      { id: 2, type: 'way', center: { lat: 52.1, lon: 4.1 }, tags: { shop: 'supermarket', name: 'Grocery' } },
      { id: 3, type: 'node', lat: 52.2, lon: 4.2, tags: { amenity: 'bench' } },
    ], ['park', 'supermarket']);
    expect(parsed.map((item) => item.name)).toEqual(['Tiny Park', 'Grocery']);
  });
});
