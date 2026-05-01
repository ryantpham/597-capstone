import { useState, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import VesselDataPanel from './components/VesselDataPanel';
import WeatherDataPanel from './components/WeatherDataPanel';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showVesselData, setShowVesselData] = useState(false);
  const [showWaves, setShowWaves] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [weatherStatus, setWeatherStatus] = useState('idle'); // idle | loading | ready | error
  const [showWavePanel, setShowWavePanel] = useState(false);
  const [showWindPanel, setShowWindPanel] = useState(false);

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
            showWaves={showWaves}
            showWind={showWind}
            onToggleWaves={() => setShowWaves((v) => !v)}
            onToggleWind={() => setShowWind((v) => !v)}
            weatherStatus={weatherStatus}
            onViewWaveData={() => setShowWavePanel(true)}
            onViewWindData={() => setShowWindPanel(true)}
          />
        )}
        <div className="map-area">
          <Map
            showWaves={showWaves}
            showWind={showWind}
            onWeatherLoad={handleWeatherLoad}
          />
        </div>
      </div>

      {showVesselData && (
        <VesselDataPanel onClose={() => setShowVesselData(false)} />
      )}
      {showWavePanel && (
        <WeatherDataPanel type="wave" onClose={() => setShowWavePanel(false)} />
      )}
      {showWindPanel && (
        <WeatherDataPanel type="wind" onClose={() => setShowWindPanel(false)} />
      )}
    </div>
  );
}

export default App;
