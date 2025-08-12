export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'cli',
        'expo-atlas-plugin',
        'metro',
        'mmkv-plugin',
        'network-activity-plugin',
        'plugin-bridge',
        'runtime',
        'tanstack-query-plugin',
        'vite-plugin',
        'website',
        'redux-devtools-plugin',
        'playground',
        'middleware',
        'repack',
        'performance-monitor-plugin',
        '',
      ],
    ],
  },
};
