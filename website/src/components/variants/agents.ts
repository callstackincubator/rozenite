// Variant B's hero: an agent reproduces a bug through Rozenite and reads why it happens.
// Loaded on demand by HeroAgents.astro.
import { ghostLine, sendPacket, sleep, whenVisible } from '../site/anim';

const DOT = '<span class="p">●</span> ';

// What the agent writes: the request, each Rozenite call with its arguments, what comes back.
const LINES = [
  { text: '> The cart screen shows an error. Find out why.', cls: 'user', type: true },
  { text: 'session · create', cls: 'tool', prefix: DOT },
  {
    text: 'react-navigation · navigate',
    cls: 'tool',
    prefix: DOT,
    args: ' {"name":"Cart"}',
    to: 'app',
  },
  {
    text: 'console · getMessages',
    cls: 'tool',
    prefix: DOT,
    args: ' {"levels":["error"]}',
    to: 'agent',
  },
  { text: "  ERR  TypeError: Cannot read property 'price' of undefined", cls: 'out' },
  { text: 'network · listRequests', cls: 'tool', prefix: DOT, args: ' {"limit":5}', to: 'agent' },
  { text: '  GET  /api/cart  500  212 ms', cls: 'out' },
  {
    text: '✓ /api/cart returns 500 and CartScreen reads items before they load.',
    cls: 'ok',
    type: true,
  },
] as const;

export default function runAgents(viz: HTMLElement) {
  const term = viz.querySelector<HTMLElement>('[data-term]')!;
  const duct = viz.querySelector<HTMLElement>('[data-duct]')!;
  const pkt = viz.querySelector<HTMLElement>('[data-pkt]')!;
  const back = viz.querySelector<HTMLElement>('[data-pkt-back]')!;
  const views = [...viz.querySelectorAll<HTMLElement>('[data-view]')];
  const title = viz.querySelector<HTMLElement>('[data-title]')!;

  const show = (view: 'home' | 'cart') => {
    for (const v of views) v.classList.toggle('is-on', v.dataset.view === view);
    title.textContent = view === 'home' ? 'Store' : 'Cart';
  };

  // Lays out every line before anything is typed, so nothing reflows.
  const prepare = () => {
    term.textContent = '';
    return LINES.map((l) => {
      const args = 'args' in l ? l.args : '';
      const g = ghostLine(term, l.text + args, l.cls, 'prefix' in l ? l.prefix : '');
      return { ...l, g };
    });
  };
  // Arguments in faint, after the tool name.
  const dimArgs = (el: HTMLElement, text: string, args: string) => {
    if (!args) return;
    const typed = el.children[el.children.length - 2] as HTMLElement;
    typed.innerHTML = `${text}<span class="dim">${args}</span>`;
  };

  const play = async () => {
    show('home');
    const lines = prepare();
    await sleep(700);
    for (const l of lines) {
      if ('type' in l && l.type) await l.g.type(22);
      else {
        await sleep(320);
        l.g.show();
        dimArgs(l.g.el, l.text, 'args' in l ? l.args : '');
      }
      if ('to' in l) {
        await sleep(200);
        if (l.to === 'app') {
          await sendPacket(duct, pkt);
          show('cart');
          await sleep(400);
          await sendPacket(duct, back, true);
        } else {
          await sendPacket(duct, pkt);
          await sleep(160);
          await sendPacket(duct, back, true);
        }
      }
    }
    await sleep(3600);
  };

  whenVisible(viz, play, () => {
    const lines = prepare();
    for (const l of lines) {
      l.g.show();
      dimArgs(l.g.el, l.text, 'args' in l ? l.args : '');
    }
    show('cart');
  });
}
