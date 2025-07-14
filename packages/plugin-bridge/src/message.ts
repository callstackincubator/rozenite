export type DevToolsPluginMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

export const getDevToolsMessage = (
  data: string
): DevToolsPluginMessage | null => {
  try {
    const message = JSON.parse(data);
    if (
      typeof message !== 'object' ||
      message === null ||
      !('pluginId' in message) ||
      !('type' in message) ||
      !('payload' in message)
    ) {
      return null;
    }

    return message;
  } catch {
    return null;
  }
};
