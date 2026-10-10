// Variant B's hero: the agent changes the app through plugin tools, then DevTools attaches and
// shows the human what changed. Loaded on demand by HeroAgents.astro.
import { ghostLine, sendPacket, sleep, whenVisible } from '../site/anim';

const DOT = '<span class="p">●</span> ';

// What the agent writes: the request, each Rozenite call with its arguments, what comes back.
const LINES = [
  { text: '> Reset onboarding and open it, so I can check the new copy.', cls: 'user', type: true },
  { text: 'session · create', cls: 'tool', prefix: DOT, call: true },
  { text: 'storage · list-storages', cls: 'tool', prefix: DOT, call: true },
  { text: '  mmkv · async-storage · secure-store', cls: 'out' },
  {
    text: 'storage · edit-entry',
    args: ' {"adapterId":"mmkv","storageId":"app","key":"onboarding.done","type":"boolean","value":false}',
    cls: 'tool',
    prefix: DOT,
    call: true,
  },
  {
    text: 'react-navigation · navigate',
    args: ' {"name":"Onboarding"}',
    cls: 'tool',
    prefix: DOT,
    call: true,
    nav: true,
  },
  { text: 'session · stop', cls: 'tool', prefix: DOT },
  { text: '✓ Onboarding is reset and open on the simulator.', cls: 'ok', type: true },
];

export default function runAgents(viz: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => viz.querySelector<T>(sel)!;
  const term = q('[data-term]');
  const agent = q('.rig-agent');
  const devtools = q('.rig-devtools');
  const ductA = q('[data-duct-agent]');
  const ductH = q('[data-duct-human]');
  const pktA = q('[data-pkt-agent]');
  const pktCall = q('[data-pkt-call]');
  const pktH = q('[data-pkt-human]');
  const rows = [...viz.querySelectorAll<HTMLElement>('[data-row]')];
  const views = [...viz.querySelectorAll<HTMLElement>('[data-view]')];
  const title = q('[data-title]');

  const show = (view: 'home' | 'onboarding') => {
    for (const v of views) v.classList.toggle('is-on', v.dataset.view === view);
    title.textContent = view === 'home' ? 'Store' : 'Welcome';
  };
  const attach = (side: 'human' | 'agent' | 'both') => {
    agent.classList.toggle('is-idle', side === 'human');
    ductA.classList.toggle('is-idle', side === 'human');
    devtools.classList.toggle('is-idle', side === 'agent');
    ductH.classList.toggle('is-idle', side === 'agent');
  };
  // The app is right of both windows, or between them when stacked: DevTools then sits below,
  // so its packets travel forward; side by side they travel back toward the left.
  const stacked = () => ductH.clientHeight > ductH.clientWidth;

  const prepare = () => {
    term.textContent = '';
    return LINES.map((l) => ({
      ...l,
      g: ghostLine(term, l.text + (l.args ?? ''), l.cls, l.prefix ?? ''),
    }));
  };
  const dimArgs = (el: HTMLElement, text: string, args?: string) => {
    if (!args) return;
    const typed = el.children[el.children.length - 2] as HTMLElement;
    typed.innerHTML = `${text}<span class="dim">${args}</span>`;
  };
  // Agent calls go toward the app: right side by side, down when stacked; data comes back.
  const call = async () => {
    await sendPacket(ductA, pktCall, false);
    await sendPacket(ductA, pktA, true);
  };

  const play = async () => {
    show('home');
    for (const r of rows) r.classList.remove('is-on', 'is-picked');
    const lines = prepare();
    attach('agent');
    await sleep(700);
    for (const l of lines) {
      if (l.type) await l.g.type(20);
      else {
        await sleep(300);
        l.g.show();
        dimArgs(l.g.el, l.text, l.args);
      }
      if (l.call) await call();
      if (l.nav) show('onboarding');
    }
    await sleep(600);

    // The human's turn: DevTools attaches and the Storage panel shows what changed.
    attach('human');
    await sleep(500);
    for (const r of rows) {
      await sendPacket(ductH, pktH, !stacked());
      r.classList.add('is-on');
    }
    rows[0]!.classList.add('is-picked');
    await sleep(3200);
  };

  whenVisible(viz, play, () => {
    const lines = prepare();
    for (const l of lines) {
      l.g.show();
      dimArgs(l.g.el, l.text, l.args);
    }
    show('onboarding');
    attach('both');
    for (const r of rows) r.classList.add('is-on');
    rows[0]!.classList.add('is-picked');
  });
}
