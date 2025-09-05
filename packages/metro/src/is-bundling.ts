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

  // Check for Expo bundling
  if (command === 'export') {
    // Check direct binary path
    if (expoBinRelativePath && executablePath.endsWith(expoBinRelativePath)) {
      return true;
    }

    // Check node_modules/.bin alias
    if (executablePath.endsWith('node_modules/.bin/expo')) {
      return true;
    }
  }

  // Check for React Native bundling
  if (command === 'bundle') {
    // Check direct binary path
    if (
      reactNativeBinRelativePath &&
      executablePath.endsWith(reactNativeBinRelativePath)
    ) {
      return true;
    }

    // Check node_modules/.bin alias
    if (executablePath.endsWith('node_modules/.bin/react-native')) {
      return true;
    }

    // Check Xcode's bundle.js script
    if (executablePath.endsWith('scripts/bundle.js')) {
      return true;
    }
  }

  return false;
};
