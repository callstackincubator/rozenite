import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { HttpNetworkEntry } from '../state/model';
import { Section } from '../components/Section';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { CodeBlock } from '../components/CodeBlock';
import { useNetworkActivityActions, useOverrides } from '../state/hooks';
import { OverrideActions } from '../components/OverrideActions';
import { CodeEditor } from '../components/CodeEditor';

export type ResponseTabProps = {
  selectedRequest: HttpNetworkEntry;
  onRequestResponseBody: (requestId: string) => void;
};

type ResponseBodySectionProps = {
  action?: React.ReactNode;
  children: React.ReactNode;
};

const RenderResponseBodySection = ({
  children,
  action,
}: ResponseBodySectionProps) => {
  return (
    <Section title="Response Body" collapsible={false} action={action}>
      <div className="space-y-4">{children}</div>
    </Section>
  );
};

export const ResponseTab = ({
  selectedRequest,
  onRequestResponseBody,
}: ResponseTabProps) => {
  const onRequestResponseBodyRef = useRef(onRequestResponseBody);
  const actions = useNetworkActivityActions();
  const overrides = useOverrides();
  const [savedOverride, setSavedOverride] = useState<string | null>(() => {
    const override = overrides.get(selectedRequest.request.url);
    return override?.body ?? null;
  });
  const [editedData, setEditedData] = useState<string | null>(savedOverride);
  const responseEditorRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    onRequestResponseBodyRef.current = onRequestResponseBody;
  }, [onRequestResponseBody]);

  useEffect(() => {
    if (onRequestResponseBodyRef.current) {
      onRequestResponseBodyRef.current(selectedRequest.id);
    }
  }, [selectedRequest.id]);

  const responseBody = selectedRequest.response?.body;

  const saveOverride = () => {
    if (editedData === null) return;

    const newOverrideData = editedData;
    setSavedOverride(newOverrideData);
    actions.addOverride(selectedRequest.request.url, {
      body: newOverrideData,
    });
  };

  const clearOverride = () => {
    setSavedOverride(null);
    setEditedData(null);
    actions.clearOverride(selectedRequest.request.url);
  };

  const renderResponseBody = () => {
    if (!responseBody || responseBody.data === null) {
      return (
        <div className="text-sm text-gray-400">
          No response body available for this request
        </div>
      );
    }

    const { type, data } = responseBody;

    const contentTypeGrid = (
      <KeyValueGrid
        items={[
          {
            key: 'Content-Type',
            value: type,
            valueClassName: 'text-blue-400',
          },
        ]}
      />
    );

    const overrideActions = (
      <OverrideActions
        currentData={editedData}
        initialData={savedOverride}
        onOverride={() => {
          setSavedOverride(data);
          setEditedData(data);
        }}
        onSaveOverride={saveOverride}
        onClear={clearOverride}
      />
    );

    if (savedOverride !== null) {
      return (
        <RenderResponseBodySection action={overrideActions}>
          {contentTypeGrid}
          <CodeEditor
            data={savedOverride}
            ref={responseEditorRef}
            onInput={(e) => setEditedData(e.currentTarget.innerText)}
          />
        </RenderResponseBodySection>
      );
    }

    if (type.startsWith('application/json')) {
      let bodyContent;

      try {
        const jsonData = JSON.parse(data);

        bodyContent = (
          <CodeBlock>
            <JsonTree data={jsonData} />
          </CodeBlock>
        );
      } catch {
        bodyContent = (
          <>
            <CodeBlock>{data}</CodeBlock>
            <div className="text-xs text-gray-500 mt-1">
              ⚠️ Failed to parse as JSON, showing as raw text
            </div>
          </>
        );
      }

      return (
        <RenderResponseBodySection action={overrideActions}>
          {contentTypeGrid}
          {bodyContent}
        </RenderResponseBodySection>
      );
    }

    if (
      type.startsWith('text/') ||
      type.startsWith('application/xml') ||
      type.startsWith('application/javascript')
    ) {
      return (
        <RenderResponseBodySection action={overrideActions}>
          {contentTypeGrid}
          <CodeBlock>{data}</CodeBlock>
        </RenderResponseBodySection>
      );
    }

    return (
      <RenderResponseBodySection>
        {contentTypeGrid}
        <div className="text-sm text-gray-400">
          Binary content not shown - {data.length} bytes
        </div>
      </RenderResponseBodySection>
    );
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4">{renderResponseBody()}</div>
    </ScrollArea>
  );
};
