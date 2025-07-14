import * as clack from '@clack/prompts';
import { isInteractive } from './isInteractive.js';
import { logger } from './logger.js';

export const intro = (title?: string) => clack.intro(title);

export const outro = (message?: string) => clack.outro(message);

export const note = (message?: string, title?: string) =>
  clack.note(message, title);

export const promptText = async (
  options: clack.TextOptions
): Promise<string> => {
  const result = await clack.text(options);
  if (clack.isCancel(result)) {
    cancelPromptAndExit();
  }

  return result as string;
};

export const promptPassword = async (
  options: clack.PasswordOptions
): Promise<string> => {
  const result = await clack.password(options);
  if (clack.isCancel(result)) {
    cancelPromptAndExit();
  }

  return result as string;
};

export const promptSelect = async <T>(
  options: clack.SelectOptions<T>
): Promise<T> => {
  // If there is only one option, return it immediately
  if (options.options.length === 1) {
    return options.options[0].value as T;
  }

  const result = await clack.select<T>(options);
  if (clack.isCancel(result)) {
    cancelPromptAndExit();
  }

  return result as T;
};

type ConfirmOptions = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export const promptConfirm = async (
  options: ConfirmOptions
): Promise<boolean> => {
  const result = await clack.select({
    message: options.message,
    options: [
      { value: true, label: options.confirmLabel ?? 'Confirm' },
      { value: false, label: options.cancelLabel ?? 'Cancel' },
    ],
  });

  if (clack.isCancel(result)) {
    cancelPromptAndExit();
  }

  return result === true;
};

export const promptMultiselect = async <T>(
  options: clack.MultiSelectOptions<T>
): Promise<T[]> => {
  const result = await clack.multiselect<T>(options);
  if (clack.isCancel(result)) {
    cancelPromptAndExit();
  }

  return result as T[];
};

export const promptGroup = async <T>(
  prompts: clack.PromptGroup<T>,
  options?: clack.PromptGroupOptions<T> | undefined
): Promise<T> => {
  const result = await clack.group(prompts, options);
  if (clack.isCancel(result)) {
    cancelPromptAndExit();
  }

  return result;
};

export const spinner = (options?: clack.SpinnerOptions) => {
  if (logger.isVerbose() || !isInteractive()) {
    return {
      start: (message?: string) => logger.log(formatStartMessage(message)),
      stop: (message?: string, code = 0) => {
        return code === 0 ? logger.log(message) : logger.error(message);
      },
      message: (message?: string) => logger.log(formatStartMessage(message)),
    };
  }

  const clackSpinner = clack.spinner(options);

  return {
    start: (message?: string) => {
      clackSpinner.start(message);
    },
    stop: (message?: string, code?: number) => {
      clackSpinner.stop(message, code);
    },
    message: (message?: string) => {
      clackSpinner.message(message);
    },
  };
};

export const formatStartMessage = (
  text: string | undefined
): string | undefined => {
  if (text === undefined) {
    return undefined;
  }

  const messageWithoutDots = text.replace(/\.+$/, '');
  return `${messageWithoutDots}...`;
};

export const cancelPromptAndExit = (message?: string): never => {
  clack.cancel(message ?? 'Operation cancelled by user.');
  process.exit(0);
};
