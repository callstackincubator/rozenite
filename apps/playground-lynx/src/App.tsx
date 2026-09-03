import './App.css';
import Rozenite from '@rozenite/lynx';
import { RozeniteLogo } from './RozeniteLogo.jsx';

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

      <Rozenite />
    </scroll-view>
  );
}
