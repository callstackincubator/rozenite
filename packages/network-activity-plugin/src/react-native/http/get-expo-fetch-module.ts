type ExpoFetchModule = {
  fetch: typeof globalThis.fetch;
};

const expoFetchModule = (() => {
  try {
    return require('expo/fetch') as ExpoFetchModule;
  } catch {
    return null;
  }
})();

export const getExpoFetchModule = (): ExpoFetchModule | null => {
  return expoFetchModule;
};
