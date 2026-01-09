import React, { memo } from 'react';
import { ImageConfig } from '../../shared/types';
import { SimpleOverlayLayer } from './SimpleOverlayLayer';
import { SliderOverlayLayer } from './SliderOverlayLayer';

export const ImageComparisonLayer: React.FC<{ config: ImageConfig }> = memo(({
  config,
}) => {
  if (!config.enabled || !config.uri) {
    return null;
  }

  if (config.mode === 'overlay') {
    return <SimpleOverlayLayer config={config} />;
  }

  return <SliderOverlayLayer config={config} />;
});
