import { createHash } from 'node:crypto';
import type { AgentTool } from './types.js';
import type { DomainDefinition } from './types.js';
import { STATIC_DOMAIN_TOOL_NAMES, STATIC_DOMAIN_TOOL_PREFIXES } from './constants.js';

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

  return segments[segments.length - 1];
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

  return tools.filter((tool) =>
    (staticPrefix ? tool.name.startsWith(staticPrefix) : false)
    || staticToolNames.has(tool.name),
  );
};

export const encodePluginDomainSlug = (pluginId: string): string => {
  const normalized = pluginId
    .toLowerCase()
    .replaceAll('@', 'at-')
    .replaceAll('/', '__')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'plugin';
};

const getCollisionHash = (pluginId: string): string => {
  return createHash('sha1').update(pluginId).digest('hex').slice(0, 8);
};

export const buildRuntimePluginDomains = (tools: AgentTool[]): DomainDefinition[] => {
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

  const baseSlugGroups = new Map<string, string[]>();
  for (const pluginId of pluginIds) {
    const baseSlug = encodePluginDomainSlug(pluginId);
    const existing = baseSlugGroups.get(baseSlug) || [];
    existing.push(pluginId);
    baseSlugGroups.set(baseSlug, existing);
  }

  const usedSlugs = new Set<string>();

  return pluginIds.map((pluginId) => {
    const baseSlug = encodePluginDomainSlug(pluginId);
    const collidingIds = baseSlugGroups.get(baseSlug) || [];

    let slug = baseSlug;
    if (collidingIds.length > 1) {
      slug = `${baseSlug}--${getCollisionHash(pluginId)}`;
    }

    while (usedSlugs.has(slug)) {
      slug = `${slug}-${getCollisionHash(`${pluginId}:${slug}`)}`;
    }
    usedSlugs.add(slug);

    const description = pluginId === 'app'
      ? 'Runtime tools exposed by the app itself.'
      : `Runtime tools exposed by plugin "${pluginId}".`;

    return {
      id: slug,
      kind: 'plugin',
      pluginId,
      slug,
      description,
      actions: ['list-tools', 'get-tool-schema', 'call-tool'],
    };
  });
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
      domain.pluginId === normalized,
  );
};
