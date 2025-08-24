import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
  Animated,
} from "react-native";
import Svg, { Defs, Mask, Rect, Pattern, Image } from "react-native-svg";

interface ImageOverlayProps {
  imageUri: string;
  show?: boolean;
  initialDividerPosition?: number; // Percentage from left (0-100)
}

export const ImageOverlay: React.FC<ImageOverlayProps> = ({
  imageUri,
  show = true,
  initialDividerPosition = 50,
}) => {
  const { width, height } = useWindowDimensions();
  
  // Use Animated.Value for smooth animations
  const dividerPositionAnim = useRef(new Animated.Value(initialDividerPosition)).current;
  const [dividerPosition, setDividerPosition] = useState(initialDividerPosition);

  // Reset position when show prop changes
  useEffect(() => {
    if (show) {
      dividerPositionAnim.setValue(initialDividerPosition);
      setDividerPosition(initialDividerPosition);
    }
  }, [show, initialDividerPosition, dividerPositionAnim]);

  // Sync animated value with state for SVG calculations
  useEffect(() => {
    const listener = dividerPositionAnim.addListener(({ value }) => {
      setDividerPosition(value);
    });
    
    return () => {
      dividerPositionAnim.removeListener(listener);
    };
  }, [dividerPositionAnim]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          // Store the current position when gesture starts
          dividerPositionAnim.setOffset(dividerPositionAnim._value);
          dividerPositionAnim.setValue(0);
        },
        onPanResponderMove: (evt, gestureState) => {
          // Use dx (delta) to calculate the change in position
          const deltaX = gestureState.dx;
          const deltaPercentage = (deltaX / width) * 100;
          dividerPositionAnim.setValue(deltaPercentage);
        },
        onPanResponderRelease: () => {
          // Flatten the offset and value
          dividerPositionAnim.flattenOffset();
        },
      }),
    [width, dividerPositionAnim]
  );

  const dividerX = (dividerPosition / 100) * width;

  if (!show) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1001 }]}>
      {/* SVG container with masking */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          {/* Define the image pattern first */}
          <Pattern  
            id="imagePattern"
            patternUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <Image
              href={imageUri}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid slice"
            />
          </Pattern>
          
          <Mask id="imageMask">
            {/* White rectangle on the right side (shows the image) */}
            <Rect
              x={dividerX}
              y={0}
              width={width - dividerX}
              height={height}
              fill="white"
            />
            {/* Black rectangle on the left side (hides the image, shows the app) */}
            <Rect
              x={0}
              y={0}
              width={dividerX}
              height={height}
              fill="black"
            />
          </Mask>
        </Defs>
        
        {/* Masked image - now the pattern is defined before it's used */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#imagePattern)"
          mask="url(#imageMask)"
        />
      </Svg>
      
      {/* Animated divider line */}
      <Animated.View
        style={[
          styles.divider,
          {
            left: dividerPositionAnim.interpolate({
              inputRange: [0, 100],
              outputRange: [-1, width - 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
      
      {/* Animated draggable handle */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.handle,
          {
            left: dividerPositionAnim.interpolate({
              inputRange: [0, 100],
              outputRange: [-15, width - 15],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <View style={styles.handleKnob} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#007AFF",
    zIndex: 2,
  },
  handle: {
    position: "absolute",
    top: "50%",
    width: 30,
    height: 60,
    backgroundColor: "#007AFF",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
    transform: [{ translateY: -30 }],
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  handleKnob: {
    width: 4,
    height: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
});
