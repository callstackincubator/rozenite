import { useRef } from 'react';
import { GridFour } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { CommandLine } from '../../components/command-line/command-line';
import { RozeniteLoader } from '../../components/rozenite-loader/rozenite-loader';
import { useTokenColor } from '../../components/use-token-color/use-token-color';
import styles from './hero.module.css';

const TARGETS = ['React Native', 'Expo', 'Re.Pack', 'React Native Web', 'Lynx'];

export const Hero = () => {
  const visualRef = useRef<HTMLDivElement>(null);
  // The dark value, because the site renders dark by default -- so the first
  // painted frame is already the right colour rather than flashing the light
  // accent on the way through.
  const accent = useTokenColor(visualRef, '--rz-accent', '#b18cff');

  return (
    <header className={styles.hero}>
      <div className={styles.wash} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.copy}>
          <div className={styles.logo}>
            <img className={styles.logoLight} src="/logo-light.svg" alt="Rozenite" />
            <img className={styles.logoDark} src="/logo-dark.svg" alt="" aria-hidden="true" />
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

        {/*
         * The mark is decorative here, not a status: `label=""` keeps the
         * component's `role="status"` / "Loading" announcement off a page that
         * is not loading anything. `fg` comes from `useTokenColor` rather than a
         * hardcoded violet, so the mark follows the theme, and the component
         * falls back to a single static frame under `prefers-reduced-motion`.
         */}
        <div className={styles.visual} ref={visualRef}>
          <RozeniteLoader size={380} cols={56} period={2600} fg={accent} label="" />
        </div>
      </div>
    </header>
  );
};
