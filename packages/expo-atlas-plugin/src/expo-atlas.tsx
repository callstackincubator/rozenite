import { useState, useEffect } from 'react';
import { PluginHeader, PluginTheme } from '@rozenite/ui';
import './globals.css';

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
      } catch {
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

  return (
    <PluginTheme
      defaultTheme="dark"
      className="flex h-screen flex-col bg-background text-foreground"
    >
      {(isLoading || hasError) && (
        <PluginHeader
          title="Expo Atlas"
          subtitle="Bundle analysis powered by Expo Atlas."
          showThemeSwitcher={false}
        />
      )}

      <main className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin mb-3" />
            <p className="text-muted text-sm">Checking Expo Atlas availability...</p>
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="max-w-md">
              <h3 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h3>
              <p className="text-muted text-sm mb-4">
                Unable to load Expo Atlas. Please make sure you followed the setup
                guide in the Rozenite documentation.
              </p>
              <a
                href="https://rozenite.dev/docs/plugins/expo-atlas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                View Setup Guide
              </a>
            </div>
          </div>
        ) : (
          <iframe
            className="w-full h-full border-0"
            src="/_expo/atlas"
          />
        )}
      </main>
    </PluginTheme>
  );
}
