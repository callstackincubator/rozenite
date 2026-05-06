import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
} from '@microsoft/api-extractor';

type Target = 'react-native' | 'metro' | 'sdk';

export const normalizeRolledUpDeclarations = (content: string) => {
  const valueDeclarationNames = new Set<string>();

  content.replace(
    /^\s*declare\s+(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)\b/gm,
    (_, name: string) => {
      valueDeclarationNames.add(name);
      return _;
    },
  );

  const normalizeTypeReference = (name: string) =>
    valueDeclarationNames.has(name) ? `typeof ${name}` : name;

  return content
    .replace(
      /^(\s*(?:export\s+)?declare\s+(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*)([A-Za-z_$][\w$]*)(\s*;)$/gm,
      (_, prefix: string, name: string, suffix: string) => {
        return `${prefix}${normalizeTypeReference(name)}${suffix}`;
      },
    )
    .replace(
      /^(\s*(?:export\s+)?declare\s+type\s+[A-Za-z_$][\w$]*\s*=\s*)([A-Za-z_$][\w$]*)(\s*;)$/gm,
      (_, prefix: string, name: string, suffix: string) => {
        return `${prefix}${normalizeTypeReference(name)}${suffix}`;
      },
    );
};

export const bundleTargetDeclarations = async (
  projectRoot: string,
  target: Target,
) => {
  const targetRoot = path.join(projectRoot, 'dist', target);
  const publicEntryPath = path.join(targetRoot, 'index.d.ts');
  const bundleEntryPath =
    target === 'sdk' ? path.join(targetRoot, `${target}.d.ts`) : publicEntryPath;
  const entryPath =
    (await fs
      .access(bundleEntryPath)
      .then(() => bundleEntryPath)
      .catch(() => publicEntryPath));
  const tempOutputPath = path.join(targetRoot, 'index.public.d.ts');
  const srcDeclarationsPath = path.join(targetRoot, 'src');
  const configObjectFullPath = path.join(projectRoot, 'api-extractor.json');
  const packageJsonFullPath = path.join(projectRoot, 'package.json');
  const tsconfigFilePath = path.join(projectRoot, 'tsconfig.json');

  const extractorConfig = ExtractorConfig.prepare({
    configObject: {
      projectFolder: projectRoot,
      mainEntryPointFilePath: entryPath,
      compiler: {
        tsconfigFilePath,
        overrideTsconfig: {
          $schema: 'http://json.schemastore.org/tsconfig',
          compilerOptions: {
            skipLibCheck: true,
          },
        },
      },
      apiReport: {
        enabled: false,
      },
      docModel: {
        enabled: false,
      },
      dtsRollup: {
        enabled: true,
        publicTrimmedFilePath: tempOutputPath,
      },
      tsdocMetadata: {
        enabled: false,
      },
      messages: {
        compilerMessageReporting: {
          default: {
            logLevel: ExtractorLogLevel.None,
          },
        },
        extractorMessageReporting: {
          default: {
            logLevel: ExtractorLogLevel.None,
          },
        },
      },
    },
    configObjectFullPath,
    packageJsonFullPath,
  });

  const result = Extractor.invoke(extractorConfig, {
    localBuild: true,
    showVerboseMessages: false,
    showDiagnostics: false,
  });

  if (!result.succeeded) {
    throw new Error(`Failed to bundle ${target} declaration files.`);
  }

  if (entryPath !== publicEntryPath) {
    await fs.rm(publicEntryPath, { force: true });
  }
  await fs.rm(entryPath, { force: true });
  await fs.rename(tempOutputPath, publicEntryPath);
  const bundledContent = await fs.readFile(publicEntryPath, 'utf8');
  const normalizedContent = normalizeRolledUpDeclarations(bundledContent);

  if (normalizedContent !== bundledContent) {
    await fs.writeFile(publicEntryPath, normalizedContent);
  }

  await fs.rm(srcDeclarationsPath, { recursive: true, force: true });
};
