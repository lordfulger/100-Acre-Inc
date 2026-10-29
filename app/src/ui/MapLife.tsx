// Life on the map, drawn over the (memoized) WoodMap: the season's tint, holiday
// decorations, projects built together, and friends wandering between homes.
// Weather falls over the whole screen, separately, so it doesn't scroll away.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { activeEvent, PROJECT_LOOKS, seasonAt, SEASONS, weatherAt } from '../game/calendar';
import { chatter, resident } from '../game/extras';
import { GameState } from '../game/engine';
import { nativeDriver } from './kit';
import { Portrait } from './Portrait';
import { HAND, MAP_H, MAP_W, PLACES } from './WoodMap';
import { MapAlive, Speech, TOP_ROOM } from './MapAlive';

// Open spots on the map for holiday decorations.
const HOLIDAY_SPOTS: [number, number][] = [
  [140, 250], [260, 160], [395, 330], [560, 250], [40, 430], [250, 520], [420, 600], [110, 600], [560, 620], [250, 800], [560, 900], [420, 1040],
];

function Wanderer({ home, to, k, delay }: { home: string; to: string; k: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const [line, setLine] = useState<string | null>(null);
  const who = resident(home);
  useEffect(() => {
    const walk = (toValue: number) => Animated.timing(v, { toValue, duration: 26_000 + delay * 3, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver });
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), walk(1), Animated.delay(4_000), walk(0), Animated.delay(6_000)]));
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  useEffect(() => {
    if (!line) return;
    const id = setTimeout(() => setLine(null), 4_500);
    return () => clearTimeout(id);
  }, [line]);
  const a = PLACES[home];
  const b = PLACES[to];
  const size = Math.max(22, 30 * k);
  // Walk alongside the homes rather than through their front doors.
  const x = v.interpolate({ inputRange: [0, 1], outputRange: [(a.x + 34) * k - size / 2, (b.x - 34) * k - size / 2] });
  const y = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [(a.y + 14) * k - size, ((a.y + b.y) / 2 + 26) * k - size, (b.y + 14) * k - size] });
  return (
    <Animated.View style={[styles.wanderer, { transform: [{ translateX: x }, { translateY: y }] }]}>
      {line && <Speech key={line} text={line} anchor={size} below={Math.min(a.y, b.y) * k < TOP_ROOM} />}
      <Pressable onPress={() => setLine(chatter(home))} hitSlop={10} accessibilityLabel={`Talk to ${who.name}`}>
        <Portrait id={who.portrait} size={size} />
      </Pressable>
    </Animated.View>
  );
}

/** Friends who live in homes with a manager stroll to a neighbour's and back. */
export function wanderers(s: GameState) {
  const homes = ['pooh', ...Object.keys(PLACES).filter((id) => id !== 'pooh' && s.biz[id]?.managed)];
  const near = (id: string) => {
    const p = PLACES[id];
    return Object.keys(PLACES).filter((o) => o !== id).sort((x, y) => Math.hypot(PLACES[x].x - p.x, PLACES[x].y - p.y) - Math.hypot(PLACES[y].x - p.x, PLACES[y].y - p.y))[0];
  };
  // Pooh, plus the two most recently hired friends.
  return [homes[0], ...homes.slice(1).slice(-2)].map((home) => ({ home, to: near(home) }));
}

export function MapLife({ s, width, now }: { s: GameState; width: number; now: number }) {
  const k = width / MAP_W;
  const season = SEASONS[seasonAt(now)];
  const event = activeEvent(now);
  const walkers = wanderers(s);
  const walkKey = walkers.map((w) => w.home).join(',');
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { width, height: MAP_H * k }]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: season.tint }]} />
      {event && HOLIDAY_SPOTS.map(([x, y], i) => (
        <Text key={i} pointerEvents="none" style={[styles.spot, { left: x * k - 10, top: y * k - 10, fontSize: Math.max(14, 20 * k) }]}>{i % 3 === 2 ? event.emoji : event.mapEmoji}</Text>
      ))}
      {s.projects.filter((id) => PROJECT_LOOKS[id]).map((id) => {
        const p = PROJECT_LOOKS[id];
        const at = PLACES[p.near];
        return (
          <View key={id} pointerEvents="none" style={[styles.project, { left: (at.x + p.dx) * k - 30, top: (at.y + p.dy) * k - 24 }]}>
            <Text style={{ fontSize: Math.max(18, 28 * k) }}>{p.emoji}</Text>
            <Text style={[styles.projectName, { fontSize: Math.max(8, 10 * k) }]}>{p.name}</Text>
          </View>
        );
      })}
      <MapAlive k={k} now={now} />
      <React.Fragment key={walkKey}>
        {walkers.map((w, i) => <Wanderer key={w.home} home={w.home} to={w.to} k={k} delay={i * 7_000} />)}
      </React.Fragment>
    </View>
  );
}

// ---------- weather ----------

// Kept light: on the web every flake is moved by the page itself, which costs phones battery.
const FALL: Record<string, { n: number; ms: number; drift: number; size: number }> = {
  rain: { n: 14, ms: 1_400, drift: 20, size: 11 },
  snow: { n: 14, ms: 9_000, drift: 40, size: 14 },
  windy: { n: 10, ms: 5_000, drift: 260, size: 16 },
  clear: { n: 6, ms: 14_000, drift: 60, size: 15 },
};

function Flake({ char, w, h, ms, drift, size, i }: { char: string; w: number; h: number; ms: number; drift: number; size: number; i: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const x0 = useMemo(() => Math.random() * w, [w]);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms * (0.8 + Math.random() * 0.4), easing: Easing.linear, useNativeDriver: nativeDriver }));
    const start = setTimeout(() => loop.start(), (i * ms) / 8);
    return () => { clearTimeout(start); loop.stop(); };
  }, [v, ms, i]);
  return (
    <Animated.Text
      style={[styles.flake, {
        fontSize: size, left: x0,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-30, h + 30] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, drift * 0.6, drift] }) },
        ],
      }]}
    >
      {char}
    </Animated.Text>
  );
}

export function Weather({ now }: { now: number }) {
  const { width, height } = useWindowDimensions();
  const weather = weatherAt(now);
  const season = SEASONS[seasonAt(now)];
  const char = weather === 'rain' ? '💧' : weather === 'snow' ? '❄️' : weather === 'windy' ? '🍂' : season.particle;
  const f = FALL[weather];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {Array.from({ length: f.n }, (_, i) => (
        <Flake key={`${weather}${i}`} char={char} w={width} h={height} ms={f.ms} drift={weather === 'windy' ? -f.drift : f.drift} size={f.size} i={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  spot: { position: 'absolute' },
  project: { position: 'absolute', width: 60, alignItems: 'center' },
  projectName: { fontFamily: HAND, color: '#4B3A26', textAlign: 'center', backgroundColor: 'rgba(255,250,232,0.85)', borderRadius: 6, paddingHorizontal: 3 },
  wanderer: { position: 'absolute', left: 0, top: 0, alignItems: 'center' },
  flake: { position: 'absolute', top: 0, opacity: 0.8 },
});
