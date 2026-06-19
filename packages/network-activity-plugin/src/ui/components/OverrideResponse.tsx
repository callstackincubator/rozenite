import { useRef, useState } from 'react';
import { HttpNetworkEntry } from '../state/model';
import { Section } from '../components/Section';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { useNetworkActivityActions } from '../state/hooks';
import { CodeEditor } from '../components/CodeEditor';
import { RequestOverride } from '../../shared/client';
import { Button } from './Button';
import { Check, CircleSlash2 } from 'lucide-react';

export type OverrideResponseProps = {
  selectedRequest: HttpNetworkEntry;
  initialOverride: RequestOverride | undefined;
  onClear: () => void;
};

export const OverrideResponse = ({
  selectedRequest,
  initialOverride,
  onClear,
}: OverrideResponseProps) => {
  const actions = useNetworkActivityActions();
  const [savedOverride, setSavedOverride] = useState<
    RequestOverride | undefined
  >(initialOverride);
  const [editedBody, setEditedBody] = useState<string | undefined>(
    initialOverride?.body
  );
  const [editedStatus, setEditedStatus] = useState<number | undefined>(
    initialOverride?.status
  );
  const responseEditorRef = useRef<HTMLPreElement>(null);
  const responseBody = selectedRequest.response?.body;

  const saveOverride = () => {
    if (editedBody === undefined && editedStatus === undefined) return;

    const newOverrideData = {
      body: editedBody,
      status: editedStatus,
    };

    setSavedOverride(newOverrideData);
    actions.addOverride(selectedRequest.request.url, newOverrideData);
  };

  const clearOverride = () => {
    setSavedOverride(undefined);
    setEditedBody(undefined);
    actions.clearOverride(selectedRequest.request.url);
    onClear();
  };

  if (!responseBody || responseBody.data === null) {
    return (
      <div className="text-sm text-muted">
        No response body available for this request
      </div>
    );
  }

  const { type } = responseBody;

  const hasChanges =
    editedBody !== savedOverride?.body ||
    editedStatus !== savedOverride?.status;

  const overrideActions = (
    <>
      <Button
        variant="ghost"
        size="xs"
        className="text-accent hover:text-accent ms-2"
        onClick={clearOverride}
      >
        <CircleSlash2 className="h-2 w-2" />
        Clear override
      </Button>

      <Button
        variant="ghost"
        size="xs"
        className="text-accent hover:text-accent"
        onClick={saveOverride}
        disabled={!hasChanges}
      >
        <Check className="h-2 w-2" />
        {hasChanges ? 'Save override' : 'Saved'}
      </Button>
    </>
  );

  if (savedOverride !== undefined) {
    return (
      <Section
        title="Response Body"
        collapsible={false}
        action={overrideActions}
      >
        <div className="space-y-4">
          <KeyValueGrid
            items={[
              {
                key: 'Content-Type',
                value: type,
                valueClassName: 'text-accent',
              },
            ]}
          />

          <div className="grid grid-cols-[minmax(7rem,25%)_minmax(3rem,1fr)] gap-x-2 gap-y-2 text-sm">
            <span className={'text-muted wrap-anywhere'}>Status Code</span>
            <input
              type="number"
              value={editedStatus}
              onChange={(e) => {
                setEditedStatus(parseInt(e.target.value));
              }}
              className="max-w-24 font-mono text-foreground/70 whitespace-pre-wrap bg-surface p-1 rounded-md border border-border/60 overflow-x-auto wrap-anywhere ring-offset-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            />
          </div>

          <CodeEditor
            data={savedOverride?.body}
            ref={responseEditorRef}
            onInput={(e) => setEditedBody(e.currentTarget.innerText)}
          />
        </div>
      </Section>
    );
  }
};
