import fs from 'node:fs';
import path from 'node:path';
import { DOCS_DIR } from '../constants.js';

export { DOCS_DIR };

export type SkillDoc = {
  id: string;
  description: string;
  domain?: string;
  /**
   * Platforms this doc applies to, as written in the frontmatter (for
   * example `react-native, lynx`). Advisory: docs are annotated rather
   * than filtered, because one repository can hold a React Native app and
   * a Lynx app, and hiding a doc from the list would just make the
   * platform difference invisible again.
   */
  platforms?: string;
  body: string;
};

type Frontmatter = {
  name?: string;
  description?: string;
  domain?: string;
  platforms?: string;
};

const parseFrontmatter = (raw: string): { frontmatter: Frontmatter; body: string } => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    return { frontmatter: {}, body: raw };
  }

  const [, rawFrontmatter, body] = match;
  const frontmatter: Frontmatter = {};

  for (const line of rawFrontmatter.split(/\r?\n/)) {
    const lineMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!lineMatch) {
      continue;
    }

    const [, key, value] = lineMatch;
    const trimmedValue = value.trim().replace(/^['"]|['"]$/g, '');

    if (key === 'name' || key === 'description' || key === 'domain' || key === 'platforms') {
      frontmatter[key] = trimmedValue;
    }
  }

  return { frontmatter, body: body.replace(/^\r?\n/, '') };
};

const loadDoc = (docsDir: string, fileName: string): SkillDoc => {
  const filePath = path.join(docsDir, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const id = frontmatter.name ?? path.basename(fileName, '.md');

  if (!frontmatter.description) {
    throw new Error(`Doc "${id}" (${filePath}) is missing a "description" in its frontmatter.`);
  }

  return {
    id,
    description: frontmatter.description,
    domain: frontmatter.domain,
    ...(frontmatter.platforms ? { platforms: frontmatter.platforms } : {}),
    body,
  };
};

/**
 * Loads every bundled doc under `docsDir` from disk.
 */
const loadAllDocs = (docsDir: string): SkillDoc[] => {
  const fileNames = fs
    .readdirSync(docsDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort();

  return fileNames.map((fileName) => loadDoc(docsDir, fileName));
};

export class SkillsRegistry {
  private readonly docs: SkillDoc[];
  private readonly byId: Map<string, SkillDoc>;
  private readonly byDomain: Map<string, SkillDoc>;

  constructor(docsDir: string = DOCS_DIR) {
    this.docs = loadAllDocs(docsDir);
    this.byId = new Map(this.docs.map((doc) => [doc.id, doc]));
    this.byDomain = new Map(
      this.docs.filter((doc) => doc.domain).map((doc) => [doc.domain as string, doc]),
    );
  }

  list(): SkillDoc[] {
    return this.docs;
  }

  get(id: string): SkillDoc | undefined {
    return this.byId.get(id);
  }

  getByDomain(domain: string): SkillDoc | undefined {
    return this.byDomain.get(domain);
  }
}
