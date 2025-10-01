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
import { RequestOverride } from '../../shared/client';

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
  const [savedOverride, setSavedOverride] = useState<
    RequestOverride | undefined
  >(() => {
    const override = overrides.get(selectedRequest.request.url);
    return override;
  });
  const [editedBody, setEditedBody] = useState<string | undefined>(
    savedOverride?.body
  );
  const [editedStatus, setEditedStatus] = useState<number | undefined>(
    savedOverride?.status
  );
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
    const statusCode = selectedRequest.response?.status;

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
        currentData={{ body: editedBody, status: editedStatus }}
        initialData={savedOverride}
        onOverride={() => {
          setSavedOverride({ body: data, status: statusCode });
          setEditedBody(data);
          setEditedStatus(statusCode);
        }}
        onSaveOverride={saveOverride}
        onClear={clearOverride}
      />
    );

    if (savedOverride !== undefined) {
      return (
        <RenderResponseBodySection action={overrideActions}>
          {contentTypeGrid}

          <div className="grid grid-cols-[minmax(7rem,25%)_minmax(3rem,1fr)] gap-x-2 gap-y-2 text-sm">
            <span className={'text-gray-400 wrap-anywhere'}>Status Code</span>
            <input
              type="number"
              value={editedStatus}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                setEditedStatus(parseInt(target.value));
              }}
              className="max-w-24 font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-1 rounded-md border border-gray-700 overflow-x-auto wrap-anywhere ring-offset-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <CodeEditor
            data={savedOverride?.body}
            ref={responseEditorRef}
            onInput={(e) => setEditedBody(e.currentTarget.innerText)}
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
