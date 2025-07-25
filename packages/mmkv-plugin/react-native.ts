export let useMMKVDevTools: typeof import('./src/react-native/useMMKVDevTools').useMMKVDevTools;

if (process.env.NODE_ENV !== 'production') {
  useMMKVDevTools =
    require('./src/react-native/useMMKVDevTools').useMMKVDevTools;
} else {
  useMMKVDevTools = () => null;
}
