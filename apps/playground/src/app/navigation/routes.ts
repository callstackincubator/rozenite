// Single source of truth for the root stack: route name, deep-link path,
// accessibility label/title, and the home-index group it belongs to.
// `docs/agents/playground-testing.md` documents this table for agents.

export type RouteGroup =
  | 'State'
  | 'Storage'
  | 'Flags'
  | 'Network'
  | 'Performance'
  | 'Forms'
  | 'Navigation'
  | 'Settings';

export type RouteDef = {
  name: string;
  /** Path segment under the `rozenite://` deep-link prefix. */
  path: string;
  title: string;
  accessibilityLabel: string;
  /** Home-index group. Routes without a group are not listed on the home index. */
  group?: RouteGroup;
};

export const routes = {
  home: {
    name: 'Home',
    path: '',
    title: 'Rozenite Playground',
    accessibilityLabel: 'Rozenite Playground home',
  },
  controlsPlugin: {
    name: 'ControlsPlugin',
    path: 'controls',
    title: 'Controls',
    accessibilityLabel: 'Controls plugin',
    group: 'State',
  },
  reduxTest: {
    name: 'ReduxTest',
    path: 'redux',
    title: 'Redux',
    accessibilityLabel: 'Redux DevTools demo',
    group: 'State',
  },
  storagePlugin: {
    name: 'StoragePlugin',
    path: 'storage',
    title: 'Storage',
    accessibilityLabel: 'Storage plugin',
    group: 'Storage',
  },
  fileSystemTest: {
    name: 'FileSystemTest',
    path: 'file-system',
    title: 'File System',
    accessibilityLabel: 'File system plugin',
    group: 'Storage',
  },
  featureFlagsPlugin: {
    name: 'FeatureFlagsPlugin',
    path: 'feature-flags',
    title: 'Feature Flags',
    accessibilityLabel: 'Feature flags plugin',
    group: 'Flags',
  },
  networkTest: {
    name: 'NetworkTest',
    path: 'network',
    title: 'Network Activity',
    accessibilityLabel: 'Network activity plugin',
    group: 'Network',
  },
  requestBodyTest: {
    name: 'RequestBodyTest',
    path: 'network/request-body',
    title: 'Request Body',
    accessibilityLabel: 'Network request body test',
  },
  performanceMonitor: {
    name: 'PerformanceMonitor',
    path: 'performance/monitor',
    title: 'Performance Monitor',
    accessibilityLabel: 'Performance monitor plugin',
    group: 'Performance',
  },
  requireProfilerTest: {
    name: 'RequireProfilerTest',
    path: 'performance/require-profiler',
    title: 'Require Profiler',
    accessibilityLabel: 'Require profiler plugin',
    group: 'Performance',
  },
  perfProblem: {
    name: 'PerfProblem',
    path: 'performance/perf-problem',
    title: 'Perf Problem',
    accessibilityLabel: 'Performance problem demo',
    group: 'Performance',
  },
  reactHookFormPlugin: {
    name: 'ReactHookFormPlugin',
    path: 'forms',
    title: 'React Hook Form',
    accessibilityLabel: 'React Hook Form plugin',
    group: 'Forms',
  },
  bottomTabs: {
    name: 'BottomTabs',
    path: 'navigation',
    title: 'React Navigation Demo',
    accessibilityLabel: 'React Navigation demo',
    group: 'Navigation',
  },
  parameterDisplay: {
    name: 'ParameterDisplay',
    path: 'navigation/parameter-display',
    title: 'Parameter Display',
    accessibilityLabel: 'Navigation parameter display',
  },
  successiveScreensStack: {
    name: 'SuccessiveScreensStack',
    path: 'navigation/successive',
    title: 'Successive Screens',
    accessibilityLabel: 'Successive screens demo',
  },
  settings: {
    name: 'Settings',
    path: 'settings',
    title: 'Settings',
    accessibilityLabel: 'Playground settings',
    group: 'Settings',
  },
} as const satisfies Record<string, RouteDef>;

export type RouteKey = keyof typeof routes;

export const routeList: RouteDef[] = Object.values(routes);

export const groupedRoutes: Partial<Record<RouteGroup, RouteDef[]>> = routeList.reduce(
  (acc, route) => {
    if (!route.group) {
      return acc;
    }

    acc[route.group] = [...(acc[route.group] ?? []), route];
    return acc;
  },
  {} as Partial<Record<RouteGroup, RouteDef[]>>,
);
