import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import { Button, Card, DescriptionList, ScrollArea, useCopyToClipboard } from '@rozenite/ui';
import type { FsEntry } from '../shared/protocol';
import { isLikelyImageFile } from '../shared/path';
import { formatBytes, formatDate } from '../utils';
import { formatTextPreview } from '../formatters';
import type { useFileSystemRequests } from '../use-file-system-requests';

type FileSystemRequests = ReturnType<typeof useFileSystemRequests>;

type DetailPaneProps = {
  selected: FsEntry;
  canExport: boolean;
  exporting: boolean;
  requestImagePreview: FileSystemRequests['requestImagePreview'];
  requestTextPreview: FileSystemRequests['requestTextPreview'];
  onExport: (entry: FsEntry) => void;
  onClose: () => void;
};

/**
 * File/directory detail pane (Feature 2, Version B "sticky path bar" +
 * Feature 3, Version A "single scroll region"): a sticky path/export strip
 * above a scrollable metadata card and content preview.
 *
 * Only rendered while something is selected — the caller unmounts the whole
 * pane otherwise rather than showing an empty placeholder.
 */
export function DetailPane({
  selected,
  canExport,
  exporting,
  requestImagePreview,
  requestTextPreview,
  onExport,
  onClose,
}: DetailPaneProps) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <span
          className="min-w-0 flex-1 truncate px-1 font-mono text-xs text-muted-foreground"
          title={selected.path}
        >
          {selected.path}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void copy(selected.path)}
          aria-label={copied ? 'Path copied' : 'Copy path'}
          title={copied ? 'Copied!' : 'Copy path'}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="outline"
          size="compact"
          onClick={() => onExport(selected)}
          disabled={!canExport || exporting}
          aria-label={exporting ? 'Exporting file' : 'Export file'}
          title={exporting ? 'Exporting file' : 'Export file'}
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? 'Exporting…' : 'Export'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close details"
          title="Close details"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          <Card collapsible defaultOpen>
            <Card.Header>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {selected.name}
              </span>
            </Card.Header>
            <Card.Body>
              <DescriptionList>
                <DescriptionList.Item label="Type">
                  {selected.isDirectory ? 'Directory' : 'File'}
                </DescriptionList.Item>
                <DescriptionList.Item label="Size">
                  {selected.isDirectory ? '—' : formatBytes(selected.size)}
                </DescriptionList.Item>
                <DescriptionList.Item label="Modified">
                  {formatDate(selected.modifiedAtMs)}
                </DescriptionList.Item>
              </DescriptionList>
            </Card.Body>
          </Card>

          {!selected.isDirectory && (
            <FilePreview
              entry={selected}
              requestImagePreview={requestImagePreview}
              requestTextPreview={requestTextPreview}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

type FilePreviewProps = {
  entry: FsEntry;
  requestImagePreview: FileSystemRequests['requestImagePreview'];
  requestTextPreview: FileSystemRequests['requestTextPreview'];
};

function FilePreview({ entry, requestImagePreview, requestTextPreview }: FilePreviewProps) {
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState<string | null>(null);
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false);

  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null);
  const [textPreviewLoading, setTextPreviewLoading] = useState(false);

  const loadPreview = useCallback(
    async (target: FsEntry) => {
      setImagePreviewUri(null);
      setImagePreviewError(null);
      setImagePreviewLoading(false);
      setTextPreview(null);
      setTextPreviewError(null);
      setTextPreviewLoading(false);

      if (isLikelyImageFile(target.path)) {
        setImagePreviewLoading(true);
        try {
          const res = await requestImagePreview(target.path);
          if (!res) return;
          if (res.error || !res.dataUri) {
            setImagePreviewError(res.error ?? 'No preview available');
            return;
          }
          setImagePreviewUri(res.dataUri);
        } catch (e) {
          setImagePreviewError(e instanceof Error ? e.message : String(e));
        } finally {
          setImagePreviewLoading(false);
        }
        return;
      }

      setTextPreviewLoading(true);
      try {
        const res = await requestTextPreview(target.path);
        if (!res) return;
        if (res.error || !res.content) {
          setTextPreviewError(res.error ?? 'No preview available');
          return;
        }
        setTextPreview(res.content);
      } catch (e) {
        setTextPreviewError(e instanceof Error ? e.message : String(e));
      } finally {
        setTextPreviewLoading(false);
      }
    },
    [requestImagePreview, requestTextPreview],
  );

  useEffect(() => {
    void loadPreview(entry);
  }, [entry, loadPreview]);

  if (isLikelyImageFile(entry.path)) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-foreground">Image preview</span>
        {imagePreviewLoading ? (
          <span className="text-xs text-muted-foreground">Loading preview…</span>
        ) : imagePreviewError ? (
          <p role="alert" className="text-xs text-destructive">
            {imagePreviewError}
          </p>
        ) : imagePreviewUri ? (
          <img
            src={imagePreviewUri}
            alt={entry.name}
            className="max-h-72 w-full rounded-md border border-border bg-muted object-contain"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">File preview</span>
      {textPreviewLoading ? (
        <span className="text-xs text-muted-foreground">Loading preview…</span>
      ) : textPreviewError ? (
        <p role="alert" className="text-xs text-destructive">
          {textPreviewError}
        </p>
      ) : textPreview ? (
        <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs whitespace-pre-wrap wrap-anywhere text-foreground">
          {formatTextPreview(textPreview)}
        </pre>
      ) : null}
    </div>
  );
}
