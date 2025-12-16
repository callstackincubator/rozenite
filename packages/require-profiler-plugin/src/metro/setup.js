// Initialize require chains tracking
global.__requireChains = []; // Array of completed chains (raw timing data)
global.__currentChain = null; // Currently active chain with depth tracking
global.__requireChainListeners = []; // Array of callbacks to notify when a chain completes

// Stack to track nested requires (since endEvent doesn't receive the event name)
// Shared across all SYSTRACE versions
const requireStack = [];

/**
 * Subscribe to chain completion events
 * @param {Function} callback - Called with chain metadata when a chain completes
 * @returns {Function} - Unsubscribe function
 */
global.__onRequireChainComplete = function (callback) {
  global.__requireChainListeners.push(callback);
  return function () {
    var index = global.__requireChainListeners.indexOf(callback);
    if (index > -1) {
      global.__requireChainListeners.splice(index, 1);
    }
  };
};

/**
 * Creates an instrumented SYSTRACE object that records require timings.
 * @param {Object|null} originalSystrace - The original SYSTRACE to wrap, or null for a stub
 * @returns {Object} - Instrumented SYSTRACE object
 */
const createInstrumentedSystrace = (originalSystrace) => {
  const originalBeginEvent = originalSystrace?.beginEvent;
  const originalEndEvent = originalSystrace?.endEvent;

  const instrumented = {
    // Mark this as our instrumented version
    __METRO_REQUIRE_INSTRUMENTED__: true,

    beginEvent: function (eventName, args) {
      // Check if this is a require event (prefix used by Metro)
      if (
        typeof eventName === 'string' &&
        eventName.startsWith('JS_require_')
      ) {
        const moduleIdentifier = eventName.slice('JS_require_'.length);
        const startTime = Date.now();

        // Check if this is the start of a new require chain
        if (!global.__currentChain) {
          // Get root module name from the modules registry
          const modules = global.__r?.getModules();
          const module = modules?.get(parseInt(moduleIdentifier, 10));
          const rootModuleName = module?.verboseName || moduleIdentifier;

          // Start a new require chain
          global.__currentChain = {
            rootModuleId: parseInt(moduleIdentifier, 10) || moduleIdentifier,
            rootModuleName,
            depth: 1,
            timings: [],
          };
        } else {
          // Increment depth for nested require
          global.__currentChain.depth++;
        }

        requireStack.push({
          moduleIdentifier,
          startTime,
        });
      }

      // Call original if it exists
      if (originalBeginEvent) {
        return originalBeginEvent.call(this, eventName, args);
      }
    },

    endEvent: function (args) {
      // Pop the most recent require event from the stack
      if (requireStack.length > 0 && global.__currentChain) {
        const { moduleIdentifier, startTime } = requireStack.pop();
        const endTime = Date.now();
        const duration = endTime - startTime;

        // moduleIdentifier could be a number (moduleId) or string (verboseName)
        // Try to parse as number first
        const moduleId = parseInt(moduleIdentifier, 10);

        // Add timing to current chain
        global.__currentChain.timings.push({
          moduleId: isNaN(moduleId) ? moduleIdentifier : moduleId,
          time: duration,
        });

        // Decrement depth and check if chain is complete
        global.__currentChain.depth--;

        if (global.__currentChain.depth === 0) {
          // Chain is complete, store it and reset
          var completedChain = {
            index: global.__requireChains.length,
            rootModuleId: global.__currentChain.rootModuleId,
            rootModuleName: global.__currentChain.rootModuleName,
            timings: global.__currentChain.timings,
          };
          global.__requireChains.push(completedChain);
          global.__currentChain = null;

          // Notify listeners about the new chain
          var listeners = global.__requireChainListeners;
          for (var i = 0; i < listeners.length; i++) {
            try {
              listeners[i]({
                index: completedChain.index,
                rootModuleId: completedChain.rootModuleId,
                rootModuleName: completedChain.rootModuleName,
              });
            } catch (e) {
              // Ignore listener errors
            }
          }
        }
      }

      // Call original if it exists
      if (originalEndEvent) {
        return originalEndEvent.call(this, args);
      }
    },
  };

  return instrumented;
};

