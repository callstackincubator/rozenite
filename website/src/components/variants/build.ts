// Variant C's hero: one plugin's app side answers the panel, then the agent.
// Loaded on demand by HeroBuild.astro.
import { ghostLine, sendPacket, sleep, whenVisible } from '../site/anim';

const DOT = '<span class="p">●</span> ';
const LINES = [
  { text: "> What's in the cart on the simulator?", cls: 'user', type: true },
  { text: 'session · create', cls: 'tool', prefix: DOT, call: true },
  { text: '@acme/checkout-inspector · get-cart', cls: 'tool', prefix: DOT, call: true, tool: true },
  { text: '  Runner Low ×1  $120 · Cotton Tee ×2  $64', cls: 'out' },
  { text: '✓ Two products, $184 in total.', cls: 'ok', type: true },
];

export default function runBuild(viz: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => viz.querySelector<T>(sel)!;
  const term = q('[data-term]');
  const devtools = q('.tree-devtools');
  const agent = q('.tree-agent');
  const ductH = q('[data-duct-human]');
  const ductA = q('[data-duct-agent]');
  const pktH = q('[data-pkt-human]');
  const pktA = q('[data-pkt-agent]');
  const pktCall = q('[data-pkt-call]');
  const rows = [...viz.querySelectorAll<HTMLElement>('[data-row]')];
  const halves = [...viz.querySelectorAll<HTMLElement>('[data-half]')];

  // Lights the half of the plugin that is answering: the panel's handler or the agent tool.
  const hot = (half: 'panel' | 'agent' | '') => {
    for (const h of halves) h.classList.toggle('is-hot', h.dataset.half === half);
  };
  const attach = (side: 'human' | 'agent' | 'both') => {
    devtools.classList.toggle('is-idle', side === 'agent');
    ductH.classList.toggle('is-idle', side === 'agent');
    agent.classList.toggle('is-idle', side === 'human');
    ductA.classList.toggle('is-idle', side === 'human');
  };
  // The agent's duct is hidden on a phone; its packets then just wait their turn.
  const agentDuct = () => ductA.offsetParent !== null;

  const prepare = () => {
    term.textContent = '';
    return LINES.map((l) => ({ ...l, g: ghostLine(term, l.text, l.cls, l.prefix ?? '') }));
  };
  const reset = () => {
    hot('');
    for (const r of rows) r.classList.remove('is-on');
    return prepare();
  };

  const play = async () => {
    const tlines = reset();
    // The human's turn: the panel asks, the handler answers with the cart.
    attach('human');
    await sleep(900);
    hot('panel');
    await sleep(500);
    for (const r of rows) {
      await sendPacket(ductH, pktH);
      r.classList.add('is-on');
    }
    await sleep(1400);
    hot('');

    // The agent's turn: the same data through the plugin's agent tool.
    attach('agent');
    await sleep(500);
    for (const l of tlines) {
      if (l.type) await l.g.type(22);
      else {
        await sleep(300);
        l.g.show();
      }
      if (l.tool) hot('agent');
      if (l.call && agentDuct()) {
        await sendPacket(ductA, pktCall, true);
        await sendPacket(ductA, pktA);
      } else if (l.call) await sleep(500);
    }
    await sleep(2400);
    hot('');
    await sleep(800);
  };

  whenVisible(viz, play, () => {
    const tlines = reset();
    attach('both');
    for (const r of rows) r.classList.add('is-on');
    for (const l of tlines) l.g.show();
    hot('panel');
  });
}
