import { useState, useEffect } from 'react';
import './FleetAnalyticsPanel.css';

// ── helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  Cargo: '#3b82f6', Tanker: '#ef4444', Passenger: '#a855f7',
  Fishing: '#22c55e', Towing: '#f97316', Tug: '#f97316',
  'High Speed Craft': '#06b6d4', Military: '#6b7280', Sailing: '#14b8a6',
  'Pleasure Craft': '#ec4899', 'Search & Rescue': '#eab308',
  'Pilot Vessel': '#eab308', 'Law Enforcement': '#6b7280',
  Dredging: '#a16207', Diving: '#0ea5e9', 'Port Tender': '#f59e0b',
  Medical: '#f43f5e', Other: '#78716c', Unknown: '#9ca3af',
};

const NAV_STATUS_LABELS = {
  0: 'Underway (Engine)', 1: 'At Anchor', 2: 'Not Under Command',
  3: 'Restricted Maneuverability', 4: 'Constrained by Draught',
  5: 'Moored', 6: 'Aground', 7: 'Engaged in Fishing',
  8: 'Underway (Sailing)', 15: 'Undefined / Default',
};

const NAV_STATUS_COLORS = {
  0: '#22c55e', 1: '#eab308', 2: '#ef4444', 3: '#f97316',
  4: '#a855f7', 5: '#06b6d4', 6: '#dc2626', 7: '#14b8a6',
  8: '#3b82f6', 15: '#6b7280',
};

const SPEED_BUCKETS = [
  { label: 'Stationary',  min: 0,   max: 0.5,     color: '#6b7280' },
  { label: 'Very Slow',   min: 0.5, max: 3,        color: '#06b6d4' },
  { label: 'Slow',        min: 3,   max: 8,        color: '#22c55e' },
  { label: 'Moderate',    min: 8,   max: 14,       color: '#eab308' },
  { label: 'Fast',        min: 14,  max: 20,       color: '#f97316' },
  { label: 'Very Fast',   min: 20,  max: Infinity, color: '#ef4444' },
];

function getRegion(lat, lon) {
  if (lon <= -110)                             return 'Pacific';
  if (lon > -100 && lon <= -80 && lat < 32)   return 'Gulf of Mexico';
  if (lat < 32 && lon > -88)                  return 'Caribbean';
  return 'Atlantic';
}

const REGION_COLORS = {
  Pacific: '#3b82f6', 'Gulf of Mexico': '#22c55e',
  Caribbean: '#a855f7', Atlantic: '#06b6d4',
};

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function fmt(n, dec = 1) {
  return n == null ? '—' : n.toFixed(dec);
}

function waveLabel(h) {
  if (h < 0.5) return 'Calm';
  if (h < 1.5) return 'Light';
  if (h < 2.5) return 'Moderate';
  if (h < 3.5) return 'Rough';
  if (h < 5.0) return 'Very Rough';
  return 'Dangerous';
}

const WAVE_COND_COLORS = {
  Calm: '#0ea5e9', Light: '#06b6d4', Moderate: '#22c55e',
  Rough: '#eab308', 'Very Rough': '#f97316', Dangerous: '#ef4444',
};

function windCategory(s) {
  if (s < 3)  return 'Calm';
  if (s < 8)  return 'Light';
  if (s < 14) return 'Moderate';
  if (s < 20) return 'Strong';
  return 'Gale';
}

const WIND_CAT_COLORS = {
  Calm: '#22c55e', Light: '#06b6d4', Moderate: '#eab308',
  Strong: '#f97316', Gale: '#ef4444',
};

// ── stat computation ───────────────────────────────────────────────────────────

