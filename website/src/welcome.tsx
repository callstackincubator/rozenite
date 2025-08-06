import { useEffect, useState } from 'react';
import { Button } from '@callstack/rspress-theme';
import styles from './welcome.module.css';

export const frontmatter = {
  pageType: 'blank',
};

export default function Welcome() {
  const [withPluginsInstalled, setWithPluginsInstalled] = useState(false);

  useEffect(() => {
    const withPluginsInstalled =
      new URLSearchParams(window.location.search).get(
        'withPluginsInstalled'
      ) === 'true';
    setWithPluginsInstalled(withPluginsInstalled);
  }, []);

  useEffect(() => {
    // Make sure links open in a new tab
    document.querySelectorAll('a').forEach((linkElement) => {
      linkElement.target = '_blank';
    });
  });

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Rozenite loaded successfully!</h1>
          <p className={styles.subtitle}>
            {withPluginsInstalled ? (
              <>
                You should see installed plugins as tabs at the end of the tab
                list.
              </>
            ) : (
              <>
                You are now ready to install your first plugin.
                <br />
                Go to plugin directory to find a plugin to install.
              </>
            )}
          </p>

          <div className={styles.actions}>
            <Button href="/docs/getting-started">Documentation</Button>
            <Button href="/plugin-directory">Plugin directory</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
