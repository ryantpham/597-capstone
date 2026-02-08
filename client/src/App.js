import { useState } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import VesselDataPanel from './components/VesselDataPanel';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showVesselData, setShowVesselData] = useState(false);

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
          <Sidebar onViewVesselData={() => setShowVesselData(true)} />
        )}
        <div className="map-area">
          <Map />
        </div>
      </div>

      {showVesselData && (
        <VesselDataPanel onClose={() => setShowVesselData(false)} />
      )}
    </div>
  );
}

export default App;
