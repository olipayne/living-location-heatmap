import { GripVertical, LocateFixed, RefreshCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapCanvas } from './MapCanvas';
import { AMENITY_CATEGORIES, DEFAULT_FILTERS, type Amenity, type Bounds, type PreferenceFilter } from './domain';
import { AMSTERDAM_FALLBACK_AMENITIES } from './fallbackData';
import { AMSTERDAM_BOUNDS, AMSTERDAM_CENTER, fetchAmenities, geocodePlace } from './osm';
import { scoreGrid } from './scoring';
import { simplifyAmenitiesForDisplay } from './simplify';

const GRID_STEPS = 30;

function clampBounds(bounds: Bounds): Bounds {
  const minSpan = 0.01;
  const latSpan = Math.max(bounds.north - bounds.south, minSpan);
  const lonSpan = Math.max(bounds.east - bounds.west, minSpan);
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLon = (bounds.east + bounds.west) / 2;
  const cappedLatSpan = Math.min(latSpan, 0.28);
  const cappedLonSpan = Math.min(lonSpan, 0.42);
  return {
    south: centerLat - cappedLatSpan / 2,
    north: centerLat + cappedLatSpan / 2,
    west: centerLon - cappedLonSpan / 2,
    east: centerLon + cappedLonSpan / 2,
  };
}

function activeCategoryIds(filters: PreferenceFilter[]): string[] {
  return Array.from(new Set(filters.filter((filter) => filter.enabled).map((filter) => filter.categoryId)));
}

