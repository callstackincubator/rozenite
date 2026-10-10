// Variant A's hero: the same failing request seen by a human in DevTools, then by an agent in
// the terminal. One debugger connection at a time, so the two sides take turns.
// Loaded on demand by HeroPanels.astro.
import { ghostLine, sendPacket, sleep, whenVisible } from '../site/anim';

const DOT = '<span class="p">●</span> ';
const LINES = [
  { text: '> Why does the cart screen fail?', cls: 'user', type: true },
  { text: 'session · create', cls: 'tool', prefix: DOT, call: true },
  { text: 'network · listRequests', args: ' {"limit":5}', cls: 'tool', prefix: DOT, call: true },
  { text: '  GET  /api/cart  500  212 ms', cls: 'out' },
  {
    text: 'console · getMessages',
    args: ' {"levels":["error"]}',
    cls: 'tool',
    prefix: DOT,
    call: true,
  },
  { text: "  ERR  TypeError: Cannot read property 'price' of undefined", cls: 'out' },
  {
    text: '✓ /api/cart returns 500, and CartScreen reads items before they load.',
    cls: 'ok',
    type: true,
  },
];

export default function runPanels(viz: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => viz.querySelector<T>(sel)!;
  const devtools = q('.rig-devtools');
  const agent = q('.rig-agent');
  const term = q('[data-term]');
  const ductH = q('[data-duct-human]');
  const ductA = q('[data-duct-agent]');
  const pktH = q('[data-pkt-human]');
  const pktA = q('[data-pkt-agent]');
  const pktCall = q('[data-pkt-call]');
  const views = [...viz.querySelectorAll<HTMLElement>('[data-view]')];
  const title = q('[data-title]');
  const rows = ['n0', 'n1', 'n2'].map((id) => q(`[data-row="${id}"]`));

  const show = (view: 'home' | 'cart') => {
    for (const v of views) v.classList.toggle('is-on', v.dataset.view === view);
    title.textContent = view === 'home' ? 'Store' : 'Cart';
  };
  // DevTools sits left of the app, or above it when stacked: either way, against the duct.
  const toDevTools = () => sendPacket(ductH, pktH, true);
  const attach = (side: 'human' | 'agent' | 'both') => {
    devtools.classList.toggle('is-idle', side === 'agent');
    ductH.classList.toggle('is-idle', side === 'agent');
    agent.classList.toggle('is-idle', side === 'human');
    ductA.classList.toggle('is-idle', side === 'human');
  };

  const prepare = () => {
    term.textContent = '';
    return LINES.map((l) => {
      const g = ghostLine(term, l.text + (l.args ?? ''), l.cls, l.prefix ?? '');
      return { ...l, g };
    });
  };
  const dimArgs = (el: HTMLElement, text: string, args?: string) => {
    if (!args) return;
    const typed = el.children[el.children.length - 2] as HTMLElement;
    typed.innerHTML = `${text}<span class="dim">${args}</span>`;
  };
  const reset = () => {
    show('home');
    for (const r of rows) r.classList.remove('is-on', 'is-picked');
    return prepare();
  };

  const play = async () => {
    const lines = reset();
    // The human's turn: DevTools is attached; the app's requests land as rows.
    attach('human');
    await sleep(800);
    for (const r of rows.slice(0, 2)) {
      await toDevTools();
      r.classList.add('is-on');
    }
    await sleep(400);
    show('cart');
    await toDevTools();
    rows[2]!.classList.add('is-on', 'is-picked');
    await sleep(1800);

    // The agent's turn: it attaches from the terminal and asks for the same data.
    attach('agent');
    await sleep(500);
    for (const l of lines) {
      if (l.type) await l.g.type(20);
      else {
        await sleep(280);
        l.g.show();
        dimArgs(l.g.el, l.text, l.args);
      }
      if (l.call) {
        await sendPacket(ductA, pktCall, true);
        await sendPacket(ductA, pktA);
      }
    }
    await sleep(3200);
  };

  whenVisible(viz, play, () => {
    const lines = reset();
    attach('both');
    for (const r of rows) r.classList.add('is-on');
    rows[2]!.classList.add('is-picked');
    show('cart');
    for (const l of lines) {
      l.g.show();
      dimArgs(l.g.el, l.text, l.args);
    }
  });
}
