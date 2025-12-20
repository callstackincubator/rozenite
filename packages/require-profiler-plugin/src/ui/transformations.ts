import { RawData } from 'react-flame-graph';
import { RequireTimingNode } from '../shared';

// Transform RequireTimingNode to RawData format for flame graph
export const transformToFlameGraphData = (
  node: RequireTimingNode | null,
): RawData | null => {
  if (!node) {
    return null;
  }

  return {
    name: node.name,
    value: node.value,
    tooltip: node.tooltip,
    children: node.children
      ?.map(transformToFlameGraphData)
      .filter((child): child is RawData => child !== null),
  };
};

// Calculate statistics from the data
// Note: In flame graphs, each node's value already includes its children's time,
// so we only count modules recursively, not sum times (which would double-count)
export const calculateStats = (
  node: RawData,
): {
  totalModules: number;
  totalTime: number;
} => {
  let totalModules = 1;

  if (node.children) {
    for (const child of node.children) {
      const childStats = calculateStats(child);
      totalModules += childStats.totalModules;
    }
  }

  // The root node's value is the total time for everything
  return { totalModules, totalTime: node.value ?? 0 };
};

// Calculate self-time for a node (time spent in module itself, excluding children)
export const getSelfTime = (node: RawData): number => {
  const childrenTime =
    node.children?.reduce((sum, child) => sum + child.value, 0) ?? 0;
  return node.value - childrenTime;
};

// Generate color based on self-time value (heat map style)
export const getColorForValue = (value: number, maxValue: number): string => {
  if (value === 0) return '#3d5a80'; // Cool blue for zero-time modules

  const ratio = Math.min(value / maxValue, 1);

  if (ratio > 0.7) return '#e63946'; // Hot red
  if (ratio > 0.4) return '#f4a261'; // Warm orange
  if (ratio > 0.2) return '#2a9d8f'; // Teal
  return '#457b9d'; // Cool blue
};

// Find max self-time in tree
export const findMaxValue = (node: RawData): number => {
  let max = getSelfTime(node);
  if (node.children) {
    for (const child of node.children) {
      max = Math.max(max, findMaxValue(child));
    }
  }
  return max;
};

// Ensure minimum visibility for flame graph nodes when all times are 0
// Each node gets at least 1 unit of width so the structure is visible
export const ensureMinimumValues = (node: RawData): RawData => {
  const children = node.children?.map(ensureMinimumValues);

  // Calculate minimum value: 1 for self + sum of children's values
  const childrenValue =
    children?.reduce((sum, child) => sum + child.value, 0) ?? 0;
  const minValue = 1 + childrenValue;

  return {
    ...node,
    value: Math.max(node.value, minValue),
    children,
  };
};

// Apply colors to flame graph data based on self-time
export const applyColors = (node: RawData, maxValue: number): RawData => {
  const selfTime = getSelfTime(node);
  const color = getColorForValue(selfTime, maxValue);
  return {
    ...node,
    backgroundColor: color,
    color: '#ffffff',
    children: node.children?.map((child) => applyColors(child, maxValue)),
  };
};

export const formatTime = (ms: number | undefined): string => {
  if (ms == null || isNaN(ms)) {
    return '0ms';
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(1)}ms`;
};
