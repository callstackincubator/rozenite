// Variant C's hero: the official plugins light up, then your own plugin is generated into the
// last tile. Loaded on demand by HeroBuild.astro.
import { ghostLine, sleep, whenVisible } from '../site/anim';

const PROMPT = '<span class="p">$</span> ';

export default function runBuild(viz: HTMLElement) {
  const tiles = [...viz.querySelectorAll<HTMLElement>('[data-tile]')];
  const yours = viz.querySelector<HTMLElement>('[data-yours]')!;
  const term = viz.querySelector<HTMLElement>('[data-term]')!;
  // A fixed shuffle, so the grid lights in a scattered order rather than row by row.
  const order = tiles.map((_, i) => i).sort((a, b) => ((a * 7) % 15) - ((b * 7) % 15));

  const prepare = () => {
    term.textContent = '';
    return [
      ghostLine(term, 'npx rozenite generate checkout-inspector', '', PROMPT),
      ghostLine(term, 'cd checkout-inspector && rozenite dev', '', PROMPT),
    ];
  };
  const reset = () => {
    for (const t of tiles) t.classList.remove('is-on');
    yours.classList.remove('is-on');
    return prepare();
  };

  const play = async () => {
    const [generate, dev] = reset();
    await sleep(800);
    for (const i of order) {
      tiles[i]!.classList.add('is-on');
      await sleep(140);
    }
    await sleep(700);
    await generate!.type(34);
    await sleep(500);
    yours.classList.add('is-on');
    await sleep(700);
    await dev!.type(34);
    await sleep(3400);
  };

  whenVisible(viz, play, () => {
    const lines = reset();
    for (const t of tiles) t.classList.add('is-on');
    yours.classList.add('is-on');
    for (const l of lines) l.show();
  });
}
