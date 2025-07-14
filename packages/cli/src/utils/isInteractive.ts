/**
 * Source from https://github.com/sindresorhus/is-interactive/blob/main/index.js
 */
export const isInteractive = ({ stream = process.stdout } = {}) => {
  return Boolean(
    stream &&
      stream.isTTY &&
      process.env['TERM'] !== 'dumb' &&
      !('CI' in process.env)
  );
};
