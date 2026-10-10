// The dithered pixel scenes behind the landing pages' windows and phones: a scene generated in
// the browser and ordered-dithered at a fine grain into a ramp from near-black through a dark
// crimson to the accent. Generated instead of shipped as an image, so it follows the accent.
//
// A scene is built once per size (the slow part: geometry and shading) and then animated
// cheaply, with a few arithmetic operations per cell each frame. See docs/DESIGN.md.

// 4x4 Bayer matrix, normalised to 0..1: the threshold a cell's tone must beat to step up.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

// Integer-hashed value noise. `period` makes it wrap horizontally.
const hash = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const noise = (x: number, y: number, period = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = period ? ((xi % period) + period) % period : xi;
  const x1 = period ? (x0 + 1) % period : xi + 1;
  const a = hash(x0, yi);
  const b = hash(x1, yi);
  const c = hash(x0, yi + 1);
  const d = hash(x1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, y: number, octaves = 4, period = 0) => {
  let sum = 0;
  let amp = 0.5;
  let p = period;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x, y, p);
    x *= 2;
    y *= 2;
    p *= 2;
    amp *= 0.5;
  }
  return sum / (1 - Math.pow(0.5, octaves));
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A scene at one size: `frame(t)` fills and returns the tone (0..1) of every cell. */
type Scene = { frame: (t: number) => Float32Array };
type SceneBuilder = (cols: number, rows: number, focus: number, hollow?: boolean) => Scene;

/** A horizontally wrapping noise texture, sampled with a sliding offset. */
function mistTexture(cols: number, rows: number, scaleX: number, scaleY: number) {
  const tex = new Float32Array(cols * rows);
  const period = Math.max(1, Math.round(scaleX));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      tex[y * cols + x] = fbm((x / cols) * period, (y / rows) * scaleY, 4, period);
    }
  }
  return tex;
}

// The mark: how many steps wide each of its ten rows is, tip first. Seven steps at its widest.
const MARK_ROWS = [1, 3, 3, 5, 5, 7, 7, 7, 5, 3];

type Crystal = {
  cx: number;
  base: number;
  step: number;
  depth: number;
  speed: number;
  phase: number;
  /** The missing one (404 page): only a dashed outline of its socket is drawn. */
  hollow?: boolean;
};

