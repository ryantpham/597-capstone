import './FilterPanel.css';

export const DEFAULT_FILTERS = {
  categories:     null,   // null = all shown, [] = none, ['Cargo'] = only those
  movementStatus: 'all',  // 'all' | 'underway' | 'stationary'
  minSpeed:       '',
  maxSpeed:       '',
  destination:    '',
  navStatuses:    [],     // [] = all nav statuses shown
  region:         'all',
};

export function countActiveFilters(f) {
  return [
    f.categories !== null,
    f.movementStatus !== 'all',
    f.minSpeed !== '',
    f.maxSpeed !== '',
    f.destination.trim() !== '',
    f.navStatuses.length > 0,
    f.region !== 'all',
  ].filter(Boolean).length;
}

const ALL_CATEGORIES = [
  'Cargo', 'Tanker', 'Passenger', 'Fishing', 'Towing', 'Tug',
  'High Speed Craft', 'Military', 'Sailing', 'Pleasure Craft',
  'Search & Rescue', 'Pilot Vessel', 'Law Enforcement',
  'Dredging', 'Diving', 'Port Tender', 'Medical', 'Other', 'Unknown',
];

const CATEGORY_COLORS = {
  Cargo: '#3b82f6', Tanker: '#ef4444', Passenger: '#a855f7',
  Fishing: '#22c55e', Towing: '#f97316', Tug: '#f97316',
  'High Speed Craft': '#06b6d4', Military: '#6b7280', Sailing: '#14b8a6',
  'Pleasure Craft': '#ec4899', 'Search & Rescue': '#eab308',
  'Pilot Vessel': '#eab308', 'Law Enforcement': '#6b7280',
  Dredging: '#a16207', Diving: '#0ea5e9', 'Port Tender': '#f59e0b',
  Medical: '#f43f5e', Other: '#78716c', Unknown: '#9ca3af',
};

const NAV_STATUSES = [
  { code: 0,  label: 'Underway (Engine)' },
  { code: 1,  label: 'At Anchor' },
  { code: 2,  label: 'Not Under Command' },
  { code: 3,  label: 'Restricted Maneuverability' },
  { code: 5,  label: 'Moored' },
  { code: 7,  label: 'Engaged in Fishing' },
  { code: 8,  label: 'Underway (Sailing)' },
  { code: 15, label: 'Undefined / Default' },
];

const REGIONS = ['Pacific', 'Gulf of Mexico', 'Caribbean', 'Atlantic'];

