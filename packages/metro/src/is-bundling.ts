import { getBinaryRelativePath } from './packages.js';

export const isBundling = (projectRoot: string): boolean => {
  const executablePath = process.argv[1];
  const command = process.argv[2];

  // Relative -> expo/bin/cli.js | react-native/cli.js
  const expoBinRelativePath = getBinaryRelativePath(projectRoot, 'expo');
  const reactNativeBinRelativePath = getBinaryRelativePath(
    projectRoot,
    'react-native'
  );

  if (
    expoBinRelativePath &&
    executablePath.endsWith(expoBinRelativePath) &&
    command === 'export'
  ) {
    return true;
  }

  if (
    reactNativeBinRelativePath &&
    executablePath.endsWith(reactNativeBinRelativePath) &&
    command === 'bundle'
  ) {
    return true;
  }

  return false;
};
