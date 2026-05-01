import { useState, useEffect } from 'react';
import './WeatherDataPanel.css';

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compassDir = (deg) => COMPASS[Math.round(deg / 22.5) % 16];

function waveLabel(h) {
  if (h < 0.5) return 'Calm';
  if (h < 1.5) return 'Light';
  if (h < 2.5) return 'Moderate';
  if (h < 3.5) return 'Rough';
  if (h < 5.0) return 'Very Rough';
  return 'Dangerous';
}

function waveLabelClass(h) {
  if (h < 0.5) return 'cond-calm';
  if (h < 1.5) return 'cond-light';
  if (h < 2.5) return 'cond-moderate';
  if (h < 3.5) return 'cond-rough';
  if (h < 5.0) return 'cond-very-rough';
  return 'cond-dangerous';
}

function windCategory(s) {
  if (s < 3)  return 'Calm';
  if (s < 8)  return 'Light';
  if (s < 14) return 'Moderate';
  if (s < 20) return 'Strong';
  return 'Gale';
}

function windCategoryClass(s) {
  if (s < 3)  return 'cond-calm';
  if (s < 8)  return 'cond-light';
  if (s < 14) return 'cond-moderate';
  if (s < 20) return 'cond-rough';
  return 'cond-dangerous';
}

function escapeCSV(val) {
  const str = String(val ?? '');
  return str.includes(',') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function WeatherDataPanel({ type, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timestamp, setTimestamp] = useState(null);

  const isWave = type === 'wave';
  const title = isWave ? 'Wave Height Data' : 'Wind Direction Data';

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/weather/data');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setTimestamp(json.timestamp);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function downloadCSV() {
    const rows = isWave
      ? (data?.wavePoints ?? []).map((p) => [
          p.lat, p.lon,
          p.waveHeight?.toFixed(2) ?? '',
          p.waveDir != null ? Math.round(p.waveDir) : '',
          p.waveDir != null ? compassDir(p.waveDir) : '',
          waveLabel(p.waveHeight),
        ])
      : (data?.windPoints ?? []).map((p) => [
          p.lat, p.lon,
          p.windSpeed?.toFixed(1) ?? '',
          p.windDir != null ? Math.round(p.windDir) : '',
          p.windDir != null ? compassDir(p.windDir) : '',
          windCategory(p.windSpeed),
        ]);

    const headers = isWave
      ? ['Latitude', 'Longitude', 'Wave Height (m)', 'Swell Direction (deg)', 'Compass', 'Condition']
      : ['Latitude', 'Longitude', 'Wind Speed (m/s)', 'Wind Direction (deg)', 'Compass', 'Category'];

    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCSV).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-data-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const points = isWave ? (data?.wavePoints ?? []) : (data?.windPoints ?? []);

  return (
    <div className="weather-panel-overlay">
      <div className="weather-panel">
        <div className="weather-panel-header">
          <div className="weather-panel-title">
            <h2>{title}</h2>
            {timestamp && (
              <span className="weather-panel-meta">
                {points.length} points &middot; {new Date(timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="weather-panel-actions">
            <button
              className="panel-btn download-btn"
              onClick={downloadCSV}
              disabled={points.length === 0}
            >
              Download CSV
            </button>
            <button className="panel-btn close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="weather-panel-body">
          {loading && <div className="panel-status">Loading weather data...</div>}
          {error && <div className="panel-status panel-error">Error: {error}</div>}
          {!loading && !error && points.length === 0 && (
            <div className="panel-status">No data available.</div>
          )}
          {!loading && !error && points.length > 0 && isWave && (
            <table className="weather-table">
              <thead>
                <tr>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Wave Height (m)</th>
                  <th>Swell From</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i}>
                    <td>{p.lat.toFixed(1)}</td>
                    <td>{p.lon.toFixed(1)}</td>
                    <td>{p.waveHeight?.toFixed(2) ?? '—'}</td>
                    <td>
                      {p.waveDir != null
                        ? `${Math.round(p.waveDir)}° (${compassDir(p.waveDir)})`
                        : '—'}
                    </td>
                    <td>
                      <span className={`cond-badge ${waveLabelClass(p.waveHeight)}`}>
                        {waveLabel(p.waveHeight)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !error && points.length > 0 && !isWave && (
            <table className="weather-table">
              <thead>
                <tr>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Wind Speed (m/s)</th>
                  <th>Wind From</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i}>
                    <td>{p.lat.toFixed(1)}</td>
                    <td>{p.lon.toFixed(1)}</td>
                    <td>{p.windSpeed?.toFixed(1) ?? '—'}</td>
                    <td>
                      {p.windDir != null
                        ? `${Math.round(p.windDir)}° (${compassDir(p.windDir)})`
                        : '—'}
                    </td>
                    <td>
                      <span className={`cond-badge ${windCategoryClass(p.windSpeed)}`}>
                        {windCategory(p.windSpeed)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default WeatherDataPanel;
