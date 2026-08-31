import './App.css';
import { RozeniteLogo } from './RozeniteLogo.jsx';
import { ControlsPlayground } from './plugins/ControlsPlayground.jsx';
import { FeatureFlagsPlayground } from './plugins/FeatureFlagsPlayground.jsx';
import { RhfPlayground } from './plugins/RhfPlayground.jsx';
import { TanStackQueryPlayground } from './plugins/TanStackQueryPlayground.jsx';

export function App() {
  return (
    <scroll-view className="Screen" scroll-orientation="vertical">
      <view className="Panel">
        <RozeniteLogo />
        <text className="Title">Rozenite</text>
        <view className="Badge">
          <text className="Badge__label">LYNX</text>
        </view>
        <text className="Tagline">
          A showcase and E2E testing ground for Rozenite DevTools plugins.
        </text>
      </view>

      <ControlsPlayground />
      <FeatureFlagsPlayground />
      <RhfPlayground />
      <TanStackQueryPlayground />
    </scroll-view>
  );
}
