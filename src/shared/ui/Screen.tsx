import React, { type PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

export function Screen({
  children,
  bottom = false,
  contentStyle,
}: PropsWithChildren<{
  bottom?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={
        bottom ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 24,
    gap: 24,
    paddingBottom: 32,
  },
});
