export type Plugin = string;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type GuestFunctions = {};

export type HostFunctions = {
  createPanel: (name: string, url: string) => void;
  getPlugins: () => Plugin[];
};
