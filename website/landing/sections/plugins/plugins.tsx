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
      title="The panels you would otherwise build"
      body="We build and maintain these ourselves: install one, restart the bundler, and the tab is there. The community maintains a further set of plugins on top of it."
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
          +{REMAINING_PLUGIN_COUNT} more official plugins, covering SQLite, the
          file system, bundle size, startup profiling and forms.
        </span>
        <span className={styles.moreCta}>
          Browse plugins
          <ArrowRight size={17} weight="bold" />
        </span>
      </a>
    </Reveal>
  </Section>
);
