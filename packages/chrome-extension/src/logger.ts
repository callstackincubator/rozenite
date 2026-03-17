const PREFIX = '[Rozenite]';

export type Logger = {
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
};

export const logger: Logger = {
	info: (...args) => console.log(PREFIX, ...args),
	warn: (...args) => console.warn(PREFIX, ...args),
	error: (...args) => console.error(PREFIX, ...args),
};
