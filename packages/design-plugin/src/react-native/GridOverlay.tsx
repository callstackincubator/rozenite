import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Line } from "react-native-svg";

export const GridOverlay = ({
  cellSize = 20,
  majorLineEvery = 5,
  minorColor = "rgba(0,0,0,0.05)",
  majorColor = "rgba(0,0,0,0.15)",
  show = true,
  background = "transparent",
}) => {
  const { width, height } = useWindowDimensions();
  if (!show) return null;

  const verticalLines = [];
  const horizontalLines = [];

  let index = 0;
  for (let x = 0; x <= width; x += cellSize) {
    const isMajor = index % majorLineEvery === 0;
    verticalLines.push(
      <Line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={isMajor ? majorColor : minorColor}
        strokeWidth={isMajor ? 1.5 : 0.5}
      />
    );
    index++;
  }

  index = 0;
  for (let y = 0; y <= height; y += cellSize) {
    const isMajor = index % majorLineEvery === 0;
    horizontalLines.push(
      <Line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={isMajor ? majorColor : minorColor}
        strokeWidth={isMajor ? 1.5 : 0.5}
      />
    );
    index++;
  }

  return (
    <Svg style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: background }]} pointerEvents="none">
      {verticalLines}
      {horizontalLines}
    </Svg>
  );
};
