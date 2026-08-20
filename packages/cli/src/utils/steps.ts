import { spinner } from './prompts.js';

export type StepOptions = {
  start: string;
  stop: string;
  /** A function can tell a genuine failure apart from a cancelled step. */
  error: string | ((error: unknown) => string);
};

export const step = async ({ start, stop, error }: StepOptions, fn: () => Promise<void>) => {
  const step = spinner();
  step.start(start);

  try {
    await fn();
    step.stop(stop);
  } catch (err) {
    step.stop(typeof error === 'string' ? error : error(err), 1);
    throw err;
  }
};
