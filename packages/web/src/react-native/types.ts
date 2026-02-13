export type FuseboxDomain = {
	name: string;
	onMessage: {
		addEventListener: (listener: (event: unknown) => void) => void;
		removeEventListener: (listener: (event: unknown) => void) => void;
	};
	sendMessage: (message: { event: unknown; payload: unknown }) => void;
}