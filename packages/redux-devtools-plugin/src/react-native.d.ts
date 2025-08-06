declare module 'react-native/Libraries/Core/Devtools/getDevServer' {
  export type DevServerInfo = {
    url: string;
    fullBundleUrl?: string;
    bundleLoadedFromServer: boolean;
  };
  export default function getDevServer(): DevServerInfo;
}
