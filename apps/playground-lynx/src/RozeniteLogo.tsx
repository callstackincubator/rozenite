import './RozeniteLogo.css';

const PIXEL_SIZE = 14;

/**
 * The Rozenite gem. Lynx has no inline SVG element, so the mark is rebuilt from
 * the pixel rows it is drawn from: every row is a centred run of N blocks, so
 * each one collapses to a single view N blocks wide.
 */
const GEM_ROWS = [1, 3, 3, 5, 5, 7, 7, 7, 5, 3];

export function RozeniteLogo() {
  return (
    <view className="Logo">
      {GEM_ROWS.map((blocks, index) => (
        <view
          className="Logo__row"
          key={index}
          style={{
            width: `${blocks * PIXEL_SIZE}px`,
            height: `${PIXEL_SIZE}px`,
          }}
        />
      ))}
    </view>
  );
}
