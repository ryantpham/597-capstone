import { useState, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import VesselDataPanel from './components/VesselDataPanel';
import WeatherDataPanel from './components/WeatherDataPanel';
import SystemInfoPanel from './components/SystemInfoPanel';
import FleetAnalyticsPanel from './components/FleetAnalyticsPanel';
import FilterPanel, { DEFAULT_FILTERS, countActiveFilters } from './components/FilterPanel';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showVesselData, setShowVesselData] = useState(false);
  const [showWaves, setShowWaves] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [weatherStatus, setWeatherStatus] = useState('idle'); // idle | loading | ready | error
  const [showWeatherData, setShowWeatherData] = useState(false);
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [showFleetAnalytics, setShowFleetAnalytics] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [vesselFilters, setVesselFilters] = useState(DEFAULT_FILTERS);

  const handleWeatherLoad = useCallback((status) => setWeatherStatus(status), []);

  return (
    <div className="App">
      <button
        className={`hamburger-btn ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      <div className="app-layout">
        {sidebarOpen && (
          <Sidebar
            onViewVesselData={() => setShowVesselData(true)}
            onViewFleetAnalytics={() => setShowFleetAnalytics(true)}
            onViewFilterPanel={() => setShowFilterPanel(true)}
            onViewSystemInfo={() => setShowSystemInfo(true)}
            activeFilterCount={countActiveFilters(vesselFilters)}
            showWaves={showWaves}
            showWind={showWind}
            onToggleWaves={() => setShowWaves((v) => !v)}
            onToggleWind={() => setShowWind((v) => !v)}
            weatherStatus={weatherStatus}
            onViewWeatherData={() => setShowWeatherData(true)}
          />
        )}
        <div className="map-area">
          <Map
            showWaves={showWaves}
            showWind={showWind}
            onWeatherLoad={handleWeatherLoad}
            vesselFilters={vesselFilters}
          />
        </div>
      </div>

      {showVesselData && (
        <VesselDataPanel onClose={() => setShowVesselData(false)} />
      )}
      {showWeatherData && (
        <WeatherDataPanel onClose={() => setShowWeatherData(false)} />
      )}
      {showFleetAnalytics && (
        <FleetAnalyticsPanel onClose={() => setShowFleetAnalytics(false)} />
      )}
      {showFilterPanel && (
        <FilterPanel
          filters={vesselFilters}
          onChange={setVesselFilters}
          onClose={() => setShowFilterPanel(false)}
        />
      )}
      {showSystemInfo && (
        <SystemInfoPanel onClose={() => setShowSystemInfo(false)} />
      )}
    </div>
  );
}

export default App;
