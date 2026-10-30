// One shared animation clock per speed, instead of a separate animation for every
// firefly, lamp, bee and pulsing arrow. Older phones choke on dozens of loops at once;
// one loop that everything reads from (each at its own phase) stays smooth.
import { Animated, Easing } from 'react-native';
import { nativeDriver } from './kit';

const clocks = new Map<number, Animated.Value>();

/** A value going 0 → 1 every `ms`, forever, shared by everyone who asks for the same speed. */
export function clock(ms: number) {
  let v = clocks.get(ms);
  if (!v) {
    v = new Animated.Value(0);
    clocks.set(ms, v);
    Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: nativeDriver })).start();
  }
  return v;
}

/** A looping wave read off a shared clock: `fn(t)` for t in 0–1, shifted by `phase` (0–1). */
export function wave(v: Animated.Value, phase: number, fn: (t: number) => number, steps = 8) {
  const input = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  return v.interpolate({ inputRange: input, outputRange: input.map((t) => fn((t + phase) % 1)) });
}
