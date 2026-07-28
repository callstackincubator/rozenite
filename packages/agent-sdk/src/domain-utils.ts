import type { AgentTool } from '@rozenite/agent-shared';
import {
  RESERVED_DOMAIN_NAMES,
  STATIC_DOMAIN_TOOL_NAMES,
  STATIC_DOMAIN_TOOL_PREFIXES,
} from './constants.js';
import type {
  AgentDomainTool,
  AgentToolSchema,
  DomainDefinition,
} from './types.js';

const splitByDelimiters = (value: string): string[] => {
  return value
    .split(/[/:.#]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

const getScopedPlugin = (name: string): string | null => {
  const scoped = name.match(/^(@[^/]+\/[^/:.#]+)/);
  return scoped?.[1] ?? null;
};

export const inferPluginId = (toolName: string): string => {
  const scoped = getScopedPlugin(toolName);
  if (scoped) {
    return scoped;
  }

  const segments = splitByDelimiters(toolName);
  if (segments.length === 0) {
    return 'app';
  }

  return segments[0];
};

export const inferToolShortName = (toolName: string): string => {
  const segments = splitByDelimiters(toolName);
  if (segments.length === 0) {
    return toolName;
  }

  return segments[segments.length - 1] ?? toolName;
};

export const getStaticDomainPrefix = (domainId: string): string | undefined => {
  return STATIC_DOMAIN_TOOL_PREFIXES[domainId];
};

export const getStaticDomainToolNames = (domainId: string): string[] => {
  return STATIC_DOMAIN_TOOL_NAMES[domainId] || [];
};

export const getDomainToolsByDefinition = (
  tools: AgentTool[],
  domain: DomainDefinition,
): AgentTool[] => {
  if (domain.kind === 'plugin' && domain.pluginId) {
    return tools.filter((tool) => inferPluginId(tool.name) === domain.pluginId);
  }

  const staticPrefix = getStaticDomainPrefix(domain.id);
  const staticToolNames = new Set(getStaticDomainToolNames(domain.id));

  if (!staticPrefix && staticToolNames.size === 0) {
    return [];
  }

  return tools.filter(
    (tool) =>
      (staticPrefix ? tool.name.startsWith(staticPrefix) : false) ||
      staticToolNames.has(tool.name),
  );
};

const GENERIC_RESIDUE_NAMES = new Set(['plugin', 'devtool', 'devtools']);

const ROZENITE_PLUGIN_PREFIX = 'rozenite-plugin-';
const ROZENITE_PREFIX = 'rozenite-';
const PLUGIN_SUFFIX = '-plugin';

/**
 * Strips the `rozenite-plugin-` prefix, else the `rozenite-` prefix, then the
 * `-plugin` suffix. Order matters: `rozenite-plugin-ably` must reduce to
 * `ably`, not `plugin-ably`.
 */
const reducePackageName = (name: string): string => {
  let reduced = name;
  if (reduced.startsWith(ROZENITE_PLUGIN_PREFIX)) {
    reduced = reduced.slice(ROZENITE_PLUGIN_PREFIX.length);
  } else if (reduced.startsWith(ROZENITE_PREFIX)) {
    reduced = reduced.slice(ROZENITE_PREFIX.length);
  }

  if (reduced.endsWith(PLUGIN_SUFFIX)) {
    reduced = reduced.slice(0, -PLUGIN_SUFFIX.length);
  }

  return reduced;
};

const parseScopedPackageName = (
  pluginId: string,
): { scope: string; name: string } | null => {
  const match = pluginId.match(/^@([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }

  return { scope: match[1]!, name: match[2]! };
};

/**
 * Derives a short, stable domain name from an npm package name. This is a
 * pure function of `pluginId` alone: installing, removing, or updating any
 * *other* plugin must never change the result. See
 * https://github.com/callstackincubator/rozenite/issues/319 for the rules.
 */
export const deriveDomainName = (pluginId: string): string => {
  const scoped = parseScopedPackageName(pluginId);

  let candidate: string;
  if (scoped) {
    const reduced = reducePackageName(scoped.name);
    if (!reduced || GENERIC_RESIDUE_NAMES.has(reduced)) {
      candidate = scoped.scope;
    } else if (scoped.scope === 'rozenite') {
      candidate = reduced;
    } else {
      candidate = `${scoped.scope}/${reduced}`;
    }
  } else {
    candidate = pluginId;
  }

  if (RESERVED_DOMAIN_NAMES.has(candidate)) {
    return pluginId;
  }

  return candidate;
};

/**
 * Undocumented, deprecated alias for the pre-#319 domain token shape, kept so
 * `resolveDomainToken` still accepts scripts written against
 * `at-rozenite__mmkv-plugin`-style tokens for one release cycle.
 */
const deriveLegacyDomainSlug = (pluginId: string): string => {
  const normalized = pluginId
    .toLowerCase()
    .replaceAll('@', 'at-')
    .replaceAll('/', '__')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'plugin';
};

export const buildRuntimePluginDomains = (
  tools: AgentTool[],
): DomainDefinition[] => {
  const staticPrefixes = new Set(Object.values(STATIC_DOMAIN_TOOL_PREFIXES));
  const staticToolNames = new Set(
    Object.values(STATIC_DOMAIN_TOOL_NAMES).flatMap((names) => names),
  );
  const pluginIds = Array.from(
    new Set(
      tools
        .filter((tool) => {
          if (staticToolNames.has(tool.name)) {
            return false;
          }

          for (const prefix of staticPrefixes) {
            if (tool.name.startsWith(prefix)) {
              return false;
            }
          }

          return true;
        })
        .map((tool) => inferPluginId(tool.name)),
    ),
  ).sort();

  const pluginIdsByDomainName = new Map<string, string[]>();
  for (const pluginId of pluginIds) {
    const domainName = deriveDomainName(pluginId);
    const existing = pluginIdsByDomainName.get(domainName) || [];
    existing.push(pluginId);
    pluginIdsByDomainName.set(domainName, existing);
  }

  for (const [domainName, collidingIds] of pluginIdsByDomainName) {
    if (collidingIds.length > 1) {
      throw new Error(
        `Ambiguous domain name "${domainName}": plugins ${collidingIds.join(
          ', ',
        )} all derive the same domain name. Rename one of these packages to disambiguate.`,
      );
    }

    // Scoped package names already fall back to their full pluginId when
    // they would shadow a built-in domain (see deriveDomainName). An
    // unscoped package literally named e.g. "console" has no alternate
    // representation to fall back to, so guard against that here.
    if (RESERVED_DOMAIN_NAMES.has(domainName)) {
      throw new Error(
        `Plugin "${collidingIds[0]}" derives the domain name "${domainName}", which shadows the built-in "${domainName}" domain. Rename the package to avoid the collision.`,
      );
    }
  }

  return pluginIds.map((pluginId) => {
    const description =
      pluginId === 'app'
        ? 'Runtime tools exposed by the app itself.'
        : `Runtime tools exposed by plugin "${pluginId}".`;

    return {
      id: deriveDomainName(pluginId),
      kind: 'plugin',
      pluginId,
      slug: deriveLegacyDomainSlug(pluginId),
      description,
      actions: ['list-tools', 'get-tool-schema', 'call-tool'],
    };
  });
};

const getRozeniteScopedAlias = (
  domain: DomainDefinition,
): string | undefined => {
  return domain.pluginId?.startsWith('@rozenite/')
    ? `rozenite/${domain.id}`
    : undefined;
};

export const resolveDomainToken = (
  token: string,
  domains: DomainDefinition[],
): DomainDefinition | undefined => {
  const normalized = token.trim();
  return domains.find(
    (domain) =>
      domain.id === normalized ||
      domain.slug === normalized ||
      domain.pluginId === normalized ||
      getRozeniteScopedAlias(domain) === normalized,
  );
};

const formatLimitedList = (items: string[]): string => {
  if (items.length <= 5) {
    return items.join(', ');
  }

  const first = items.slice(0, 5).join(', ');
  return `${first}, and ${items.length - 5} more`;
};

export const rankDomainSuggestions = (
  token: string,
  domains: DomainDefinition[],
): string[] => {
  const query = token.toLowerCase();

  return domains
    .map((domain) => {
      const candidates = [
        domain.id,
        domain.slug,
        domain.pluginId,
        getRozeniteScopedAlias(domain),
      ]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());

      let score = 0;
      for (const candidate of candidates) {
        if (candidate === query) {
          score = Math.max(score, 100);
        } else if (candidate.startsWith(query)) {
          score = Math.max(score, 60);
        } else if (candidate.includes(query)) {
          score = Math.max(score, 40);
        }
      }

      return { domain, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.domain.id.localeCompare(b.domain.id))
    .slice(0, 5)
    .map((item) => item.domain.id);
};

export const formatUnknownDomainError = (
  token: string,
  domains: DomainDefinition[],
): Error => {
  const suggestions = rankDomainSuggestions(token, domains);
  const suggestionsText =
    suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : '';

  return new Error(
    `Unknown domain "${token}".${suggestionsText} Run \`rozenite agent domains\` to list available domains.`,
  );
};

export const resolveDomainTool = (
  domainTools: AgentTool[],
  domainLabel: string,
  toolName: string,
): AgentTool => {
  const exactMatch = domainTools.find((tool) => tool.name === toolName);
  const shortMatches = domainTools.filter(
    (tool) => inferToolShortName(tool.name) === toolName,
  );

  const selectedTool =
    exactMatch || (shortMatches.length === 1 ? shortMatches[0] : null);
  if (!selectedTool) {
    if (shortMatches.length > 1) {
      const fullNames = formatLimitedList(
        shortMatches.map((tool) => tool.name),
      );
      throw new Error(
        `Ambiguous tool "${toolName}" for domain "${domainLabel}". Matches: ${fullNames}.`,
      );
    }

    const available = formatLimitedList(domainTools.map((tool) => tool.name));
    throw new Error(
      `Tool "${toolName}" not found for domain "${domainLabel}". Available: ${available || 'none'}. Hint: rozenite agent ${domainLabel} tools`,
    );
  }

  return selectedTool;
};

export const toAgentDomainTool = (tool: AgentTool): AgentDomainTool => ({
  ...tool,
  shortName: inferToolShortName(tool.name),
});

export const toAgentToolSchema = (tool: AgentTool): AgentToolSchema => ({
  name: tool.name,
  shortName: inferToolShortName(tool.name),
  inputSchema: tool.inputSchema,
});
