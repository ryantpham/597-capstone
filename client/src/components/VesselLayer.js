import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const CATEGORY_COLORS = {
  Cargo: '#3b82f6',
  Tanker: '#ef4444',
  Passenger: '#a855f7',
  Fishing: '#22c55e',
  Towing: '#f97316',
  Tug: '#f97316',
  'High Speed Craft': '#06b6d4',
  Military: '#6b7280',
  'Sailing': '#14b8a6',
  'Pleasure Craft': '#ec4899',
  'Search & Rescue': '#eab308',
  'Pilot Vessel': '#eab308',
  'Law Enforcement': '#6b7280',
  Unknown: '#9ca3af',
};

function getColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Unknown;
}

function createVesselIcon(vessel) {
  const color = getColor(vessel.shipCategory);
  const heading = vessel.trueHeading < 511 ? vessel.trueHeading : vessel.cog || 0;

  return L.divIcon({
    className: 'vessel-icon',
    html: `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${heading}, 7, 7)">
        <polygon points="7,1 12,12 7,9 2,12" fill="${color}" stroke="#000" stroke-width="0.8" opacity="0.9"/>
      </g>
    </svg>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function buildPopupContent(v) {
  const fields = [
    ['Ship Name', v.shipName || 'Unknown'],
    ['MMSI', v.mmsi],
    v.imoNumber ? ['IMO', v.imoNumber] : null,
    v.callSign ? ['Call Sign', v.callSign] : null,
    v.shipCategory ? ['Type', `${v.shipCategory}${v.shipType ? ` (${v.shipType})` : ''}`] : null,
    ['Position', `${v.latitude?.toFixed(4)}, ${v.longitude?.toFixed(4)}`],
    ['Speed', `${v.sog?.toFixed(1)} kn`],
    ['Course', `${v.cog?.toFixed(1)}°`],
    v.trueHeading < 511 ? ['Heading', `${v.trueHeading}°`] : null,
    v.destination ? ['Destination', v.destination] : null,
    ['Last Update', v.timeUtc ? v.timeUtc.split('.')[0].replace(' +0000 UTC', '') : 'N/A'],
  ].filter(Boolean);

  return `<div class="vessel-popup">
    ${fields.map(([label, value]) => `<div class="popup-row"><span class="popup-label">${label}</span><span class="popup-value">${value}</span></div>`).join('')}
  </div>`;
}

// ── Filter logic ───────────────────────────────────────────────────────────────

function getRegion(lat, lon) {
  if (lon <= -110) return 'Pacific';
  if (lon > -100 && lon <= -80 && lat < 32) return 'Gulf of Mexico';
  if (lat < 32 && lon > -88) return 'Caribbean';
  return 'Atlantic';
}

function passesFilter(vessel, filters) {
  // null = show all; [] = show none; [...] = show only listed
  if (filters.categories !== null) {
    if (!filters.categories.includes(vessel.shipCategory || 'Unknown')) return false;
  }

  const sog = vessel.sog || 0;
  if (filters.movementStatus === 'underway'   && sog <= 0.5) return false;
  if (filters.movementStatus === 'stationary' && sog >  0.5) return false;

  const minSpd = parseFloat(filters.minSpeed);
  const maxSpd = parseFloat(filters.maxSpeed);
  if (!isNaN(minSpd) && filters.minSpeed !== '' && sog < minSpd) return false;
  if (!isNaN(maxSpd) && filters.maxSpeed !== '' && sog > maxSpd) return false;

  if (filters.destination.trim()) {
    const dest = (vessel.destination || '').toLowerCase();
    if (!dest.includes(filters.destination.trim().toLowerCase())) return false;
  }

  if (filters.navStatuses.length > 0) {
    const ns = vessel.navStatus ?? 15;
    if (!filters.navStatuses.includes(ns)) return false;
  }

  if (filters.region !== 'all' && vessel.latitude != null) {
    if (getRegion(vessel.latitude, vessel.longitude) !== filters.region) return false;
  }

  return true;
}

function syncCluster(cluster, store, filters) {
  cluster.clearLayers();
  for (const { marker, vessel } of store.values()) {
    if (passesFilter(vessel, filters)) {
      cluster.addLayer(marker);
    }
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

function VesselLayer({ filters }) {
  const map = useMap();
  const clusterRef  = useRef(null);
  const storeRef    = useRef(new window.Map()); // Map<mmsi, {marker, vessel}>
  const intervalRef = useRef(null);
  const filtersRef  = useRef(filters);

  // Keep filtersRef current so the interval callback always sees latest filters
  filtersRef.current = filters;

  // Re-sync cluster whenever filters change
  useEffect(() => {
    if (clusterRef.current && storeRef.current.size > 0) {
      syncCluster(clusterRef.current, storeRef.current, filters);
    }
  }, [filters]);

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 12,
      chunkedLoading: true,
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);

    function fetchAndUpdate() {
      fetch('/api/vessels')
        .then((res) => res.json())
        .then((data) => {
          const vessels = data.vessels;
          const currentMMSIs = new Set(vessels.map((v) => v.mmsi));
          const store = storeRef.current;

          // Remove departed vessels
          for (const [mmsi, { marker }] of store) {
            if (!currentMMSIs.has(mmsi)) {
              cluster.removeLayer(marker);
              store.delete(mmsi);
            }
          }

          // Add or update
          for (const vessel of vessels) {
            const entry = store.get(vessel.mmsi);
            if (entry) {
              entry.vessel = vessel;
              entry.marker.setLatLng([vessel.latitude, vessel.longitude]);
              entry.marker.setIcon(createVesselIcon(vessel));
              entry.marker.setPopupContent(buildPopupContent(vessel));
            } else {
              const marker = L.marker([vessel.latitude, vessel.longitude], {
                icon: createVesselIcon(vessel),
              });
              marker.bindPopup(buildPopupContent(vessel), {
                className: 'vessel-popup-container',
                maxWidth: 260,
              });
              store.set(vessel.mmsi, { marker, vessel });
            }
          }

          // Apply current filters to cluster membership
          syncCluster(cluster, store, filtersRef.current);
        })
        .catch(() => {});
    }

    fetchAndUpdate();
    intervalRef.current = setInterval(fetchAndUpdate, 30000);

    return () => {
      clearInterval(intervalRef.current);
      map.removeLayer(cluster);
    };
  }, [map]);

  return null;
}

export default VesselLayer;
