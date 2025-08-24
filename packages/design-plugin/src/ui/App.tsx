import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useState } from "react";

export default function App() {
    const client = useRozeniteDevToolsClient({
        pluginId: '@rozenite/design-plugin',
    });

    // Grid state
    const [gridConfig, setGridConfig] = useState({
        show: false,
        cellSize: 20,
        majorLineEvery: 5,
        minorColor: '#e0e0e0',
        majorColor: '#c0c0c0'
    });


    // Grid event handlers
    const handleGridConfigChange = (key: keyof typeof gridConfig, value: any) => {
        const newConfig = { ...gridConfig, [key]: value };
        setGridConfig(newConfig);
        client?.send('set-grid', newConfig);
    };

    return (
        <div style={{ 
            padding: '20px', 
            fontFamily: 'system-ui, -apple-system, sans-serif',
            maxWidth: '80%',
            margin: '0 auto',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            {/* Sections Container */}
            <div style={{
                display: 'flex',
                gap: '20px',
                marginBottom: '20px'
            }}>
                {/* Grid Section */}
                <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    flex: 1
                }}>
                    <h2 style={{ 
                        marginTop: 0, 
                        color: '#444',
                        borderBottom: '2px solid #007acc',
                        paddingBottom: '8px'
                    }}>
                        Grid Overlay Configuration
                    </h2>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="checkbox"
                                checked={gridConfig.show}
                                onChange={(e) => handleGridConfigChange('show', e.target.checked)}
                            />
                            <span>Show Grid</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Cell Size: {gridConfig.cellSize}px</div>
                            <input
                                type="range"
                                min="5"
                                max="100"
                                value={gridConfig.cellSize}
                                onChange={(e) => handleGridConfigChange('cellSize', parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Major Line Every: {gridConfig.majorLineEvery} cells</div>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={gridConfig.majorLineEvery}
                                onChange={(e) => handleGridConfigChange('majorLineEvery', parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Minor Color</div>
                            <input
                                type="color"
                                value={gridConfig.minorColor}
                                onChange={(e) => handleGridConfigChange('minorColor', e.target.value)}
                                style={{ width: '60px', height: '30px' }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Major Color</div>
                            <input
                                type="color"
                                value={gridConfig.majorColor}
                                onChange={(e) => handleGridConfigChange('majorColor', e.target.value)}
                                style={{ width: '60px', height: '30px' }}
                            />
                        </label>
                    </div>
                </div>

                {/* Overlay Section */}
                <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    flex: 1
                }}>
                    <h2 style={{ 
                        marginTop: 0, 
                        color: '#444',
                        borderBottom: '2px solid #28a745',
                        paddingBottom: '8px'
                    }}>
                        Image Overlay Configuration
                    </h2>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="checkbox"
                                checked={overlayConfig.show}
                                onChange={(e) => handleOverlayConfigChange('show', e.target.checked)}
                            />
                            <span>Show Overlay</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Image URI</div>
                            <input
                                type="text"
                                value={overlayConfig.imageUri}
                                onChange={(e) => handleOverlayConfigChange('imageUri', e.target.value)}
                                placeholder="Enter image URL or path"
                                style={{ 
                                    width: '100%', 
                                    padding: '8px', 
                                    border: '1px solid #ccc',
                                    borderRadius: '4px'
                                }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>
                                Initial Divider Position: {overlayConfig.initialDividerPosition}%
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={overlayConfig.initialDividerPosition}
                                onChange={(e) => handleOverlayConfigChange('initialDividerPosition', parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}