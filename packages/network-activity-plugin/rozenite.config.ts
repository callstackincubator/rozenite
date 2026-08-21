export default {
  panels: [
    {
      name: 'Network Activity',
      source: './src/ui/App.tsx',
    },
  ],
  // `withOnBootNetworkActivityRecording` is documented to be called from
  // `index.js`, before any other imports, so it needs a touchpoint that
  // survives a production build. See `register.ts`.
  productionEntries: ['./register'],
};
