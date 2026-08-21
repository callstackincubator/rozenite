/**
 * Applies a capability profile to a local domain service.
 *
 * Deliberately a wrapper rather than a branch inside each service: the
 * four domain services stay ignorant of platforms entirely, and there is
 * exactly one place where "this target cannot do that" is decided.
 */
import {
  getUnsupportedToolReason,
  isToolSupported,
  type CapabilityProfile,
} from '@rozenite/agent-shared';
import type { LocalAgentToolService } from './local-domains.js';

export class UnsupportedToolError extends Error {
  constructor(profile: CapabilityProfile, domainId: string, toolName: string) {
    const reason = getUnsupportedToolReason(profile, domainId, toolName);

    super(
      `Tool "${toolName}" is not supported on this ${profile.platform} target.` +
        (reason ? ` ${reason}` : ''),
    );
    this.name = 'UnsupportedToolError';
  }
}

export const withCapabilityFilter = (
  service: LocalAgentToolService,
  profile: CapabilityProfile,
): LocalAgentToolService => {
  const allowed = new Set(
    service
      .getTools()
      .filter((tool) => isToolSupported(profile, service.domainId, tool.name))
      .map((tool) => tool.name),
  );

  // Nothing was filtered out, so hand back the service untouched rather
  // than wrapping it. Keeps the React Native path allocation-identical to
  // what it was before profiles existed.
  if (allowed.size === service.getTools().length) {
    return service;
  }

  return {
    ...service,
    getTools: () => service.getTools().filter((tool) => allowed.has(tool.name)),
    // A filtered tool is unreachable through `getTools`, but `callTool`
    // is also reachable by exact tool name from the call-tool route, so
    // it needs the same guard rather than trusting the listing.
    callTool: async (toolName, args) => {
      if (!allowed.has(toolName)) {
        throw new UnsupportedToolError(profile, service.domainId, toolName);
      }

      return service.callTool(toolName, args);
    },
  };
};
