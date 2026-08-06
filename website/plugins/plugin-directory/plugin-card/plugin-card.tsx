import { GithubLogo, Package, Star } from '@phosphor-icons/react';

import styles from './plugin-card.module.css';
import { RozenitePluginEntry } from '../types';

export type PluginCardProps = {
  plugin: RozenitePluginEntry;
};

export function PluginCard({ plugin }: PluginCardProps) {
  const { packageName, version, githubUrl, npmUrl, description, stars, isOfficial } = plugin;

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <span className={styles.version} aria-label={`Version ${version}`}>
          v{version}
        </span>
        {isOfficial && <span className={styles.official}>Official</span>}
      </div>
      <h3 className={styles.title}>{packageName}</h3>
      <p className={styles.description}>
        {description || 'A Rozenite plugin for React Native DevTools.'}
      </p>
      <div className={styles.meta}>
        <span className={styles.stars} aria-label={`${stars.toLocaleString()} stars`}>
          <Star aria-hidden="true" size={15} weight="fill" />
          {stars.toLocaleString()}
        </span>
        <div className={styles.links}>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`View ${packageName} on GitHub`}
          >
            <GithubLogo aria-hidden="true" size={17} weight="bold" />
            GitHub
          </a>
          <a
            href={npmUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`View ${packageName} on npm`}
          >
            <Package aria-hidden="true" size={17} weight="bold" />
            npm
          </a>
        </div>
      </div>
    </article>
  );
}