function toggleItem(arr, item) {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

function FilterPanel({ filters, onChange, onClose }) {
  const active = countActiveFilters(filters);

  function set(key, val) {
    onChange({ ...filters, [key]: val });
  }

  return (
    <div className="fp-overlay">
      <div className="fp-panel">

        {/* Header */}
        <div className="fp-header">
          <div className="fp-header-left">
            <h2 className="fp-title">Filter Vessels</h2>
            {active > 0 && (
              <span className="fp-active-badge">{active} active</span>
            )}
          </div>
          <div className="fp-header-right">
            <button
              className="fp-btn fp-reset"
              onClick={() => onChange({ ...DEFAULT_FILTERS })}
              disabled={active === 0}
            >
              Reset All
            </button>
            <button className="fp-btn fp-close" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="fp-body">

          {/* ── Vessel Category ── */}
          <section className="fp-section">
            <div className="fp-section-head">
              <span className="fp-section-title">Vessel Category</span>
              <div className="fp-quick-btns">
                <button
                  className="fp-quick"
                  onClick={() => set('categories', null)}
                  disabled={filters.categories === null}
                >
                  Select All
                </button>
                <button
                  className="fp-quick"
                  onClick={() => set('categories', [])}
                  disabled={Array.isArray(filters.categories) && filters.categories.length === 0}
                >
                  Clear All
                </button>
              </div>
            </div>
            {filters.categories !== null && filters.categories.length === 0 && (
              <p className="fp-hint fp-hint-warn">No categories selected — no vessels shown. Check one or more below.</p>
            )}
            <div className="fp-cat-grid">
              {ALL_CATEGORIES.map(cat => {
                const isChecked = filters.categories === null || filters.categories.includes(cat);
                return (
                  <label
                    key={cat}
                    className={`fp-cat-item ${isChecked ? 'fp-cat-on' : 'fp-cat-off'}`}
                    style={{ '--cat-color': CATEGORY_COLORS[cat] || '#9ca3af' }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (filters.categories === null) {
                          // Showing all → uncheck means start a selection without this one
                          set('categories', ALL_CATEGORIES.filter(c => c !== cat));
                        } else if (isChecked) {
                          // Remove from selection
                          set('categories', filters.categories.filter(c => c !== cat));
                        } else {
                          // Add to selection; if all picked, reset to null
                          const next = [...filters.categories, cat];
                          set('categories', next.length === ALL_CATEGORIES.length ? null : next);
                        }
                      }}
                    />
                    <span
                      className="fp-cat-dot"
                      style={{ background: CATEGORY_COLORS[cat] || '#9ca3af' }}
                    />
                    {cat}
                  </label>
                );
              })}
            </div>
          </section>

          {/* ── Movement Status ── */}
          <section className="fp-section">
            <span className="fp-section-title">Movement Status</span>
            <div className="fp-toggle-group">
              {[
                { val: 'all',        label: 'All Vessels' },
                { val: 'underway',   label: 'Underway Only  (SOG > 0.5 kn)' },
                { val: 'stationary', label: 'Stationary Only  (SOG ≤ 0.5 kn)' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  className={`fp-toggle ${filters.movementStatus === val ? 'fp-toggle-on' : ''}`}
                  onClick={() => set('movementStatus', val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Speed Range ── */}
          <section className="fp-section">
            <span className="fp-section-title">Speed Range (knots)</span>
            <div className="fp-speed-row">
              <div className="fp-speed-field">
                <label className="fp-input-label">Minimum</label>
                <div className="fp-input-wrap">
                  <input
                    type="number"
                    className="fp-number-input"
                    placeholder="0"
                    min="0"
                    step="0.5"
                    value={filters.minSpeed}
                    onChange={e => set('minSpeed', e.target.value)}
                  />
                  <span className="fp-input-unit">kn</span>
                </div>
              </div>
              <span className="fp-speed-sep">–</span>
              <div className="fp-speed-field">
                <label className="fp-input-label">Maximum</label>
                <div className="fp-input-wrap">
                  <input
                    type="number"
                    className="fp-number-input"
                    placeholder="∞"
                    min="0"
                    step="0.5"
                    value={filters.maxSpeed}
                    onChange={e => set('maxSpeed', e.target.value)}
                  />
                  <span className="fp-input-unit">kn</span>
                </div>
              </div>
              {(filters.minSpeed !== '' || filters.maxSpeed !== '') && (
                <button
                  className="fp-quick fp-speed-clear"
                  onClick={() => onChange({ ...filters, minSpeed: '', maxSpeed: '' })}
                >
                  Clear
                </button>
              )}
            </div>
          </section>

          {/* ── Destination ── */}
          <section className="fp-section">
            <span className="fp-section-title">Destination</span>
            <p className="fp-hint">Partial match, case-insensitive — e.g. "seattle", "houston", "miami"</p>
            <div className="fp-input-wrap fp-dest-wrap">
              <input
                type="text"
                className="fp-text-input"
                placeholder="Type a port or destination..."
                value={filters.destination}
                onChange={e => set('destination', e.target.value)}
              />
              {filters.destination && (
                <button className="fp-inline-clear" onClick={() => set('destination', '')}>✕</button>
              )}
            </div>
            <div className="fp-dest-chips">
              {['SEATTLE', 'HOUSTON', 'MIAMI', 'NEW YORK', 'LOS ANGELES', 'NEW ORLEANS', 'TAMPA', 'BOSTON'].map(port => (
                <button
                  key={port}
                  className={`fp-chip ${filters.destination.toUpperCase() === port ? 'fp-chip-on' : ''}`}
                  onClick={() => set('destination', filters.destination.toUpperCase() === port ? '' : port)}
                >
                  {port}
                </button>
              ))}
            </div>
          </section>

          {/* ── Nav Status ── */}
          <section className="fp-section">
            <div className="fp-section-head">
              <span className="fp-section-title">Navigational Status</span>
              {filters.navStatuses.length > 0 && (
                <button className="fp-quick" onClick={() => set('navStatuses', [])}>
                  Show All
                </button>
              )}
            </div>
            <div className="fp-nav-grid">
              {NAV_STATUSES.map(({ code, label }) => {
                const active = filters.navStatuses.length === 0 || filters.navStatuses.includes(code);
                return (
                  <label
                    key={code}
                    className={`fp-nav-item ${active ? '' : 'fp-nav-off'}`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        if (filters.navStatuses.length === 0) {
                          set('navStatuses', NAV_STATUSES.map(s => s.code).filter(c => c !== code));
                        } else {
                          const next = toggleItem(filters.navStatuses, code);
                          set('navStatuses', next.length === NAV_STATUSES.length ? [] : next);
                        }
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </section>

          {/* ── Region ── */}
          <section className="fp-section">
            <span className="fp-section-title">Geographic Region</span>
            <div className="fp-toggle-group">
              <button
                className={`fp-toggle ${filters.region === 'all' ? 'fp-toggle-on' : ''}`}
                onClick={() => set('region', 'all')}
              >
                All Regions
              </button>
              {REGIONS.map(r => (
                <button
                  key={r}
                  className={`fp-toggle ${filters.region === r ? 'fp-toggle-on' : ''}`}
                  onClick={() => set('region', r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default FilterPanel;
