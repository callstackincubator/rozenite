import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { ImageConfig } from '../../shared/types';

export const SliderOverlayLayer: React.FC<{ config: ImageConfig }> = memo(({
  config,
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const splitPosition = useRef(new Animated.Value(SCREEN_WIDTH / 2)).current;
  const currentPositionRef = useRef(SCREEN_WIDTH / 2);

  // Update split position if it's out of bounds after rotation
  useEffect(() => {
    if (currentPositionRef.current > SCREEN_WIDTH) {
      const newPos = SCREEN_WIDTH / 2;
      currentPositionRef.current = newPos;
      splitPosition.setValue(newPos);
    }
  }, [SCREEN_WIDTH]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        const newPosition = Math.max(
          0,
          Math.min(SCREEN_WIDTH, evt.nativeEvent.pageX),
        );
        splitPosition.setValue(newPosition);
        currentPositionRef.current = newPosition;
      },
    }),
  ).current;

  if (!config.uri) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Left side - overlay image */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            width: splitPosition,
          },
        ]}
        pointerEvents="none"
      >
        <Image
          source={{ uri: config.uri }}
          style={[
            styles.overlayImage,
            {
              width: SCREEN_WIDTH, // Fixed width to prevent resizing
              opacity: config.opacity,
            },
          ]}
          resizeMode={config.resizeMode || 'contain'}
        />
      </Animated.View>

      {/* Draggable handle */}
      <Animated.View
        style={[
          styles.dragHandle,
          {
            left: Animated.subtract(splitPosition, 22), // Half of dragHandle width (44/2)
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandleBar} />
        <View style={styles.dragHandleThumb}>
          {/* Grip lines */}
          <View style={styles.gripLine} />
          <View style={styles.gripLine} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  dragHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dragHandleBar: {
    width: 2,
    height: '100%',
    backgroundColor: '#8232FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  dragHandleThumb: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8232FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  gripLine: {
    width: 2,
    height: 14,
    backgroundColor: 'white',
    borderRadius: 1,
  },
});