function computeStats(vessels, weatherData) {
  if (!vessels.length) return null;

  const withSog = vessels.filter(v => v.sog != null);
  const speeds  = withSog.map(v => v.sog);
  const underway = vessels.filter(v => (v.sog || 0) > 0.5);
  const stationary = vessels.filter(v => (v.sog || 0) <= 0.5);

  // Category breakdown
  const byCat = {};
  for (const v of vessels) {
    const c = v.shipCategory || 'Unknown';
    byCat[c] = (byCat[c] || 0) + 1;
  }

  // Speed histogram
  const histogram = SPEED_BUCKETS.map(b => ({
    ...b,
    count: vessels.filter(v => {
      const s = v.sog || 0;
      return s >= b.min && s < b.max;
    }).length,
  }));

  // Nav status breakdown
  const byNav = {};
  for (const v of vessels) {
    const ns = v.navStatus ?? 15;
    const label = NAV_STATUS_LABELS[ns] || `Status ${ns}`;
    if (!byNav[label]) byNav[label] = { count: 0, color: NAV_STATUS_COLORS[ns] || '#6b7280' };
    byNav[label].count++;
  }

  // Regional distribution
  const byRegion = {};
  for (const v of vessels) {
    if (v.latitude == null) continue;
    const r = getRegion(v.latitude, v.longitude);
    byRegion[r] = (byRegion[r] || 0) + 1;
  }

  // Speed by category
  const catStats = {};
  for (const v of vessels) {
    const c = v.shipCategory || 'Unknown';
    if (!catStats[c]) catStats[c] = { count: 0, speeds: [], underway: 0 };
    catStats[c].count++;
    if (v.sog != null) catStats[c].speeds.push(v.sog);
    if ((v.sog || 0) > 0.5) catStats[c].underway++;
  }

  // Top 10 fastest
  const top10Fastest = [...vessels]
    .filter(v => v.sog != null)
    .sort((a, b) => b.sog - a.sog)
    .slice(0, 10);

  // Top destinations
  const destCounts = {};
  const destCategories = {};
  for (const v of vessels) {
    if (!v.destination || v.destination.trim() === '') continue;
    const d = v.destination.trim();
    destCounts[d] = (destCounts[d] || 0) + 1;
    if (!destCategories[d]) destCategories[d] = new Set();
    if (v.shipCategory) destCategories[d].add(v.shipCategory);
  }
  const topDestinations = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([dest, count]) => ({
      dest, count,
      categories: [...(destCategories[dest] || [])].slice(0, 4),
    }));

  // Fastest vessel
  const fastestVessel = top10Fastest[0] || null;

  // Unique destinations
  const uniqueDestinations = Object.keys(destCounts).length;

  // Wave stats
  let waveStats = null;
  if (weatherData?.wavePoints?.length) {
    const heights = weatherData.wavePoints.map(p => p.waveHeight).filter(h => h != null);
    const condCounts = {};
    for (const h of heights) {
      const label = waveLabel(h);
      condCounts[label] = (condCounts[label] || 0) + 1;
    }
    const maxPoint = weatherData.wavePoints.reduce((best, p) =>
      (p.waveHeight ?? -1) > (best?.waveHeight ?? -1) ? p : best, null);
    waveStats = {
      avg: mean(heights),
      max: Math.max(...heights),
      min: Math.min(...heights),
      maxPoint,
      condCounts,
      total: heights.length,
    };
  }

  // Wind stats
  let windStats = null;
  if (weatherData?.windPoints?.length) {
    const wspds = weatherData.windPoints.map(p => p.windSpeed).filter(s => s != null);
    const catCounts = {};
    for (const s of wspds) {
      const cat = windCategory(s);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    windStats = {
      avg: mean(wspds),
      max: Math.max(...wspds),
      min: Math.min(...wspds),
      catCounts,
      total: wspds.length,
    };
  }

  return {
    total: vessels.length,
    underwayCount: underway.length,
    stationaryCount: stationary.length,
    avgSpeed: mean(speeds),
    medianSpeed: median(speeds),
    maxSpeed: fastestVessel?.sog ?? 0,
    fastestVessel,
    uniqueDestinations,
    byCat,
    histogram,
    byNav,
    byRegion,
    catStats,
    top10Fastest,
    topDestinations,
    waveStats,
    windStats,
  };
}

// ── sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="fa-stat-card" style={{ borderTopColor: accent || '#63b3ed' }}>
      <div className="fa-stat-value">{value}</div>
      <div className="fa-stat-label">{label}</div>
      {sub && <div className="fa-stat-sub">{sub}</div>}
    </div>
  );
}

