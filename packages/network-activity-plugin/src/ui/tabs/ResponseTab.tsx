import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { HttpNetworkEntry } from '../state/model';
import { Section } from '../components/Section';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { useOverrides } from '../state/hooks';
import { RequestOverride } from '../../shared/client';
import { OverrideResponse } from '../components/OverrideResponse';
import { Button } from '../components/Button';
import { Pencil } from 'lucide-react';
import { ViewToggle } from '../components/ViewToggle';
import {
  findRenderer,
  type RenderCtx,
  type ResponseView,
} from '../response-renderers';

export type ResponseTabProps = {
  selectedRequest: HttpNetworkEntry;
  supportsOverrides?: boolean;
  onRequestResponseBody: (requestId: string) => void;
};

export const ResponseTab = ({
  selectedRequest,
  supportsOverrides = true,
  onRequestResponseBody,
}: ResponseTabProps) => {
  const onRequestResponseBodyRef = useRef(onRequestResponseBody);
  const overrides = useOverrides();
  const [initialOverride, setInitialOverride] = useState<
    RequestOverride | undefined
  >(() => overrides.get(selectedRequest.request.url));
  // Sticky preference: a user who flips to Raw on one response stays
  // on Raw for the rest of the panel session, when the active renderer
  // supports it. Renderers without Raw (e.g. JSON tree) fall back to
  // their own default.
  const [preferredView, setPreferredView] = useState<ResponseView>('preview');

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
      return (
        <div className="text-sm text-gray-400">
          No response body available for this request
        </div>
      );
    }

    const { type, data } = responseBody;
    const renderer = findRenderer(type, data);
    const activeView = renderer.views.includes(preferredView)
      ? preferredView
      : renderer.defaultView;
    const ctx: RenderCtx = {
      contentType: type,
      url: selectedRequest.request.url,
    };

    // Override engaged: replace the whole panel with the override editor.
    // Only reachable for renderers that support override AND when the
    // user has clicked into the override flow.
    if (
      supportsOverrides &&
      renderer.supportsOverride &&
      initialOverride !== undefined
    ) {
      return (
        <OverrideResponse
          selectedRequest={selectedRequest}
          initialOverride={initialOverride}
          onClear={() => setInitialOverride(undefined)}
        />
      );
    }

    const canOverride =
      renderer.supportsOverride &&
      supportsOverrides &&
      typeof data === 'string';
    const overrideAction = canOverride ? (
      <Button
        variant="ghost"
        size="xs"
        className="text-violet-300 hover:text-violet-300"
        onClick={(e) => {
          e.stopPropagation();
          setInitialOverride({
            body: data,
            status: selectedRequest.response?.status,
          });
        }}
      >
        <Pencil className="h-2 w-2" />
        Override
      </Button>
    ) : null;

    const toggle =
      renderer.views.length > 1 ? (
        <ViewToggle
          views={renderer.views}
          value={activeView}
          onChange={setPreferredView}
        />
      ) : null;

    const sectionAction =
      toggle || overrideAction ? (
        <div className="flex items-center gap-1">
          {toggle}
          {overrideAction}
        </div>
      ) : null;

    return (
      <Section title="Response Body" collapsible={false} action={sectionAction}>
        <div className="space-y-4">
          <KeyValueGrid
            items={[
              {
                key: 'Content-Type',
                value: type,
                valueClassName: 'text-blue-400',
              },
            ]}
          />
          {renderer.render({ view: activeView, body: data, ctx })}
        </div>
      </Section>
    );
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4">{renderResponseBody()}</div>
    </ScrollArea>
  );
};
