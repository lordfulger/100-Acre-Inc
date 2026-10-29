import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { COMB_BONUS, varietyAt } from '../game/catalog';
import { Boost, tap, totalCombs } from '../game/engine';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { buzz, C, nativeDriver } from './kit';
import { Portrait } from './Portrait';
import { playTap } from '../audio/sound';

type Pop = { id: number; x: number; text: string; anim: Animated.Value };
let popId = 0;

function HoneyPot() {
  const { act, s, d } = useGame();
  const scale = useRef(new Animated.Value(1)).current;
  const [pops, setPops] = useState<Pop[]>([]);
  const v = varietyAt(s.variety);

  const onTap = () => {
    const before = d.tapValue;
    const value = act((st, now) => tap(st, now));
    playTap(value > before * 1.5);
    buzz();
    scale.setValue(0.86);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 160, useNativeDriver: nativeDriver }).start();
    const id = ++popId;
    const anim = new Animated.Value(0);
    setPops((p) => [...p.slice(-10), { id, x: 10 + Math.random() * 70, text: `+${fmt(value)}`, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver })
      .start(() => setPops((p) => p.filter((q) => q.id !== id)));
  };

  return (
    <View style={styles.potWrap}>
      {/* onPressIn feels snappier for rapid tapping on phones; web only fires onPress reliably. */}
      <Pressable
        onPressIn={Platform.OS === 'web' ? undefined : onTap}
        onPress={Platform.OS === 'web' ? onTap : undefined}
        accessibilityRole="button"
        accessibilityLabel="Tap the honey pot"
      >
        <Animated.View style={[styles.pot, { backgroundColor: v.deep, transform: [{ scale }] }]}>
          <Text style={styles.potEmoji}>🍯</Text>
          <Portrait id="pooh" size={40} style={styles.potBear} />
        </Animated.View>
      </Pressable>
      {pops.map((p) => (
        <Animated.Text
          key={p.id}
          pointerEvents="none"
          style={[styles.pop, {
            left: p.x,
            opacity: p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [{ translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [10, -70] }) }],
          }]}
        >
          {p.text}
        </Animated.Text>
      ))}
    </View>
  );
}

function Hearts() {
  const { hearts } = useGame();
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!hearts) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: nativeDriver }).start();
  }, [hearts, anim]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {['💕', '💛', '💗', '🧡', '💖'].map((h, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute', left: `${12 + i * 18}%`, bottom: 0, fontSize: 30,
            opacity: anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -110 - i * 12] }) }],
          }}
        >
          {h}
        </Animated.Text>
      ))}
    </View>
  );
}

export function Header() {
  const { s, d, now } = useGame();
  const v = varietyAt(s.variety);
  const combs = totalCombs(s);
  // Same-named boosts (two hugs in a row) show as one chip.
  const boosts = Object.values(
    s.boosts.filter((b) => b.until > now).reduce<Record<string, Boost & { count: number }>>((acc, b) => {
      const key = `${b.kind}:${b.label}`;
      const prev = acc[key];
      acc[key] = prev ? { ...prev, mult: prev.mult * b.mult, until: Math.max(prev.until, b.until), count: prev.count + 1 } : { ...b, count: 1 };
      return acc;
    }, {}),
  );
  return (
    <View style={[styles.header, { backgroundColor: v.color }]}>
      <View style={styles.info}>
        <Text style={styles.honey} numberOfLines={1} adjustsFontSizeToFit>{fmt(s.honey)}</Text>
        <Text style={styles.unit}>{v.emoji} {v.name}</Text>
        <Text style={styles.rate}>+{fmt(d.hps)}/s  ·  👆 +{fmt(d.tapValue)}</Text>
        {combs > 0 && <Text style={styles.combs}>✨ {fmt(combs)} Golden Honeycombs (+{fmt(combs * COMB_BONUS * 100)}%)</Text>}
        {boosts.length > 2 && <Text style={styles.combs}>+{boosts.length - 2} more boosts</Text>}
        {boosts.length > 0 && (
          <View style={styles.chips}>
            {boosts.slice(0, 2).map((b) => (
              <View key={b.id} style={styles.chip}>
                <Text style={styles.chipText}>{b.kind === 'tap' ? '👆' : '🍯'}×{fmt(b.mult)} {b.label} · {Math.ceil((b.until - now) / 1000)}s</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <HoneyPot />
      <Hearts />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopLeftRadius: 26, borderTopRightRadius: 26, zIndex: 10 },
  potWrap: { width: 112, height: 112, marginLeft: 12, zIndex: 20 },
  pot: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  potEmoji: { fontSize: 58 },
  potBear: { position: 'absolute', bottom: -2, right: -2 },
  pop: { position: 'absolute', top: 10, fontSize: 18, fontWeight: '900', color: 'white', textShadowColor: 'rgba(74,52,24,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  info: { flex: 1 },
  honey: { fontSize: 34, fontWeight: '900', color: C.ink },
  unit: { fontSize: 13, fontWeight: '800', color: 'rgba(74,52,24,0.75)', marginTop: -2 },
  rate: { fontSize: 14, fontWeight: '800', color: C.ink, marginTop: 4 },
  combs: { fontSize: 12, fontWeight: '700', color: 'rgba(74,52,24,0.8)', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 },
  chip: { backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '800', color: C.ink },
});
