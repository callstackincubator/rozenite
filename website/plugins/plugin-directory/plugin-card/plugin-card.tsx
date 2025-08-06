import { Button } from '@callstack/rspress-theme';

import styles from './plugin-card.module.css';
import { RozenitePluginEntry } from '../types';

export type PluginCardProps = {
  plugin: RozenitePluginEntry;
};

export function PluginCard({ plugin }: PluginCardProps) {
  const {
    packageName,
    version,
    githubUrl,
    npmUrl,
    description,
    stars,
    isOfficial,
  } = plugin;

  return (
    <div className={styles.pluginCardContainer}>
      <div className={styles.pluginCard}>
        <div className={styles.pluginHeader}>
          <div className={styles.pluginTitleContainer}>
            <h3 className={styles.pluginTitle}>{packageName}</h3>
            <div
              className={styles.pluginVersion}
              aria-label={`Version ${version}`}
            >
              v{version}
            </div>
          </div>
          {isOfficial && (
            <div className={styles.officialBadge} aria-label="Official plugin">
              Official
            </div>
          )}
        </div>
        {description && (
          <p className={styles.pluginDescription}>{description}</p>
        )}
        <div className={styles.pluginFooter}>
          <div className={styles.pluginStats}>
            <div
              className={styles.starsContainer}
              aria-label={`${stars.toLocaleString()} stars`}
            >
              <svg
                className={styles.starIcon}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className={styles.starsCount}>
                {stars.toLocaleString()}
              </span>
            </div>
          </div>
          <div className={styles.pluginLinks}>
            <Button
              theme="alt"
              href={githubUrl}
              external
              aria-label={`View ${packageName} on GitHub`}
            >
              GitHub
            </Button>
            <Button
              theme="alt"
              href={npmUrl}
              external
              aria-label={`View ${packageName} on NPM`}
            >
              NPM
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
