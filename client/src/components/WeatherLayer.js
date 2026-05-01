import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import './WeatherLayer.css';

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compassDir = (deg) => COMPASS[Math.round(deg / 22.5) % 16];

// Wave height → fill color
function waveColor(h) {
  if (h < 0.5) return '#0ea5e9';
  if (h < 1.5) return '#06b6d4';
  if (h < 2.5) return '#22c55e';
  if (h < 3.5) return '#eab308';
  if (h < 5.0) return '#f97316';
  return '#ef4444';
}

function waveLabel(h) {
  if (h < 0.5) return 'Calm';
  if (h < 1.5) return 'Light';
  if (h < 2.5) return 'Moderate';
  if (h < 3.5) return 'Rough';
  if (h < 5.0) return 'Very Rough';
  return 'Dangerous';
}

// Wind arrow SVG with staggered animation delay via CSS custom property
function windArrowHTML(dir, speed, delay) {
  const color = speed > 15 ? '#ef4444' : speed > 8 ? '#f97316' : '#22c55e';
  return `
    <div class="wind-arrow" style="--delay:${delay.toFixed(2)}s">
      <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(${dir},10,10)">
          <polygon points="10,2 14.5,17 10,13 5.5,17"
            fill="${color}" stroke="rgba(0,0,0,0.5)" stroke-width="0.7"/>
        </g>
      </svg>
    </div>`;
}

function WeatherLayer({ showWaves, showWind, onWeatherLoad }) {
  const map = useMap();
  const [wavePoints, setWavePoints] = useState(null);
  const [windPoints, setWindPoints] = useState(null);
  const fetchedRef     = useRef(false);
  const waveCirclesRef = useRef([]);
  const windMarkersRef = useRef([]);

  // Lazy fetch — fires once when either layer is first toggled on
  useEffect(() => {
    if (!(showWaves || showWind) || fetchedRef.current) return;
    fetchedRef.current = true;
    onWeatherLoad('loading');
    fetch('/api/weather/data')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        setWavePoints(data.wavePoints);
        setWindPoints(data.windPoints);
        onWeatherLoad('ready');
      })
      .catch(() => onWeatherLoad('error'));
  }, [showWaves, showWind, onWeatherLoad]);

  // Wave height — geographic L.circle markers (scale with zoom, no canvas clipping)
  useEffect(() => {
    if (!wavePoints) return;
    if (showWaves) {
      if (waveCirclesRef.current.length > 0) return;
      waveCirclesRef.current = wavePoints.map((p) => {
        const h = p.waveHeight;
        const dirStr = p.waveDir != null
          ? `${Math.round(p.waveDir)}&deg; (${compassDir(p.waveDir)})`
          : '—';
        const c = L.circle([p.lat, p.lon], {
          radius: 800000,
          color: 'none',
          fillColor: waveColor(h),
          fillOpacity: 0.38,
        });
        c.bindTooltip(
          `<strong>Wave Height:</strong> ${h.toFixed(1)} m &mdash; ${waveLabel(h)}<br>` +
          `<strong>Swell From:</strong> ${dirStr}`,
          { direction: 'top', className: 'weather-tooltip', sticky: true }
        );
        c.addTo(map);
        return c;
      });
    } else {
      waveCirclesRef.current.forEach((c) => map.removeLayer(c));
      waveCirclesRef.current = [];
    }
  }, [showWaves, wavePoints, map]);

  // Wind direction — 90-point grid, animated arrows
  useEffect(() => {
    if (!windPoints) return;
    if (showWind) {
      if (windMarkersRef.current.length > 0) return;
      windMarkersRef.current = windPoints.map((p, i) => {
        const delay = (i * 0.13) % 2.6;
        const icon = L.divIcon({
          className: '',
          html: windArrowHTML(p.windDir, p.windSpeed, delay),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const m = L.marker([p.lat, p.lon], { icon });
        const spd = p.windSpeed != null ? `${p.windSpeed.toFixed(1)} m/s` : '?';
        m.bindTooltip(
          `Wind: ${p.windDir}&deg; &bull; ${spd}`,
          { direction: 'top', className: 'weather-tooltip' }
        );
        m.addTo(map);
        return m;
      });
    } else {
      windMarkersRef.current.forEach((m) => map.removeLayer(m));
      windMarkersRef.current = [];
    }
  }, [showWind, windPoints, map]);

  // Cleanup on unmount
  useEffect(() => () => {
    waveCirclesRef.current.forEach((c) => map.removeLayer(c));
    windMarkersRef.current.forEach((m) => map.removeLayer(m));
  }, [map]);

  return null;
}

export default WeatherLayer;