const scenes: Record<string, SceneBuilder> = {
  // Crystals: a druse of the mark. Stepped crystals rise from the bottom edge and cluster around
  // `focus` (0..1 across), shaded as faceted stones in dark rock, with a glint sweeping across
  // them and pulses climbing from base to tip.
  crystals: (cols, rows, focus, hollow = false) => {
    const out = new Float32Array(cols * rows);
    const aspect = cols / rows;
    const owner = new Int16Array(cols * rows).fill(-1);
    const shade = new Float32Array(cols * rows);
    const height = new Float32Array(cols * rows); // 0 at the tip, 1 at the base
    const rock = new Float32Array(cols * rows);
    const diag = new Float32Array(cols * rows);

    // Dark rock: low noise in the bottom tones, a faint glow around the focus.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const d = Math.hypot((x / cols - focus) * aspect, (y / rows - 0.62) * 1.2);
        const grain = fbm((x / cols) * 9 * aspect * 0.5, (y / rows) * 9, 4);
        rock[i] = 0.12 * smooth(0.52, 0.85, grain) + 0.12 * Math.exp(-d * d * 4.5);
        diag[i] = (x / cols) * aspect * 0.55 + y / rows;
      }
    }

    // Place the crystals: a big cluster beside the focus, a bed along the bottom edge, and a few
    // small loose ones in the upper field. Sizes are in cells per step.
    // Crystal sizes follow the shorter side, so a tall phone-width scene doesn't get huge steps.
    const size = Math.min(rows, cols * 0.8);
    // Capped, so steps never grow past about 28px and stop reading as pixels.
    const unit = Math.min(size / 10, 28);
    const crystals: Crystal[] = [];
    const add = (u: number, baseFromBottom: number, h: number, depth: number, seed: number) =>
      crystals.push({
        cx: Math.round(u * cols),
        base: Math.round(rows + baseFromBottom * size),
        step: Math.max(1, Math.round((h * unit) / 1)),
        depth,
        speed: 0.12 + 0.1 * hash(seed, 3),
        phase: hash(seed, 9) * 3,
      });
    // The bed: small and dim, everywhere along the bottom.
    const bed = Math.max(8, Math.round(aspect * 7));
    for (let k = 0; k < bed; k++) {
      const u = (k + 0.2 + 0.6 * hash(k, 1)) / bed;
      const near = Math.exp(-(((u - focus) / 0.28) ** 2));
      const h = 0.1 + 0.12 * hash(k, 2) + 0.12 * near;
      add(u, 0.04 + 0.06 * hash(k, 5), h, 0.42 + 0.3 * near, k + 10);
    }
    // Loose crystals in the rock, small and faint.
    for (let k = 0; k < Math.round(aspect * 3); k++) {
      const u = hash(k, 21);
      if (Math.abs(u - focus) < 0.12) continue;
      add(u, -0.35 - 0.5 * hash(k, 22), 0.025 + 0.03 * hash(k, 23), 0.38, k + 40);
    }
    // The cluster: a dense druse of medium crystals, tallest at the focus, falling off to either
    // side. Medium, not huge: past about a fifth of the height the steps stop reading as pixels.
    const n = 13;
    for (let k = 0; k < n; k++) {
      const o = (k / (n - 1) - 0.5) * 2 + (hash(k, 61) - 0.5) * 0.12; // -1..1 across the cluster
      const h = 0.5 * (1 - 0.6 * Math.abs(o) ** 1.2) * (0.78 + 0.3 * hash(k, 62));
      add(
        focus + (o * 0.8 * size) / cols,
        0.03 + 0.12 * hash(k, 63),
        h,
        0.62 + 0.38 * (1 - Math.abs(o)),
        k + 70,
      );
      // On the 404 page the middle, tallest crystal is the one that is missing.
      if (hollow && k === (n - 1) / 2) {
        // Taller than the rest and uncapped: an outline does not turn into a skyline.
        const c = crystals[crystals.length - 1]!;
        c.hollow = true;
        c.step = Math.max(2, Math.round((0.82 * size) / 10));
        c.base = Math.round(rows + 0.04 * size);
      }
    }

    // Rasterise back to front: smaller (further) crystals first, so the cluster sits in front.
    crystals.sort((a, b) => a.depth - b.depth);
    crystals.forEach((c, k) => {
      const s = c.step;
      const top = c.base - 10 * s;
      const rim = Math.max(1, Math.round(s * 0.2));
      // A dark gap around the silhouette, so a crystal in front reads against the ones behind.
      const gap = Math.max(1, Math.round(s * 0.18));
      for (let r = 0; r < 10; r++) {
        const half = (MARK_ROWS[r]! * s) / 2 + gap;
        for (let y = top + r * s - gap; y < top + (r + 1) * s + gap; y++) {
          if (y < 0 || y >= rows) continue;
          for (let x = Math.ceil(c.cx - half); x < c.cx + half; x++) {
            if (x < 0 || x >= cols) continue;
            const i = y * cols + x;
            if (owner[i]! >= 0) {
              owner[i] = -1;
              rock[i] = 0;
            }
          }
        }
      }
      if (c.hollow) {
        // The empty socket: dark inside, a dashed line along the stepped outline.
        const inside = (x: number, y: number) => {
          const r = Math.floor((y - top) / s);
          return r >= 0 && r < 10 && Math.abs(x - c.cx + 0.5) < (MARK_ROWS[r]! * s) / 2;
        };
        const w = Math.max(1, Math.round(s * 0.08));
        for (let y = Math.max(0, top); y < Math.min(rows, c.base); y++) {
          for (let x = Math.max(0, c.cx - 4 * s); x < Math.min(cols, c.cx + 4 * s); x++) {
            if (!inside(x, y)) continue;
            const i = y * cols + x;
            const edge =
              !inside(x - w, y) || !inside(x + w, y) || !inside(x, y - w) || !inside(x, y + w);
            owner[i] = edge && (x + y) % 8 < 4 ? -2 : -3;
            rock[i] = 0;
          }
        }
        return;
      }
      for (let r = 0; r < 10; r++) {
        const half = (MARK_ROWS[r]! * s) / 2;
        const prevHalf = r > 0 ? (MARK_ROWS[r - 1]! * s) / 2 : 0;
        for (let y = top + r * s; y < top + (r + 1) * s; y++) {
          if (y < 0 || y >= rows) continue;
          const v = (y - top) / (10 * s);
          for (let x = Math.ceil(c.cx - half); x < c.cx + half; x++) {
            if (x < 0 || x >= cols) continue;
            const i = y * cols + x;
            const u = (x - c.cx + 0.5) / half; // -1..1 across this row
            // Faceted: the left half lit, the right half darker, a facet line down the middle.
            let tone = u < 0 ? 0.86 : 0.58;
            if (Math.abs(x - c.cx + 0.5) < Math.max(0.6, s * 0.12)) tone = 0.5;
            // A bright rim on every step's top edge that is exposed (wider than the row above).
            const exposed = Math.abs(x - c.cx + 0.5) > prevHalf || r === 0;
            if (exposed && y - (top + r * s) < rim) tone = 1;
            // Darker toward the base, and toward the outer edge of the right facet.
            tone *= 1 - 0.42 * v;
            if (u > 0.6) tone *= 0.85;
            owner[i] = k;
            shade[i] = tone * c.depth;
            height[i] = v;
          }
        }
      }
    });

    return {
      frame: (t) => {
        const sweep = ((t * 0.09) % 1.9) - 0.3; // the glint's position along the diagonal
        for (let i = 0; i < out.length; i++) {
          const k = owner[i]!;
          if (k === -2) {
            // The missing crystal's outline: faint, flaring as the glint crosses it.
            const g = (diag[i]! - sweep * (1 + aspect * 0.55)) / 0.08;
            out[i] = clamp01(0.36 + Math.exp(-g * g) * 0.7);
            continue;
          }
          if (k < 0) {
            out[i] = rock[i]!;
            continue;
          }
          const c = crystals[k]!;
          // A glint band sweeping diagonally across the facets.
          const g = (diag[i]! - sweep * (1 + aspect * 0.55)) / 0.06;
          const glint = Math.exp(-g * g) * 0.4 * c.depth;
          // A pulse climbing from base to tip, each crystal at its own speed.
          const p = (t * c.speed + c.phase) % 1.6;
          const dv = (height[i]! - (1 - p)) / 0.05;
          const pulse = p < 1 ? Math.exp(-dv * dv) * 0.3 * c.depth : 0;
          out[i] = clamp01(Math.max(rock[i]!, shade[i]! + glint + pulse));
        }
        return out;
      },
    };
  },

  // Hollow: the same druse with its tallest crystal missing, for the 404 page. A dashed outline
  // marks the empty socket, and the glint flares along it as it passes.
  hollow: (cols, rows, focus) => scenes.crystals!(cols, rows, focus, true),

  // Soft, slowly turning bands of light on black: a quiet backdrop for code and commands.
  flow: (cols, rows) => {
    const out = new Float32Array(cols * rows);
    const aspect = cols / rows;
    const warp = mistTexture(cols, rows, 2 * aspect, 2);
    return {
      frame: (t) => {
        const shift = Math.floor(t * 4) % cols;
        for (let y = 0; y < rows; y++) {
          const v = y / rows;
          const row = y * cols;
          for (let x = 0; x < cols; x++) {
            const u = x / cols;
            const w = warp[row + ((x + shift) % cols)]! * 3.2;
            const band =
              0.5 + 0.5 * Math.sin((u * 1.6 * aspect * 0.35 + v * 1.3) * Math.PI + w + t * 0.15);
            const edges = smooth(0, 0.3, u) * smooth(1, 0.7, u) * 0.4 + 0.6;
            out[row + x] = smooth(0.35, 1, band) * edges * (1 - Math.abs(u - 0.5) * 0.6);
          }
        }
        return out;
      },
    };
  },
};

