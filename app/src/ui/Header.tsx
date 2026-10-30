import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { varietyAt } from '../game/catalog';
import { Boost, combPower, tap, totalCombs } from '../game/engine';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { buzz, C, nativeDriver } from './kit';
import { Portrait } from './Portrait';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playTap } from '../audio/sound';
import { lightEffects } from './effects';

type Pop = { id: number; x: number; text: string; anim: Animated.Value; lucky?: boolean };
let popId = 0;
/**
 * Honey sloshing out of the pot on a tap: a glob that swells up at the mouth, gooey
 * blobs that stretch as they fly and squash when they land, and now and then a drip
 * that oozes down the side. `dx`/`up` are a blob's flight; `side` is the drip's side.
 */
type Splash = { id: number; kind: 'glob' | 'blob' | 'drip'; dx: number; up: number; size: number; side: number; gold: boolean; anim: Animated.Value };
const GOO_MS = { glob: 480, blob: 820, drip: 1300 };
// Where the honey comes out (the pot's mouth, in the 112px button).
const MOUTH = { x: 52, y: 18 };
const HUNNY = require('../../assets/art/hunny-pot.png');

/** A glossy piece of honey: amber with a golden middle, a darker rim and a shine. */
function HoneyBody({ w, h, gold }: { w: number; h: number; gold: boolean }) {
  return (
    <View style={[styles.gooBody, { width: w, height: h, borderRadius: Math.min(w, h) / 2, backgroundColor: gold ? '#FFBE2E' : '#EE9A12', borderColor: gold ? '#B57406' : '#9A5806' }]}>
      <View style={[styles.gooCore, { borderRadius: Math.min(w, h) / 2, backgroundColor: gold ? '#FFE07A' : '#FFC84A' }]} />
      <View style={[styles.gooShine, { width: Math.max(3, w * 0.3), height: Math.max(3, h * 0.28), borderRadius: w }]} />
    </View>
  );
}

function Goo({ sp }: { sp: Splash }) {
  const a = sp.anim;
  if (sp.kind === 'glob') {
    // Wells up at the mouth, wobbles, and sinks back in.
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.goo, {
          left: MOUTH.x - sp.size / 2, top: MOUTH.y - sp.size * 0.45,
          transform: [
            { translateY: a.interpolate({ inputRange: [0, 0.35, 0.6, 1], outputRange: [4, -7, -4, 2] }) },
            { scaleX: a.interpolate({ inputRange: [0, 0.35, 0.6, 1], outputRange: [0.4, 1.15, 0.95, 0.2] }) },
            { scaleY: a.interpolate({ inputRange: [0, 0.35, 0.6, 1], outputRange: [0.3, 1.05, 1.1, 0.2] }) },
          ],
        }]}
      >
        <HoneyBody w={sp.size} h={sp.size * 0.8} gold={sp.gold} />
      </Animated.View>
    );
  }
  if (sp.kind === 'drip') {
    // Oozes down the outside of the pot, stretches, then a drop lets go and falls.
    const w = sp.size;
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.goo, {
          left: MOUTH.x + sp.side * 24 - w / 2, top: MOUTH.y + 6,
          opacity: a.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: a.interpolate({ inputRange: [0, 0.6, 0.72, 1], outputRange: [0, 13, 18, 70] }) },
            { scaleY: a.interpolate({ inputRange: [0, 0.6, 0.72, 0.8, 1], outputRange: [0.8, 3.4, 3.8, 1.3, 1.1] }) },
            { scaleX: a.interpolate({ inputRange: [0, 0.6, 0.72, 0.8, 1], outputRange: [1, 0.8, 0.7, 1.05, 1] }) },
          ],
        }]}
      >
        <HoneyBody w={w} h={w} gold={sp.gold} />
      </Animated.View>
    );
  }
  // A blob: thrown up and out, stretched along its flight, then squashed flat as it lands.
  const tilt = (Math.atan2(sp.dx, -sp.up) * 180) / Math.PI;
  const fall = (Math.atan2(sp.dx, sp.up) * 180) / Math.PI;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.goo, {
        left: MOUTH.x - sp.size / 2, top: MOUTH.y - sp.size / 2,
        opacity: a.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, sp.dx] }) },
          { translateY: a.interpolate({ inputRange: [0, 0.3, 0.45, 0.7, 0.85, 1], outputRange: [0, -sp.up * 0.9, -sp.up, -sp.up * 0.45, 46, 46] }) },
          { rotate: a.interpolate({ inputRange: [0, 0.35, 0.55, 0.85, 1], outputRange: [`${tilt}deg`, `${tilt}deg`, `${(tilt + fall) / 2}deg`, `${fall}deg`, '0deg'] }) },
          { scaleY: a.interpolate({ inputRange: [0, 0.15, 0.45, 0.85, 0.9, 1], outputRange: [0.5, 1.7, 1.05, 1.5, 0.45, 0.4] }) },
          { scaleX: a.interpolate({ inputRange: [0, 0.15, 0.45, 0.85, 0.9, 1], outputRange: [0.5, 0.75, 1, 0.8, 1.6, 1.7] }) },
        ],
      }]}
    >
      <HoneyBody w={sp.size} h={sp.size} gold={sp.gold} />
    </Animated.View>
  );
}

