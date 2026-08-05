export type ShellPanel = {
  id: string;
  name: string;
  source: string;
};

export type ShellPlugin = {
  id: string;
  name: string;
  description: string;
  panels: ShellPanel[];
};

export type ShellConfiguration = {
  plugins: ShellPlugin[];
};