function categoryLabel(id: string): string {
  return AMENITY_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

export default function App() {
  const [filters, setFilters] = useState<PreferenceFilter[]>(DEFAULT_FILTERS);
  const [amenities, setAmenities] = useState<Amenity[]>(AMSTERDAM_FALLBACK_AMENITIES);
  const [analysisBounds, setAnalysisBounds] = useState<Bounds>(AMSTERDAM_BOUNDS);
  const [viewportBounds, setViewportBounds] = useState<Bounds>(AMSTERDAM_BOUNDS);
  const [center, setCenter] = useState(AMSTERDAM_CENTER);
  const [place, setPlace] = useState('Amsterdam');
  const [status, setStatus] = useState('Ready. Load OpenStreetMap amenities to score Amsterdam.');
  const [isLoading, setIsLoading] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const cells = useMemo(() => scoreGrid(analysisBounds, filters, amenities, GRID_STEPS), [analysisBounds, filters, amenities]);
  const displayAmenities = useMemo(() => simplifyAmenitiesForDisplay(amenities, viewportBounds), [amenities, viewportBounds]);
  const topCells = cells.slice(0, 5);

  const loadAmenities = useCallback(async (bounds: Bounds, nextFilters = filters) => {
    const categoryIds = activeCategoryIds(nextFilters);
    if (categoryIds.length === 0) {
      setAmenities([]);
      setStatus('Enable at least one preference filter to fetch amenities.');
      return;
    }
    const abort = new AbortController();
    setIsLoading(true);
    setStatus(`Fetching ${categoryIds.map(categoryLabel).join(', ')} from OpenStreetMap / Overpass…`);
    try {
      const data = await fetchAmenities(bounds, categoryIds, abort.signal);
      setAmenities(data);
      setStatus(`Loaded ${data.length.toLocaleString()} amenities across ${categoryIds.length} categories. Scoring uses all data; map markers are simplified for speed.`);
    } catch (error) {
      if (bounds.south < 52.43 && bounds.north > 52.27 && bounds.west < 5.08 && bounds.east > 4.72) {
        const fallback = AMSTERDAM_FALLBACK_AMENITIES.filter((amenity) => categoryIds.includes(amenity.categoryId));
        setAmenities(fallback);
        setStatus(`Live Overpass fetch failed, so showing ${fallback.length} bundled Amsterdam demo amenities. Try Refresh data again later.`);
      } else {
        setStatus(error instanceof Error ? `Could not load amenities: ${error.message}` : 'Could not load amenities.');
      }
    } finally {
      setIsLoading(false);
    }
    return () => abort.abort();
  }, [filters]);

  useEffect(() => {
    void fetchAmenities(AMSTERDAM_BOUNDS, activeCategoryIds(DEFAULT_FILTERS))
      .then((data) => {
        setAmenities(data);
        setStatus(`Loaded ${data.length.toLocaleString()} Amsterdam amenities. Scoring uses all data; map markers are simplified for speed.`);
      })
      .catch((error) => {
        setAmenities(AMSTERDAM_FALLBACK_AMENITIES);
        setStatus(error instanceof Error
          ? `Live Overpass fetch failed (${error.message}); showing bundled Amsterdam demo amenities.`
          : 'Live Overpass fetch failed; showing bundled Amsterdam demo amenities.');
      });
  }, []);

  function updateFilter(id: string, patch: Partial<PreferenceFilter>) {
    setFilters((current) => current.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
  }

  function addFilter(categoryId: string) {
    const category = AMENITY_CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return;
    const next: PreferenceFilter = {
      id: `f-${category.id}-${Date.now()}`,
      categoryId: category.id,
      enabled: true,
      radiusMeters: category.id === 'healthcare' ? 1000 : 400,
      weight: 3,
      mode: category.id === 'quiet' ? 'away' : 'near',
    };
    setFilters((current) => [...current, next]);
  }

  function reorder(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setFilters((current) => {
      const from = current.findIndex((item) => item.id === draggedId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }

  async function searchPlace(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setStatus(`Searching for ${place}…`);
    try {
      const result = await geocodePlace(place);
      const bounds = clampBounds(result.bounds);
      setCenter({ lat: result.lat, lon: result.lon });
      setAnalysisBounds(bounds);
      setViewportBounds(bounds);
      setStatus(`Found ${result.label}. Loading local amenities…`);
      await loadAmenities(bounds);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setIsLoading(false);
    }
  }

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    amenities.forEach((amenity) => map.set(amenity.categoryId, (map.get(amenity.categoryId) ?? 0) + 1));
    return map;
  }, [amenities]);

  return (
    <main className="app-shell">
      <aside className="panel">
        <header className="hero">
          <div className="eyebrow"><SlidersHorizontal size={16} /> Perfect Living Location</div>
          <h1>Personal city heatmap</h1>
          <p>Score every patch of a city by the amenities you care about. Data is fetched from OpenStreetMap and scoring runs entirely in your browser.</p>
        </header>

        <form className="search-row" onSubmit={searchPlace}>
          <label className="sr-only" htmlFor="place">Place</label>
          <input id="place" value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Amsterdam, Utrecht, Lisbon…" />
          <button type="submit" disabled={isLoading}><Search size={16} /> Search</button>
        </form>

        <div className="toolbar">
          <button type="button" onClick={() => void loadAmenities(analysisBounds)} disabled={isLoading}><RefreshCcw size={16} /> Refresh data</button>
          <button type="button" onClick={() => { const b = clampBounds(viewportBounds); setAnalysisBounds(b); void loadAmenities(b); }} disabled={isLoading}><LocateFixed size={16} /> Use map view</button>
        </div>

        <section className="status" aria-live="polite">{isLoading ? <span className="spinner" /> : null}{status}</section>
        <section className="data-summary" aria-label="Loaded data summary">
          <strong>{amenities.length.toLocaleString()}</strong> amenities loaded for scoring · <strong>{displayAmenities.visible.length.toLocaleString()}</strong> shown as markers
          {displayAmenities.hiddenCount > 0 ? ` · ${displayAmenities.hiddenCount.toLocaleString()} hidden from marker layer` : ''}
        </section>

        <section>
          <h2>Preference filters</h2>
          <p className="hint">Drag cards to reorder. Radius says how close is “good”; weight says how much it matters.</p>
          <div className="filter-stack">
            {filters.map((filter) => {
              const category = AMENITY_CATEGORIES.find((item) => item.id === filter.categoryId)!;
              return (
                <article
                  key={filter.id}
                  className={`filter-card ${draggedId === filter.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDraggedId(filter.id)}
                  onDragEnter={() => reorder(filter.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <div className="filter-title">
                    <GripVertical className="grip" size={18} />
                    <span className="emoji">{category.emoji}</span>
                    <div>
                      <strong>{category.label}</strong>
                      <small>{counts.get(category.id) ?? 0} loaded</small>
                    </div>
                    <label className="toggle"><input type="checkbox" checked={filter.enabled} onChange={(event) => updateFilter(filter.id, { enabled: event.target.checked })} /> On</label>
                  </div>
                  <div className="control-grid">
                    <label>Mode
                      <select value={filter.mode} onChange={(event) => updateFilter(filter.id, { mode: event.target.value as PreferenceFilter['mode'] })}>
                        <option value="near">Prefer nearby</option>
                        <option value="away">Prefer away</option>
                      </select>
                    </label>
                    <label>Radius: {filter.radiusMeters}m
                      <input type="range" min="100" max="2000" step="50" value={filter.radiusMeters} onChange={(event) => updateFilter(filter.id, { radiusMeters: Number(event.target.value) })} />
                    </label>
                    <label>Weight: {filter.weight}
                      <input type="range" min="1" max="10" step="1" value={filter.weight} onChange={(event) => updateFilter(filter.id, { weight: Number(event.target.value) })} />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
          <label className="add-filter">Add filter
            <select defaultValue="" onChange={(event) => { if (event.target.value) addFilter(event.target.value); event.currentTarget.value = ''; }}>
              <option value="" disabled>Choose amenity…</option>
              {AMENITY_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.emoji} {category.label}</option>)}
            </select>
          </label>
        </section>

        <section>
          <h2>Best cells in view</h2>
          <ol className="top-list">
            {topCells.map((cell) => <li key={cell.id}><strong>{cell.score}/100</strong> near {cell.center.lat.toFixed(4)}, {cell.center.lon.toFixed(4)}</li>)}
          </ol>
        </section>
      </aside>

      <section className="map-wrap">
        <MapCanvas center={center} bounds={analysisBounds} amenities={displayAmenities.visible} cells={cells} onViewportChange={setViewportBounds} />
        <div className="legend">
          <span><i className="bad" /> low fit</span>
          <span><i className="ok" /> mixed</span>
          <span><i className="good" /> great fit</span>
        </div>
      </section>
    </main>
  );
}
