import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { ColumnDef } from '@tanstack/react-table';
import { Flame, Layers, Package, RefreshCw } from 'lucide-react';
import {
  Badge,
  ChevronRight,
  Column,
  DescriptionList,
  EmptyState,
  FlameGraph,
  IconButton,
  PluginShell,
  Row,
  RozeniteLoader,
  SearchField,
  Select,
  Sidebar,
  Split,
  Tabs,
  Text,
  VirtualizedDataTable,
  type FlameGraphNode,
} from '@rozenite/ui';
import type { RequireChainData, RequireChainMeta, RequireProfilerEventMap } from '../shared';
import {
  aggregateModules,
  filterChains,
  matchesQuery,
  toFlameGraphNode,
  type ModuleStat,
} from './aggregations';
import { aggregatePackages, type PackageStat } from './analysis/packages';
import { findRequirePath } from './analysis/require-path';
import { formatCount, formatDuration, formatOffset } from './format';

import './globals.css';

const DURATION_THRESHOLDS = [
  { value: '0', label: 'All chains' },
  { value: '1', label: '≥ 1ms' },
  { value: '10', label: '≥ 10ms' },
  { value: '50', label: '≥ 50ms' },
  { value: '100', label: '≥ 100ms' },
] as const;

const GROUPINGS = [
  { value: 'modules', label: 'Modules' },
  { value: 'packages', label: 'Packages' },
] as const;

type Grouping = (typeof GROUPINGS)[number]['value'];

type SelectedItem =
  | {
      kind: 'module';
      name: string;
      path: string;
      selfTime: number;
      totalTime: number;
      /** Direct dependencies, when the selection came from the flame graph. */
      dependencies?: number;
      occurrences?: number;
    }
  | {
      kind: 'package';
      name: string;
      selfTime: number;
      inclusiveTime: number;
      moduleCount: number;
      entryCount: number;
    };