function BarChart({ rows, total, colorKey }) {
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <div className="fa-bar-list">
      {rows.map(({ label, count, color }) => (
        <div key={label} className="fa-bar-row">
          <span className="fa-bar-label">{label}</span>
          <div className="fa-bar-track">
            <div
              className="fa-bar-fill"
              style={{ width: `${(count / max) * 100}%`, background: color || colorKey?.[label] || '#63b3ed' }}
            />
          </div>
          <span className="fa-bar-count">{count}</span>
          {total != null && (
            <span className="fa-bar-pct">{((count / total) * 100).toFixed(1)}%</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children, meta }) {
  return (
    <div className="fa-section-title">
      {children}
      {meta && <span className="fa-section-meta">{meta}</span>}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

function FleetAnalyticsPanel({ onClose }) {
  const [vessels, setVessels] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [vRes, wRes] = await Promise.allSettled([
          fetch('/api/vessels').then(r => r.json()),
          fetch('/api/weather/data').then(r => r.json()),
        ]);
        if (vRes.status === 'fulfilled') {
          setVessels(vRes.value.vessels || []);
          setLastUpdated(new Date().toLocaleTimeString());
        }
        if (wRes.status === 'fulfilled') setWeatherData(wRes.value);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
    const id = setInterval(() => {
      fetch('/api/vessels').then(r => r.json()).then(data => {
        setVessels(data.vessels || []);
        setLastUpdated(new Date().toLocaleTimeString());
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const stats = vessels.length ? computeStats(vessels, weatherData) : null;

  return (
    <div className="fa-overlay">
      <div className="fa-panel">

        {/* Header */}
        <div className="fa-header">
          <div>
            <h2 className="fa-title">Fleet Analytics</h2>
            {lastUpdated && <span className="fa-meta">Live · Updated {lastUpdated} · Auto-refresh every 30s</span>}
          </div>
          <button className="fa-close" onClick={onClose}>Close</button>
        </div>

        {loading && <div className="fa-status-msg">Loading fleet data...</div>}
        {!loading && !stats && <div className="fa-status-msg">Waiting for vessel data from AIS stream...</div>}

        {stats && (
          <div className="fa-body">

            {/* ── Section 1: Overview Cards ── */}
            <div className="fa-cards">
              <StatCard label="Total Vessels" value={stats.total.toLocaleString()} accent="#63b3ed" />
              <StatCard
                label="Underway"
                value={stats.underwayCount.toLocaleString()}
                sub={`${((stats.underwayCount / stats.total) * 100).toFixed(1)}% of fleet`}
                accent="#22c55e"
              />
              <StatCard
                label="Stationary / Anchored"
                value={stats.stationaryCount.toLocaleString()}
                sub={`${((stats.stationaryCount / stats.total) * 100).toFixed(1)}% of fleet`}
                accent="#eab308"
              />
              <StatCard
                label="Avg Speed (all)"
                value={`${fmt(stats.avgSpeed)} kn`}
                sub={`Median ${fmt(stats.medianSpeed)} kn`}
                accent="#a855f7"
              />
              <StatCard
                label="Max Speed"
                value={`${fmt(stats.maxSpeed)} kn`}
                sub={stats.fastestVessel?.shipName || '—'}
                accent="#ef4444"
              />
              <StatCard
                label="Unique Destinations"
                value={stats.uniqueDestinations.toLocaleString()}
                sub="Reported by vessels"
                accent="#06b6d4"
              />
            </div>

            {/* ── Section 2: Category + Speed Histogram ── */}
            <div className="fa-two-col">
              <div className="fa-card-section">
                <SectionTitle meta={`${Object.keys(stats.byCat).length} categories`}>
                  Fleet Composition by Vessel Type
                </SectionTitle>
                <BarChart
                  rows={Object.entries(stats.byCat)
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, count]) => ({ label, count, color: CATEGORY_COLORS[label] || '#9ca3af' }))}
                  total={stats.total}
                />
              </div>

              <div className="fa-card-section">
                <SectionTitle meta="Speed over ground (knots)">
                  Speed Distribution
                </SectionTitle>
                <BarChart
                  rows={stats.histogram.map(b => ({ label: `${b.label} kn`, count: b.count, color: b.color }))}
                  total={stats.total}
                />
              </div>
            </div>

            {/* ── Section 3: Nav Status + Regional ── */}
            <div className="fa-two-col">
              <div className="fa-card-section">
                <SectionTitle>Navigational Status Breakdown</SectionTitle>
                <BarChart
                  rows={Object.entries(stats.byNav)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([label, { count, color }]) => ({ label, count, color }))}
                  total={stats.total}
                />
              </div>

              <div className="fa-card-section">
                <SectionTitle meta="Based on vessel coordinates">
                  Regional Distribution
                </SectionTitle>
                <BarChart
                  rows={Object.entries(stats.byRegion)
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, count]) => ({ label, count, color: REGION_COLORS[label] || '#9ca3af' }))}
                  total={stats.total}
                />
              </div>
            </div>

            {/* ── Section 4: Speed by Category Table ── */}
            <div className="fa-card-section">
              <SectionTitle meta="Vessels with speed data only">
                Speed Intelligence by Vessel Type
              </SectionTitle>
              <div className="fa-table-wrap">
                <table className="fa-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Vessels</th>
                      <th>Underway</th>
                      <th>% Underway</th>
                      <th>Avg Speed (kn)</th>
                      <th>Median Speed (kn)</th>
                      <th>Max Speed (kn)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.catStats)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([cat, s]) => (
                        <tr key={cat}>
                          <td>
                            <span className="fa-cat-dot" style={{ background: CATEGORY_COLORS[cat] || '#9ca3af' }} />
                            {cat}
                          </td>
                          <td>{s.count}</td>
                          <td>{s.underway}</td>
                          <td>
                            <span className="fa-pct-bar-wrap">
                              <span
                                className="fa-pct-bar"
                                style={{
                                  width: `${(s.underway / s.count) * 100}%`,
                                  background: CATEGORY_COLORS[cat] || '#9ca3af',
                                }}
                              />
                            </span>
                            {s.count > 0 ? `${((s.underway / s.count) * 100).toFixed(0)}%` : '—'}
                          </td>
                          <td>{s.speeds.length ? fmt(mean(s.speeds)) : '—'}</td>
                          <td>{s.speeds.length ? fmt(median(s.speeds)) : '—'}</td>
                          <td>{s.speeds.length ? fmt(Math.max(...s.speeds)) : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 5: Top 10 Fastest ── */}
            <div className="fa-card-section">
              <SectionTitle meta="Real-time · sorted by SOG">
                Top 10 Fastest Vessels
              </SectionTitle>
              <div className="fa-table-wrap">
                <table className="fa-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ship Name</th>
                      <th>MMSI</th>
                      <th>Category</th>
                      <th>Speed (kn)</th>
                      <th>Course</th>
                      <th>Heading</th>
                      <th>Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top10Fastest.map((v, i) => (
                      <tr key={v.mmsi} className={i === 0 ? 'fa-row-highlight' : ''}>
                        <td className="fa-rank">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td>{v.shipName || '—'}</td>
                        <td className="fa-mono">{v.mmsi}</td>
                        <td>
                          <span className="fa-cat-dot" style={{ background: CATEGORY_COLORS[v.shipCategory] || '#9ca3af' }} />
                          {v.shipCategory || '—'}
                        </td>
                        <td className="fa-speed-cell">
                          <span className="fa-speed-badge">{fmt(v.sog)} kn</span>
                        </td>
                        <td className="fa-mono">{v.cog != null ? `${fmt(v.cog, 0)}°` : '—'}</td>
                        <td className="fa-mono">{v.trueHeading < 511 ? `${v.trueHeading}°` : '—'}</td>
                        <td>{v.destination || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 6: Top Destinations ── */}
            {stats.topDestinations.length > 0 && (
              <div className="fa-card-section">
                <SectionTitle meta={`${stats.uniqueDestinations} unique ports reported`}>
                  Top 10 Destinations
                </SectionTitle>
                <div className="fa-table-wrap">
                  <table className="fa-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Destination</th>
                        <th>Vessels En Route</th>
                        <th>Vessel Types</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topDestinations.map(({ dest, count, categories }, i) => (
                        <tr key={dest}>
                          <td className="fa-rank">#{i + 1}</td>
                          <td>{dest}</td>
                          <td>
                            <span className="fa-dest-bar-wrap">
                              <span
                                className="fa-dest-bar"
                                style={{ width: `${(count / stats.topDestinations[0].count) * 100}%` }}
                              />
                            </span>
                            {count}
                          </td>
                          <td>
                            {categories.map(cat => (
                              <span key={cat} className="fa-type-pill" style={{ borderColor: CATEGORY_COLORS[cat] || '#9ca3af', color: CATEGORY_COLORS[cat] || '#9ca3af' }}>
                                {cat}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Section 7: Ocean Conditions ── */}
            {stats.waveStats && (
              <div className="fa-two-col">
                <div className="fa-card-section">
                  <SectionTitle meta={`${stats.waveStats.total} ocean measurement points`}>
                    Wave Height Statistics
                  </SectionTitle>
                  <div className="fa-weather-stats">
                    <div className="fa-weather-row">
                      <span className="fa-weather-label">Average</span>
                      <span className="fa-weather-val">{fmt(stats.waveStats.avg)} m</span>
                      <span className="fa-weather-cond">{waveLabel(stats.waveStats.avg)}</span>
                    </div>
                    <div className="fa-weather-row">
                      <span className="fa-weather-label">Maximum</span>
                      <span className="fa-weather-val">{fmt(stats.waveStats.max)} m</span>
                      <span className="fa-weather-cond">{waveLabel(stats.waveStats.max)}</span>
                    </div>
                    <div className="fa-weather-row">
                      <span className="fa-weather-label">Minimum</span>
                      <span className="fa-weather-val">{fmt(stats.waveStats.min)} m</span>
                      <span className="fa-weather-cond">{waveLabel(stats.waveStats.min)}</span>
                    </div>
                    {stats.waveStats.maxPoint && (
                      <div className="fa-weather-row">
                        <span className="fa-weather-label">Roughest Area</span>
                        <span className="fa-weather-val fa-mono">
                          {stats.waveStats.maxPoint.lat}°N, {Math.abs(stats.waveStats.maxPoint.lon)}°W
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="fa-section-divider" />
                  <div className="fa-section-sub">Condition Distribution</div>
                  <BarChart
                    rows={Object.entries(stats.waveStats.condCounts).map(([label, count]) => ({
                      label, count, color: WAVE_COND_COLORS[label] || '#9ca3af',
                    }))}
                    total={stats.waveStats.total}
                  />
                </div>

                {/* ── Section 8: Wind Stats ── */}
                {stats.windStats && (
                  <div className="fa-card-section">
                    <SectionTitle meta={`${stats.windStats.total} grid points`}>
                      Wind Speed Statistics
                    </SectionTitle>
                    <div className="fa-weather-stats">
                      <div className="fa-weather-row">
                        <span className="fa-weather-label">Average</span>
                        <span className="fa-weather-val">{fmt(stats.windStats.avg)} m/s</span>
                        <span className="fa-weather-cond">{windCategory(stats.windStats.avg)}</span>
                      </div>
                      <div className="fa-weather-row">
                        <span className="fa-weather-label">Maximum</span>
                        <span className="fa-weather-val">{fmt(stats.windStats.max)} m/s</span>
                        <span className="fa-weather-cond">{windCategory(stats.windStats.max)}</span>
                      </div>
                      <div className="fa-weather-row">
                        <span className="fa-weather-label">Minimum</span>
                        <span className="fa-weather-val">{fmt(stats.windStats.min)} m/s</span>
                        <span className="fa-weather-cond">{windCategory(stats.windStats.min)}</span>
                      </div>
                      <div className="fa-weather-row">
                        <span className="fa-weather-label">Coverage</span>
                        <span className="fa-weather-val">25–50°N, 60–130°W</span>
                      </div>
                    </div>
                    <div className="fa-section-divider" />
                    <div className="fa-section-sub">Wind Category Distribution</div>
                    <BarChart
                      rows={Object.entries(stats.windStats.catCounts).map(([label, count]) => ({
                        label, count, color: WIND_CAT_COLORS[label] || '#9ca3af',
                      }))}
                      total={stats.windStats.total}
                    />
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default FleetAnalyticsPanel;
