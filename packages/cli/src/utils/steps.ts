import { spinner } from './prompts.js';

export type StepOptions = {
  start: string;
  stop: string;
  error: string;
};

export const step = async (
  { start, stop, error }: StepOptions,
  fn: () => Promise<void>
) => {
  const step = spinner();
  step.start(start);

  try {
    await fn();
    step.stop(stop);
  } catch (err) {
    step.stop(error, 1);
    throw err;
  }
};
