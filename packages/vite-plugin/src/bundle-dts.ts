import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
} from '@microsoft/api-extractor';

type Target = 'react-native' | 'metro';

export const bundleTargetDeclarations = async (
  projectRoot: string,
  target: Target,
) => {
  const targetRoot = path.join(projectRoot, 'dist', target);
  const entryPath = path.join(targetRoot, 'index.d.ts');
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

  await fs.rm(entryPath, { force: true });
  await fs.rename(tempOutputPath, entryPath);
  await fs.rm(srcDeclarationsPath, { recursive: true, force: true });
};
