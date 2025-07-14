declare global {
  declare const callstack: {
    devtools: {
      panels: {
        create: (name: string, icon: string, url: string) => void;
      };
    };
  };
}

export {};
