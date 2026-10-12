import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, Text } from '@rozenite/ui';
import { TabContent } from '../components/TabContent';
import { HttpNetworkEntry } from '../state/model';
import { Section } from '../components/Section';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { useOverrides } from '../state/hooks';
import { RequestOverride } from '../../shared/client';
import { OverrideResponse } from '../components/OverrideResponse';
import { ViewToggle } from '../components/ViewToggle';
import { findRenderer, type RenderCtx, type ResponseView } from '../response-renderers';

export type ResponseTabProps = {
  selectedRequest: HttpNetworkEntry;
  supportsOverrides?: boolean;
  // Sticky Preview/Raw preference is owned by the parent (SidePanel)
  // so it survives the `<Tabs key={selectedRequest.id}>` remount that
  // happens on every request switch. Renderers without the requested
  // view fall back to their own `defaultView`.
  preferredView: ResponseView;
  onPreferredViewChange: (view: ResponseView) => void;
  onRequestResponseBody: (requestId: string) => void;
};

export const ResponseTab = ({
  selectedRequest,
  supportsOverrides = true,
  preferredView,
  onPreferredViewChange,
  onRequestResponseBody,
}: ResponseTabProps) => {
  const onRequestResponseBodyRef = useRef(onRequestResponseBody);
  const overrides = useOverrides();
  const [initialOverride, setInitialOverride] = useState<RequestOverride | undefined>(() =>
    overrides.get(selectedRequest.request.url),
  );

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
    if (!responseBody) {
      return <Text variant="caption">No response body available for this request</Text>;
    }

    const { type, data } = responseBody;
    const renderer = findRenderer(type, data);
    const activeView = renderer.views.includes(preferredView)
      ? preferredView
      : renderer.defaultView;
    const ctx: RenderCtx = {
      contentType: type,
      url: selectedRequest.request.url,
      headers: selectedRequest.response?.headers,
      size: selectedRequest.response?.size,
    };

    // Override engaged: replace the whole panel with the override editor.
    // Only reachable for renderers that support override AND when the
    // user has clicked into the override flow.
    if (supportsOverrides && renderer.supportsOverride && initialOverride !== undefined) {
      return (
        <OverrideResponse
          selectedRequest={selectedRequest}
          initialOverride={initialOverride}
          onClear={() => setInitialOverride(undefined)}
        />
      );
    }

    const canOverride = renderer.supportsOverride && supportsOverrides && typeof data === 'string';
    const overrideAction = canOverride ? (
      <Button
        tone="primary"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setInitialOverride({
            body: data,
            status: selectedRequest.response?.status,
          });
        }}
      >
        <Pencil />
        Override
      </Button>
    ) : null;

    const toggle =
      renderer.views.length > 1 ? (
        <ViewToggle views={renderer.views} value={activeView} onChange={onPreferredViewChange} />
      ) : null;

    const sectionAction =
      toggle || overrideAction ? (
        <>
          {toggle}
          {overrideAction}
        </>
      ) : null;

    return (
      <Section title="Response Body" collapsible={false} action={sectionAction}>
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
          {renderer.render({ view: activeView, body: data, ctx })}
        </div>
      </Section>
    );
  };

  return <TabContent>{renderResponseBody()}</TabContent>;
};
