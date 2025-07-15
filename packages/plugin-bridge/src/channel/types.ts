import { Subscription } from '../types';

export type Channel = {
  send: (message: unknown) => void;
  onMessage: (listener: (message: unknown) => void) => Subscription;
  close: () => void;
};
