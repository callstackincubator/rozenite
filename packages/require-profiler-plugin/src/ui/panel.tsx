import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FlameGraph, RawData } from 'react-flame-graph';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { RequireProfilerEventMap, RequireTimingNode } from '../shared';
import {
  transformToFlameGraphData,
  calculateStats,
  findMaxValue,
  applyColors,
} from './transformations';
import {
  Header,
  InfoBar,
  Legend,
  LoadingState,
  EmptyState,
  Sidebar,
} from './components';

import './styles.css';

const App = () => {
  const [selectedNode, setSelectedNode] = useState<RawData | null>(null);
  const [showSidebar, setShowSidebar] = useState(() => window.innerWidth > 768);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [flameGraphData, setFlameGraphData] =
    useState<RequireTimingNode | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-hide sidebar on small screens (only on resize)
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmallScreen = window.innerWidth <= 768;
      if (isSmallScreen && !selectedNode) {
        setShowSidebar(false);
      }
    };

    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, [selectedNode]);

  const client = useRozeniteDevToolsClient<RequireProfilerEventMap>({
    pluginId: '@rozenite/require-profiler-plugin',
  });

  // Request data on mount and when client becomes available
  useEffect(() => {
    if (!client) {
      return;
    }

    // Request initial data
    client.send('request-data', {});
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
    client.send('reload-and-profile', {});
  }, [client]);

  const handleToggleSidebar = useCallback(() => {
    setShowSidebar((prev) => !prev);
  }, []);

  // Auto-show sidebar when node is selected on small screens
  useEffect(() => {
    if (selectedNode && window.innerWidth <= 768) {
      setShowSidebar(true);
    }
  }, [selectedNode]);

  // Transform RequireTimingNode to RawData format
  const transformedData = useMemo(() => {
    return transformToFlameGraphData(flameGraphData);
  }, [flameGraphData]);

  const stats = useMemo(() => {
    if (!transformedData) {
      return { totalModules: 0, totalTime: 0 };
    }
    return calculateStats(transformedData);
  }, [transformedData]);

  const maxValue = useMemo(() => {
    if (!transformedData) {
      return 0;
    }
    return findMaxValue(transformedData);
  }, [transformedData]);

  const coloredData = useMemo(() => {
    if (!transformedData || maxValue === 0) {
      return null;
    }
    return applyColors(transformedData, maxValue);
  }, [transformedData, maxValue]);

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

  const handleChange = useCallback((node: RawData | { source: RawData }) => {
    setSelectedNode('source' in node ? (node.source as RawData) : node);
  }, []);

  const handleReset = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle ESC key to reset zoom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleReset]);

  return (
    <div className="app-container">
      <Header
        onRefresh={handleRefresh}
        onToggleSidebar={handleToggleSidebar}
        showSidebar={showSidebar}
        loading={loading}
        clientAvailable={!!client}
      />

      <InfoBar
        totalTime={stats.totalTime}
        totalModules={stats.totalModules}
        entryName={transformedData?.name}
      />

      <div className="main-content">
        <div className="flame-graph-container">
          <div className="flame-graph-wrapper" ref={containerRef}>
            {loading ? (
              <LoadingState />
            ) : !transformedData || !coloredData ? (
              <EmptyState message="No data available. Click refresh to load require profiler data." />
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

          <Legend />
        </div>

        {showSidebar && <Sidebar selectedNode={selectedNode} />}
      </div>
    </div>
  );
};

export default App;
