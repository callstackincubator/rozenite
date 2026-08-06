import { Check, Copy } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './command-line.module.css';

type CommandLineProps = {
  command: string;
  className?: string;
};

export const CommandLine = ({ command, className }: CommandLineProps) => {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard is unavailable (insecure context, denied permission). The
      // command stays selectable, so there is nothing useful to recover from.
      return;
    }

    setCopied(true);

    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <span className={styles.prompt} aria-hidden="true">
        $
      </span>
      <code className={styles.command}>{command}</code>
      <button
        type="button"
        onClick={copy}
        className={[styles.copy, copied ? styles.copied : ''].filter(Boolean).join(' ')}
        aria-label={copied ? 'Command copied' : `Copy "${command}"`}
      >
        {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
      </button>
    </div>
  );
};
