import { useEffect, useState } from 'react';
import styles from './welcome.module.css';

export default function Welcome() {
  const [withPluginsInstalled, setWithPluginsInstalled] = useState(false);

  // The page is server-rendered at build time, where neither `window` nor
  // `document` exists.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const withPluginsInstalled =
      new URLSearchParams(window.location.search).get('withPluginsInstalled') === 'true';
    setWithPluginsInstalled(withPluginsInstalled);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

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
              <>You should see installed plugins as tabs at the end of the tab list.</>
            ) : (
              <>
                You are now ready to install your first plugin.
                <br />
                Go to plugin directory to find a plugin to install.
              </>
            )}
          </p>

          <div className={styles.actions}>
            <a className={styles.button} href="/docs/getting-started">
              Documentation
            </a>
            <a className={styles.button} href="/plugin-directory">
              Plugin directory
            </a>
            <a className={styles.button} href="https://forms.gle/vUCVUmnZ883sfzoS8">
              Want to shape the future of Rozenite? Share your feedback!
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
