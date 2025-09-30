/**
 * Type declarations for external libraries without TypeScript definitions
 */

declare module 'react-native-slider' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  interface SliderProps {
    style?: ViewStyle;
    minimumValue?: number;
    maximumValue?: number;
    value?: number;
    onValueChange?: (value: number) => void;
    step?: number;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbStyle?: ViewStyle;
  }

  export default class Slider extends Component<SliderProps> {}
}
