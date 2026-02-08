import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './Map.css';

const MAP_BOUNDS = [
  [-85, -180],
  [85, 180],
];

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  },
};

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer().parentElement);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function Map() {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const tile = TILE_LAYERS[theme];

  return (
    <div className="map-wrapper">
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
      <MapContainer
        center={[20, 0]}
        zoom={3}
        minZoom={3}
        maxZoom={18}
        maxBounds={MAP_BOUNDS}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
        className="map-container"
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <MapResizeHandler />
        <TileLayer
          key={theme}
          url={tile.url}
          attribution={tile.attribution}
          noWrap={true}
          bounds={MAP_BOUNDS}
        />
      </MapContainer>
    </div>
  );
}

export default Map;
