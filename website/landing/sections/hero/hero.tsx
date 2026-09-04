import { useEffect, useRef, useState } from 'react';
import { GridFour } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { CommandLine } from '../../components/command-line/command-line';
import { RozeniteLoader } from '../../components/rozenite-loader/rozenite-loader';
import { useTokenColor } from '../../components/use-token-color/use-token-color';
import styles from './hero.module.css';

const TARGETS = ['React Native', 'Expo', 'Re.Pack', 'React Native Web', 'Lynx'];

/** Height in px, then grid cells across. Grain has to shrink with the mark, or
 * the silhouette stops reading as the logo and turns into haze. */
const MARK_WIDE = { size: 260, cols: 30 };
const MARK_NARROW = { size: 176, cols: 22 };

/**
 * The canvas takes its size as a number, so this cannot be a media query in
 * the stylesheet. At the full size the mark pushes "Get started" past the fold
 * on a phone, which is the one thing the hero must not do.
 *
 * Starts wide so server-rendered markup matches the desktop first paint, and
 * settles on the real value in an effect.
 */
const useMarkSize = () => {
  const [mark, setMark] = useState(MARK_WIDE);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const apply = () => setMark(query.matches ? MARK_NARROW : MARK_WIDE);

    apply();
    query.addEventListener('change', apply);

    return () => query.removeEventListener('change', apply);
  }, []);

  return mark;
};

export const Hero = () => {
  const visualRef = useRef<HTMLDivElement>(null);
  const mark = useMarkSize();
  // The dark value, because the site renders dark by default -- so the first
  // painted frame is already the right colour rather than flashing the light
  // accent on the way through.
  const accent = useTokenColor(visualRef, '--rz-accent', '#b18cff');

  return (
    <header className={styles.hero}>
      <div className={styles.wash} aria-hidden="true" />
      <div className={styles.container}>
        {/*
         * The mark stands in for the wordmark that used to sit here: the site
         * navigation already carries one, and two Rozenite logos above the fold
         * was one too many.
         *
         * It is decorative, so it passes `label=""`. The component is a loading
         * spinner by origin and defaults to `role="status"` with a "Loading"
         * label, which would be a lie on a page that has finished loading.
         * `fg` comes from `useTokenColor` rather than a hardcoded violet, and
         * the component draws a single static frame under
         * `prefers-reduced-motion`.
         */}
        <div className={styles.visual} ref={visualRef}>
          <RozeniteLoader size={mark.size} cols={mark.cols} period={2600} fg={accent} label="" />
        </div>

        <h1 className={styles.title}>
          <span className={styles.titleLine}>DevTools panels for React Native and Lynx.</span>
          <span className={[styles.titleLine, styles.titleMuted].join(' ')}>
            Runtime tools for agents.
          </span>
        </h1>

        <p className={styles.lead}>
          Rozenite adds debugging panels to React Native DevTools — for React Native, web and Lynx
          apps. Agents read the same runtime data.
        </p>

        {/* The headline names two targets; the rest of the breadth lives here
            rather than in a third line of display type. */}
        <ul className={styles.targets}>
          {TARGETS.map((target) => (
            <li className={styles.target} key={target}>
              {target}
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <ActionButton href="/docs/getting-started">Get started</ActionButton>
          <ActionButton href="/plugin-directory" variant="outline" icon={GridFour}>
            Browse plugins
          </ActionButton>
        </div>

        <CommandLine command="npx rozenite@latest init" className={styles.install} />
      </div>
    </header>
  );
};
