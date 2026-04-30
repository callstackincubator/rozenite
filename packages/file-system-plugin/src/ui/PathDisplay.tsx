import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, TextField } from '@rozenite/ui';
import { AlertCircle, Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../utils';

type CopyState = 'idle' | 'copied' | 'error';

type PathDisplayProps = {
  label?: string;
  path: string;
};

export function PathDisplay({ label, path }: PathDisplayProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(() => {
    const success = copyToClipboard(path);

    setCopyState(success ? 'copied' : 'error');

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, 2000);
  }, [path]);

  const copyLabel =
    copyState === 'copied'
      ? 'Copied!'
      : copyState === 'error'
        ? 'Failed'
        : 'Copy';

  const CopyIcon =
    copyState === 'copied' ? Check : copyState === 'error' ? AlertCircle : Copy;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {label ? (
        <p className="text-xs font-medium text-muted">{label}</p>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <TextField aria-label={label ?? 'Path'} className="min-w-0 flex-1">
          <Input fullWidth readOnly value={path} variant="secondary" />
        </TextField>
        <Button
          className="shrink-0"
          onPress={handleCopy}
          size="sm"
          variant="secondary"
        >
          <CopyIcon
            className={`size-4 ${
              copyState === 'copied'
                ? 'text-success'
                : copyState === 'error'
                  ? 'text-danger'
                  : 'text-muted'
            }`}
          />
          {copyLabel}
        </Button>
      </div>
    </div>
  );
}
