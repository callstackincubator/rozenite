declare global {
  interface Plugin {
    id: string;
    name: string;
    description: string;
    website: string;
  }

  declare const callstack: {
    devtools: {
      panels: {
        create: (name: string, icon: string, url: string) => void;
      };
      plugins: Plugin[];
    };
  };
}

export {};
