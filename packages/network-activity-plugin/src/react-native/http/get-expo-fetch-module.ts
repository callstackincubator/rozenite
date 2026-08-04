type ExpoFetchModule = {
  fetch: typeof globalThis.fetch;
};

const expoFetchModule = (() => {
  try {
    // `expo/fetch` is a getter-only public facade. Patching the writable
    // implementation export keeps normal ESM imports live without trying to
    // assign through that facade.
    return require('expo/src/winter/fetch/fetch') as ExpoFetchModule;
  } catch {
    return null;
  }
})();

export const getExpoFetchModule = (): ExpoFetchModule | null => {
  return expoFetchModule;
};
