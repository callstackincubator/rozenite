import React from 'react';

// Panel components must export a React component as default
export default function ExpoAtlasPanel() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <iframe
        src="http://localhost:8081/_expo/atlas"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Expo Atlas"
      />
    </div>
  );
}
