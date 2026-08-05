import { ArrowRight, GridFour } from '@phosphor-icons/react';

import { PluginCard } from '../../components/plugin-card/plugin-card';
import { Reveal } from '../../components/reveal/reveal';
import { Section, SectionHeader } from '../../components/section/section';
import { FEATURED_PLUGINS, REMAINING_PLUGIN_COUNT } from '../../data/plugins';
import styles from './plugins.module.css';

export const Plugins = () => (
  <Section id="plugins" tint="subtle" bordered>
    <SectionHeader
      eyebrow="Official plugins"
      title="Panels for common React Native work"
      body="Install the plugin you need and follow its setup guide. Each one adds a panel to React Native DevTools."
    />

    <Reveal>
      <div className={styles.grid}>
        {FEATURED_PLUGINS.map((plugin) => (
          <PluginCard plugin={plugin} key={plugin.packageName} />
        ))}
      </div>

      <a href="/plugin-directory" className={styles.more}>
        <span className={styles.moreIcon}>
          <GridFour size={20} />
        </span>
        <span className={styles.moreText}>
          +{REMAINING_PLUGIN_COUNT} more official plugins for other libraries
          and development tasks.
        </span>
        <span className={styles.moreCta}>
          Browse plugins
          <ArrowRight size={17} weight="bold" />
        </span>
      </a>
    </Reveal>
  </Section>
);
