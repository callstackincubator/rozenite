import { GridOverlay } from "./GridOverlay";
import { ImageOverlay } from "./ImageOverlay";
import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { RozeniteDesignDevToolsEvents } from "../shared/client";
import { useState, useEffect } from "react";

export const RozeniteDesignDevTools = () => {
  const [gridProps, setGridProps] = useState<RozeniteDesignDevToolsEvents['set-grid']>({
    show: false,
    cellSize: 21.33,
    majorLineEvery: 5,
    minorColor: 'rgba(255,255,255,0.15)',
    majorColor: 'rgba(255,255,255,0.25)',
  });
  const [overlayProps, setOverlayProps] = useState<RozeniteDesignDevToolsEvents['set-overlay']>({
    show: false,
    imageUri: '',
    initialDividerPosition: 50,
  });

  const client = useRozeniteDevToolsClient<RozeniteDesignDevToolsEvents>({
    pluginId: '@rozenite/design-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions = [
      client.onMessage('set-grid', (data) => {
        setGridProps(data);
      }),
      client.onMessage('set-overlay', (data) => {
        setOverlayProps(data);
      }),
    ];
    
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    }
  }, [client]);

  return (
    <>
      {gridProps.show && (
        <GridOverlay 
          {...gridProps}
        />
      )}

      {overlayProps.show && (
        <ImageOverlay
          {...overlayProps}
        />
      )}
    </>
  );
};