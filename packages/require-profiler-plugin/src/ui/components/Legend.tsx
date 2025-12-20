export const Legend = () => {
  return (
    <div className="legend">
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#e63946' }} />
        <span className="legend-label">Expensive init ({'>'}70%)</span>
      </div>
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#f4a261' }} />
        <span className="legend-label">Moderate init (40-70%)</span>
      </div>
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#2a9d8f' }} />
        <span className="legend-label">Light init (20-40%)</span>
      </div>
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#457b9d' }} />
        <span className="legend-label">Minimal init ({'<'}20%)</span>
      </div>
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#3d5a80' }} />
        <span className="legend-label">No own time (0ms)</span>
      </div>
    </div>
  );
};
