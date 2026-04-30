import { useCallback, useEffect, useState } from 'react';
import { Card, Chip, Separator, Surface } from '@rozenite/ui';
import { FileImage, FileText, Loader2 } from 'lucide-react';
import { formatTextPreview } from '../formatters';
import { isLikelyImageFile } from '../shared/path';
import type { FsEntry } from '../shared/protocol';
import type { useFileSystemRequests } from '../use-file-system-requests';
import { formatBytes, formatDate } from '../utils';
import { PathDisplay } from './PathDisplay';

type FileSystemRequests = ReturnType<typeof useFileSystemRequests>;

type DetailPanelProps = {
  requestImagePreview: FileSystemRequests['requestImagePreview'];
  requestTextPreview: FileSystemRequests['requestTextPreview'];
  selected: FsEntry | null;
};

function getEntryKind(entry: FsEntry): string {
  return entry.isDirectory ? 'Directory' : 'File';
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Surface
      className="flex flex-col gap-1 rounded-lg border border-border/70 bg-surface-secondary px-3 py-2"
      variant="secondary"
    >
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </Surface>
  );
}

export function DetailPanel({
  requestImagePreview,
  requestTextPreview,
  selected,
}: DetailPanelProps) {
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState<string | null>(
    null,
  );
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false);

  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null);
  const [textPreviewLoading, setTextPreviewLoading] = useState(false);

  const loadPreview = useCallback(
    async (entry: FsEntry) => {
      setImagePreviewUri(null);
      setImagePreviewError(null);
      setImagePreviewLoading(false);
      setTextPreview(null);
      setTextPreviewError(null);
      setTextPreviewLoading(false);

      if (entry.isDirectory) {
        return;
      }

      if (isLikelyImageFile(entry.path)) {
        setImagePreviewLoading(true);

        try {
          const res = await requestImagePreview(entry.path);
          if (!res) {
            return;
          }

          if (res.error || !res.dataUri) {
            setImagePreviewError(res.error ?? 'No preview available');
            return;
          }

          setImagePreviewUri(res.dataUri);
        } catch (error) {
          setImagePreviewError(
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          setImagePreviewLoading(false);
        }

        return;
      }

      setTextPreviewLoading(true);

      try {
        const res = await requestTextPreview(entry.path);
        if (!res) {
          return;
        }

        if (res.error || !res.content) {
          setTextPreviewError(res.error ?? 'No preview available');
          return;
        }

        setTextPreview(res.content);
      } catch (error) {
        setTextPreviewError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setTextPreviewLoading(false);
      }
    },
    [requestImagePreview, requestTextPreview],
  );

  useEffect(() => {
    if (!selected || selected.isDirectory) {
      setImagePreviewUri(null);
      setImagePreviewError(null);
      setImagePreviewLoading(false);
      setTextPreview(null);
      setTextPreviewError(null);
      setTextPreviewLoading(false);
      return;
    }

    loadPreview(selected);
  }, [loadPreview, selected]);

  const isImageEntry = selected ? isLikelyImageFile(selected.path) : false;

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Card.Header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Card.Title>{selected?.name ?? 'Details'}</Card.Title>
            <Card.Description className="mt-1 text-xs">
              {selected
                ? 'Inspect metadata and preview file contents.'
                : 'Select a file from the browser to inspect metadata and preview its contents.'}
            </Card.Description>
          </div>
          {selected ? (
            <Chip
              className="shrink-0"
              color={selected.isDirectory ? 'accent' : 'default'}
              size="sm"
              variant="soft"
            >
              {getEntryKind(selected)}
            </Chip>
          ) : null}
        </div>
      </Card.Header>

      <Card.Content className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        {!selected ? (
          <Surface
            className="flex min-h-40 items-center justify-center rounded-xl border border-border/70 bg-surface px-4 py-6 text-center text-sm text-muted"
            variant="secondary"
          >
            Select a file to inspect metadata and preview its contents.
          </Surface>
        ) : (
          <>
            <PathDisplay label="Path" path={selected.path} />

            <div className="grid gap-3 sm:grid-cols-3">
              <DetailStat label="Type" value={getEntryKind(selected)} />
              <DetailStat
                label="Size"
                value={selected.isDirectory ? '-' : formatBytes(selected.size)}
              />
              <DetailStat
                label="Modified"
                value={formatDate(selected.modifiedAtMs)}
              />
            </div>

            <Separator />

            {isImageEntry ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileImage className="size-4 text-accent" />
                  Image preview
                </div>

                {imagePreviewLoading ? (
                  <Surface
                    className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface px-4 py-8 text-sm text-muted"
                    variant="secondary"
                  >
                    <Loader2 className="size-5 animate-spin text-accent" />
                    Loading preview...
                  </Surface>
                ) : imagePreviewError ? (
                  <Surface
                    className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-4 text-sm text-danger"
                    variant="secondary"
                  >
                    {imagePreviewError}
                  </Surface>
                ) : imagePreviewUri ? (
                  <Surface
                    className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-surface p-0"
                    variant="secondary"
                  >
                    <img
                      alt={`Preview of ${selected.name}`}
                      className="h-auto max-h-80 w-full object-contain"
                      src={imagePreviewUri}
                    />
                  </Surface>
                ) : (
                  <Surface
                    className="rounded-xl border border-border/70 bg-surface px-4 py-4 text-sm text-muted"
                    variant="secondary"
                  >
                    Select the file again to re-fetch the preview.
                  </Surface>
                )}
              </div>
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="size-4 text-accent" />
                  File preview
                </div>

                {textPreviewLoading ? (
                  <Surface
                    className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface px-4 py-8 text-sm text-muted"
                    variant="secondary"
                  >
                    <Loader2 className="size-5 animate-spin text-accent" />
                    Loading preview...
                  </Surface>
                ) : textPreviewError ? (
                  <Surface
                    className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-4 text-sm text-danger"
                    variant="secondary"
                  >
                    {textPreviewError}
                  </Surface>
                ) : textPreview ? (
                  <Surface
                    className="min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-border/70 bg-surface px-4 py-4"
                    variant="secondary"
                  >
                    <pre className="wrap-anywhere w-full max-w-full whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                      {formatTextPreview(textPreview)}
                    </pre>
                  </Surface>
                ) : (
                  <Surface
                    className="rounded-xl border border-border/70 bg-surface px-4 py-4 text-sm text-muted"
                    variant="secondary"
                  >
                    Select the file again to re-fetch the preview.
                  </Surface>
                )}
              </div>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
}
