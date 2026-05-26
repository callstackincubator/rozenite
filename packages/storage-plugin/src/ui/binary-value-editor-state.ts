import {
  base64ToBytes,
  bytesToBase64,
  bytesToGroupedHex,
  hexInputToBytes,
} from './binary';

export type EditorMode = 'hex' | 'base64';

export type EditorState = {
  mode: EditorMode;
  text: string;
  bytes: number[] | null;
  error: string | null;
};

export type EditorAction =
  | { type: 'set-text'; text: string }
  | { type: 'normalize-paste'; text: string }
  | { type: 'switch-mode'; mode: EditorMode };

export type Validation =
  | { ok: true; bytes: number[] }
  | { ok: false; reason: string };

const encode = (bytes: readonly number[], mode: EditorMode): string =>
  mode === 'hex' ? bytesToGroupedHex(bytes) : bytesToBase64(bytes);

const parse = (text: string, mode: EditorMode) =>
  mode === 'hex' ? hexInputToBytes(text) : base64ToBytes(text);

const parsedToState = (
  text: string,
  mode: EditorMode,
): Pick<EditorState, 'bytes' | 'error'> => {
  const result = parse(text, mode);
  return result.ok
    ? { bytes: result.value, error: null }
    : { bytes: null, error: result.error };
};

export const initialState = (args: {
  initialBytes?: number[];
  mode?: EditorMode;
}): EditorState => {
  const mode = args.mode ?? 'hex';
  if (args.initialBytes && args.initialBytes.length > 0) {
    return {
      mode,
      text: encode(args.initialBytes, mode),
      bytes: args.initialBytes,
      error: null,
    };
  }
  return {
    mode,
    text: '',
    bytes: null,
    error: null,
  };
};

export const reduce = (
  state: EditorState,
  action: EditorAction,
): EditorState => {
  switch (action.type) {
    case 'set-text': {
      return {
        ...state,
        text: action.text,
        ...parsedToState(action.text, state.mode),
      };
    }
    case 'normalize-paste': {
      const result = parse(action.text, state.mode);
      if (result.ok) {
        return {
          ...state,
          text: encode(result.value, state.mode),
          bytes: result.value,
          error: null,
        };
      }
      return {
        ...state,
        text: action.text,
        bytes: null,
        error: result.error,
      };
    }
    case 'switch-mode': {
      if (state.mode === action.mode) {
        return state;
      }
      if (state.bytes !== null) {
        return {
          mode: action.mode,
          text: encode(state.bytes, action.mode),
          bytes: state.bytes,
          error: null,
        };
      }
      return {
        mode: action.mode,
        text: '',
        bytes: null,
        error: null,
      };
    }
  }
};

export const validate = (state: EditorState): Validation => {
  if (state.bytes === null) {
    return {
      ok: false,
      reason: state.error ?? 'Enter at least one byte.',
    };
  }
  if (state.bytes.length === 0) {
    return { ok: false, reason: 'Enter at least one byte.' };
  }
  return { ok: true, bytes: state.bytes };
};