global.__patchSystrace = () => {
  const systraceKey = (global.__METRO_GLOBAL_PREFIX__ || '') + '__SYSTRACE';
  const currentSystrace = global[systraceKey];

  // If SYSTRACE exists and is already our instrumented version, nothing to do
  if (currentSystrace && currentSystrace.__METRO_REQUIRE_INSTRUMENTED__) {
    return;
  }

  // Either SYSTRACE doesn't exist (we create a stub) or it's a real one we need to wrap
  // In both cases, create an instrumented version
  const instrumentedSystrace = createInstrumentedSystrace(currentSystrace);

  // Set the instrumented version as the global SYSTRACE
  global[systraceKey] = instrumentedSystrace;
};

/**
 * Returns a list of all completed require chains (metadata only).
 * This is lightweight and doesn't build the tree structures.
 *
 * @returns {Array} Array of chain metadata objects
 */
const getRequireChainsList = () => {
  return global.__requireChains.map((chain) => ({
    index: chain.index,
    rootModuleId: chain.rootModuleId,
    rootModuleName: chain.rootModuleName,
  }));
};

/**
 * Builds a flame graph tree structure for a specific require chain.
 * Compatible with react-flame-graph format.
 *
 * @param {number} chainIndex - The index of the chain to build
 * @returns {Object|null} Tree structure for the chain or null if not found
 */
const getRequireChainData = (chainIndex) => {
  const chain = global.__requireChains[chainIndex];
  if (!chain) {
    return null;
  }

  const modules = global.__r.getModules();
  const timings = chain.timings;

  // Create maps of timings for quick lookup
  // We need both: by numeric moduleId and by verboseName (path string)
  const timingsByModuleId = new Map();
  const timingsByVerboseName = new Map();

  for (const timing of timings) {
    if (typeof timing.moduleId === 'number') {
      timingsByModuleId.set(timing.moduleId, timing.time);
    } else {
      // It's a verboseName (string path)
      timingsByVerboseName.set(timing.moduleId, timing.time);
    }
  }

  // Set to track modules that have been added to the tree
  // Each module should only appear once (under its first requirer)
  const addedToTree = new Set();

  /**
   * Extracts the filename from a full path
   * @param {string} path - Full module path
   * @returns {string} - Just the filename
   */
  const getFileName = (path) => {
    if (!path) return String(path);
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  /**
   * Recursively builds the tree starting from a given module
   * @param {number} moduleId - The module ID to start from
   * @returns {Object|null} - The tree node or null if already processed/not found
   */
  const buildTree = (moduleId) => {
    // Each module should only appear once in the tree
    if (addedToTree.has(moduleId)) {
      return null;
    }
    addedToTree.add(moduleId);

    const module = modules.get(moduleId);
    if (!module) {
      return null;
    }

    // Look up timing by moduleId first, then by verboseName
    const selfTime =
      timingsByModuleId.get(moduleId) ??
      timingsByVerboseName.get(module.verboseName) ??
      0;
    const children = [];

    // Process dependencies from the dependencyMap
    if (module.dependencyMap && Array.isArray(module.dependencyMap)) {
      for (const depId of module.dependencyMap) {
        const childNode = buildTree(depId);
        if (childNode) {
          children.push(childNode);
        }
      }
    }

    // Value = self time + sum of all children's values (which already include their descendants)
    const childrenValue = children.reduce((sum, child) => sum + child.value, 0);
    const value = selfTime + childrenValue;

    const fullPath = module.verboseName || String(moduleId);

    return {
      name: getFileName(fullPath),
      value,
      tooltip: fullPath,
      children,
    };
  };

  // Start from the root module of this chain
  // rootModuleId could be a number or string (verboseName)
  let rootId = chain.rootModuleId;
  if (typeof rootId === 'string') {
    // Try to find the module by verboseName
    // Use forEach instead of entries() for older JS compatibility
    modules.forEach(function (mod, id) {
      if (mod.verboseName === rootId) {
        rootId = id;
      }
    });
  }

  const tree = buildTree(rootId);

  return {
    index: chain.index,
    rootModuleId: chain.rootModuleId,
    rootModuleName: chain.rootModuleName,
    tree,
  };
};

// Export for use
global.getRequireChainsList = getRequireChainsList;
global.getRequireChainData = getRequireChainData;
