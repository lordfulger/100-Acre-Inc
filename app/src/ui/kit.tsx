import React from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

export const C = {
  bg: '#FFF7E3',
  card: '#FFFDF6',
  border: '#EBD9AE',
  ink: '#4A3418',
  soft: '#8A6D45',
  faint: '#B9A27A',
  green: '#5E9E3B',
  greenDeep: '#3F7524',
  disabled: '#E4D8BE',
  pink: '#E46A8C',
  blue: '#5A8FD6',
  red: '#C8553D',
};

export const nativeDriver = Platform.OS !== 'web';

export function buzz(kind: 'light' | 'medium' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label, sub, onPress, disabled, color = C.green, small, style, outline,
}: {
  label: string; sub?: string; onPress: () => void; disabled?: boolean; color?: string; small?: boolean; style?: ViewStyle; outline?: boolean;
}) {
  return (
    <Pressable
      onPress={() => { if (!disabled) { buzz(); onPress(); } }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        outline ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: disabled ? C.disabled : color } : { backgroundColor: disabled ? C.disabled : color },
        pressed && !disabled && { transform: [{ scale: 0.96 }] },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.btnText, small && { fontSize: 13 }, outline && { color: disabled ? C.faint : color }, disabled && !outline && { color: C.soft }]} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={[styles.btnSub, outline && { color: C.soft }, disabled && { color: C.soft }]} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Bar({ value, color, height = 10, marks }: { value: number; color: string; height?: number; marks?: number[] }) {
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color, height: '100%', borderRadius: height / 2 }} />
      {marks?.map((m) => <View key={m} style={[styles.mark, { left: `${m * 100}%` }]} />)}
    </View>
  );
}

export function Section({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1.5, borderColor: C.border, padding: 12, marginBottom: 10 },
  btn: { borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, minWidth: 0, borderRadius: 11 },
  btnText: { color: 'white', fontWeight: '800', fontSize: 15 },
  btnSub: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 12, marginTop: 1 },
  bar: { backgroundColor: '#F1E5C8', overflow: 'hidden', width: '100%' },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(74,52,24,0.35)' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: C.ink },
});
