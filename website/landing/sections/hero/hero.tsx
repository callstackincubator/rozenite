import { GridFour } from '@phosphor-icons/react';

import landingRozenite from '../../../landing-rozenite.png';
import { ActionButton } from '../../components/action-button/action-button';
import { CommandLine } from '../../components/command-line/command-line';
import styles from './hero.module.css';

export const Hero = () => (
  <header className={styles.hero}>
    <div className={styles.wash} aria-hidden="true" />
    <div className={styles.container}>
      <div className={styles.copy}>
        <div className={styles.logo}>
          <img className={styles.logoLight} src="/logo-light.svg" alt="Rozenite" />
          <img className={styles.logoDark} src="/logo-dark.svg" alt="" aria-hidden="true" />
        </div>
        <h1 className={styles.title}>
          <span className={styles.titleLine}>DevTools panels for React Native.</span>
          <span className={[styles.titleLine, styles.titleMuted].join(' ')}>
            Runtime tools for agents.
          </span>
        </h1>

        <p className={styles.lead}>
          Rozenite adds debugging panels to React Native DevTools. Agents can read the same runtime
          data.
        </p>

        <div className={styles.actions}>
          <ActionButton href="/docs/getting-started">Get started</ActionButton>
          <ActionButton href="/plugin-directory" variant="outline" icon={GridFour}>
            Browse plugins
          </ActionButton>
        </div>

        <CommandLine command="npx rozenite@latest init" className={styles.install} />
      </div>

      <div className={styles.visual}>
        <img
          className={styles.screenshot}
          src={landingRozenite}
          alt="React Native DevTools showing the Rozenite MMKV Storage panel."
        />
      </div>
    </div>
  </header>
);
