import { ChatCircleDots, GithubLogo } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { Reveal } from '../../components/reveal/reveal';
import { Section } from '../../components/section/section';
import styles from './closing.module.css';

export const Closing = () => (
  <Section bordered>
    <Reveal>
      <div className={styles.panel}>
        <div>
          <h2 className={styles.title}>Come see what your app is doing</h2>
          <p className={styles.body}>
            One command and every panel here is running in your app. Missing
            one? Open an issue or send a plugin yourself — that is how most of
            the official set got here, and we would love to see yours join it.
          </p>
        </div>

        <div className={styles.actions}>
          <ActionButton href="/docs/getting-started" fullWidth>
            Get started
          </ActionButton>
          <ActionButton
            href="https://github.com/callstackincubator/rozenite"
            variant="outline"
            icon={GithubLogo}
            external
            fullWidth
          >
            View on GitHub
          </ActionButton>
          <ActionButton
            href="https://discord.gg/xgGt7KAjxv"
            variant="outline"
            icon={ChatCircleDots}
            external
            fullWidth
          >
            Join the Discord
          </ActionButton>
        </div>
      </div>
    </Reveal>
  </Section>
);
