// Variant A's hero: plugin tabs appear in DevTools and fill with live rows from the app.
// Loaded on demand by HeroPanels.astro.
import { sendPacket, sleep, whenVisible } from '../site/anim';

export default function runPanels(viz: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => viz.querySelector<T>(sel)!;
  const qa = (sel: string) => [...viz.querySelectorAll<HTMLElement>(sel)];
  const duct = q('[data-duct]');
  const pkt = q('[data-pkt]');
  const ring = q('[data-ring]');
  const count = q('[data-count]');
  const screen = q('.screen');
  const cartValue = q('[data-cart-value]');
  const qStatus = q('[data-q-status]');

  // The phone sits left of the window, or below it when the layout stacks.
  const toDevTools = () => sendPacket(duct, pkt, duct.clientHeight > duct.clientWidth);

  const reveal = (id: string) => q(`[data-tab="${id}"]`).removeAttribute('data-hidden');
  const strip = q('.dt-tabs');
  const select = (id: string) => {
    for (const t of qa('[data-tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === id));
    // Keep the selected tab in view when the strip is narrower than its tabs.
    const tab = q(`[data-tab="${id}"]`);
    strip.scrollLeft = Math.max(0, tab.offsetLeft + tab.offsetWidth - strip.clientWidth);
    for (const p of qa('[data-pane]')) p.classList.toggle('is-on', p.dataset.pane === id);
  };
  const row = (id: string, on = true) => q(`[data-row="${id}"]`).classList.toggle('is-on', on);
  const item = (i: number) => q(`[data-item="${i}"]`).classList.add('is-on');
  const setCount = (n: number) => {
    count.textContent = String(n);
    count.classList.toggle('is-full', n > 0);
  };

  const tap = async (name: string) => {
    const target = q(`[data-tap="${name}"]`);
    const s = screen.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    ring.style.left = `${t.left - s.left + t.width / 2}px`;
    ring.style.top = `${t.top - s.top + t.height / 2}px`;
    ring.classList.add('is-on');
    await sleep(420);
    ring.classList.add('is-down');
    target.classList.add('is-pressed');
    await sleep(140);
    ring.classList.remove('is-down');
    target.classList.remove('is-pressed');
    await sleep(160);
    ring.classList.remove('is-on');
  };

  const reset = () => {
    for (const id of ['network', 'query', 'storage'])
      q(`[data-tab="${id}"]`).setAttribute('data-hidden', '');
    select('console');
    for (const r of qa('[data-row]')) r.classList.remove('is-on');
    for (const i of qa('[data-item]')) i.classList.remove('is-on');
    q('[data-empty]').style.visibility = 'visible';
    setCount(0);
    cartValue.textContent = '1';
    cartValue.classList.remove('flash');
    qStatus.textContent = 'fetching';
    qStatus.className = 'live';
  };

  const play = async () => {
    reset();
    await sleep(900);

    // Network Activity: the app loads, each request lands as a row.
    reveal('network');
    await sleep(240);
    select('network');
    await sleep(500);
    await toDevTools();
    row('n0');
    q('[data-empty]').style.visibility = 'hidden';
    for (let i = 0; i < 3; i++) {
      item(i);
      await sleep(90);
    }
    await toDevTools();
    row('n1');
    await sleep(200);
    await toDevTools();
    row('n2');
    await sleep(1400);

    // TanStack Query: adding to the cart refetches ["cart"].
    reveal('query');
    await sleep(240);
    select('query');
    row('q0');
    row('q1');
    await sleep(700);
    await tap('add-1');
    setCount(1);
    await toDevTools();
    row('q2');
    row('q3');
    await sleep(700);
    qStatus.textContent = 'fresh';
    qStatus.className = 'mut';
    await sleep(1400);

    // Storage: the stored count follows the app.
    reveal('storage');
    await sleep(240);
    select('storage');
    for (const r of ['s0', 's1', 's2']) row(r);
    await sleep(700);
    await tap('add-2');
    setCount(2);
    await toDevTools();
    cartValue.textContent = '2';
    cartValue.classList.add('flash');
    await sleep(500);
    cartValue.classList.remove('flash');
    cartValue.classList.add('live');
    await sleep(2600);
    cartValue.classList.remove('live');
  };

  whenVisible(viz, play, () => {
    reset();
    for (const id of ['network', 'query', 'storage']) reveal(id);
    select('network');
    for (const r of ['n0', 'n1', 'n2']) row(r);
    for (let i = 0; i < 3; i++) item(i);
    q('[data-empty]').style.visibility = 'hidden';
    setCount(2);
  });
}
