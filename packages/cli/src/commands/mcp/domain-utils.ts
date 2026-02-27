import { createHash } from 'node:crypto';
import type { MCPTool } from './types.js';
import type { DomainDefinition } from './types.js';

const DOMAIN_KEYWORDS = {
  network: ['network', 'http', 'request', 'response'],
  react: ['react', 'component', 'props', 'tree'],
};

const splitByDelimiters = (value: string): string[] => {
  return value
    .split(/[/:.#]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

const lowerIncludesAny = (value: string, needles: string[]): boolean => {
  return needles.some((needle) => value.includes(needle));
};

const getScopedPlugin = (name: string): string | null => {
  const scoped = name.match(/^(@[^/]+\/[^/:.#]+)/);
  return scoped?.[1] ?? null;
};

export const inferDomain = (tool: MCPTool): 'network' | 'react' | 'plugin' => {
  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();

  if (
    lowerIncludesAny(name, DOMAIN_KEYWORDS.network) ||
    lowerIncludesAny(description, DOMAIN_KEYWORDS.network)
  ) {
    return 'network';
  }

  if (
    lowerIncludesAny(name, DOMAIN_KEYWORDS.react) ||
    lowerIncludesAny(description, DOMAIN_KEYWORDS.react)
  ) {
    return 'react';
  }

  return 'plugin';
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

export const getDomainTools = (
  tools: MCPTool[],
  domain: 'network' | 'react',
): MCPTool[] => {
  return tools.filter((tool) => inferDomain(tool) === domain);
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

export const buildRuntimePluginDomains = (tools: MCPTool[]): DomainDefinition[] => {
  const pluginIds = Array.from(
    new Set(
      tools.map((tool) => inferPluginId(tool.name)),
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
