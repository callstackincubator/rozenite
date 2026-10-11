import { logger } from '../../utils/logger.js';

/**
 * Whether stdout is a terminal. JSON is indented for a person reading a
 * terminal and compact for a program reading a pipe (ADR 0005, decision 8).
 */
export const isStdoutTTY = (): boolean => process.stdout.isTTY === true;

/**
 * Prints `payload`. JSON is indented when `pretty` is set or stdout is a
 * terminal, and compact otherwise.
 */
export const printOutput = (payload: unknown, asJson: boolean, pretty: boolean = false): void => {
  if (asJson) {
    const json =
      pretty || isStdoutTTY() ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
    process.stdout.write(`${json}\n`);
    return;
  }

  if (typeof payload === 'string') {
    logger.info(payload);
    return;
  }

  logger.info(JSON.stringify(payload, null, 2));
};
