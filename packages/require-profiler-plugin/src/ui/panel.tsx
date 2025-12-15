import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FlameGraph } from 'react-flame-graph';
import type { FlameGraphNode } from 'react-flame-graph';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  RequireProfilerEventMap,
  RequireProfilerFlameGraphNode,
} from '../shared/messaging';
import './styles.css';

// Calculate statistics from the data
function calculateStats(node: FlameGraphNode): {
  totalModules: number;
  totalTime: number;
} {
  let totalModules = 1;
  let totalTime = node.value ?? 0;

  if (node.children) {
    for (const child of node.children) {
      const childStats = calculateStats(child);
      totalModules += childStats.totalModules;
      totalTime += childStats.totalTime;
    }
  }

  return { totalModules, totalTime };
}

// Generate color based on timing value (heat map style)
function getColorForValue(value: number, maxValue: number): string {
  if (value === 0) return '#3d5a80'; // Cool blue for zero-time modules

  const ratio = Math.min(value / maxValue, 1);

  if (ratio > 0.7) return '#e63946'; // Hot red
  if (ratio > 0.4) return '#f4a261'; // Warm orange
  if (ratio > 0.2) return '#2a9d8f'; // Teal
  return '#457b9d'; // Cool blue
}

// Find max value in tree
function findMaxValue(node: FlameGraphNode): number {
  let max = node.value;
  if (node.children) {
    for (const child of node.children) {
      max = Math.max(max, findMaxValue(child));
    }
  }
  return max;
}

// Apply colors to flame graph data
function applyColors(node: FlameGraphNode, maxValue: number): FlameGraphNode {
  const color = getColorForValue(node.value, maxValue);
  return {
    ...node,
    backgroundColor: color,
    color: '#ffffff',
    children: node.children?.map((child) => applyColors(child, maxValue)),
  };
}

function formatTime(ms: number | undefined): string {
  if (ms == null || isNaN(ms)) {
    return '0ms';
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(1)}ms`;
}

function App() {
  const [selectedNode, setSelectedNode] = useState<FlameGraphNode | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [flameGraphData, setFlameGraphData] =
    useState<RequireProfilerFlameGraphNode | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const client = useRozeniteDevToolsClient<RequireProfilerEventMap>({
    pluginId: '@rozenite/require-profiler-plugin',
  });

  // Request data on mount and when client becomes available
  useEffect(() => {
    if (!client) {
      return;
    }

    // Request initial data
    client.send('request-data', {
      type: 'request-data',
    });
    setLoading(true);

    // Listen for data responses
    const subscription = client.onMessage('data-response', (event) => {
      setFlameGraphData(event.data);
      setLoading(false);
    });

    return () => {
      subscription.remove();
    };
  }, [client]);

  const handleRefresh = useCallback(() => {
    if (!client) {
      return;
    }
    setLoading(true);
    client.send('request-data', {
      type: 'request-data',
    });
  }, [client]);

  const stats = useMemo(() => {
    if (!flameGraphData) {
      return { totalModules: 0, totalTime: 0 };
    }
    return calculateStats(flameGraphData);
  }, [flameGraphData]);

  const maxValue = useMemo(() => {
    if (!flameGraphData) {
      return 0;
    }
    return findMaxValue(flameGraphData);
  }, [flameGraphData]);

  const coloredData = useMemo(() => {
    if (!flameGraphData || maxValue === 0) {
      return null;
    }
    return applyColors(
      flameGraphData as FlameGraphNode,
      maxValue,
    ) as RequireProfilerFlameGraphNode;
  }, [flameGraphData, maxValue]);

  // Update dimensions when container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    // Initial measurement
    updateDimensions();

    // Listen for window resize
    window.addEventListener('resize', updateDimensions);

    // Use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, [showSidebar]); // Re-measure when sidebar toggles

  const handleChange = useCallback(
    (node: FlameGraphNode | { source: FlameGraphNode }) => {
      setSelectedNode(
        'source' in node ? (node.source as FlameGraphNode) : node,
      );
    },
    [],
  );

  const handleReset = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-text">Metro Require Profiler</span>
          </div>
        </div>
        <div className="header-right">
          <button
            className="btn btn-icon"
            onClick={handleRefresh}
            title="Refresh data"
            disabled={loading || !client}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={loading ? 'spinning' : ''}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
          <button
            className="btn btn-icon"
            onClick={handleReset}
            title="Reset zoom"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            className={`btn btn-icon ${showSidebar ? 'btn-primary' : ''}`}
            onClick={() => setShowSidebar(!showSidebar)}
            title="Toggle details panel"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Info bar */}
      <div className="info-bar">
        <div className="info-bar-left">
          <div className="info-item">
            <span>Total Time:</span>
            <span className="info-item-value">
              {formatTime(stats.totalTime)}
            </span>
          </div>
          <div className="info-item">
            <span>Modules:</span>
            <span className="info-item-value">
              {stats.totalModules.toLocaleString()}
            </span>
          </div>
          <div className="info-item">
            <span>Entry:</span>
            <span className="info-item-value">
              {flameGraphData?.name ?? 'N/A'}
            </span>
          </div>
        </div>
        <div className="info-bar-right">
          <span className="shortcuts-hint">
            Click to zoom in, <kbd>Esc</kbd> to reset
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        <div className="flame-graph-container">
          <div className="flame-graph-wrapper" ref={containerRef}>
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>Loading require profiler data...</p>
              </div>
            ) : !flameGraphData || !coloredData ? (
              <div className="empty-state">
                <svg
                  className="empty-state-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <p className="empty-state-text">
                  No data available. Click refresh to load require profiler
                  data.
                </p>
              </div>
            ) : (
              dimensions.width > 0 &&
              dimensions.height > 0 && (
                <FlameGraph
                  data={coloredData}
                  height={dimensions.height}
                  width={dimensions.width}
                  onChange={handleChange}
                />
              )
            )}
          </div>

          {/* Legend */}
          <div className="legend">
            <div className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: '#e63946' }}
              />
              <span className="legend-label">Slow ({'>'}70%)</span>
            </div>
            <div className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: '#f4a261' }}
              />
              <span className="legend-label">Moderate (40-70%)</span>
            </div>
            <div className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: '#2a9d8f' }}
              />
              <span className="legend-label">Fast (20-40%)</span>
            </div>
            <div className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: '#457b9d' }}
              />
              <span className="legend-label">Very Fast ({'<'}20%)</span>
            </div>
            <div className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: '#3d5a80' }}
              />
              <span className="legend-label">Cached (0ms)</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title">Module Details</span>
            </div>
            <div className="sidebar-content">
              {selectedNode ? (
                <>
                  <div className="detail-section">
                    <div className="detail-label">Evaluation Time</div>
                    <div className="detail-value detail-value-large">
                      {formatTime(selectedNode.value)}
                    </div>
                  </div>
                  <div className="detail-section">
                    <div className="detail-label">Module Name</div>
                    <div className="detail-value">{selectedNode.name}</div>
                  </div>
                  <div className="detail-section">
                    <div className="detail-label">Full Path</div>
                    <div className="detail-value detail-value-path">
                      {selectedNode.tooltip ?? selectedNode.name}
                    </div>
                  </div>
                  {selectedNode.children &&
                    selectedNode.children.length > 0 && (
                      <div className="detail-section">
                        <div className="detail-label">Direct Dependencies</div>
                        <div className="detail-value">
                          {selectedNode.children.length} module
                          {selectedNode.children.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <div className="empty-state">
                  <svg
                    className="empty-state-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <p className="empty-state-text">
                    Click on a module in the flame graph to view its details
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;
