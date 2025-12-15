// Initialize timings array
global.__timings = [];

// Stack to track nested requires (since endEvent doesn't receive the event name)
// Shared across all SYSTRACE versions
const requireStack = [];

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
        requireStack.push({
          moduleIdentifier,
          startTime: Date.now(),
        });
      }

      // Call original if it exists
      if (originalBeginEvent) {
        return originalBeginEvent.call(this, eventName, args);
      }
    },

    endEvent: function (args) {
      // Pop the most recent require event from the stack
      if (requireStack.length > 0) {
        const { moduleIdentifier, startTime } = requireStack.pop();
        const endTime = Date.now();
        const duration = endTime - startTime;

        // moduleIdentifier could be a number (moduleId) or string (verboseName)
        // Try to parse as number first
        const moduleId = parseInt(moduleIdentifier, 10);

        global.__timings.push({
          moduleId: isNaN(moduleId) ? moduleIdentifier : moduleId,
          time: duration,
        });
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
 * Builds a flame graph tree structure of the require flow.
 * Compatible with react-flame-graph format.
 *
 * @returns {Object} Tree structure with:
 *   - name: module name (filename)
 *   - value: total time (self + all descendants)
 *   - tooltip: full module path
 *   - children: array of child nodes (dependencies)
 */
const getRequireTimings = () => {
  const modules = global.__r.getModules();
  const timings = global.__timings || [];

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

  // Start from entry point (module 0)
  return buildTree(0);
};

// Export for use
global.getRequireTimings = getRequireTimings;
