// The agent's side of the home hero, shared by Hero.astro (which renders it in the server HTML,
// in its final state, so it is there without JavaScript) and hero.ts (which types it out).

export type Line = {
  text: string;
  cls: 'user' | 'tool' | 'out' | 'ok';
  /** A Rozenite call, led by the accent dot. */
  call?: boolean;
  /** The call's JSON arguments. */
  args?: string;
  /** Typed out character by character rather than shown at once. */
  type?: boolean;
};

export const LINES: Line[] = [
  { text: '> Why does the cart screen fail?', cls: 'user', type: true },
  { text: 'session · create', cls: 'tool', call: true },
  { text: 'network · listRequests', args: '{"limit":5}', cls: 'tool', call: true },
  { text: '  GET  /api/cart  500  212 ms', cls: 'out' },
  { text: 'console · getMessages', args: '{"levels":["error"]}', cls: 'tool', call: true },
  { text: "  ERR  TypeError: Cannot read property 'price' of undefined", cls: 'out' },
  {
    text: '✓ /api/cart returns 500, and CartScreen reads items before they load.',
    cls: 'ok',
    type: true,
  },
];

export const DOT = '<span class="p">●</span> ';

/** Colours a JSON argument object the way code blocks do: keys, values, punctuation. */
export const colorArgs = (json: string) =>
  json.replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|([{}[\],:])/g,
    (_, str, colon, num, punc) => {
      if (str && colon) return `<span class="k">${str}</span><span class="dim">${colon}</span>`;
      if (str) return `<span class="s">${str}</span>`;
      if (num) return `<span class="s">${num}</span>`;
      return `<span class="dim">${punc}</span>`;
    },
  );

/** A line's finished HTML: the dot, the text, the coloured arguments. Static strings only. */
export const lineHtml = (l: Line) => {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `${l.call ? DOT : ''}${esc(l.text)}${l.args ? ` ${colorArgs(l.args)}` : ''}`;
};
