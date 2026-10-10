// The plugin anatomy: a request from the panel, the app side's handler, the answer back.
// Loaded on demand by Anatomy.astro.
import { sendPacket, sleep, whenVisible } from '../site/anim';

export default function runAnatomy(viz: HTMLElement) {
  const duct = viz.querySelector<HTMLElement>('[data-duct]')!;
  const pkt = viz.querySelector<HTMLElement>('[data-pkt]')!;
  const back = viz.querySelector<HTMLElement>('[data-pkt-back]')!;
  const lines = [...viz.querySelectorAll<HTMLElement>('.an-code .line')];
  const fields = [...viz.querySelectorAll<HTMLElement>('[data-field]')];
  const rowOut = viz.querySelector<HTMLElement>('[data-row="out"]')!;
  const rowIn = viz.querySelector<HTMLElement>('[data-row="in"]')!;

  // Lines of the snippet: the handler (6) and the send with its payload (7 to 11), 1-based.
  const hot = (from: number, to = from) =>
    lines.forEach((l, i) => l.classList.toggle('is-hot', i + 1 >= from && i + 1 <= to));

  const reset = () => {
    hot(0);
    for (const f of fields) f.classList.remove('is-on');
    rowOut.classList.remove('is-on');
    rowIn.classList.remove('is-on');
  };

  const play = async () => {
    reset();
    await sleep(900);
    // The panel asks: right to left (bottom to top when stacked).
    rowOut.classList.add('is-on');
    await sendPacket(duct, back, true);
    hot(6);
    await sleep(700);
    hot(7, 11);
    await sleep(500);
    await sendPacket(duct, pkt);
    rowIn.classList.add('is-on');
    for (const f of fields) {
      f.classList.add('is-on');
      await sleep(120);
    }
    hot(0);
    await sleep(3000);
  };

  whenVisible(viz, play, () => {
    reset();
    hot(7, 11);
    for (const f of fields) f.classList.add('is-on');
    rowOut.classList.add('is-on');
    rowIn.classList.add('is-on');
  });
}