type Painted = { key: string; scene: Scene; image: ImageData; px: Uint32Array; palette: number[] };
const cache = new WeakMap<HTMLCanvasElement, Painted>();

/** Packs the three tones (background, a dark mix of the accent, the accent) as RGBA words. */
function palette(rgb: number[]) {
  const [r, g, b] = rgb as [number, number, number];
  const pack = (cr: number, cg: number, cb: number) =>
    (255 << 24) | (Math.round(cb) << 16) | (Math.round(cg) << 8) | Math.round(cr);
  const mix = (c: number) => 10 + (c - 10) * 0.3;
  return [pack(10, 10, 10), pack(mix(r), mix(g), mix(b)), pack(r, g, b)];
}

/**
 * Draws frame t of a scene onto a canvas sized one pixel per cell; CSS scales it up with
 * `image-rendering: pixelated`. The scene and the pixel buffer are kept per canvas and rebuilt
 * only when its size changes. Tones are ordered-dithered between neighbouring colours.
 */
export function drawDither(
  canvas: HTMLCanvasElement,
  name: string,
  t: number,
  rgb: number[],
  cols: number,
  rows: number,
  focus: number,
) {
  const build = scenes[name];
  const ctx = canvas.getContext('2d');
  if (!build || !ctx || cols < 2 || rows < 2) return;
  const key = `${name}:${cols}x${rows}:${focus}`;
  let entry = cache.get(canvas);
  if (!entry || entry.key !== key) {
    canvas.width = cols;
    canvas.height = rows;
    const image = ctx.createImageData(cols, rows);
    entry = {
      key,
      scene: build(cols, rows, focus),
      image,
      px: new Uint32Array(image.data.buffer),
      palette: palette(rgb),
    };
    cache.set(canvas, entry);
  }
  const tones = entry.scene.frame(t);
  const { px, palette: colours } = entry;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const scaled = tones[i]! * 2;
      const low = Math.min(1, Math.floor(scaled));
      const step = scaled - low > BAYER[(y & 3) * 4 + (x & 3)]! ? 1 : 0;
      px[i] = colours[low + step]!;
    }
  }
  ctx.putImageData(entry.image, 0, 0);
}

