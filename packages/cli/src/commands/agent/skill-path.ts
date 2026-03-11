import fs from 'node:fs';
import path from 'node:path';

const CLI_PACKAGE_NAME = 'rozenite';

const isRozeniteCliPackage = (dir: string): boolean => {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { name?: unknown };
    return parsed.name === CLI_PACKAGE_NAME;
  } catch {
    return false;
  }
};

export const resolveAgentSkillRootFrom = (startDir: string): string => {
  let current = path.resolve(startDir);

  while (true) {
    if (isRozeniteCliPackage(current)) {
      const candidate = path.join(current, 'skills', 'agent');
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Unable to resolve Agent skill root from "${startDir}". Expected a parent directory containing package.json with name "${CLI_PACKAGE_NAME}" and "skills/agent".`,
  );
};
