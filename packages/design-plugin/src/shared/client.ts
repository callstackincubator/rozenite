import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';

export type RozeniteDesignDevToolsEvents = {
  'set-grid': {
    show: boolean;
    cellSize: number;
    majorLineEvery: number;
    minorColor: string;
    majorColor: string;
  };
  'set-overlay': {
    show: boolean;
    imageUri: string;
    initialDividerPosition: number;
  };
};

export type RozeniteDesignDevToolsClient =
  RozeniteDevToolsClient<RozeniteDesignDevToolsEvents>;
