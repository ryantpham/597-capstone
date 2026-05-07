import { useState, useEffect, useRef } from 'react';
import './SystemInfoPanel.css';

const CATEGORY_COLORS = {
  Cargo: '#3b82f6',
  Tanker: '#ef4444',
  Passenger: '#a855f7',
  Fishing: '#22c55e',
  Towing: '#f97316',
  Tug: '#f97316',
  'High Speed Craft': '#06b6d4',
  Military: '#6b7280',
  Sailing: '#14b8a6',
  'Pleasure Craft': '#ec4899',
  'Search & Rescue': '#eab308',
  'Pilot Vessel': '#eab308',
  'Law Enforcement': '#6b7280',
  Unknown: '#9ca3af',
};

function statusDot(status) {
  if (status === 'connected' || status === 'ready') return 'dot-green';
  if (status === 'connecting' || status === 'reconnecting') return 'dot-yellow';
  return 'dot-red';
}

function statusLabel(status) {
  const map = {
    connected: 'Connected',
    connecting: 'Connecting...',
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
    ready: 'Ready',
    idle: 'Not fetched',
    error: 'Error',
  };
  return map[status] || status;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString();
}

function logSourceClass(source) {
  if (source === 'AIS') return 'log-ais';
  if (source === 'Weather') return 'log-weather';
  return 'log-system';
}

function logLevelClass(level) {
  if (level === 'error') return 'log-error';
  if (level === 'warn') return 'log-warn';
  return '';
}

function SystemInfoPanel({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const logEndRef = useRef(null);
  const prevLogCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/system/health');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Auto-scroll log feed only when new entries arrive
  useEffect(() => {
    if (!data) return;
    const count = data.logs?.length ?? 0;
    if (count !== prevLogCount.current) {
      prevLogCount.current = count;
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data]);

  const categories = data ? Object.entries(data.ais.vesselsByCategory)
    .sort((a, b) => b[1] - a[1]) : [];
  const maxCount = categories[0]?.[1] ?? 1;

  return (
    <div className="sys-overlay">
      <div className="sys-panel">

        {/* Header */}
        <div className="sys-header">
          <div>
            <h2 className="sys-title">System Information</h2>
            {data && (
              <span className="sys-meta">
                Updated {formatTime(data.timestamp)}
              </span>
            )}
          </div>
          <button className="sys-close" onClick={onClose}>Close</button>
        </div>

        {error && <div className="sys-error">Error fetching system data: {error}</div>}

        {data && (
          <div className="sys-body">

            {/* Status Cards */}
            <div className="sys-cards">
              <div className="sys-card">
                <div className="sys-card-title">AIS Stream</div>
                <div className="sys-card-status">
                  <span className={`sys-dot ${statusDot(data.ais.status)}`} />
                  <span className="sys-status-text">{statusLabel(data.ais.status)}</span>
                </div>
                <div className="sys-card-stats">
                  <div className="sys-stat">
                    <span className="sys-stat-label">Vessels tracked</span>
                    <span className="sys-stat-value">{data.ais.vesselCount.toLocaleString()}</span>
                  </div>
                  <div className="sys-stat">
                    <span className="sys-stat-label">Messages received</span>
                    <span className="sys-stat-value">{data.ais.messageCount.toLocaleString()}</span>
                  </div>
                  <div className="sys-stat">
                    <span className="sys-stat-label">Source</span>
                    <span className="sys-stat-value">AISStream.io</span>
                  </div>
                </div>
              </div>

              <div className="sys-card">
                <div className="sys-card-title">Weather API</div>
                <div className="sys-card-status">
                  <span className={`sys-dot ${statusDot(data.weather.status)}`} />
                  <span className="sys-status-text">{statusLabel(data.weather.status)}</span>
                </div>
                <div className="sys-card-stats">
                  <div className="sys-stat">
                    <span className="sys-stat-label">Wave points</span>
                    <span className="sys-stat-value">{data.weather.wavePointCount}</span>
                  </div>
                  <div className="sys-stat">
                    <span className="sys-stat-label">Wind points</span>
                    <span className="sys-stat-value">{data.weather.windPointCount}</span>
                  </div>
                  <div className="sys-stat">
                    <span className="sys-stat-label">Last fetched</span>
                    <span className="sys-stat-value">{formatTime(data.weather.lastFetch)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vessel count by category */}
            <div className="sys-section">
              <div className="sys-section-title">
                Live Vessel Count by Category
                <span className="sys-section-meta">{data.ais.vesselCount.toLocaleString()} positioned vessels</span>
              </div>
              {categories.length === 0 ? (
                <div className="sys-empty">No vessel data yet — waiting for AIS stream</div>
              ) : (
                <div className="sys-categories">
                  {categories.map(([cat, count]) => (
                    <div key={cat} className="sys-cat-row">
                      <span className="sys-cat-name">
                        <span
                          className="sys-cat-dot"
                          style={{ background: CATEGORY_COLORS[cat] || '#9ca3af' }}
                        />
                        {cat}
                      </span>
                      <div className="sys-cat-bar-wrap">
                        <div
                          className="sys-cat-bar"
                          style={{
                            width: `${(count / maxCount) * 100}%`,
                            background: CATEGORY_COLORS[cat] || '#9ca3af',
                          }}
                        />
                      </div>
                      <span className="sys-cat-count">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Log feed */}
            <div className="sys-section sys-log-section">
              <div className="sys-section-title">
                Live Log Feed
                <span className="sys-section-meta">{data.logs.length} entries (last 150)</span>
              </div>
              <div className="sys-log-feed">
                {data.logs.length === 0 && (
                  <div className="sys-empty">No log entries yet</div>
                )}
                {[...data.logs].reverse().map((log, i) => (
                  <div key={i} className={`sys-log-entry ${logLevelClass(log.level)}`}>
                    <span className="sys-log-time">{formatTime(log.time)}</span>
                    <span className={`sys-log-source ${logSourceClass(log.source)}`}>
                      [{log.source}]
                    </span>
                    <span className="sys-log-msg">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>

          </div>
        )}

        {!data && !error && (
          <div className="sys-loading">Loading system data...</div>
        )}
      </div>
    </div>
  );
}

export default SystemInfoPanel;
