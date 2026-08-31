export default {
  panels: [
    {
      name: 'Hello world!',
      source: './src/hello-world.tsx',
    },
  ],
  // Which environments this plugin supports. Omitting this defaults to
  // ['react-native']. See the docs for typing this file with
  // `satisfies RozeniteConfig` to catch a typo'd id in the editor.
  integrations: ['react-native'],
};
