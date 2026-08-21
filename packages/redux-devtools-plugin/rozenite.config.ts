export default {
  integrations: ['react-native', 'react-native-web'],
  panels: [
    {
      name: 'Redux DevTools',
      source: './src/ui/panel.tsx',
    },
  ],
  // The store enhancer runs in ordinary app code, so it needs a touchpoint
  // that survives a production build. See `register.ts`.
  productionEntries: ['./register'],
};
