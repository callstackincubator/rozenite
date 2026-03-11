import { logger } from '../../utils/logger.js';

export const printOutput = (
  payload: unknown,
  asJson: boolean,
  pretty: boolean = false,
): void => {
  if (asJson) {
    const json = pretty
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(payload);
    process.stdout.write(`${json}\n`);
    return;
  }

  if (typeof payload === 'string') {
    logger.info(payload);
    return;
  }

  logger.info(JSON.stringify(payload, null, 2));
};
