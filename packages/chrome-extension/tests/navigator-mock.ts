/**
 * Helper to mock globalThis.navigator in tests.
 * Uses Object.defineProperty to work with Node.js v21+ where navigator is read-only.
 * Pass undefined to simulate missing navigator (for typeof navigator === 'undefined').
 */
export function setNavigatorMock(mock: { userAgent?: string } | undefined): () => void {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
	Object.defineProperty(globalThis, 'navigator', {
		value: mock,
		writable: true,
		configurable: true,
	});
	return () => {
		if (descriptor) {
			Object.defineProperty(globalThis, 'navigator', descriptor);
		} else {
			delete (globalThis as { navigator?: unknown }).navigator;
		}
	};
}
