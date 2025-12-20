import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FlameGraph, RawData } from 'react-flame-graph';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  RequireProfilerEventMap,
  RequireChainMeta,
  RequireChainData,
} from '../shared';
import {
  transformToFlameGraphData,
  calculateStats,
  findMaxValue,
  applyColors,
  ensureMinimumValues,
} from './transformations';
import {
  Header,
  InfoBar,
  Legend,
  LoadingState,
  EmptyState,
  Sidebar,
  OptionsModal,
  ProfilerOptions,
} from './components';

import './styles.css';

const DEFAULT_OPTIONS: ProfilerOptions = {
  minChainDurationMs: 0,
};

const App = () => {
  const [selectedNode, setSelectedNode] = useState<RawData | null>(null);
  const [showSidebar, setShowSidebar] = useState(() => window.innerWidth > 768);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [chainsList, setChainsList] = useState<RequireChainMeta[]>([]);
  const [currentChainIndex, setCurrentChainIndex] = useState(0);
  const [currentChainData, setCurrentChainData] =
    useState<RequireChainData | null>(null);
  const [chainDataCache, setChainDataCache] = useState<
    Map<number, RequireChainData>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [options, setOptions] = useState<ProfilerOptions>(DEFAULT_OPTIONS);
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

  // Request chains list on mount and when client becomes available
  useEffect(() => {
    if (!client) {
      return;
    }

    // Request chains list
    client.send('request-chains-list', {});
    setLoading(true);

    // Listen for chains list responses
    const chainsListSubscription = client.onMessage(
      'chains-list-response',
      (event) => {
        setChainsList(event.chains);
        setLoading(false);

        // If we have chains, request the first one directly
        if (event.chains.length > 0) {
          setCurrentChainIndex(0);
          setLoading(true);
          client.send('request-chain-data', { chainIndex: 0 });
        }
      },
    );

    // Listen for chain data responses
    const chainDataSubscription = client.onMessage(
      'chain-data-response',
      (event) => {
        if (event.data) {
          setChainDataCache(
            (prev) => new Map(prev.set(event.data.index, event.data)),
          );
          setCurrentChainData(event.data);
        }
        setLoading(false);
      },
    );

    // Listen for new chain notifications (lazy requires)
    const newChainSubscription = client.onMessage('new-chain', (event) => {
      setChainsList((prev) => [...prev, event.chain]);
    });

    return () => {
      chainsListSubscription.remove();
      chainDataSubscription.remove();
      newChainSubscription.remove();
    };
  }, [client]);

  const loadChainData = useCallback(
    (chainIndex: number) => {
      // Check cache first
      const cachedData = chainDataCache.get(chainIndex);
      if (cachedData) {
        setCurrentChainData(cachedData);
        return;
      }

      // Request from client
      if (client) {
        setLoading(true);
        client.send('request-chain-data', { chainIndex });
      }
    },
    [client, chainDataCache],
  );

  const handleRefresh = useCallback(() => {
    if (!client) {
      return;
    }
    setLoading(true);
    setChainsList([]);
    setCurrentChainIndex(0);
    setCurrentChainData(null);
    setChainDataCache(new Map());
    client.send('reload-and-profile', {});
  }, [client]);

  const handleToggleSidebar = useCallback(() => {
    setShowSidebar((prev) => !prev);
  }, []);

  const handleOpenOptions = useCallback(() => {
    setShowOptionsModal(true);
  }, []);

  const handleCloseOptions = useCallback(() => {
    setShowOptionsModal(false);
  }, []);

  const handleOptionsChange = useCallback(
    (newOptions: ProfilerOptions) => {
      setOptions(newOptions);

      const noFilter = newOptions.minChainDurationMs <= 0;

      // Determine which chains pass the new filter
      const validChainIndices = chainsList
        .map((_, index) => index)
        .filter((index) => {
          if (noFilter) {
            // No filter - all chains are valid
            return true;
          }

          // Filter active - only include cached chains that meet the threshold
          const cachedData = chainDataCache.get(index);
          return (
            cachedData && cachedData.tree.value >= newOptions.minChainDurationMs
          );
        });

      // Check if current chain is still valid under new filter
      const currentChainStillValid =
        validChainIndices.includes(currentChainIndex);

      if (currentChainStillValid) {
        // Current chain passes the filter, ensure it's loaded/restored
        loadChainData(currentChainIndex);
      } else if (validChainIndices.length > 0) {
        // Current chain doesn't pass filter, navigate to first valid chain
        const firstValidIndex = validChainIndices[0];
        setCurrentChainIndex(firstValidIndex);
        loadChainData(firstValidIndex);
      } else {
        // No valid chains available
        setCurrentChainData(null);
      }
    },
    [chainsList, chainDataCache, currentChainIndex, loadChainData],
  );

  // Filter chains based on minimum duration threshold
  // When filter is active, only include chains that have been loaded AND pass the threshold
  // When filter is not active (0), include all chains
  const filteredChainIndices = useMemo(() => {
    if (options.minChainDurationMs <= 0) {
      // No filter - show all chains
      return chainsList.map((_, index) => index);
    }

    // Filter active - only include chains that are cached AND pass the duration threshold
    return chainsList
      .map((_, index) => index)
      .filter((index) => {
        const cachedData = chainDataCache.get(index);
        // Only include if cached and passes filter
        if (!cachedData) {
          return false;
        }
        return cachedData.tree.value >= options.minChainDurationMs;
      });
  }, [chainsList, chainDataCache, options.minChainDurationMs]);

  // Find the current position in filtered list
  const currentFilteredPosition = useMemo(() => {
    return filteredChainIndices.indexOf(currentChainIndex);
  }, [filteredChainIndices, currentChainIndex]);

  // Check if current chain passes the filter
  const currentChainPassesFilter = useMemo(() => {
    if (options.minChainDurationMs <= 0) {
      return true;
    }
    const cachedData = chainDataCache.get(currentChainIndex);
    if (!cachedData) {
      return true; // Not loaded yet, assume it passes
    }
    return cachedData.tree.value >= options.minChainDurationMs;
  }, [currentChainIndex, chainDataCache, options.minChainDurationMs]);

  const handlePrevChain = useCallback(() => {
    if (currentFilteredPosition > 0) {
      const newIndex = filteredChainIndices[currentFilteredPosition - 1];
      setCurrentChainIndex(newIndex);
      loadChainData(newIndex);
    }
  }, [currentFilteredPosition, filteredChainIndices, loadChainData]);

  const handleNextChain = useCallback(() => {
    if (currentFilteredPosition < filteredChainIndices.length - 1) {
      const newIndex = filteredChainIndices[currentFilteredPosition + 1];
      setCurrentChainIndex(newIndex);
      loadChainData(newIndex);
    }
  }, [currentFilteredPosition, filteredChainIndices, loadChainData]);

  // Auto-show sidebar when node is selected on small screens
  useEffect(() => {
    if (selectedNode && window.innerWidth <= 768) {
      setShowSidebar(true);
    }
  }, [selectedNode]);

  // Transform RequireTimingNode to RawData format
  const transformedData = useMemo(() => {
    return transformToFlameGraphData(currentChainData?.tree || null);
  }, [currentChainData]);

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
    if (!transformedData) {
      return null;
    }
    // If all times are 0, ensure minimum values so nodes are visible
    const dataToColor =
      stats.totalTime === 0
        ? ensureMinimumValues(transformedData)
        : transformedData;
    return applyColors(dataToColor, maxValue);
  }, [transformedData, maxValue, stats.totalTime]);

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
        onOpenOptions={handleOpenOptions}
        showSidebar={showSidebar}
        loading={loading}
        clientAvailable={!!client}
        currentChainIndex={
          currentFilteredPosition >= 0 ? currentFilteredPosition : 0
        }
        totalChains={filteredChainIndices.length}
        onPrevChain={handlePrevChain}
        onNextChain={handleNextChain}
      />

      <OptionsModal
        isOpen={showOptionsModal}
        onClose={handleCloseOptions}
        options={options}
        onOptionsChange={handleOptionsChange}
      />

      <InfoBar
        totalTime={stats.totalTime}
        totalModules={stats.totalModules}
        entryName={currentChainData?.rootModuleName || transformedData?.name}
      />

      <div className="main-content">
        <div className="flame-graph-container">
          <div className="flame-graph-wrapper" ref={containerRef}>
            {loading ? (
              <LoadingState />
            ) : !transformedData ||
              !coloredData ||
              !currentChainPassesFilter ||
              filteredChainIndices.length === 0 ? (
              <EmptyState
                message={
                  chainsList.length === 0
                    ? 'No require chains available. Click refresh to load require profiler data.'
                    : filteredChainIndices.length === 0 &&
                        options.minChainDurationMs > 0
                      ? `No chains found with duration ≥ ${options.minChainDurationMs}ms. Try lowering the threshold in options.`
                      : 'No data available for this chain.'
                }
              />
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