const RequireProfilerContent = () => {
  const client = useRozeniteDevToolsClient<RequireProfilerEventMap>({
    pluginId: '@rozenite/require-profiler-plugin',
  });

  const [chains, setChains] = useState<RequireChainMeta[]>([]);
  const [chainData, setChainData] = useState<Map<number, RequireChainData>>(new Map());
  const [selectedChainIndex, setSelectedChainIndex] = useState<number | null>(null);
  const [pendingChainIndex, setPendingChainIndex] = useState<number | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [minDuration, setMinDuration] = useState('0');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('flame-graph');
  const [grouping, setGrouping] = useState<Grouping>('modules');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedFrameKey, setSelectedFrameKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!client) {
      return;
    }

    const chainsListSubscription = client.onMessage('chains-list-response', (event) => {
      setChains(event.chains);
      setListLoading(false);
    });

    const chainDataSubscription = client.onMessage('chain-data-response', (event) => {
      const { data } = event;
      setPendingChainIndex(null);

      if (data) {
        setChainData((previous) => new Map(previous).set(data.index, data));
      }
    });

    const newChainSubscription = client.onMessage('new-chain', (event) => {
      setChains((previous) => {
        if (previous.some((chain) => chain.index === event.chain.index)) {
          return previous;
        }
        return [...previous, event.chain];
      });
    });

    setListLoading(true);
    client.send('request-chains-list', {});

    return () => {
      chainsListSubscription.remove();
      chainDataSubscription.remove();
      newChainSubscription.remove();
    };
  }, [client]);

  const visibleChains = useMemo(
    () => filterChains(chains, Number(minDuration)),
    [chains, minDuration],
  );

  const firstStartedAt = chains[0]?.startedAt ?? 0;

  const selectChain = useCallback(
    (index: number) => {
      setSelectedChainIndex(index);
      setSelectedItem(null);
      setSelectedFrameKey(undefined);

      if (!client || chainData.has(index)) {
        return;
      }

      setPendingChainIndex(index);
      client.send('request-chain-data', { chainIndex: index });
    },
    [client, chainData],
  );

  // Keep a chain selected as chains arrive, and step off one the filter hides.
  useEffect(() => {
    const stillVisible =
      selectedChainIndex !== null &&
      visibleChains.some((chain) => chain.index === selectedChainIndex);

    if (stillVisible || visibleChains.length === 0) {
      return;
    }

    selectChain(visibleChains[0].index);
  }, [visibleChains, selectedChainIndex, selectChain]);

  const handleReload = useCallback(() => {
    if (!client) {
      return;
    }

    setChains([]);
    setChainData(new Map());
    setSelectedChainIndex(null);
    setPendingChainIndex(null);
    setSelectedItem(null);
    setSelectedFrameKey(undefined);
    setListLoading(true);
    client.send('reload-and-profile', {});
  }, [client]);

  const currentChain = selectedChainIndex === null ? null : chainData.get(selectedChainIndex);
  const currentChainMeta = chains.find((chain) => chain.index === selectedChainIndex) ?? null;
  const chainLoading = pendingChainIndex !== null && pendingChainIndex === selectedChainIndex;

  const flameGraphData = useMemo(
    () => toFlameGraphNode(currentChain?.tree ?? null),
    [currentChain],
  );

  const moduleStats = useMemo(() => aggregateModules(currentChain?.tree ?? null), [currentChain]);
  const packageStats = useMemo(() => aggregatePackages(currentChain?.tree ?? null), [currentChain]);

  const filteredModuleStats = useMemo(() => {
    if (!query) {
      return moduleStats;
    }
    return moduleStats.filter((stat) => matchesQuery(stat.path, query));
  }, [moduleStats, query]);

  const filteredPackageStats = useMemo(() => {
    if (!query) {
      return packageStats;
    }
    return packageStats.filter((stat) => matchesQuery(stat.name, query));
  }, [packageStats, query]);

  const handleFrameSelect = useCallback((key: string, node: FlameGraphNode) => {
    setSelectedFrameKey(key);
    setSelectedItem({
      kind: 'module',
      name: node.name,
      path: node.tooltip ?? node.name,
      selfTime: node.selfValue ?? node.value,
      totalTime: node.value,
      dependencies: node.children?.length ?? 0,
    });
  }, []);

  const handleModuleRowClick = useCallback((stat: ModuleStat) => {
    setSelectedItem({
      kind: 'module',
      name: stat.name,
      path: stat.path,
      selfTime: stat.selfTime,
      totalTime: stat.totalTime,
      occurrences: stat.occurrences,
    });
  }, []);

  const handlePackageRowClick = useCallback((stat: PackageStat) => {
    setSelectedItem({
      kind: 'package',
      name: stat.name,
      selfTime: stat.selfTime,
      inclusiveTime: stat.inclusiveTime,
      moduleCount: stat.moduleCount,
      entryCount: stat.entryCount,
    });
  }, []);

  // Keyed by full path so an ancestor in the require-path chain can be
  // resolved back to the stat `handleModuleRowClick` expects, keeping
  // ancestor clicks on the same selection path as the top-modules table.
  const moduleStatsByPath = useMemo(() => {
    const map = new Map<string, ModuleStat>();
    for (const stat of moduleStats) {
      map.set(stat.path, stat);
    }
    return map;
  }, [moduleStats]);

  const handleAncestorSelect = useCallback(
    (path: string) => {
      const stat = moduleStatsByPath.get(path);
      if (stat) {
        handleModuleRowClick(stat);
      }
    },
    [moduleStatsByPath, handleModuleRowClick],
  );

  const requirePathResult = useMemo(() => {
    if (!currentChain?.tree || !selectedItem || selectedItem.kind !== 'module') {
      return null;
    }
    return findRequirePath(currentChain.tree, selectedItem.path);
  }, [currentChain, selectedItem]);

  const moduleColumns = useMemo<ColumnDef<ModuleStat>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Module',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate">{row.original.name}</div>
            <div className="truncate text-xs text-muted-foreground">{row.original.path}</div>
          </div>
        ),
      },
      {
        accessorKey: 'selfTime',
        header: 'Self',
        cell: ({ row }) => <Text variant="numeric">{formatDuration(row.original.selfTime)}</Text>,
      },
      {
        accessorKey: 'totalTime',
        header: 'Total',
        cell: ({ row }) => <Text variant="numeric">{formatDuration(row.original.totalTime)}</Text>,
      },
      {
        accessorKey: 'occurrences',
        header: 'Evaluations',
        cell: ({ row }) => <Text variant="numeric">{row.original.occurrences}</Text>,
      },
    ],
    [],
  );

  const packageColumns = useMemo<ColumnDef<PackageStat>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Package',
        cell: ({ row }) => <div className="min-w-0 truncate">{row.original.name}</div>,
      },
      {
        accessorKey: 'selfTime',
        header: 'Self',
        cell: ({ row }) => <Text variant="numeric">{formatDuration(row.original.selfTime)}</Text>,
      },
      {
        accessorKey: 'inclusiveTime',
        header: 'Inclusive',
        cell: ({ row }) => (
          <Text variant="numeric">{formatDuration(row.original.inclusiveTime)}</Text>
        ),
      },
      {
        accessorKey: 'moduleCount',
        header: 'Modules',
        cell: ({ row }) => <Text variant="numeric">{formatCount(row.original.moduleCount)}</Text>,
      },
    ],
    [],
  );

  if (!client) {
    return (
      <EmptyState
        icon={Flame}
        title="Connecting to the device…"
        description="Waiting for the app to report its require timings."
      />
    );
  }

  return (
    <Split direction="horizontal" autoSaveId="require-profiler">
      <Split.Pane defaultSize={24} minSize={16} maxSize={40}>
        <Sidebar className="w-full gap-2 border-r-0 p-0">
          <Sidebar.Header className="gap-2 px-2">
            <span className="flex-1 text-xs font-medium">Require chains</span>
            <IconButton
              label="Reload and profile"
              size="sm"
              variant="ghost"
              tone="neutral"
              onClick={handleReload}
            >
              <RefreshCw />
            </IconButton>
          </Sidebar.Header>

          <div className="px-2">
            <Select value={minDuration} onValueChange={(value) => setMinDuration(String(value))}>
              <Select.Trigger className="w-full" aria-label="Minimum chain duration">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {DURATION_THRESHOLDS.map((threshold) => (
                  <Select.Item key={threshold.value} value={threshold.value}>
                    {threshold.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {listLoading ? (
              <div className="flex flex-1 items-center justify-center p-4">
                <RozeniteLoader />
              </div>
            ) : visibleChains.length === 0 ? (
              <p className="p-3 text-center text-xs text-sidebar-foreground/60">
                {chains.length === 0
                  ? 'No require chains recorded yet. Reload the app to profile startup.'
                  : 'No chain is longer than the selected threshold.'}
              </p>
            ) : (
              <Sidebar.Group
                label={
                  visibleChains.length === chains.length
                    ? `${formatCount(chains.length)} chains`
                    : `${formatCount(visibleChains.length)} of ${formatCount(chains.length)} chains`
                }
              >
                {visibleChains.map((chain) => (
                  <Sidebar.Item
                    key={chain.index}
                    size="sm"
                    selected={chain.index === selectedChainIndex}
                    onClick={() => selectChain(chain.index)}
                    title={`${chain.rootModuleName} · ${formatCount(
                      chain.moduleCount,
                    )} modules · ${formatOffset(chain.startedAt, firstStartedAt)}`}
                    trailing={
                      <Badge size="sm" tone="neutral" variant="soft">
                        {formatDuration(chain.duration)}
                      </Badge>
                    }
                  >
                    {chain.rootModuleName}
                  </Sidebar.Item>
                ))}
              </Sidebar.Group>
            )}
          </div>
        </Sidebar>
      </Split.Pane>

      <Split.Handle />

      <Split.Pane>
        <Tabs
          value={view}
          onValueChange={(value) => setView(String(value))}
          className="flex h-full min-h-0 flex-col"
        >
          {/* A plain bar rather than `Toolbar`: a tab list inside a toolbar
              would nest two composite keyboard-navigation roots. */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-2 py-1.5">
            <Tabs.List size="sm">
              <Tabs.Tab size="sm" value="flame-graph">
                Flame graph
              </Tabs.Tab>
              <Tabs.Tab size="sm" value="top-modules">
                Top modules
              </Tabs.Tab>
            </Tabs.List>
            <div className="min-w-32 flex-1">
              <SearchField
                size="sm"
                placeholder={
                  view === 'top-modules' && grouping === 'packages'
                    ? 'Filter packages…'
                    : 'Filter modules…'
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery('')}
              />
            </div>
            {view === 'top-modules' && (
              <Select value={grouping} onValueChange={(value) => setGrouping(value as Grouping)}>
                <Select.Trigger
                  className="w-32 shrink-0"
                  size="sm"
                  aria-label="Group top modules by"
                >
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {GROUPINGS.map((option) => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            )}
            {currentChainMeta && (
              <div className="flex shrink-0 items-center gap-3 pr-1 text-xs text-muted-foreground">
                <span>
                  Total <Text variant="numeric">{formatDuration(currentChainMeta.duration)}</Text>
                </span>
                <span>
                  Modules <Text variant="numeric">{formatCount(currentChainMeta.moduleCount)}</Text>
                </span>
              </div>
            )}
          </div>

          <Tabs.Panel value="flame-graph" className="flex min-h-0 flex-1 flex-col">
            {chainLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <RozeniteLoader />
              </div>
            ) : (
              <>
                <FlameGraph
                  key={selectedChainIndex ?? 'none'}
                  aria-label="Require timings"
                  className="min-h-0 flex-1"
                  data={flameGraphData}
                  selectedKey={selectedFrameKey}
                  onSelect={handleFrameSelect}
                  highlight={query}
                  formatValue={formatDuration}
                  emptyState={
                    <EmptyState
                      icon={Flame}
                      title="No require timings for this chain"
                      description="Reload the app to record startup timings, then pick a chain on the left."
                    />
                  }
                />
                <FlameGraph.Legend className="shrink-0 border-t border-border" />
              </>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="top-modules" className="min-h-0 flex-1 overflow-hidden">
            {grouping === 'packages' ? (
              <VirtualizedDataTable
                ariaLabel="Packages by self time"
                columns={packageColumns}
                data={filteredPackageStats}
                getRowId={(stat) => stat.name}
                getRowTextValue={(stat) => stat.name}
                loading={chainLoading}
                emptyMessage={
                  query
                    ? 'No package matches your filter.'
                    : 'No packages recorded for this chain yet.'
                }
                onRowClick={handlePackageRowClick}
                scrollClassName="h-full w-full overflow-auto"
                style={{ height: '100%' }}
              />
            ) : (
              <VirtualizedDataTable
                ariaLabel="Modules by self time"
                columns={moduleColumns}
                data={filteredModuleStats}
                getRowId={(stat) => stat.path}
                getRowTextValue={(stat) => stat.path}
                loading={chainLoading}
                emptyMessage={
                  query
                    ? 'No module matches your filter.'
                    : 'No modules recorded for this chain yet.'
                }
                onRowClick={handleModuleRowClick}
                scrollClassName="h-full w-full overflow-auto"
                style={{ height: '100%' }}
              />
            )}
          </Tabs.Panel>
        </Tabs>
      </Split.Pane>

      {selectedItem && (
        <>
          <Split.Handle />
          <Split.Pane defaultSize={26} minSize={18} maxSize={45}>
            <div className="flex h-full min-h-0 flex-col overflow-y-auto border-l border-border bg-card">
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
                {selectedItem.kind === 'package' ? (
                  <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {selectedItem.name}
                </span>
              </div>
              {selectedItem.kind === 'package' ? (
                <DescriptionList className="p-3">
                  <DescriptionList.Item label="Self time">
                    <Text variant="numeric">{formatDuration(selectedItem.selfTime)}</Text>
                  </DescriptionList.Item>
                  <DescriptionList.Item label="Inclusive time">
                    <Text variant="numeric">{formatDuration(selectedItem.inclusiveTime)}</Text>
                  </DescriptionList.Item>
                  <DescriptionList.Item label="Modules">
                    <Text variant="numeric">{formatCount(selectedItem.moduleCount)}</Text>
                  </DescriptionList.Item>
                  <DescriptionList.Item label="Entries">
                    <Text variant="numeric">{formatCount(selectedItem.entryCount)}</Text>
                  </DescriptionList.Item>
                </DescriptionList>
              ) : (
                <>
                  {requirePathResult && requirePathResult.entries.length > 0 && (
                    <div className="border-b border-border p-3">
                      <Text variant="caption" className="mb-2 block">
                        Required by
                      </Text>
                      <Column gap={1}>
                        {requirePathResult.entries.map((entry, index) => {
                          const isTarget = index === requirePathResult.entries.length - 1;

                          return (
                            <Row
                              key={`${entry.path}-${index}`}
                              align="center"
                              gap={1}
                              style={{ paddingLeft: index * 12 }}
                            >
                              {index > 0 && (
                                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                              )}
                              {isTarget ? (
                                <Text
                                  variant="body"
                                  className="min-w-0 truncate font-medium"
                                  title={entry.path}
                                >
                                  {entry.name}
                                </Text>
                              ) : (
                                <button
                                  type="button"
                                  className="min-w-0 truncate text-left text-sm text-muted-foreground hover:text-foreground hover:underline"
                                  title={entry.path}
                                  onClick={() => handleAncestorSelect(entry.path)}
                                >
                                  {entry.name}
                                </button>
                              )}
                            </Row>
                          );
                        })}
                      </Column>
                      {requirePathResult.occurrences > 1 && (
                        <Text variant="caption" className="mt-2 block">
                          Also evaluated at {requirePathResult.occurrences - 1} other{' '}
                          {requirePathResult.occurrences - 1 === 1 ? 'point' : 'points'} in this
                          chain
                        </Text>
                      )}
                    </div>
                  )}
                  <DescriptionList className="p-3">
                    <DescriptionList.Item label="Self time">
                      <Text variant="numeric">{formatDuration(selectedItem.selfTime)}</Text>
                    </DescriptionList.Item>
                    <DescriptionList.Item label="Total time">
                      <Text variant="numeric">{formatDuration(selectedItem.totalTime)}</Text>
                    </DescriptionList.Item>
                    {selectedItem.dependencies !== undefined && (
                      <DescriptionList.Item label="Dependencies">
                        <Text variant="numeric">{formatCount(selectedItem.dependencies)}</Text>
                      </DescriptionList.Item>
                    )}
                    {selectedItem.occurrences !== undefined && (
                      <DescriptionList.Item label="Evaluations">
                        <Text variant="numeric">{formatCount(selectedItem.occurrences)}</Text>
                      </DescriptionList.Item>
                    )}
                    <DescriptionList.Item label="Path">
                      <span className="font-mono text-xs break-all">{selectedItem.path}</span>
                    </DescriptionList.Item>
                  </DescriptionList>
                </>
              )}
            </div>
          </Split.Pane>
        </>
      )}
    </Split>
  );
};

const RequireProfilerPanel = () => {
  return (
    <PluginShell>
      <PluginShell.Body>
        <RequireProfilerContent />
      </PluginShell.Body>
    </PluginShell>
  );
};

export default RequireProfilerPanel;
