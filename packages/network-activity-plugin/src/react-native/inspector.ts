export interface Inspector<TEventMap> {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
  on<TEventType extends keyof TEventMap>(
    type: TEventType,
    callback: (event: TEventMap[TEventType]) => void
  ): () => void;
}
