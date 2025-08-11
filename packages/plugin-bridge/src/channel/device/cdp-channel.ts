import { isWeb } from '../../web.js';
import { Channel } from '../types.js';
import { UnsupportedPlatformError } from '../../errors.js';

export type CdpMessageListener = (message: unknown) => void;

export type CdpDomain = {
  name: string;
  sendMessage: (message: unknown) => void;
  onMessage: {
    addEventListener: (listener: CdpMessageListener) => void;
    removeEventListener: (listener: CdpMessageListener) => void;
  };
  close: () => void;
};

const DOMAIN_NAME = 'rozenite';

const getInitialCdpDomain = (): CdpDomain | null => {
  const dispatcher = global.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__;
  const bindingName = dispatcher.BINDING_NAME;
  const globalBinding = (global as Record<string, unknown>)[bindingName];

  if (globalBinding != null) {
    return dispatcher.initializeDomain(DOMAIN_NAME);
  }

  return null;
};

const waitForDomain = (): Promise<CdpDomain> => {
  return new Promise((resolve) => {
    const handler = (domain: CdpDomain) => {
      if (domain.name === DOMAIN_NAME) {
        global.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.onDomainInitialization.removeEventListener(
          handler
        );

        // This is on purpose. Without setTimeout the promise will be never resolved.
        // Hermes bug?
        setTimeout(() => resolve(domain));
      }
    };

    global.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.onDomainInitialization.addEventListener(
      handler
    );
  });
};

const getCdpDomainProxy = async (): Promise<Channel> => {
  const eventListeners = new Set<CdpMessageListener>();
  let instance = getInitialCdpDomain();

  if (!instance) {
    instance = await waitForDomain();
  }

  const getDomain = (): CdpDomain => {
    if (!instance) {
      throw new Error('Domain not initialized');
    }
    return instance;
  };

  const reinitHandler = (domain: CdpDomain) => {
    if (domain.name === DOMAIN_NAME) {
      // Remove from the old instance
      if (instance) {
        eventListeners.forEach((listener) => {
          (instance as CdpDomain).onMessage.removeEventListener(listener);
        });
      }

      instance = domain;

      // Assign to the new instance
      eventListeners.forEach((listener) => {
        domain.onMessage.addEventListener(listener);
      });
    }
  };

  global.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.onDomainInitialization.addEventListener(
    reinitHandler
  );

  const close = () => {
    global.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.onDomainInitialization.removeEventListener(
      reinitHandler
    );
  };

  return {
    send: (message: unknown) => {
      getDomain().sendMessage(message);
    },
    onMessage(listener: CdpMessageListener) {
      // Promises creating in listeners behave in weird way when not wrapped in setTimeout.
      // This is probably the same case as with the domain initialization.
      const delayedListener = (message: unknown) => {
        setTimeout(() => {
          listener(message);
        });
      };

      eventListeners.add(delayedListener);
      getDomain().onMessage.addEventListener(delayedListener);

      return {
        remove: () => {
          eventListeners.delete(delayedListener);
          getDomain().onMessage.removeEventListener(delayedListener);
        },
      };
    },
    close,
  };
};

export const getCdpChannel = async (): Promise<Channel> => {
  if (isWeb()) {
    throw new UnsupportedPlatformError('web');
  }

  return getCdpDomainProxy();
};
