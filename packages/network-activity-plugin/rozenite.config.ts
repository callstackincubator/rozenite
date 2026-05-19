export default {
  panels: [
    {
      name: 'Network Activity',
      source: './src/ui/App.tsx',
    },
  ],
  dev: {
    flows: [
      {
        name: 'Start recording',
        autoRun: true,
        run({ send }) {
          send('network-enable', {});
        },
      },
    ],
  },
};
