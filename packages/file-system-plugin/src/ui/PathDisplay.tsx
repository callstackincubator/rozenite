import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, TextField, useCopyToClipboard } from '@rozenite/ui';
import { AlertCircle, Check, Copy } from 'lucide-react';

type PathDisplayProps = {
  label?: string;
  path: string;
};

export function PathDisplay({ label, path }: PathDisplayProps) {
  const { copy, isCopied } = useCopyToClipboard(2000);
  const [hasError, setHasError] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    try {
      await copy(path);
      setHasError(false);
    } catch {
      setHasError(true);

      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = setTimeout(() => {
        setHasError(false);
        resetTimerRef.current = null;
      }, 2000);
    }
  }, [copy, path]);

  const copyState = hasError ? 'error' : isCopied ? 'copied' : 'idle';

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
