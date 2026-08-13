export type DevToolsPluginMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

export const getDevToolsMessage = (message: unknown): DevToolsPluginMessage | null => {
  if (
    typeof message !== 'object' ||
    message === null ||
    typeof (message as { pluginId?: unknown }).pluginId !== 'string' ||
    !('type' in message) ||
    !('payload' in message)
  ) {
    return null;
  }

  return message as DevToolsPluginMessage;
};
