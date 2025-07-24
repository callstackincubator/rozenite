type XHRInterceptorOpenCallback = (
  method: string,
  url: string,
  request: XMLHttpRequest,
) => void;

type XHRInterceptorSendCallback = (
  data: string,
  request: XMLHttpRequest,
) => void;

type XHRInterceptorRequestHeaderCallback = (
  header: string,
  value: string,
  request: XMLHttpRequest,
) => void;

type XHRInterceptorHeaderReceivedCallback = (
  responseContentType: string | void,
  responseSize: number | void,
  allHeaders: string,
  request: XMLHttpRequest,
) => void;

type XHRInterceptorResponseCallback = (
  status: number,
  timeout: number,
  response: string,
  responseURL: string,
  responseType: string,
  request: XMLHttpRequest,
) => void;

type XHRInterceptor = {
  isInterceptorEnabled: () => boolean;
  setOpenCallback: (callback: XHRInterceptorOpenCallback) => void;
  setRequestHeaderCallback: (callback: XHRInterceptorRequestHeaderCallback) => void;
  setSendCallback: (callback: XHRInterceptorSendCallback) => void;
  setHeaderReceivedCallback: (callback: XHRInterceptorHeaderReceivedCallback) => void;
  setResponseCallback: (callback: XHRInterceptorResponseCallback) => void;
  enableInterception: () => void;
  disableInterception: () => void;
};

export const getXHRInterceptor = (): XHRInterceptor => {
  try {
    // React Native 0.80+
    const module = require('react-native/src/private/devsupport/devmenu/elementinspector/XHRInterceptor');
    return module.default ?? module;
  } catch {
    // Do nothing
  }

  try {
    // React Native 0.79+
    const module = require('react-native/src/private/inspector/XHRInterceptor');
    return module.default ?? module;
  } catch {
    // Do nothing
  }

  try {
    const module = require('react-native/Libraries/Network/XHRInterceptor');
    return module.default ?? module;
  } catch {
    // Do nothing
  }

  throw new Error('XHRInterceptor could not be found. Report this issue to the Rozenite team.');
}  