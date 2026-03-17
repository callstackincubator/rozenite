export type ReduxDevToolsRequest =
  | {
      type: 'STATE';
      payload: string;
      instanceId: string;
      name?: string;
    }
  | {
      type: 'ACTION';
      payload: string;
      action: string;
      nextActionId: number;
      maxAge: number;
      isExcess?: boolean;
      instanceId: string;
      name?: string;
    };

export type ReduxDevToolsRuntimeMessage =
  | {
      type: 'state-update';
      connectionId: string;
      request: ReduxDevToolsRequest;
    }
  | {
      type: 'error';
      message: string;
    };

export type ReduxDevToolsPanelCommand =
  | {
      type: 'request-state';
      instanceId?: string;
    }
  | {
      type: 'start';
      instanceId?: string;
    }
  | {
      type: 'stop';
      instanceId?: string;
    }
  | {
      type: 'update';
      instanceId?: string;
    }
  | {
      type: 'dispatch';
      action: unknown;
      instanceId?: string;
      toAll?: boolean;
    }
  | {
      type: 'action';
      action: string | { args: string[]; rest: string; selected: number };
      instanceId?: string;
    }
  | {
      type: 'import-state';
      state: string;
      instanceId?: string;
    };

export type ReduxDevToolsBridgeEventMap = {
  'runtime-message': ReduxDevToolsRuntimeMessage;
  'panel-command': ReduxDevToolsPanelCommand;
};
