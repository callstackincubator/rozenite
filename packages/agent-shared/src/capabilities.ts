/**
 * Target capability descriptors.
 *
 * Rozenite's five built-in agent domains were designed against React
 * Native's CDP surface. Other platforms expose a different one, and
 * "unsupported" is not one behaviour on the wire but three:
 *
 * 1. The device answers `{ error: { code: -32601 } }` — loud, but the
 *    agent only finds out after spending a turn on the call.
 * 2. The device answers `{ result: {} }` for a method it does not know.
 *    Lynx's PrimJS backend does this for anything missing from its
 *    dispatch table, so the call *resolves* and the event the caller is
 *    waiting on never arrives.
 * 3. The domain and method exist under the same name but mean something
 *    else. Lynx's `Tracing` is Perfetto, not Chrome's: it succeeds and
 *    reports completion over a stream Rozenite never reads.
 *
 * Cases 2 and 3 cannot be detected by inspecting a response, so they can
 * only be prevented by knowing, before the call, that this target does
 * not support this tool. That is what a capability profile is for.
 *
 * The profile is deliberately a *descriptor*, not a blocklist: the same
 * mechanism that removes `network` on Lynx is the one that would later
 * add a Lynx-only domain there, or describe the next platform after it.
 */

/** Which host platform a dev server, and therefore a target, runs. */
export type AgentTargetPlatform = 'react-native' | 'lynx';

export const DEFAULT_AGENT_TARGET_PLATFORM: AgentTargetPlatform = 'react-native';

/**
 * `degraded` is a domain-level verdict only: the domain stays usable, but
 * at least one of its tools does not. An individual tool is either
 * supported or not.
 */
export type ToolAvailability = 'supported' | 'degraded' | 'unsupported';

export type ToolCapability = {
  availability: Exclude<ToolAvailability, 'degraded'>;
  /**
   * Written to be read verbatim by an agent, in an error message. Say
   * what the platform does instead, not what Rozenite wanted.
   */
  reason?: string;
};

export type DomainCapability = {
  availability: ToolAvailability;
  reason?: string;
  /** A domain token the agent should try instead, when one exists. */
  fallback?: string;
  /** Per-tool overrides. Tools with no entry inherit the domain's verdict. */
  tools?: Record<string, ToolCapability>;
};

/**
 * A domain with no entry is supported. That default is what keeps React
 * Native's profile empty and its behaviour byte-for-byte unchanged, and
 * it means nobody has to maintain an allowlist that grows with every new
 * tool — only the gaps are written down.
 */
export type CapabilityProfile = {
  platform: AgentTargetPlatform;
  domains: Record<string, DomainCapability>;
};

/** One gap, flattened for transport to the agent client. */
export type UnsupportedDomainInfo = {
  domain: string;
  /**
   * The unsupported tools within an otherwise usable domain. Absent when
   * the whole domain is unavailable — the distinction is what lets the
   * client render `degraded` separately from `unsupported`.
   */
  tools?: string[];
  reason: string;
  fallback?: string;
};

export const createEmptyCapabilityProfile = (platform: AgentTargetPlatform): CapabilityProfile => ({
  platform,
  domains: {},
});

const getToolCapability = (
  domain: DomainCapability,
  toolName: string,
): ToolCapability | undefined => domain.tools?.[toolName];

/**
 * Whether `toolName` in `domainId` may be registered and called on a
 * target with this profile. Unknown domains and unknown tools are
 * supported: absence means "nothing to declare".
 */
export const isToolSupported = (
  profile: CapabilityProfile,
  domainId: string,
  toolName: string,
): boolean => {
  const domain = profile.domains[domainId];
  if (!domain) {
    return true;
  }

  const tool = getToolCapability(domain, toolName);
  if (tool) {
    return tool.availability === 'supported';
  }

  return domain.availability !== 'unsupported';
};

/**
 * The reason to hand an agent when `isToolSupported` said no. Prefers the
 * tool's own reason over the domain's, since a tool-level gap in an
 * otherwise working domain needs the more specific explanation.
 */
export const getUnsupportedToolReason = (
  profile: CapabilityProfile,
  domainId: string,
  toolName: string,
): string | undefined => {
  const domain = profile.domains[domainId];
  if (!domain) {
    return undefined;
  }

  return getToolCapability(domain, toolName)?.reason ?? domain.reason;
};

/**
 * Flattens a profile into the wire shape. Domains whose gap is entirely
 * tool-level are reported with a `tools` list; whole-domain gaps without
 * one.
 */
export const getUnsupportedDomains = (profile: CapabilityProfile): UnsupportedDomainInfo[] => {
  const entries: UnsupportedDomainInfo[] = [];

  for (const [domainId, domain] of Object.entries(profile.domains)) {
    if (domain.availability === 'unsupported') {
      entries.push({
        domain: domainId,
        reason: domain.reason ?? `Not supported on ${profile.platform} targets.`,
        ...(domain.fallback ? { fallback: domain.fallback } : {}),
      });
      continue;
    }

    const unsupportedTools = Object.entries(domain.tools ?? {})
      .filter(([, tool]) => tool.availability === 'unsupported')
      .map(([toolName]) => toolName)
      .sort();

    if (unsupportedTools.length === 0) {
      continue;
    }

    entries.push({
      domain: domainId,
      tools: unsupportedTools,
      reason:
        domain.tools?.[unsupportedTools[0]]?.reason ??
        domain.reason ??
        `Not supported on ${profile.platform} targets.`,
      ...(domain.fallback ? { fallback: domain.fallback } : {}),
    });
  }

  return entries.sort((a, b) => a.domain.localeCompare(b.domain));
};
