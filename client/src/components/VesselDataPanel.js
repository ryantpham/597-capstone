import { useState, useEffect } from 'react';
import './VesselDataPanel.css';

function escapeCSV(val) {
  const str = String(val ?? '');
  return str.includes(',') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function VesselDataPanel({ onClose }) {
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchInfo, setFetchInfo] = useState(null);

  useEffect(() => {
    fetchVesselData();
  }, []);

  async function fetchVesselData() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/vessels');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setVessels(data.vessels);
      setFetchInfo({ count: data.count, timestamp: data.timestamp });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    const headers = [
      'MMSI', 'Ship Name', 'Latitude', 'Longitude',
      'SOG (knots)', 'COG', 'Heading', 'Nav Status', 'Last Updated',
    ];
    const rows = vessels.map((v) => [
      v.mmsi, escapeCSV(v.shipName), v.latitude, v.longitude,
      v.sog, v.cog, v.trueHeading, v.navStatus, v.timeUtc,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vessel-data-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="vessel-panel-overlay">
      <div className="vessel-panel">
        <div className="vessel-panel-header">
          <div className="vessel-panel-title">
            <h2>Vessel Data</h2>
            {fetchInfo && (
              <span className="vessel-panel-meta">
                {fetchInfo.count} vessels &middot; {new Date(fetchInfo.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="vessel-panel-actions">
            <button
              className="panel-btn download-btn"
              onClick={downloadCSV}
              disabled={vessels.length === 0}
            >
              Download CSV
            </button>
            <button className="panel-btn refresh-btn" onClick={fetchVesselData}>
              Refresh
            </button>
            <button className="panel-btn close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="vessel-panel-body">
          {loading && <div className="panel-status">Loading vessel data...</div>}
          {error && <div className="panel-status panel-error">Error: {error}</div>}
          {!loading && !error && vessels.length === 0 && (
            <div className="panel-status">
              No vessel data yet. The server may still be collecting data — try refreshing in a few seconds.
            </div>
          )}
          {!loading && !error && vessels.length > 0 && (
            <table className="vessel-table">
              <thead>
                <tr>
                  <th>MMSI</th>
                  <th>Ship Name</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>SOG (kn)</th>
                  <th>COG</th>
                  <th>Heading</th>
                  <th>Nav Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {vessels.map((v) => (
                  <tr key={v.mmsi}>
                    <td>{v.mmsi}</td>
                    <td>{v.shipName}</td>
                    <td>{v.latitude?.toFixed(4)}</td>
                    <td>{v.longitude?.toFixed(4)}</td>
                    <td>{v.sog?.toFixed(1)}</td>
                    <td>{v.cog?.toFixed(1)}&deg;</td>
                    <td>{v.trueHeading}&deg;</td>
                    <td>{v.navStatus}</td>
                    <td>{v.timeUtc}</td>
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

export default VesselDataPanel;
