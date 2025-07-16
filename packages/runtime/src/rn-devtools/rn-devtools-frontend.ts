/* eslint-disable @nx/enforce-module-boundaries */
import * as UI from '/callstack/ui/legacy/legacy.js';
import * as SDK from '/callstack/core/sdk/sdk.js';
import * as ReactNativeModels from '/callstack/models/react_native/react_native.js';

export type RuntimeEvent<T> = {
  data: T;
};

export { UI, SDK, ReactNativeModels };
