import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

export interface RozeniteLoaderProps {
  /** Height in CSS px; width follows the logo's aspect ratio. Default 48. */
  size?: number;
  /** Grid cells across the logo width. Default 16 (good for ≤64 px). */
  cols?: number;
  /** Frames per loop. Default 48 (≈13 fps of visible flips). */
  frames?: number;
  /** Loop duration in ms. Default 3600. */
  period?: number;
  /** Organic grain amount, 0–1.4. Default 0.8. */
  noise?: number;
  /** Pixel color. Default Rozenite violet. */
  fg?: string;
  /** Background fill, or "transparent". Default "transparent". */
  bg?: string;
  /** Pre-render the loop into a sprite strip. "auto" = on for size ≤ 120. */
  cache?: boolean | 'auto';
  /** Freeze the animation (e.g. when not actually loading). */
  paused?: boolean;
  /** Accessible label. Set to "" to hide from AT entirely. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const PATH_D =
  'M17.333 5.333H20V10.667H22.667V16H25.333V24H22.667V26.667H20V29.333H12' +
  'V26.667H9.333V24H6.667V16H9.333V10.667H12V5.333H14.667V2.667H17.333V5.333Z';
const VB = { x: 6.67, y: 2.67, w: 18.67, h: 26.67 };
const ASPECT = VB.w / VB.h;
const B4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const hash = (i: number, j: number) => {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const vnoise = (x: number, y: number) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  let fx = x - i;
  let fy = y - j;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const fbm = (x: number, y: number) =>
  0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3);

interface Cell {
  i: number;
  j: number;
  u: number;
  v: number;
  th: number;
}

/**
 * Dithered gem loading spinner: a Bayer 4×4 ordered dither over an
 * animated light field, masked to the Rozenite logo silhouette.
 *
 * Time is quantized to the dither frame grid, so it renders far below
 * 60fps and skips redraws for repeated frames. With `cache` on (the
 * default for `size <= 120`), the whole loop is pre-rendered into an
 * offscreen sprite strip once, so steady-state playback is a single
 * `drawImage` per frame. Playback pauses when the tab is hidden or the
 * canvas leaves the viewport, and falls back to a static frame under
 * `prefers-reduced-motion`.
 */
export function RozeniteLoader({
  size = 48,
  cols = 16,
  frames = 48,
  period = 3600,
  noise = 0.8,
  fg = '#8232ff',
  bg = 'transparent',
  cache = 'auto',
  paused = false,
  label = 'Loading',
  className,
  style,
}: RozeniteLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlRef = useRef<{ setPaused(p: boolean): void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const useCache = cache === 'auto' ? size <= 120 : cache;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = size * ASPECT + 'px';
    canvas.style.height = size + 'px';
    const W = (canvas.width = Math.round(size * ASPECT * dpr));
    const H = (canvas.height = Math.round(size * dpr));

    const path = new Path2D(PATH_D);
    const rows = Math.round(cols / ASPECT);
    const cells: Cell[] = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const px = VB.x + ((i + 0.5) / cols) * VB.w;
        const py = VB.y + ((j + 0.5) / rows) * VB.h;
        if (ctx.isPointInPath(path, px, py)) {
          cells.push({
            i,
            j,
            u: (i + 0.5) / cols - 0.5,
            v: (j + 0.5) / rows - 0.5,
            th: (B4[j % 4][i % 4] + 0.5) / 16,
          });
        }
      }
    }

    const renderFrame = (target: CanvasRenderingContext2D, ox: number, phase: number) => {
      const s = W / cols;
      const gap = Math.max(0.6, s * 0.09);
      const rad = s * 0.14;
      const A = phase * Math.PI * 2;
      const ca = Math.cos(A);
      const sa = Math.sin(A);
      const hx = 0.24 * Math.cos(A + 1);
      const hy = 0.24 * Math.sin(A + 1) * 0.85;
      if (bg !== 'transparent') {
        target.fillStyle = bg;
        target.fillRect(ox, 0, W, H);
      }
      target.fillStyle = fg;
      for (const c of cells) {
        const sweep = (c.u * ca + c.v * sa) * 1.9;
        const dx = c.u - hx;
        const dy = c.v - hy;
        const blob = Math.exp(-(dx * dx + dy * dy) / 0.02);
        const n = (fbm(c.u * 3 + ca * 0.8 + 9, c.v * 4.2 + sa * 0.8) - 0.5) * noise;
        const b = 0.5 + 0.45 * sweep + blob + n;
        if (b > c.th) {
          const w = s - gap * 2;
          target.beginPath();
          target.roundRect(ox + c.i * s + gap, c.j * s + gap, w, w, rad);
          target.fill();
        }
      }
    };

    let sheet: HTMLCanvasElement | null = null;
    if (useCache) {
      sheet = document.createElement('canvas');
      sheet.width = W * frames;
      sheet.height = H;
      const sctx = sheet.getContext('2d');
      if (sctx) {
        for (let f = 0; f < frames; f++) renderFrame(sctx, f * W, f / frames);
      } else {
        sheet = null;
      }
    }

    const blit = (f: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (sheet) ctx.drawImage(sheet, f * W, 0, W, H, 0, 0, W, H);
      else renderFrame(ctx, 0, f / frames);
    };

    let raf = 0;
    let lastFrame = -1;
    let isPaused = paused;
    let visible = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = (now: number) => {
      raf = 0;
      const f = Math.floor(((now % period) / period) * frames) % frames;
      if (f !== lastFrame) {
        lastFrame = f;
        blit(f);
      }
      schedule();
    };
    const schedule = () => {
      if (!isPaused && visible && !document.hidden && !reduced && !raf) {
        raf = requestAnimationFrame(tick);
      }
    };
    const halt = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            if (visible) schedule();
            else halt();
          })
        : null;
    io?.observe(canvas);

    const onVisibility = () => (document.hidden ? halt() : schedule());
    document.addEventListener('visibilitychange', onVisibility);

    controlRef.current = {
      setPaused(p: boolean) {
        isPaused = p;
        if (p) halt();
        else schedule();
      },
    };

    blit(5); // draw immediately so there's no blank flash
    schedule();

    return () => {
      halt();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      controlRef.current = null;
    };
  }, [size, cols, frames, period, noise, fg, bg, cache]);

  useEffect(() => {
    controlRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: 'pixelated', ...style }}
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
