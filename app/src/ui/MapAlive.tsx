// Small moving things and things to poke on the map: day and night, buzzing bees,
// chimney smoke, a stick on the river, birds, fireflies, and hidden secrets.
// Positions are in map coordinates (see PLACES in WoodMap), scaled by k.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { findSecret, mapTreat, SECRETS, treatReady, treatWait } from '../game/extras';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { nativeDriver } from './kit';
import { PLACES } from './WoodMap';
import { play } from '../audio/sound';

/** How dark the wood is at this hour (real local time). Evening is dusk; lamps go on then. */
export function skyAt(now: number): { tint: string; dark: 'day' | 'evening' | 'night' } {
  const h = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  if (h >= 20.5 || h < 5.5) return { tint: 'rgba(14,22,72,0.46)', dark: 'night' };
  if (h < 7.5) return { tint: 'rgba(255,170,120,0.14)', dark: 'day' };
  if (h >= 18) return { tint: 'rgba(255,135,80,0.16)', dark: 'evening' };
  return { tint: 'transparent', dark: 'day' };
}

/** A value looping 0 → 1 forever. */
function useLoop(ms: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: nativeDriver }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, ms, delay]);
  return v;
}

const BUBBLE_W = 180;
/** Bubbles for things closer than this to the top of the map hang below them, clear of the chips along the top. */
export const TOP_ROOM = 150;
const EDGE = 8;

/**
 * A speech bubble over a character or spot `anchor` wide. It starts centred above
 * it and slides sideways if that would run it off the screen (homes near the edge,
 * or the zoomed-in map). Near the top of the map it hangs `below` instead.
 */
export function Speech({ text, anchor, below }: { text: string; anchor: number; below?: boolean }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const { width } = useWindowDimensions();
  const [shift, setShift] = useState<number | null>(null);
  const fit = () => ref.current?.measureInWindow((x, _y, w) => {
    if (x < EDGE) setShift(EDGE - x);
    else if (x + w > width - EDGE) setShift(width - EDGE - (x + w));
    else setShift(0);
  });
  return (
    <View
      ref={ref}
      onLayout={shift === null ? fit : undefined}
      style={[styles.bubble, below ? styles.bubbleBelow : styles.bubbleAbove, { left: anchor / 2 - BUBBLE_W / 2, opacity: shift === null ? 0 : 1, transform: [{ translateX: shift ?? 0 }] }]}
    >
      <Text style={styles.bubbleText}>{text}</Text>
    </View>
  );
}

// ---------- bees round the Bee Tree ----------

const HIVE = { x: PLACES.beetree.x + 8, y: PLACES.beetree.y - 62 };
const CIRCLE = Array.from({ length: 9 }, (_, i) => (i / 8) * Math.PI * 2);

function Bee({ k, ms, r, phase }: { k: number; ms: number; r: number; phase: number }) {
  const v = useLoop(ms);
  const input = CIRCLE.map((_, i) => i / 8);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.abs, {
        fontSize: Math.max(9, 12 * k),
        transform: [
          { translateX: v.interpolate({ inputRange: input, outputRange: CIRCLE.map((a) => (HIVE.x + Math.cos(a + phase) * r) * k) }) },
          { translateY: v.interpolate({ inputRange: input, outputRange: CIRCLE.map((a) => (HIVE.y + Math.sin(a + phase) * r * 0.55) * k) }) },
        ],
      }]}
    >
      🐝
    </Animated.Text>
  );
}

function BeeSwarm({ k }: { k: number }) {
  const { act, toast, save } = useGame();
  const poke = () => {
    play('buzz');
    const honey = act((g, t) => mapTreat(g, 'bees', t));
    if (honey) save();
    toast(honey ? `🐝 The bees buzz happily and share a little honey. +${fmt(honey)}` : '🐝 Bzzz! (They are very busy.)');
  };
  return (
    <>
      <Bee k={k} ms={3200} r={22} phase={0} />
      <Bee k={k} ms={4100} r={30} phase={2} />
      <Bee k={k} ms={5300} r={16} phase={4} />
      <Pressable onPress={poke} hitSlop={6} accessibilityLabel="The bees" style={[styles.abs, { left: (HIVE.x - 30) * k, top: (HIVE.y - 18) * k, width: 60 * k, height: 36 * k }]} />
    </>
  );
}

// ---------- chimney smoke at Kanga's ----------

const CHIMNEY = { x: PLACES.kitchen.x + 13, y: PLACES.kitchen.y - 60 };

