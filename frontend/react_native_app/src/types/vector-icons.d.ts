// Type-augmentation shim for @expo/vector-icons 14.0.4
//
// Why: 14.0.4 ships an `Icon` class whose `Component<...>` constraint
// doesn't satisfy the React 18.3+ JSX element contract (missing `refs`),
// triggering TS2786 at every `<Ionicons />` site. This narrows each icon
// set to a plain functional component so JSX typing works.
//
// Runtime is unaffected — Metro/Babel strip TS.

declare module '@expo/vector-icons' {
  import type { ComponentType } from 'react';
  import type { TextStyle, StyleProp, OpaqueColorValue } from 'react-native';

  interface IconBaseProps {
    name: string;
    size?: number;
    color?: string | OpaqueColorValue;
    style?: StyleProp<TextStyle>;
    accessibilityLabel?: string;
    allowFontScaling?: boolean;
    selectable?: boolean;
    testID?: string;
  }

  // Each icon set is a functional component plus a static `glyphMap`
  // that callers use as `keyof typeof Ionicons.glyphMap` to type names.
  type IconSet = ComponentType<IconBaseProps> & {
    glyphMap: Record<string, number>;
  };

  export const Ionicons: IconSet;
  export const MaterialCommunityIcons: IconSet;
  export const MaterialIcons: IconSet;
  export const FontAwesome: IconSet;
  export const FontAwesome5: IconSet;
  export const FontAwesome6: IconSet;
  export const Feather: IconSet;
  export const AntDesign: IconSet;
  export const Entypo: IconSet;
  export const EvilIcons: IconSet;
  export const Foundation: IconSet;
  export const Octicons: IconSet;
  export const SimpleLineIcons: IconSet;
  export const Zocial: IconSet;
}
