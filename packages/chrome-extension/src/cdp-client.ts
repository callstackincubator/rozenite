import { logger } from './logger.js';

const CHROME_DEBUGGER_VERSION = '1.3';

export type CDPPage = {
	id: string;
	[key: string]: unknown;
}

/** Minimal type for pages sent to CDP - TrackedPage satisfies this */
export type CDPPageLike = { id: string } & Record<string, unknown>;

export type ReactNativeAgent = {
	shouldHandle: (event: CDPEvent) => boolean;
	handleCommand: (
		pageId: string,
		event: CDPEvent,
		sendResponse: (response: unknown) => void
	) => boolean;
}

export type ConnectionLike = {
	send: (event: string, payload?: unknown) => void;
}

export type CDPEvent = {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
}

export type CDPClient = {
	sendPages: (pages: CDPPageLike[]) => void;
	sendWrappedEvent: (pageId: string, event: CDPEvent) => void;
	attach: (pageId: string) => void;
	detach: (pageId: string) => void;
	handleCommand: (pageId: string, wrappedEvent: string) => Promise<void>;
}

export const createCDPClient = (
	connection: ConnectionLike,
	reactNativeAgent: ReactNativeAgent | null
): CDPClient => {
	const sendPages = (pages: CDPPageLike[]) => {
		connection.send('getPages', pages);
	};

	const patchEvent = ({ method, params }: CDPEvent): CDPEvent => {
		if (
			method === 'Runtime.executionContextCreated' &&
			(params as { context?: { auxData?: { isDefault?: boolean } } })?.context?.auxData?.isDefault
		) {
			return {
				method,
				params: {
					...params,
					context: {
						...(params as { context?: Record<string, unknown> }).context,
						name: 'main',
					},
				},
			};
		}
		return { method, params };
	};

	const sendWrappedEvent = (pageId: string, event: CDPEvent) => {
		const patched = patchEvent(event);
		connection.send('wrappedEvent', {
			pageId,
			wrappedEvent: JSON.stringify(patched),
		});
	};

	const attach = (pageId: string) => {
		logger.info('Debugger attaching to page', pageId);
		chrome.debugger.attach({ targetId: pageId }, CHROME_DEBUGGER_VERSION);
	};

	const detach = (pageId: string) => {
		logger.info('Debugger detaching from page', pageId);
		chrome.debugger.detach({ targetId: pageId });
	};

	const handleCommand = async (pageId: string, wrappedEvent: string) => {
		try {
			const event = JSON.parse(wrappedEvent) as CDPEvent;

			if (event.method === 'Page.getResourceTree') {
				connection.send('wrappedEvent', {
					pageId,
					wrappedEvent: JSON.stringify({
						id: event.id,
						error: { code: -32601, message: `'${event.method}' wasn't found` },
					}),
				});
				return;
			}

			if (reactNativeAgent?.shouldHandle(event)) {
				const sendResponse = (response: unknown) => {
					connection.send('wrappedEvent', {
						pageId,
						wrappedEvent: JSON.stringify(response),
					});
				};

				reactNativeAgent.handleCommand(pageId, event, sendResponse);
				return;
			}

			const response = await chrome.debugger.sendCommand(
				{ targetId: pageId },
				event.method!,
				event.params
			);

			connection.send('wrappedEvent', {
				pageId,
				wrappedEvent: JSON.stringify({
					id: event.id,
					result: response,
				}),
			});
		} catch (error) {
			logger.warn('CDP command failed for page', pageId, error);
			const event = JSON.parse(wrappedEvent) as CDPEvent;
			connection.send('wrappedEvent', {
				pageId,
				wrappedEvent: JSON.stringify({
					id: event.id,
					error,
				}),
			});
		}
	};

	return {
		sendPages,
		sendWrappedEvent,
		attach,
		detach,
		handleCommand,
	};
};
