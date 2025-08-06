import { getCdpChannel } from './device/cdp-channel';
import { getPanelChannel } from './browser/panel-channel';
import { Channel } from './types';

let channel: Promise<Channel> | Channel | null = null;

export const getChannel = async (): Promise<Channel> => {
  // Channel can be safely reused, because it's not scoped to the plugin.

  if (channel) {
    return channel;
  }

  const isPanel = '__ROZENITE_PANEL__' in window;
  channel = isPanel ? getPanelChannel() : getCdpChannel();

  // Replace promise with channel when it's ready.
  channel.then((instance) => {
    channel = instance;
  });

  return channel;
};
