/**
 * Global variables available in the React Native environment.
 */
declare const __DEV__: boolean;

declare module 'react-devtools-core' {
	export function initialize(hookSettings: unknown, isProfiling: boolean, profilingSettings: unknown): void;
	export function connectWithCustomMessagingProtocol(options: unknown): () => void;
}

declare module 'react-native/Libraries/Components/View/ReactNativeStyleAttributes' {
	const attrs: Record<string, unknown>;
	export default attrs;
}

declare module 'react-native/Libraries/StyleSheet/flattenStyle' {
	const flattenStyle: (style: unknown) => unknown;
	export default flattenStyle;
}

declare module 'react-native/package.json' {
	interface PackageJson {
		version: string;
	}
	const pkg: PackageJson;
	export default pkg;
}