const FRAME_MS = 1000 / 12; // a deliberately low frame rate keeps the pixels reading as pixels

/**
 * Animates a `canvas.dither` (see Dither.astro) while it is on screen, at 12 frames a second;
 * one still frame under reduced motion.
 */
export function animateDither(canvas: HTMLCanvasElement) {
  const scene = canvas.dataset.scene ?? 'crystals';
  const focus = Number(canvas.dataset.focus ?? 0.72);
  const cell = Number(canvas.dataset.cell ?? 2);
  const rgb = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-rgb')
    .trim()
    .split(/\s+/)
    .map(Number);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now() - Math.random() * 20000;
  let visible = false;
  let last = 0;

  const draw = (now: number) => {
    const cols = Math.ceil(canvas.clientWidth / cell);
    const rows = Math.ceil(canvas.clientHeight / cell);
    // The still frame is taken nine seconds in, when the glint is on the cluster.
    const t = still ? 9 : (now - start) / 1000;
    drawDither(canvas, scene, t, rgb, cols, rows, focus);
  };
  const loop = (now: number) => {
    if (!visible) return;
    if (now - last >= FRAME_MS) {
      last = now;
      draw(now);
    }
    requestAnimationFrame(loop);
  };

  new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    if (visible && !still) requestAnimationFrame(loop);
    else if (visible) draw(performance.now());
  }).observe(canvas);
  new ResizeObserver(() => draw(performance.now())).observe(canvas);
}
