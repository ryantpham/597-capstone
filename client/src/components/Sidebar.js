import './Sidebar.css';

function Sidebar({ onViewVesselData }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Naval Intelligence</h2>
      </div>
      <nav className="sidebar-nav">
        <button className="sidebar-item" onClick={onViewVesselData}>
          View Vessel Data
        </button>
      </nav>
    </div>
  );
}

export default Sidebar;
