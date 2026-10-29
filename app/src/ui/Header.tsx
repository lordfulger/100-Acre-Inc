import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { COMB_BONUS, varietyAt } from '../game/catalog';
import { Boost, tap, totalCombs } from '../game/engine';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { buzz, C, nativeDriver } from './kit';
import { Portrait } from './Portrait';
import { playTap } from '../audio/sound';

type Pop = { id: number; x: number; text: string; anim: Animated.Value };
let popId = 0;
/** A drop of honey splashing out of the pot: flies `dx` sideways, rises `up`, then falls. */
type Splash = { id: number; dx: number; up: number; size: number; gold: boolean; anim: Animated.Value };
// Where the honey comes out (the pot's mouth, in the 112px button).
const MOUTH = { x: 52, y: 18 };
const HUNNY = require('../../assets/art/hunny-pot.png');

function HoneyPot() {
  const { act, s, d } = useGame();
  const scale = useRef(new Animated.Value(1)).current;
  const [pops, setPops] = useState<Pop[]>([]);
  const [splashes, setSplashes] = useState<Splash[]>([]);

  const splash = (lucky: boolean) => {
    const drops: Splash[] = Array.from({ length: lucky ? 9 : 5 }, () => ({
      id: ++popId,
      dx: (Math.random() - 0.5) * (lucky ? 190 : 130),
      up: 45 + Math.random() * (lucky ? 70 : 40),
      size: (lucky ? 13 : 10) + Math.random() * 5,
      gold: lucky,
      anim: new Animated.Value(0),
    }));
    // Rapid tapping keeps it to a sensible number of drops on screen.
    setSplashes((sp) => [...sp.slice(-30), ...drops]);
    for (const drop of drops) {
      Animated.timing(drop.anim, { toValue: 1, duration: 650 + Math.random() * 250, easing: Easing.linear, useNativeDriver: nativeDriver })
        .start(() => setSplashes((sp) => sp.filter((x) => x.id !== drop.id)));
    }
  };
  const v = varietyAt(s.variety);

  const onTap = () => {
    const before = d.tapValue;
    const value = act((st, now) => tap(st, now));
    const lucky = value > before * 1.5;
    playTap(lucky);
    splash(lucky);
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
        <Animated.View style={[styles.pot, { backgroundColor: '#F6EEDC', borderColor: v.deep, transform: [{ scale }] }]}>
          <Image source={HUNNY} style={styles.potArt} />
          <Portrait id="pooh" size={40} style={styles.potBear} />
        </Animated.View>
      </Pressable>
      {splashes.map((sp) => (
        <Animated.View
          key={sp.id}
          pointerEvents="none"
          style={[styles.splash, {
            left: MOUTH.x - sp.size / 2, top: MOUTH.y - sp.size / 2, width: sp.size, height: sp.size, borderRadius: sp.size / 2,
            backgroundColor: sp.gold ? '#FFC93C' : '#E39A1E', borderColor: sp.gold ? '#9A5F06' : '#6E3F08',
            opacity: sp.anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: sp.anim.interpolate({ inputRange: [0, 1], outputRange: [0, sp.dx] }) },
              // Up in an arc, then down past the pot (a rough parabola).
              { translateY: sp.anim.interpolate({ inputRange: [0, 0.3, 0.5, 0.75, 1], outputRange: [0, -sp.up * 0.85, -sp.up, -sp.up * 0.55, 50] }) },
              { scale: sp.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1, 0.8] }) },
              { rotate: '-45deg' },
            ],
          }]}
        />
      ))}
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
  // A teardrop: round with one sharp corner, turned so the point trails behind.
  splash: { position: 'absolute', borderTopRightRadius: 1, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  potWrap: { width: 112, height: 112, marginLeft: 12, zIndex: 20 },
  pot: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  potArt: { width: 100, height: 100, marginTop: -4 },
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
