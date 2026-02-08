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
    ['Course', `${v.cog?.toFixed(1)}\u00B0`],
    v.trueHeading < 511 ? ['Heading', `${v.trueHeading}\u00B0`] : null,
    v.destination ? ['Destination', v.destination] : null,
    ['Last Update', v.timeUtc ? v.timeUtc.split('.')[0].replace(' +0000 UTC', '') : 'N/A'],
  ].filter(Boolean);

  return `<div class="vessel-popup">
    ${fields.map(([label, value]) => `<div class="popup-row"><span class="popup-label">${label}</span><span class="popup-value">${value}</span></div>`).join('')}
  </div>`;
}

function VesselLayer() {
  const map = useMap();
  const clusterRef = useRef(null);
  const markersRef = useRef(new window.Map());
  const intervalRef = useRef(null);

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
          const existingMarkers = markersRef.current;

          // Remove markers for vessels no longer in data
          for (const [mmsi, marker] of existingMarkers) {
            if (!currentMMSIs.has(mmsi)) {
              cluster.removeLayer(marker);
              existingMarkers.delete(mmsi);
            }
          }

          // Add or update markers
          for (const vessel of vessels) {
            const existing = existingMarkers.get(vessel.mmsi);
            if (existing) {
              existing.setLatLng([vessel.latitude, vessel.longitude]);
              existing.setIcon(createVesselIcon(vessel));
              existing.setPopupContent(buildPopupContent(vessel));
            } else {
              const marker = L.marker([vessel.latitude, vessel.longitude], {
                icon: createVesselIcon(vessel),
              });
              marker.bindPopup(buildPopupContent(vessel), {
                className: 'vessel-popup-container',
                maxWidth: 260,
              });
              cluster.addLayer(marker);
              existingMarkers.set(vessel.mmsi, marker);
            }
          }
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
