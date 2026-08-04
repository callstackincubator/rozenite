import { GridFour } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { PluginCard } from '../../components/plugin-card/plugin-card';
import { Reveal } from '../../components/reveal/reveal';
import { Section, SectionHeader } from '../../components/section/section';
import { FEATURED_PLUGINS, REMAINING_PLUGIN_COUNT } from '../../data/plugins';
import styles from './plugins.module.css';

export const Plugins = () => (
  <Section id="plugins" tint="subtle" bordered>
    <SectionHeader
      eyebrow="Official plugins"
      title="The panels you would otherwise build"
      body="Each one is a dev dependency we maintain in the Rozenite repository. Install it, restart the bundler, and the tab is there."
    />

    <Reveal>
      <div className={styles.grid}>
        {FEATURED_PLUGINS.map((plugin) => (
          <PluginCard plugin={plugin} key={plugin.packageName} />
        ))}
      </div>

      <div className={styles.more}>
        <p className={styles.moreText}>
          Another {REMAINING_PLUGIN_COUNT} official plugins cover SQLite, the
          file system, bundle size, startup profiling and forms.
        </p>
        <ActionButton href="/plugin-directory" variant="outline" icon={GridFour}>
          Browse plugins
        </ActionButton>
      </div>
    </Reveal>
  </Section>
);
