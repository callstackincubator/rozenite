// The home page hero: one running app with DevTools and an agent attached at the same time. The
// failing request lands as a row in the Network Activity panel, and the agent gets the same
// request back from `network · listRequests`.
// The page renders the final state; the loop resets it and plays it. Loaded on demand by Hero.astro.
import { ghostLine, sendPacket, sleep, whenVisible } from '../site/anim';
import { DOT, LINES, colorArgs } from './transcript';

export default function runHero(viz: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => viz.querySelector<T>(sel)!;
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
  // The agent sits right of the app, or below it: calls travel back, data forward.
  const agentCall = async () => {
    await sendPacket(ductA, pktCall, true);
    await sendPacket(ductA, pktA);
  };

  const prepare = () => {
    term.textContent = '';
    return LINES.map((l) => ({
      ...l,
      g: ghostLine(term, l.text + (l.args ? ` ${l.args}` : ''), l.cls, l.call ? DOT : ''),
    }));
  };
  const dimArgs = (el: HTMLElement, text: string, args?: string) => {
    if (!args) return;
    const typed = el.children[el.children.length - 2] as HTMLElement;
    typed.innerHTML = `${text} ${colorArgs(args)}`;
  };
  const reveal = async (l: ReturnType<typeof prepare>[number]) => {
    if (l.type) await l.g.type(20);
    else {
      await sleep(260);
      l.g.show();
      dimArgs(l.g.el, l.text, l.args);
    }
  };
  const reset = () => {
    show('home');
    for (const r of rows) r.classList.remove('is-on', 'is-picked');
    return prepare();
  };

  const play = async () => {
    const lines = reset();
    const [ask, session, list, listOut, logs, logsOut, done] = lines;
    await sleep(700);
    // The app loads; its requests land in the panel while the agent is asked to look.
    const loading = (async () => {
      for (const r of rows.slice(0, 2)) {
        await toDevTools();
        r.classList.add('is-on');
      }
    })();
    await reveal(ask!);
    await loading;
    await reveal(session!);
    await agentCall();
    // The cart fails: the request shows up in the panel...
    show('cart');
    await toDevTools();
    rows[2]!.classList.add('is-on');
    await sleep(500);
    // ...and the agent asks for the requests and gets the same one back.
    await reveal(list!);
    await agentCall();
    await reveal(listOut!);
    rows[2]!.classList.add('is-picked');
    await sleep(400);
    await reveal(logs!);
    await agentCall();
    await reveal(logsOut!);
    await reveal(done!);
    await sleep(3400);
  };

  // Under reduced motion the server-rendered final state is the still frame: nothing to do.
  whenVisible(viz, play, () => {});
}
