import { getDeviceName } from './device-utils.js';
import { logger } from './logger.js';
import type { PageManager, TrackedPage } from './page-manager.js';

export type ReactNativeAgentMetadata = {
	appDisplayName: string;
	appIdentifier: string;
	deviceName: string;
	integrationName: string;
	platform: string;
	reactNativeVersion: string;
	unstable_isProfilingBuild: boolean;
	unstable_networkInspectionEnabled: boolean;
}

export type CDPEvent = {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
}

export type ReactNativeAgent = {
	shouldHandle: (event: CDPEvent) => boolean;
	handleCommand: (
		pageId: string,
		event: CDPEvent,
		sendResponse: (response: unknown) => void
	) => boolean;
	isEnabled: () => boolean;
}

export const createReactNativeAgent = (pageManager: PageManager): ReactNativeAgent => {
	let enabled = false;

	const getMetadata = (pageId: string): ReactNativeAgentMetadata => {
		const page = pageManager.getAll().find((p: TrackedPage) => p.id === pageId);
		const rnMeta = page?.reactNativeMetadata ?? {};

		return {
			appDisplayName: (rnMeta.appDisplayName as string) || 'Unknown App',
			appIdentifier: '',
			deviceName: getDeviceName(),
			integrationName: 'Rozenite',
			platform: 'web',
			reactNativeVersion: (rnMeta.reactNativeVersion as string) || '0.0.0',
			unstable_isProfilingBuild: false,
			unstable_networkInspectionEnabled: true,
		};
	};

	const shouldHandle = (event: CDPEvent): boolean => {
		return Boolean(event.method?.startsWith('ReactNativeApplication.'));
	};

	const handleCommand = (
		pageId: string,
		event: CDPEvent,
		sendResponse: (response: unknown) => void
	): boolean => {
		if (!shouldHandle(event)) {
			return false;
		}

		switch (event.method) {
			case 'ReactNativeApplication.enable':
				enabled = true;
				logger.info('ReactNativeApplication agent enabled');

				sendResponse({
					id: event.id,
					result: {},
				});

				sendResponse({
					method: 'ReactNativeApplication.metadataUpdated',
					params: getMetadata(pageId),
				});

				return true;

			case 'ReactNativeApplication.disable':
				enabled = false;
				logger.info('ReactNativeApplication agent disabled');
				sendResponse({
					id: event.id,
					result: {},
				});
				return true;

			default:
				sendResponse({
					id: event.id,
					error: {
						code: -32601,
						message: `Method '${event.method}' not found`,
					},
				});
				return true;
		}
	};

	const isEnabled = () => enabled;

	return {
		shouldHandle,
		handleCommand,
		isEnabled,
	};
};
