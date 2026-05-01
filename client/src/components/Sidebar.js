import './Sidebar.css';

function Sidebar({
  onViewVesselData,
  showWaves, showWind,
  onToggleWaves, onToggleWind,
  weatherStatus,
  onViewWaveData, onViewWindData,
}) {
  const isLoading = weatherStatus === 'loading';
  const isError   = weatherStatus === 'error';
  const isReady   = weatherStatus === 'ready';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Naval Intelligence</h2>
      </div>
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Vessel Data</span>
        <button className="sidebar-item" onClick={onViewVesselData}>
          View Vessel Data
        </button>

        <span className="sidebar-section-label">Weather Overlays</span>

        {isLoading && (
          <div className="sidebar-weather-status loading">Fetching weather data...</div>
        )}
        {isError && (
          <div className="sidebar-weather-status error">Weather data unavailable</div>
        )}

        <button
          className="sidebar-item"
          onClick={onViewWaveData}
          disabled={!isReady}
        >
          View Wave Height
        </button>
        <button
          className="sidebar-item"
          onClick={onViewWindData}
          disabled={!isReady}
        >
          View Wind Direction
        </button>

        <button
          className={`sidebar-item${showWaves ? ' active' : ''}`}
          onClick={onToggleWaves}
          disabled={isLoading}
        >
          Wave Height
          {showWaves && !isLoading && <span className="sidebar-item-badge">ON</span>}
        </button>
        <button
          className={`sidebar-item${showWind ? ' active' : ''}`}
          onClick={onToggleWind}
          disabled={isLoading}
        >
          Wind Direction
          {showWind && !isLoading && <span className="sidebar-item-badge">ON</span>}
        </button>
      </nav>
    </div>
  );
}

export default Sidebar;
