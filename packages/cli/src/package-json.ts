import packageJSON from '../package.json' with { type: 'json' };

export const getPackageJSON = () => {
  return packageJSON;
};
