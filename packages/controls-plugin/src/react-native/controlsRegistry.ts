import type {
  RozeniteControlsPluginOptions,
  RozeniteControlsPluginOptionsInput,
} from '../shared/types';

type ControlsRegistryListener = () => void;
type ControlsRegistryOverride = {
  id: symbol;
  input: RozeniteControlsPluginOptionsInput;
};

const EMPTY_OPTIONS: RozeniteControlsPluginOptions = {
  sections: [],
};

const resolveOptionsInput = (
  previousOptions: RozeniteControlsPluginOptions,
  input: RozeniteControlsPluginOptionsInput,
): RozeniteControlsPluginOptions => {
  if (typeof input === 'function') {
    return input(previousOptions);
  }

  return {
    ...previousOptions,
    ...input,
    sections: [...previousOptions.sections, ...input.sections],
  };
};

export const createControlsRegistry = () => {
  const registrations = new Map<symbol, RozeniteControlsPluginOptionsInput>();
  const listeners = new Set<ControlsRegistryListener>();
  let snapshot = 0;

  const getOwnerId = () => registrations.keys().next().value;

  const notify = () => {
    snapshot += 1;
    listeners.forEach((listener) => listener());
  };

  const getRegistrationEntries = (override?: ControlsRegistryOverride) => {
    const entries = Array.from(registrations.entries());

    if (!override) {
      return entries;
    }

    const overrideIndex = entries.findIndex(([id]) => id === override.id);

    if (overrideIndex === -1) {
      return [...entries, [override.id, override.input] as const];
    }

    return entries.map(([id, input]) =>
      id === override.id
        ? ([id, override.input] as const)
        : ([id, input] as const),
    );
  };

  return {
    set(id: symbol, input: RozeniteControlsPluginOptionsInput) {
      const previousOwnerId = getOwnerId();
      registrations.set(id, input);

      if (previousOwnerId !== getOwnerId()) {
        notify();
      }
    },
    delete(id: symbol) {
      registrations.delete(id);
      notify();
    },
    getOptions(
      override?: ControlsRegistryOverride,
    ): RozeniteControlsPluginOptions {
      return getRegistrationEntries(override)
        .map(([, input]) => input)
        .reduce(resolveOptionsInput, EMPTY_OPTIONS);
    },
    isOwner(id: symbol, override?: ControlsRegistryOverride) {
      const ownerEntry = getRegistrationEntries(override)[0];

      return ownerEntry?.[0] === id;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener: ControlsRegistryListener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export const controlsRegistry = createControlsRegistry();
