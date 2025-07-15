declare global {
  var __FUSEBOX_REACT_DEVTOOLS_DISPATCHER__: {
    BINDING_NAME: string;
    initializeDomain: (domainName: string) => CdpDomain;
    onDomainInitialization: {
      addEventListener: (listener: (domain: CdpDomain) => void) => void;
      removeEventListener: (listener: (domain: CdpDomain) => void) => void;
    };
  };
}

export {};
