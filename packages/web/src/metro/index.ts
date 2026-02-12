import { createMetroConfigTransformer } from '@rozenite/tools';
import type { ConfigT as MetroConfig } from 'metro-config';

const injectConfig = (config: MetroConfig): MetroConfig => {
	return {
		...config,
		serializer: {
			...config.serializer,
			getModulesRunBeforeMainModule: (...args) => [
				'@rozenite/web',
				...(config.serializer?.getModulesRunBeforeMainModule?.(...args) ?? []),
			]
		},
		resolver: {
			...config.resolver,
			resolveRequest: (context, moduleName, platform) => {
				const resolveRequest = config.resolver?.resolveRequest ?? context.resolveRequest;

				if (platform === 'web') {
					if (moduleName.includes('ReactNativeFeatureFlags')) {
						return {
							type: 'sourceFile',
							filePath: require.resolve('./ReactNativeFeatureFlags.js'),
						}
					}
				}

				return resolveRequest(context, moduleName, platform);
			}
		}
	}
}

export const withRozeniteWeb = createMetroConfigTransformer(injectConfig);
