import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import type { Amenity, Bounds, LatLon, ScoredCell } from './domain';
import { AMENITY_CATEGORIES } from './domain';
import { scoreToColor } from './scoring';

type Props = {
  center: LatLon;
  bounds: Bounds;
  amenities: Amenity[];
  cells: ScoredCell[];
  onViewportChange: (bounds: Bounds) => void;
};

function toLeafletBounds(bounds: Bounds): L.LatLngBoundsExpression {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ];
}

function fromLeafletBounds(bounds: L.LatLngBounds): Bounds {
  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
}

function describeCell(cell: ScoredCell): string {
  const lines = Object.entries(cell.evidence)
    .map(([categoryId, detail]) => {
      const category = AMENITY_CATEGORIES.find((item) => item.id === categoryId);
      const distance = detail.nearestMeters === null ? 'no data' : `${detail.nearestMeters}m`;
      return `${category?.emoji ?? '•'} ${category?.label ?? categoryId}: ${distance} (${detail.contribution}/100)`;
    })
    .join('<br/>');
  return `<strong>Living score: ${cell.score}/100</strong><br/>${lines}`;
}

export function MapCanvas({ center, bounds, amenities, cells, onViewportChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const hasFittedRef = useRef(false);

  const categoryById = useMemo(() => new Map(AMENITY_CATEGORIES.map((category) => [category.id, category])), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { preferCanvas: true, zoomControl: false }).setView([center.lat, center.lon], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    heatLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    map.on('moveend', () => onViewportChange(fromLeafletBounds(map.getBounds())));
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
  }, [center.lat, center.lon, onViewportChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasFittedRef.current) {
      map.fitBounds(toLeafletBounds(bounds), { padding: [20, 20] });
      hasFittedRef.current = true;
      return;
    }
    map.fitBounds(toLeafletBounds(bounds), { padding: [20, 20], animate: true });
  }, [bounds]);

  useEffect(() => {
    const layer = heatLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    cells.forEach((cell) => {
      const polygon = L.rectangle(toLeafletBounds(cell.bounds), {
        stroke: false,
        fillOpacity: 0.34,
        fillColor: scoreToColor(cell.score),
        interactive: true,
      });
      polygon.bindPopup(describeCell(cell));
      polygon.addTo(layer);
    });
  }, [cells]);

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    amenities.slice(0, 900).forEach((amenity) => {
      const category = categoryById.get(amenity.categoryId);
      const marker = L.circleMarker([amenity.lat, amenity.lon], {
        radius: 4,
        weight: 1,
        color: '#111827',
        fillColor: category?.color ?? '#444',
        fillOpacity: 0.8,
      });
      marker.bindTooltip(`${category?.emoji ?? ''} ${amenity.name}`, { direction: 'top' });
      marker.addTo(layer);
    });
  }, [amenities, categoryById]);

  return <div ref={containerRef} className="map" aria-label="Living score map" />;
}
