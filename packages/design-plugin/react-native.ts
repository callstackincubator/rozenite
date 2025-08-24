export let RozeniteDesignDevTools: typeof import('./src/react-native/RozeniteDesignDevTools').RozeniteDesignDevTools;

if (process.env.NODE_ENV !== 'production') {
  RozeniteDesignDevTools =
    require('./src/react-native/RozeniteDesignDevTools').RozeniteDesignDevTools;
} else {
  RozeniteDesignDevTools = () => null;
}
