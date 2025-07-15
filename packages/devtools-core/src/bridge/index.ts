export type Plugin = string;

export type GuestFunctions = {
  onMessage: (message: unknown) => void;
};

export type HostFunctions = {
  createPanel: (name: string, url: string) => void;
};
