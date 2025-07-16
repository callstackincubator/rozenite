/* eslint-disable @nx/enforce-module-boundaries */
import * as UI from '/rozenite/ui/legacy/legacy.js';
import * as SDK from '/rozenite/core/sdk/sdk.js';
import * as ReactNativeModels from '/rozenite/models/react_native/react_native.js';

export type RuntimeEvent<T> = {
  data: T;
};

export { UI, SDK, ReactNativeModels };
