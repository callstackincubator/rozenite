import type { OfficialPlugin } from '../../data/plugins';
import styles from './plugin-card.module.css';

type PluginCardProps = {
  plugin: OfficialPlugin;
};

export const PluginCard = ({ plugin }: PluginCardProps) => {
  const Glyph = plugin.icon;

  return (
    <a className={styles.card} href={plugin.href}>
      <div className={styles.top}>
        <Glyph className={styles.icon} size={22} />
        {plugin.agentEnabled ? (
          <span className={styles.agentTag}>Agent tools</span>
        ) : null}
      </div>
      <h3 className={styles.name}>{plugin.name}</h3>
      <p className={styles.exposes}>{plugin.exposes}</p>
      <span className={styles.package}>{plugin.packageName}</span>
    </a>
  );
};
