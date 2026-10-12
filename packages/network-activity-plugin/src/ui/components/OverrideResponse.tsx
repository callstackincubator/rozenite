import { useRef, useState } from 'react';
import { Check, CircleSlash2 } from 'lucide-react';
import { Button, DescriptionList, Input, Text } from '@rozenite/ui';
import { HttpNetworkEntry } from '../state/model';
import { Section } from '../components/Section';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { useNetworkActivityActions } from '../state/hooks';
import { CodeEditor } from '../components/CodeEditor';
import { RequestOverride } from '../../shared/client';

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
  const [savedOverride, setSavedOverride] = useState<RequestOverride | undefined>(initialOverride);
  const [editedBody, setEditedBody] = useState<string | undefined>(initialOverride?.body);
  const [editedStatus, setEditedStatus] = useState<number | undefined>(initialOverride?.status);
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
    return <Text variant="caption">No response body available for this request</Text>;
  }

  const { type } = responseBody;

  const hasChanges = editedBody !== savedOverride?.body || editedStatus !== savedOverride?.status;

  const overrideActions = (
    <>
      <Button tone="primary" variant="ghost" size="sm" onClick={clearOverride}>
        <CircleSlash2 />
        Clear override
      </Button>

      <Button
        tone="primary"
        variant="ghost"
        size="sm"
        onClick={saveOverride}
        disabled={!hasChanges}
      >
        <Check />
        {hasChanges ? 'Save override' : 'Saved'}
      </Button>
    </>
  );

  if (savedOverride !== undefined) {
    return (
      <Section title="Response Body" collapsible={false} action={overrideActions}>
        <div className="flex flex-col gap-4">
          <KeyValueGrid
            items={[
              {
                key: 'Content-Type',
                value: type,
                valueClassName: 'font-mono text-xs',
              },
            ]}
          />

          <DescriptionList>
            <DescriptionList.Item label="Status Code">
              <Input
                size="sm"
                type="number"
                aria-label="Status Code"
                value={editedStatus ?? ''}
                onChange={(e) => {
                  setEditedStatus(parseInt(e.target.value));
                }}
                className="w-24 font-mono"
              />
            </DescriptionList.Item>
          </DescriptionList>

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
