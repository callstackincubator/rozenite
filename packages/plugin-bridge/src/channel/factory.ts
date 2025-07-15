import { getCdpChannel } from './device/cdp-channel';
import { getPanelChannel } from './browser/panel-channel';
import { Channel } from './types';

export const getChannel = async (): Promise<Channel> => {
  const isPanel = '__ROZENITE_PANEL__' in window;

  if (isPanel) {
    return getPanelChannel();
  }

  return getCdpChannel();
};
