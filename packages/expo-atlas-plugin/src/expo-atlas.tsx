import { useState, useEffect } from 'react';
import styles from './expo-atlas.module.css';

export default function ExpoAtlasPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkServerAvailability = async () => {
      try {
        const response = await fetch('/_expo/atlas', {
          method: 'HEAD',
          mode: 'cors',
          credentials: 'omit',
        });

        if (isMounted) {
          if (response.ok) {
            setIsLoading(false);
            setHasError(false);
          } else {
            setIsLoading(false);
            setHasError(true);
          }
        }
      } catch (error) {
        if (isMounted) {
          setIsLoading(false);
          setHasError(true);
        }
      }
    };

    checkServerAvailability();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingMessage}>
            Checking Expo Atlas availability...
          </p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h3 className={styles.errorTitle}>Something went wrong</h3>
          <p className={styles.errorMessage}>
            Unable to load Expo Atlas. Please make sure you followed the setup
            guide in the Rozenite documentation.
          </p>
          <a
            href="https://rozenite.dev/docs/plugins/expo-atlas"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.setupLink}
          >
            View Setup Guide
          </a>
        </div>
      </div>
    );
  }

  return (
    <iframe
      style={{ width: '100%', height: '100%', border: 0 }}
      src="/_expo/atlas"
    />
  );
}
