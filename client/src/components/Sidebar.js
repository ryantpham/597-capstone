import './Sidebar.css';

function Sidebar({
  onClose,
  onViewVesselData,
  onViewSystemInfo,
  onViewFleetAnalytics,
  onViewFilterPanel,
  activeFilterCount,
  showWaves, showWind,
  onToggleWaves, onToggleWind,
  weatherStatus,
  onViewWeatherData,
}) {
  const isLoading = weatherStatus === 'loading';
  const isError   = weatherStatus === 'error';
  const isReady   = weatherStatus === 'ready';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Naval Intelligence</h2>
        <button className="sidebar-collapse-btn" onClick={onClose} aria-label="Close sidebar">
          &#8249;
        </button>
      </div>
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Vessel Data</span>
        <button className="sidebar-item" onClick={onViewVesselData}>
          View Vessel Data
        </button>
        <button className="sidebar-item" onClick={onViewFilterPanel}>
          Filter Vessels
          {activeFilterCount > 0 && (
            <span className="sidebar-item-badge">{activeFilterCount} ON</span>
          )}
        </button>
        <button className="sidebar-item" onClick={onViewFleetAnalytics}>
          Fleet Analytics
        </button>

        <span className="sidebar-section-label">Weather Overlays</span>

        {isLoading && (
          <div className="sidebar-weather-status loading">Fetching weather data...</div>
        )}
        {isError && (
          <div className="sidebar-weather-status error">Weather data unavailable</div>
        )}

        <div className="sw-row">
          <span className="sw-label">Wave Height</span>
          <button
            role="switch"
            aria-checked={showWaves}
            className={`sw-track${showWaves ? ' on' : ''}`}
            onClick={onToggleWaves}
            disabled={isLoading}
          >
            <span className="sw-knob" />
          </button>
        </div>

        <div className="sw-row">
          <span className="sw-label">Wind Direction</span>
          <button
            role="switch"
            aria-checked={showWind}
            className={`sw-track${showWind ? ' on' : ''}`}
            onClick={onToggleWind}
            disabled={isLoading}
          >
            <span className="sw-knob" />
          </button>
        </div>

        <button
          className="sidebar-item"
          onClick={onViewWeatherData}
          disabled={!isReady}
        >
          Weather Data
        </button>

        <span className="sidebar-section-label">Health &amp; Status</span>
        <button className="sidebar-item" onClick={onViewSystemInfo}>
          System Monitor
        </button>
      </nav>
    </div>
  );
}

export default Sidebar;
