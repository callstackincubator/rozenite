export let useReactQueryDevTools: typeof import('./src/useReactQueryDevTools').useReactQueryDevTools;

if (process.env.NODE_ENV !== 'production') {
  useReactQueryDevTools =
    require('./src/useReactQueryDevTools').useReactQueryDevTools;
} else {
  useReactQueryDevTools = () => {
    // noop!
  };
}