function HoneyPot() {
  const { act, s, d } = useGame();
  const scale = useRef(new Animated.Value(1)).current;
  const [pops, setPops] = useState<Pop[]>([]);
  const [splashes, setSplashes] = useState<Splash[]>([]);
  const glow = useRef(new Animated.Value(1)).current;

  const splash = (lucky: boolean) => {
    const make = (kind: Splash['kind'], extra: Partial<Splash> = {}): Splash => ({
      id: ++popId, kind, dx: 0, up: 0, size: 0, side: 1, gold: lucky, anim: new Animated.Value(0), ...extra,
    });
    // A lucky tap is golden honey, a touch more of it, and a soft glow round the pot
    // rather than a bigger burst, so it still feels calm. The light version splashes less.
    const light = lightEffects(s.settings.effects);
    const goo: Splash[] = [make('glob', { size: lucky ? 28 : 26 })];
    for (let i = 0; i < (light ? 2 : lucky ? 4 : 3); i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      goo.push(make('blob', { dx: side * (18 + Math.random() * (lucky ? 56 : 50)), up: 40 + Math.random() * (lucky ? 40 : 35), size: (lucky ? 13 : 12) + Math.random() * 5 }));
    }
    if (!light && (lucky || Math.random() < 0.4)) goo.push(make('drip', { side: Math.random() < 0.5 ? -1 : 1, size: 9 }));
    // Rapid tapping keeps it to a sensible amount of honey on screen.
    setSplashes((sp) => [...sp.slice(-24), ...goo]);
    for (const g of goo) {
      Animated.timing(g.anim, { toValue: 1, duration: GOO_MS[g.kind] * (0.9 + Math.random() * 0.2), easing: Easing.linear, useNativeDriver: nativeDriver })
        .start(() => setSplashes((sp) => sp.filter((x) => x.id !== g.id)));
    }
  };
  const v = varietyAt(s.variety);

  const onTap = () => {
    const before = d.tapValue;
    const value = act((st, now) => tap(st, now));
    const lucky = value > before * 1.5;
    playTap(lucky);
    splash(lucky);
    if (lucky) {
      glow.setValue(0);
      Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start();
    }
    buzz();
    scale.setValue(0.86);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 160, useNativeDriver: nativeDriver }).start();
    const id = ++popId;
    const anim = new Animated.Value(0);
    setPops((p) => [...p.slice(-10), { id, x: 10 + Math.random() * 70, text: `+${fmt(value)}`, anim, lucky }]);
    Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver })
      .start(() => setPops((p) => p.filter((q) => q.id !== id)));
  };

  return (
    <View style={styles.potWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, {
          opacity: glow.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }),
          transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] }) }],
        }]}
      />
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
      {splashes.map((sp) => <Goo key={sp.id} sp={sp} />)}
      {pops.map((p) => (
        <Animated.Text
          key={p.id}
          pointerEvents="none"
          style={[styles.pop, p.lucky && styles.popLucky, {
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
  // The bar runs to the very bottom of the screen, its contents kept clear of the iPhone's home bar.
  const { bottom } = useSafeAreaInsets();
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
    <View style={[styles.header, { backgroundColor: v.color, paddingBottom: 12 + bottom }]}>
      <View style={styles.info}>
        <Text style={styles.honey} numberOfLines={1} adjustsFontSizeToFit>{fmt(s.honey)}</Text>
        <Text style={styles.unit}>{v.emoji} {v.name}</Text>
        <Text style={styles.rate}>+{fmt(d.hps)}/s  ·  👆 +{fmt(d.tapValue)}</Text>
        {combs > 0 && <Text style={styles.combs}>✨ {fmt(combs)} Golden Honeycombs (+{fmt(combs * combPower(s) * 100)}%)</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, zIndex: 10 },
  goo: { position: 'absolute' },
  gooBody: { borderWidth: 1.5, overflow: 'hidden', shadowColor: '#5A3200', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  gooCore: { position: 'absolute', left: '22%', right: '22%', top: '30%', bottom: '14%', opacity: 0.75 },
  gooShine: { position: 'absolute', left: '18%', top: '14%', backgroundColor: 'rgba(255,255,255,0.85)' },
  potWrap: { width: 112, height: 112, marginLeft: 12, zIndex: 20 },
  pot: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  potArt: { width: 100, height: 100, marginTop: -4 },
  potBear: { position: 'absolute', bottom: -2, right: -2 },
  glow: { position: 'absolute', left: 0, top: 0, width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFD75E' },
  popLucky: { color: '#FFE07A' },
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
