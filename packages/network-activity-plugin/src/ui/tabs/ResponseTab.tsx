import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { HttpNetworkEntry } from '../state/model';
import { Section } from '../components/Section';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { CodeBlock } from '../components/CodeBlock';
import { useOverrides } from '../state/hooks';
import { RequestOverride } from '../../shared/client';
import { OverrideResponse } from '../components/OverrideResponse';
import { Button } from '../components/Button';
import { Pencil } from 'lucide-react';

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
  const overrides = useOverrides();
  const [initialOverride, setInitialOverride] = useState<
    RequestOverride | undefined
  >(() => {
    const override = overrides.get(selectedRequest.request.url);
    return override;
  });

  useEffect(() => {
    onRequestResponseBodyRef.current = onRequestResponseBody;
  }, [onRequestResponseBody]);

  useEffect(() => {
    if (onRequestResponseBodyRef.current) {
      onRequestResponseBodyRef.current(selectedRequest.id);
    }
  }, [selectedRequest.id]);

  const responseBody = selectedRequest.response?.body;

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

    const overrideAction = (
      <Button
        variant="ghost"
        size="xs"
        className="text-violet-300 hover:text-violet-300"
        onClick={() =>
          setInitialOverride({
            body: data,
            status: statusCode,
          })
        }
      >
        <Pencil className="h-2 w-2" />
        Override
      </Button>
    );

    if (initialOverride !== undefined) {
      return (
        <OverrideResponse
          selectedRequest={selectedRequest}
          initialOverride={initialOverride}
          onClear={() => setInitialOverride(undefined)}
        />
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
        <RenderResponseBodySection action={overrideAction}>
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
        <RenderResponseBodySection action={overrideAction}>
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