function Puff({ k, delay }: { k: number; delay: number }) {
  const v = useLoop(3600, delay);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.puff, {
        left: CHIMNEY.x * k - 5, top: CHIMNEY.y * k - 5, width: 10, height: 10,
        opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -34 * k] }) },
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 10 * k] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) },
        ],
      }]}
    />
  );
}

// ---------- a stick floating down the river ----------

// The big river, from where the streams meet down past Poohsticks Bridge to the bottom.
const RIVER: [number, number][] = [
  [255, 232], [262, 330], [258, 400], [235, 475], [250, 530], [290, 562], [320, 610], [318, 650],
  [305, 710], [292, 760], [318, 820], [322, 880], [302, 940], [312, 1000], [334, 1050],
];
const RIVER_MS = 70_000;

function RiverStick({ k }: { k: number }) {
  const { s, act, toast, save } = useGame();
  const v = useRef(new Animated.Value(0)).current;
  const [caught, setCaught] = useState(() => !treatReady(s, 'stick', Date.now()));
  useEffect(() => {
    if (caught) return;
    v.setValue(0);
    const run = Animated.timing(v, { toValue: 1, duration: RIVER_MS, easing: Easing.linear, useNativeDriver: nativeDriver });
    run.start(({ finished }) => { if (finished) setCaught((c) => { if (!c) { v.setValue(0); run.reset(); run.start(); } return c; }); });
    return () => run.stop();
  }, [v, caught]);
  useEffect(() => {
    if (!caught) return;
    // A new stick comes along once the last one's rest is over.
    const id = setTimeout(() => setCaught(false), (treatWait(s, 'stick', Date.now()) + 1) * 1000);
    return () => clearTimeout(id);
  }, [caught, s]);
  if (caught) return null;
  const input = RIVER.map((_, i) => i / (RIVER.length - 1));
  const catchIt = () => {
    setCaught(true);
    play('pop');
    const honey = act((g, t) => mapTreat(g, 'stick', t));
    if (honey) save();
    if (honey) toast(`🥢 You fished a Poohstick out of the river! +${fmt(honey)} honey`);
  };
  return (
    <Animated.View
      style={[styles.abs, {
        transform: [
          { translateX: v.interpolate({ inputRange: input, outputRange: RIVER.map(([x]) => x * k - 14) }) },
          { translateY: v.interpolate({ inputRange: input, outputRange: RIVER.map(([, y]) => y * k - 14) }) },
        ],
      }]}
    >
      <Pressable onPress={catchIt} hitSlop={10} accessibilityLabel="A stick on the river" style={styles.stick}>
        <Text style={{ fontSize: Math.max(12, 16 * k), transform: [{ rotate: '35deg' }] }}>🥢</Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------- birds by day, fireflies by night ----------

function Bird({ k, y, ms, delay }: { k: number; y: number; ms: number; delay: number }) {
  const v = useLoop(ms, delay);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.abs, {
        fontSize: Math.max(10, 14 * k),
        opacity: v.interpolate({ inputRange: [0, 0.05, 0.25, 0.95, 1], outputRange: [0, 1, 1, 1, 0] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [-30, 620 * k, 620 * k] }) },
          { translateY: v.interpolate({ inputRange: [0, 0.06, 0.12, 0.18, 0.25, 1], outputRange: [y * k, (y - 8) * k, y * k, (y - 8) * k, y * k, y * k] }) },
          { scaleX: -1 },
        ],
      }]}
    >
      🐦
    </Animated.Text>
  );
}

const FIREFLIES: [number, number][] = [[240, 380], [300, 420], [350, 380], [120, 670], [180, 690], [420, 735], [460, 920], [60, 990], [520, 380], [230, 900]];

function Firefly({ k, x, y, i }: { k: number; x: number; y: number; i: number }) {
  const v = useLoop(2400 + (i % 4) * 500, i * 300);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.firefly, {
        left: x * k, top: y * k,
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 1, 0.15] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] }) }],
      }]}
    />
  );
}

// ---------- lights in the homes ----------

// Windows and doorways in each home's drawing (offsets from the centre of its base).
const WINDOWS: Record<string, [number, number][]> = {
  pooh: [[0, -12]], haycorn: [[-2.5, -32]], kitchen: [[-14.5, -19], [13.5, -19]], oak: [[10, -14], [30, -46]],
  works: [[0, -15], [0, -88]], garden: [[0, -10]], thistle: [[0, -8]], ranch: [[0, -12]], heffalump: [[0, -6]],
  bridge: [[-30, -8]], floody: [[0, -10]], galleons: [[0, -10]], camp: [[0, -10]], pines: [[0, -10]], beetree: [[2, -30]],
};

