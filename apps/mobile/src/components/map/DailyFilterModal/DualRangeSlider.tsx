/**
 * Dual Range Slider Component
 *
 * A custom dual-thumb slider for selecting price ranges
 */

import React from 'react';
import { View, PanResponder } from 'react-native';
import { modals } from '@/styles';

interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onValuesChange: (min: number, max: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onValuesChange,
  onDragStateChange,
}) => {
  const [activeThumb, setActiveThumb] = React.useState<'min' | 'max' | null>(null);

  // trackWidth drives pixel-based positioning so percentage left values
  // (which break on Android physical devices) are never used.
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackWidthRef = React.useRef(0);
  const wrapperRef = React.useRef<View>(null);

  // LANDMINE — do NOT "fix"; see 09-CONTEXT.md D-11.4 (Android measure-poll; width=0 ~1s after Modal slide-in)
  // Poll measure() until non-zero — some Android devices report width=0 for ~1s after Modal slide-in.
  React.useEffect(() => {
    if (trackWidth > 0) return;
    let cancelled = false;
    let attempts = 0;
    const tryMeasure = () => {
      if (cancelled) return;
      wrapperRef.current?.measure((_x, _y, width) => {
        if (cancelled) return;
        if (width > 0) {
          trackWidthRef.current = width;
          setTrackWidth(width);
          return;
        }
        attempts += 1;
        if (attempts < 20) {
          setTimeout(tryMeasure, 50);
        }
      });
    };
    const initialId = setTimeout(tryMeasure, 50);
    return () => {
      cancelled = true;
      clearTimeout(initialId);
    };
  }, [trackWidth]);

  // Keep fresh refs for PanResponder closures so they always see current values
  const valueMinRef = React.useRef(valueMin);
  const valueMaxRef = React.useRef(valueMax);
  React.useEffect(() => {
    valueMinRef.current = valueMin;
  }, [valueMin]);
  React.useEffect(() => {
    valueMaxRef.current = valueMax;
  }, [valueMax]);

  const clamp = (val: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, val));

  // Factory: creates a PanResponder for either the min or max thumb.
  const createThumbPanResponder = (thumb: 'min' | 'max') => {
    let startValue = min;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        startValue = thumb === 'min' ? valueMinRef.current : valueMaxRef.current;
        setActiveThumb(thumb);
        onDragStateChange?.(true);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (trackWidthRef.current === 0) return;
        const deltaValue = (gestureState.dx / trackWidthRef.current) * (max - min);
        const raw = clamp(startValue + deltaValue, min, max);
        const newValue = Math.round(raw / step) * step;
        if (thumb === 'min') {
          onValuesChange(clamp(newValue, min, valueMaxRef.current - step), valueMaxRef.current);
        } else {
          onValuesChange(valueMinRef.current, clamp(newValue, valueMinRef.current + step, max));
        }
      },
      onPanResponderRelease: () => {
        setActiveThumb(null);
        onDragStateChange?.(false);
      },
      onPanResponderTerminate: () => {
        setActiveThumb(null);
        onDragStateChange?.(false);
      },
    });
  };

  const minPanResponder = React.useRef(createThumbPanResponder('min')).current;
  const maxPanResponder = React.useRef(createThumbPanResponder('max')).current;

  // Pixel positions — avoid percentage-based left values which don't resolve
  // correctly on Android physical devices when parent width is from flex layout.
  const minLeft = trackWidth > 0 ? ((valueMin - min) / (max - min)) * trackWidth : 0;
  const maxLeft = trackWidth > 0 ? ((valueMax - min) / (max - min)) * trackWidth : trackWidth;

  return (
    <View
      ref={wrapperRef}
      style={modals.priceSliderWrapper}
      collapsable={false}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) {
          trackWidthRef.current = w;
          setTrackWidth(w);
        }
      }}
    >
      {/* Visual track bar */}
      <View style={modals.priceSliderTrack} />
      {/* Active range highlight */}
      <View style={[modals.priceSliderActiveRange, { left: minLeft, width: maxLeft - minLeft }]} />
      {/* Min thumb — left is offset by half the thumb width (12) so the centre
          aligns with the value position. Direct subtraction avoids transform,
          which shifts pixels but NOT the touch area on older Android. */}
      <View
        style={[
          modals.priceSliderThumb,
          {
            left: minLeft - 12,
            zIndex: activeThumb === 'min' ? 10 : 5,
            elevation: activeThumb === 'min' ? 6 : 3,
          },
        ]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        {...minPanResponder.panHandlers}
      />
      {/* Max thumb */}
      <View
        style={[
          modals.priceSliderThumb,
          {
            left: maxLeft - 12,
            zIndex: activeThumb === 'max' ? 10 : 5,
            elevation: activeThumb === 'max' ? 6 : 3,
          },
        ]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        {...maxPanResponder.panHandlers}
      />
    </View>
  );
};
