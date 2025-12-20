// Initialize require chains tracking
global.__requireChains = []; // Array of completed chains (with tree structure)
global.__currentChain = null; // Currently active chain
global.__requireChainListeners = []; // Array of callbacks to notify when a chain completes

// Stack to track nested requires and build tree structure
// Each entry contains: { node, startTime }
const requireStack = [];

/**
 * Subscribe to chain completion events
 * @param {Function} callback - Called with chain metadata when a chain completes
 * @returns {Function} - Unsubscribe function
 */
global.__onRequireChainComplete = function (callback) {
  global.__requireChainListeners.push(callback);
  return function () {
    const index = global.__requireChainListeners.indexOf(callback);

    if (index > -1) {
      global.__requireChainListeners.splice(index, 1);
    }
  };
};

/**
 * Creates an instrumented SYSTRACE object that records require timings.
 * Builds tree structure directly from timing events.
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
        const moduleId = parseInt(moduleIdentifier, 10);

        // Create a new tree node for this require
        const node = {
          moduleId: isNaN(moduleId) ? moduleIdentifier : moduleId,
          children: [],
          selfTime: 0, // Will be calculated in endEvent
          value: 0, // Total time (self + children), calculated in endEvent
        };

        // Check if this is the start of a new require chain
        if (!global.__currentChain) {
          // Get root module name from the modules registry
          const modules = global.__r?.getModules();
          const module = modules?.get(parseInt(moduleIdentifier, 10));
          const rootModuleName = module?.verboseName || moduleIdentifier;

          // Start a new require chain with the root node
          global.__currentChain = {
            rootModuleId: node.moduleId,
            rootModuleName,
            rootNode: node,
          };
        } else {
          // Add this node as a child of the current parent (top of stack)
          const parent = requireStack[requireStack.length - 1];
          if (parent) {
            parent.node.children.push(node);
          }
        }

        requireStack.push({
          node,
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
        const { node, startTime } = requireStack.pop();
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Calculate self time (total time minus children's time)
        const childrenTime = node.children.reduce(
          (sum, child) => sum + child.value,
          0,
        );
        node.selfTime = totalTime - childrenTime;
        node.value = totalTime;

        // Check if chain is complete (stack is empty)
        if (requireStack.length === 0) {
          // Chain is complete, store it and reset
          const completedChain = {
            index: global.__requireChains.length,
            rootModuleId: global.__currentChain.rootModuleId,
            rootModuleName: global.__currentChain.rootModuleName,
            rootNode: global.__currentChain.rootNode,
          };
          global.__requireChains.push(completedChain);
          global.__currentChain = null;

          // Notify listeners about the new chain
          const listeners = global.__requireChainListeners;
          for (let i = 0; i < listeners.length; i++) {
            try {
              listeners[i]({
                index: completedChain.index,
                rootModuleId: completedChain.rootModuleId,
                rootModuleName: completedChain.rootModuleName,
              });
            } catch {
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
 * Transforms the pre-built tree into flame graph format.
 * Uses getModules() only to get display names (verboseName).
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

  // Get modules registry for display names only
  const modules = global.__r?.getModules();

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
   * Gets display info for a module from the registry
   * @param {number|string} moduleId - The module ID
   * @returns {{ name: string, tooltip: string }}
   */
  const getModuleDisplayInfo = (moduleId) => {
    if (modules && typeof moduleId === 'number') {
      const module = modules.get(moduleId);
      if (module && module.verboseName) {
        return {
          name: getFileName(module.verboseName),
          tooltip: module.verboseName,
        };
      }
    }
    // Fallback: moduleId might be a string (verboseName) or module not found
    const idStr = String(moduleId);
    return {
      name: getFileName(idStr),
      tooltip: idStr,
    };
  };

  /**
   * Recursively transforms a timing node to flame graph format
   * @param {Object} node - The timing node from recording
   * @returns {Object} - Flame graph compatible node
   */
  const transformNode = (node) => {
    const displayInfo = getModuleDisplayInfo(node.moduleId);

    return {
      name: displayInfo.name,
      value: node.value,
      tooltip: displayInfo.tooltip,
      children: node.children.map(transformNode),
    };
  };

  const tree = chain.rootNode ? transformNode(chain.rootNode) : null;

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