function HomeLight({ k, x, y, bright, i }: { k: number; x: number; y: number; bright: boolean; i: number }) {
  // A gentle flicker, like a lamp or a fire inside.
  const v = useLoop(1800 + (i % 5) * 370, (i % 7) * 200);
  const glow = 22 * k;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.abs, {
        left: x * k - glow / 2, top: y * k - glow / 2, width: glow, height: glow, alignItems: 'center', justifyContent: 'center',
        opacity: v.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: bright ? [0.85, 1, 0.75, 0.85] : [0.45, 0.6, 0.4, 0.45] }),
      }]}
    >
      <View style={[styles.halo, { width: glow, height: glow, borderRadius: glow / 2 }]} />
      <View style={[styles.lamp, { width: Math.max(4, 6 * k), height: Math.max(4, 6 * k) }]} />
    </Animated.View>
  );
}

function HomeLights({ k, bright }: { k: number; bright: boolean }) {
  const { s } = useGame();
  const homes = Object.keys(PLACES).filter((id) => id === 'pooh' || s.biz[id]?.owned > 0);
  let i = 0;
  return (
    <>
      {homes.flatMap((id) => (WINDOWS[id] || [[0, -10]]).map(([dx, dy]) => (
        <HomeLight key={`${id}${dx}${dy}`} k={k} x={PLACES[id].x + dx} y={PLACES[id].y + dy} bright={bright} i={i++} />
      )))}
    </>
  );
}

// ---------- hidden secrets ----------

function Secrets({ k }: { k: number }) {
  const { s, act, toast } = useGame();
  const twinkle = useLoop(2600);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setOpen(null), 5_000);
    return () => clearTimeout(id);
  }, [open]);
  const size = Math.max(30, 40 * k);
  return (
    <>
      {SECRETS.map((x) => {
        const found = s.secrets.includes(x.id);
        const tap = () => {
          setOpen(x.id);
          if (found) return play('tick');
          const honey = act((g, t) => findSecret(g, x.id, t));
          play('unlock');
          toast(`🔍 You found a secret! +${fmt(honey)} honey (${s.secrets.length}/${SECRETS.length})`);
        };
        return (
          <View key={x.id} style={[styles.abs, { left: x.x * k - size / 2, top: x.y * k - size / 2, width: size, height: size, zIndex: open === x.id ? 5 : 1 }]}>
            {open === x.id && <Speech key={x.id} text={x.text} anchor={size} below={x.y * k < TOP_ROOM} />}
            <Pressable onPress={tap} style={styles.secret} accessibilityLabel={found ? x.text : 'Something sparkles here'}>
              {found
                ? <Text style={{ fontSize: Math.max(13, 18 * k) }}>{x.emoji}</Text>
                : <Animated.Text style={{ fontSize: Math.max(10, 13 * k), opacity: twinkle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.7, 0.15] }) }}>✨</Animated.Text>}
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

/** Everything above, drawn over the map. `now` decides day or night. */
export function MapAlive({ k, now }: { k: number; now: number }) {
  const sky = skyAt(now);
  return (
    <>
      {sky.dark !== 'day' && <HomeLights k={k} bright={sky.dark === 'night'} />}
      {sky.dark !== 'day' && FIREFLIES.map(([x, y], i) => <Firefly key={i} k={k} x={x} y={y} i={i} />)}
      {sky.dark !== 'night' && <><Bird k={k} y={60} ms={40_000} delay={3_000} /><Bird k={k} y={600} ms={55_000} delay={20_000} /></>}
      <Puff k={k} delay={0} />
      <Puff k={k} delay={1200} />
      <Puff k={k} delay={2400} />
      <BeeSwarm k={k} />
      <RiverStick k={k} />
      <Secrets k={k} />
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  puff: { position: 'absolute', borderRadius: 5, backgroundColor: '#D6D0C4' },
  stick: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: 'rgba(255,205,100,0.35)' },
  lamp: { borderRadius: 2, backgroundColor: '#FFD866', borderWidth: 0.5, borderColor: '#C98A1E' },
  firefly: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFE87A', shadowColor: '#FFE87A', shadowOpacity: 1, shadowRadius: 6 },
  secret: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubbleAbove: { bottom: '100%', marginBottom: 4 },
  bubbleBelow: { top: '100%', marginTop: 4 },
  bubble: { position: 'absolute', width: BUBBLE_W, zIndex: 5, backgroundColor: 'white', borderRadius: 12, padding: 8, borderWidth: 1.5, borderColor: '#D9C48E' },
  bubbleText: { fontSize: 13, color: '#4B3A26', fontWeight: '600' },
});
