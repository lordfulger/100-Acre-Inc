// One game for each home that didn't have one yet. They all report a score when done.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, buzz, C } from './kit';
import { Shell, useFrames } from './Minigames';
import { HAND } from './WoodMap';
import { Portrait, PortraitId } from './Portrait';
import { play } from '../audio/sound';

type GameProps = { onDone: (score: number) => void; onQuit: () => void };
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5);

/** Ends the game once, a moment after `over` turns true (so the last frame shows). */
function useFinish(over: boolean, score: number, onDone: (n: number) => void, delay = 900) {
  const done = useRef(false);
  useEffect(() => {
    if (!over || done.current) return;
    done.current = true;
    const id = setTimeout(() => onDone(score), delay);
    return () => clearTimeout(id);
  }, [over, score, onDone, delay]);
}

const lives = (left: number, of = 3) => '❤️'.repeat(Math.max(0, left)) + '🤍'.repeat(Math.max(0, of - left));

// ---------- Pooh: Stoutness Exercises ----------

export function Stretch({ onDone, onQuit }: GameProps) {
  const g = useRef({ score: 0, misses: 0, zone: 0.4, speed: 2.2, phase: 0, last: 0 }).current;
  const t = useFrames(g.misses < 3);
  g.phase += (t - g.last) * g.speed;
  g.last = t;
  const pos = (Math.sin(g.phase) + 1) / 2;
  const width = Math.max(0.1, 0.24 - g.score * 0.008);
  useFinish(g.misses >= 3, g.score, onDone);
  const stretch = () => {
    if (g.misses >= 3) return;
    if (pos >= g.zone && pos <= g.zone + width) {
      g.score++;
      g.speed += 0.18;
      g.zone = Math.random() * (1 - width);
      play('pop');
    } else { g.misses++; play('oops'); buzz('medium'); }
  };
  return (
    <Shell id="stretch" score={`🏋️ ${g.score}`} right={lives(3 - g.misses)} onQuit={onQuit}>
      <View style={styles.center}>
        {/* Pooh stretches up and squats down with the marker. */}
        <View style={{ height: 130, justifyContent: 'flex-end', opacity: g.misses >= 3 ? 0.5 : 1, transform: [{ translateY: -pos * 18 }, { scaleY: 0.92 + pos * 0.14 }] }}>
          <Portrait id="pooh" size={110} />
        </View>
        <Text style={styles.prompt}>Up, down… and stretch when the marker's in the green!</Text>
        <View style={styles.meter}>
          <View style={[styles.zone, { left: `${g.zone * 100}%`, width: `${width * 100}%` }]} />
          <View style={[styles.needle, { left: `${pos * 100}%` }]} />
        </View>
        <Button label="Stretch!" onPress={stretch} style={{ marginTop: 16, minWidth: 200 }} />
      </View>
    </Shell>
  );
}

// ---------- Owl: Spelling Bee ----------

const WORDS: [string, string, string][] = [
  ['HONEY', 'HUNNY', 'HONNY'], ['TUESDAY', 'TWOSDAY', 'TEUSDAY'], ['BIRTHDAY', 'BIRFDAY', 'BIRTHDY'], ['HEFFALUMP', 'HEFALUMP', 'HEFFALUMPH'],
  ['EXPEDITION', 'EXPOTITION', 'EXPIDITION'], ['WOOZLE', 'WOOSLE', 'WUZZLE'], ['BALLOON', 'BALOON', 'BALLOOON'], ['PICNIC', 'PIKNICK', 'PICKNIC'],
  ['ANSWER', 'RNSER', 'ANSWERE'], ['REQUIRED', 'REQIRD', 'REQUIERD'], ['FRIENDS', 'FRENDS', 'FREINDS'], ['RELATIONS', 'RALETIONS', 'RELASHUNS'],
  ['THISTLE', 'THISSEL', 'THISTEL'], ['BRIDGE', 'BRIGE', 'BRIDJE'], ['GOLDEN', 'GOLDUN', 'GOALDEN'], ['WEATHER', 'WETHER', 'WEATHUR'],
  ['SPELLING', 'SPELING', 'SPELLIN'], ['BOUNCY', 'BOUNSY', 'BOWNCY'], ['GLOOMY', 'GLOOMEY', 'GLUMY'], ['BREAKFAST', 'BREKFAST', 'BRAKEFAST'],
  ['CARROTS', 'CARRITS', 'CAROTS'], ['LANTERN', 'LANTURN', 'LANTEN'], ['PRESENT', 'PRESANT', 'PREZENT'], ['SNOWFLAKE', 'SNOWFLAIK', 'SNOFLAKE'],
];
const SPELL_SECS = 40;

export function Spelling({ onDone, onQuit }: GameProps) {
  const [deck] = useState(() => shuffle(WORDS));
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const t = useFrames(true);
  const left = Math.max(0, SPELL_SECS - t);
  const word = deck[i % deck.length];
  const [options, setOptions] = useState(() => shuffle(deck[0]));
  useFinish(left <= 0, score, onDone, 300);
  const answer = (w: string) => {
    if (left <= 0) return;
    const right = w === word[0];
    if (right) { setScore((n) => n + 1); play('pop'); } else { play('oops'); buzz('medium'); }
    setFlash(right ? '✓' : `It's ${word[0]}`);
    setTimeout(() => setFlash(null), 600);
    setI(i + 1);
    setOptions(shuffle(deck[(i + 1) % deck.length]));
  };
  return (
    <Shell id="spelling" score={`✏️ ${score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <View style={styles.center}>
        <Portrait id="owl" size={90} />
        <Text style={styles.prompt}>“Which of these is spelled properly? I wrote all three.”</Text>
        {options.map((w) => (
          <Pressable key={w} onPress={() => answer(w)} style={styles.choice}><Text style={styles.choiceText}>{w}</Text></Pressable>
        ))}
        <Text style={styles.flash}>{flash || ' '}</Text>
      </View>
    </Shell>
  );
}

// ---------- Kanga: Roo's Bounce ----------

export function Bounce({ onDone, onQuit }: GameProps) {
  const [h, setH] = useState(0);
  const g = useRef({ jumpAt: -9, rocks: [] as { x: number; passed: boolean }[], next: 1.2, score: 0, over: false, last: 0, speed: 0.38 }).current;
  const t = useFrames(h > 0 && !g.over);
  const air = t - g.jumpAt;
  const height = air < 0.75 ? Math.sin((air / 0.75) * Math.PI) : 0; // 0..1
  if (h > 0 && !g.over) {
    const dt = Math.min(0.1, t - g.last);
    g.last = t;
    g.speed = 0.38 + t / 120;
    if (t >= g.next) { g.rocks.push({ x: 1.1, passed: false }); g.next = t + Math.max(0.9, 1.9 - t / 40) + Math.random() * 0.8; }
    for (const r of g.rocks) {
      r.x -= g.speed * dt;
      if (!r.passed && r.x < 0.14) { r.passed = true; g.score++; }
      if (r.x > 0.16 && r.x < 0.26 && height < 0.35) { g.over = true; play('oops'); buzz('medium'); }
    }
    g.rocks = g.rocks.filter((r) => r.x > -0.1);
  }
  useFinish(g.over, g.score, onDone);
  const jump = () => { if (!g.over && t - g.jumpAt > 0.75) { g.jumpAt = t; play('tick'); } };
  return (
    <Shell id="bounce" score={`🪨 ${g.score}`} onQuit={onQuit}>
      <View style={[styles.field, { backgroundColor: '#E6F2D6' }]} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        <Pressable style={StyleSheet.absoluteFill} onPressIn={jump} />
        <Text pointerEvents="none" style={styles.hint}>{g.over ? 'Bump! Roo needs a cuddle.' : 'Tap anywhere to jump'}</Text>
        <View pointerEvents="none" style={[styles.ground, { top: h * 0.7 }]} />
        {/* Mirrored: the portrait looks left, and Roo should face the stones coming from the right. */}
        <View pointerEvents="none" style={[styles.actor, { left: '12%', top: h * 0.7 - 60 - height * h * 0.32, transform: [{ scaleX: -1 }] }]}><Portrait id="roo" size={58} /></View>
        {g.rocks.map((r, i) => <Text key={i} pointerEvents="none" style={[styles.actor, { left: `${r.x * 100}%`, top: h * 0.7 - 40, fontSize: 32 }]}>🪨</Text>)}
      </View>
    </Shell>
  );
}

// ---------- Eeyore: Find the Tail ----------

export function Tail({ onDone, onQuit }: GameProps) {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<'show' | 'shuffle' | 'pick' | 'over'>('show');
  const [chosen, setChosen] = useState<number | null>(null);
  const xs = useRef([0, 1, 2].map((i) => new Animated.Value(i))).current;
  const slots = useRef([0, 1, 2]).current; // slot of each bush
  const tailBush = 1;
  useFinish(phase === 'over', round - 1, onDone, 1400);
  useEffect(() => {
    if (phase !== 'show') return;
    const id = setTimeout(() => setPhase('shuffle'), 1300);
    return () => clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'shuffle') return;
    let cancelled = false;
    const swaps = 3 + round * 2;
    const ms = Math.max(170, 520 - round * 45);
    const step = (n: number) => {
      if (cancelled) return;
      if (n === 0) { setPhase('pick'); return; }
      const a = Math.floor(Math.random() * 3);
      const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      const ba = slots.indexOf(a);
      const bb = slots.indexOf(b);
      slots[ba] = b; slots[bb] = a;
      Animated.parallel([
        Animated.timing(xs[ba], { toValue: b, duration: ms, useNativeDriver: false }),
        Animated.timing(xs[bb], { toValue: a, duration: ms, useNativeDriver: false }),
      ]).start(() => step(n - 1));
    };
    step(swaps);
    return () => { cancelled = true; };
  }, [phase, round, xs, slots]);
  const choose = (bush: number) => {
    if (phase !== 'pick') return;
    setChosen(bush);
    if (bush === tailBush) {
      play('pop');
      buzz('success');
      setTimeout(() => { setChosen(null); setRound((r) => r + 1); setPhase('show'); }, 900);
    } else { play('oops'); setPhase('over'); }
  };
  const reveal = phase === 'show' || phase === 'over' || chosen !== null;
  return (
    <Shell id="tail" score={`🎀 ${round - 1}`} onQuit={onQuit}>
      <View style={styles.center}>
        <Portrait id="eeyore" size={84} />
        <Text style={styles.prompt}>
          {phase === 'show' ? 'The tail is under this bush. Keep your eye on it…' : phase === 'shuffle' ? 'Shuffling…' : phase === 'pick' ? 'Which bush has the tail?' : '“Oh well. It was a nice tail.”'}
        </Text>
        <View style={styles.bushes}>
          {[0, 1, 2].map((bush) => (
            <Animated.View key={bush} style={[styles.bush, { left: xs[bush].interpolate({ inputRange: [0, 2], outputRange: ['2%', '68%'] }) }]}>
              <Pressable onPress={() => choose(bush)} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 26, opacity: reveal && bush === tailBush ? 1 : 0 }}>🎀</Text>
                <Text style={{ fontSize: 64 }}>🌿</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>
    </Shell>
  );
}

// ---------- Tigger: Balloons ----------

type Floater = { id: number; x: number; y: number; v: number; kind: 'red' | 'gold' | 'bee' };
const BALLOON_SECS = 30;

export function Balloons({ onDone, onQuit }: GameProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const g = useRef({ items: [] as Floater[], next: 0, score: 0, id: 0, last: 0 }).current;
  const t = useFrames(size.w > 0);
  const left = Math.max(0, BALLOON_SECS - t);
  if (size.w > 0 && left > 0) {
    const dt = Math.min(0.1, t - g.last);
    g.last = t;
    if (t >= g.next) {
      const r = Math.random();
      g.items.push({ id: g.id++, x: 0.08 + Math.random() * 0.84, y: 1.05, v: 0.2 + t / 90 + Math.random() * 0.12, kind: r < 0.15 ? 'bee' : r < 0.27 ? 'gold' : 'red' });
      g.next = t + Math.max(0.3, 0.7 - t / 70);
    }
    for (const it of g.items) it.y -= it.v * dt;
    g.items = g.items.filter((it) => it.y > -0.12);
  }
  useFinish(left <= 0, g.score, onDone, 200);
  const popIt = (id: number) => {
    const it = g.items.find((x) => x.id === id);
    if (!it || left <= 0) return;
    g.items = g.items.filter((x) => x.id !== id);
    if (it.kind === 'bee') { g.score = Math.max(0, g.score - 2); play('oops'); buzz('medium'); }
    else { g.score += it.kind === 'gold' ? 3 : 1; play('pop'); }
  };
  return (
    <Shell id="balloons" score={`🎈 ${g.score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <View style={[styles.field, { backgroundColor: '#E3F0FA' }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {g.items.map((it) => (
          <Pressable key={it.id} onPressIn={() => popIt(it.id)} hitSlop={8} style={[styles.floater, { left: it.x * size.w - 24, top: it.y * size.h }]}>
            <Text style={{ fontSize: 40 }}>{it.kind === 'bee' ? '🐝' : it.kind === 'gold' ? '🌟' : '🎈'}</Text>
          </Pressable>
        ))}
        <View pointerEvents="none" style={[styles.actor, { bottom: 8, left: '50%', marginLeft: -28 }]}><Portrait id="tigger" size={56} /></View>
      </View>
    </Shell>
  );
}

// ---------- Christopher Robin: Counting Pots ----------

const COUNT_SECS = 45;

export function CountPots({ onDone, onQuit }: GameProps) {
  const makeRound = (n: number) => {
    const count = 3 + Math.floor(Math.random() * Math.min(10, 3 + n));
    const spots = shuffle(Array.from({ length: 20 }, (_, i) => i)).slice(0, count);
    const wrong = shuffle([count - 2, count - 1, count + 1, count + 2].filter((x) => x > 0)).slice(0, 2);
    return { count, spots, options: shuffle([count, ...wrong]), shownAt: Date.now() };
  };
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(() => makeRound(0));
  const [flash, setFlash] = useState<string | null>(null);
  const t = useFrames(true);
  const left = Math.max(0, COUNT_SECS - t);
  const showing = Date.now() - round.shownAt < Math.max(700, 1600 - score * 60);
  useFinish(left <= 0, score, onDone, 300);
  const answer = (n: number) => {
    if (left <= 0) return;
    const right = n === round.count;
    if (right) { setScore((x) => x + 1); play('pop'); } else { play('oops'); }
    setFlash(right ? '✓ Right!' : `There were ${round.count}`);
    setTimeout(() => setFlash(null), 700);
    setRound(makeRound(score + (right ? 1 : 0)));
  };
  return (
    <Shell id="count" score={`🔢 ${score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <View style={styles.center}>
        <Text style={styles.prompt}>{showing ? 'Quick, count the pots!' : 'How many honey pots were there?'}</Text>
        <View style={styles.potBox}>
          {showing && round.spots.map((s) => (
            <Text key={s} style={[styles.potSpot, { left: `${(s % 5) * 19 + 3}%`, top: `${Math.floor(s / 5) * 24 + 3}%` }]}>🍯</Text>
          ))}
          {!showing && <View style={{ opacity: 0.5 }}><Portrait id="robin" size={80} /></View>}
        </View>
        <View style={styles.answers}>
          {round.options.map((n) => <Button key={n} label={String(n)} disabled={showing} onPress={() => answer(n)} style={{ flex: 1 }} />)}
        </View>
        <Text style={styles.flash}>{flash || ' '}</Text>
      </View>
    </Shell>
  );
}

// ---------- Small: Spring the Trap ----------

export function Trap({ onDone, onQuit }: GameProps) {
  const g = useRef({ x: -0.15, pit: 0.5, speed: 0.22, score: 0, misses: 0, last: 0, caught: -9 }).current;
  const t = useFrames(g.misses < 3);
  const dt = Math.min(0.1, t - g.last);
  g.last = t;
  const resting = t - g.caught < 0.8;
  if (g.misses < 3 && !resting) {
    g.x += g.speed * dt;
    if (g.x > 1.1) { g.misses++; play('oops'); g.x = -0.15; g.pit = 0.25 + Math.random() * 0.5; }
  }
  useFinish(g.misses >= 3, g.score, onDone);
  const spring = () => {
    if (g.misses >= 3 || resting) return;
    if (Math.abs(g.x - g.pit) < 0.05) {
      g.score++; g.caught = t; g.speed += 0.04; play('fanfare'); buzz('success');
      setTimeout(() => { g.x = -0.15; g.pit = 0.25 + Math.random() * 0.5; }, 700);
    } else { g.misses++; play('oops'); buzz('medium'); }
  };
  return (
    <Shell id="trap" score={`🕳️ ${g.score}`} right={lives(3 - g.misses)} onQuit={onQuit}>
      <View style={styles.center}>
        <Text style={styles.prompt}>{resting ? 'Caught one! (It just wanted the honey.)' : 'Spring the trap when the Heffalump is right over the pit!'}</Text>
        <View style={styles.track}>
          <View style={[styles.pit, { left: `${g.pit * 100}%` }]}><Text style={{ fontSize: 18 }}>🍯</Text></View>
          <View style={[styles.heff, { left: `${g.x * 100}%`, top: resting ? 38 : 0 }]}><Portrait id="heffalump" size={64} /></View>
        </View>
        <Button label="Spring it!" onPress={spring} style={{ marginTop: 20, minWidth: 200 }} />
      </View>
    </Shell>
  );
}

// ---------- Roo: Down the Floody River ----------

type RiverThing = { id: number; lane: number; y: number; kind: 'log' | 'pot' };
const RIVER_SECS = 45;

export function River({ onDone, onQuit }: GameProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const g = useRef({ lane: 1, items: [] as RiverThing[], next: 0.5, score: 0, lives: 3, id: 0, last: 0, hit: -9 }).current;
  const t = useFrames(size.w > 0 && g.lives > 0);
  const left = Math.max(0, RIVER_SECS - t);
  const over = left <= 0 || g.lives <= 0;
  if (size.w > 0 && !over) {
    const dt = Math.min(0.1, t - g.last);
    g.last = t;
    const speed = 0.32 + t / 80;
    if (t >= g.next) {
      g.items.push({ id: g.id++, lane: Math.floor(Math.random() * 3), y: -0.08, kind: Math.random() < 0.55 ? 'log' : 'pot' });
      g.next = t + Math.max(0.35, 0.85 - t / 70);
    }
    const boatY = 1 - 90 / size.h;
    g.items = g.items.filter((it) => {
      it.y += speed * dt;
      if (it.lane === g.lane && it.y > boatY - 0.04 && it.y < boatY + 0.04) {
        if (it.kind === 'pot') { g.score++; play('pop'); } else { g.lives--; g.hit = t; play('oops'); buzz('medium'); }
        return false;
      }
      return it.y < 1.05;
    });
  }
  useFinish(over, g.score, onDone);
  const steer = (x: number) => { if (!over) g.lane = Math.max(0, Math.min(2, g.lane + (x < size.w / 2 ? -1 : 1))); };
  const laneX = (lane: number) => (lane + 0.5) * (size.w / 3) - 22;
  return (
    <Shell id="river" score={`🍯 ${g.score}`} right={`${lives(g.lives)} ⏱${Math.ceil(left)}`} onQuit={onQuit}>
      <View style={[styles.field, { backgroundColor: '#A9CBE0' }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Pressable style={StyleSheet.absoluteFill} onPressIn={(e) => steer(e.nativeEvent.locationX)} />
        <Text pointerEvents="none" style={[styles.hint, { color: '#2F5470' }]}>Tap left or right to steer</Text>
        {g.items.map((it) => (
          <Text key={it.id} pointerEvents="none" style={[styles.actor, { left: laneX(it.lane), top: it.y * size.h, fontSize: 38 }]}>{it.kind === 'log' ? '🪵' : '🍯'}</Text>
        ))}
        <Text pointerEvents="none" style={[styles.actor, { left: laneX(g.lane), bottom: 30, fontSize: 46, opacity: t - g.hit < 0.4 ? 0.4 : 1 }]}>🛶</Text>
      </View>
    </Shell>
  );
}

// ---------- Pooh & Piglet: Galleons Pairs ----------

const FACES: PortraitId[] = ['pooh', 'piglet', 'tigger', 'rabbit', 'owl', 'eeyore', 'kanga', 'roo', 'heffalump', 'robin'];
const PAIRS_SECS = 75;

export function Pairs({ onDone, onQuit }: GameProps) {
  const deal = () => shuffle(shuffle(FACES).slice(0, 6).flatMap((f) => [f, f]));
  const [cards, setCards] = useState(deal);
  const [matched, setMatched] = useState<number[]>([]);
  const [up, setUp] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const t = useFrames(true);
  const left = Math.max(0, PAIRS_SECS - t);
  useFinish(left <= 0, score, onDone, 300);
  const flip = (i: number) => {
    if (left <= 0 || up.length === 2 || up.includes(i) || matched.includes(i)) return;
    play('tick');
    const next = [...up, i];
    setUp(next);
    if (next.length < 2) return;
    if (cards[next[0]] === cards[next[1]]) {
      play('pop');
      const m = [...matched, ...next];
      setScore((n) => n + 1);
      setTimeout(() => {
        setUp([]);
        if (m.length === cards.length) { setMatched([]); setCards(deal()); } else setMatched(m);
      }, 350);
    } else setTimeout(() => setUp([]), 750);
  };
  return (
    <Shell id="pairs" score={`🃏 ${score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <Text style={styles.prompt}>Find the friends who match. A new deal comes when you clear the table.</Text>
      <View style={styles.cards}>
        {cards.map((f, i) => {
          const shown = up.includes(i) || matched.includes(i);
          return (
            <Pressable key={i} onPress={() => flip(i)} style={[styles.card, shown && styles.cardUp, matched.includes(i) && { opacity: 0.45 }]}>
              {shown ? <Portrait id={f} size={58} /> : <Text style={{ fontSize: 34 }}>✨</Text>}
            </Pressable>
          );
        })}
      </View>
    </Shell>
  );
}

// ---------- The Bees: Bee Line ----------

const BEE_SECS = 40;

export function BeeLine({ onDone, onQuit }: GameProps) {
  const place = (n: number) => shuffle(Array.from({ length: 20 }, (_, i) => i)).slice(0, n);
  const [n, setN] = useState(3);
  const [spots, setSpots] = useState(() => place(3));
  const [next, setNext] = useState(1);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const t = useFrames(true);
  const left = Math.max(0, BEE_SECS - t);
  useFinish(left <= 0, score, onDone, 300);
  const tapBee = (k: number) => {
    if (left <= 0) return;
    if (k !== next) { setWrong(k); play('oops'); setTimeout(() => setWrong(null), 300); return; }
    play('pop');
    setScore((x) => x + 1);
    if (k === n) {
      buzz('success');
      const m = Math.min(10, n + 1);
      setN(m); setSpots(place(m)); setNext(1);
    } else setNext(k + 1);
  };
  return (
    <Shell id="beeline" score={`🐝 ${score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <Text style={styles.prompt}>Tap the bees in order: 1, 2, 3…</Text>
      <View style={styles.potBox}>
        {spots.map((s, i) => i + 1 >= next && (
          <Pressable key={`${n}-${i}`} onPress={() => tapBee(i + 1)} style={[styles.beeSpot, { left: `${(s % 5) * 19 + 2}%`, top: `${Math.floor(s / 5) * 24 + 2}%` }, wrong === i + 1 && { backgroundColor: '#F6C9C0' }]}>
            <Text style={{ fontSize: 24 }}>🐝</Text>
            <Text style={styles.beeNum}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>
    </Shell>
  );
}

// ---------- The Heffalump: Odd One Out ----------

const ODD: [string, string][] = [['🌲', '🌳'], ['🐘', '🦏'], ['🍯', '🏺'], ['🌰', '🥔'], ['🐝', '🪰'], ['🍂', '🍁'], ['🐻', '🐨'], ['🎈', '🏮'], ['❄️', '✳️'], ['🐷', '🐽']];
const ODD_SECS = 40;

export function OddOne({ onDone, onQuit }: GameProps) {
  const make = (found: number) => {
    const side = Math.min(6, 3 + Math.floor(found / 3));
    const [a, b] = shuffle(pick(ODD));
    return { side, a, b, odd: Math.floor(Math.random() * side * side) };
  };
  const [score, setScore] = useState(0);
  const [board, setBoard] = useState(() => make(0));
  const [shake, setShake] = useState(false);
  const t = useFrames(true);
  const left = Math.max(0, ODD_SECS - t);
  useFinish(left <= 0, score, onDone, 300);
  const tapCell = (i: number) => {
    if (left <= 0) return;
    if (i === board.odd) { play('pop'); setScore(score + 1); setBoard(make(score + 1)); }
    else { play('oops'); setShake(true); setTimeout(() => setShake(false), 250); }
  };
  const cell = `${100 / board.side}%` as const;
  return (
    <Shell id="oddone" score={`🌲 ${score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <Text style={styles.prompt}>Which one isn't like the others?</Text>
      <View style={[styles.oddGrid, shake && { backgroundColor: '#F6D9D2' }]}>
        {Array.from({ length: board.side * board.side }, (_, i) => (
          <Pressable key={i} onPress={() => tapCell(i)} style={{ width: cell, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: Math.round(150 / board.side) }}>{i === board.odd ? board.b : board.a}</Text>
          </Pressable>
        ))}
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
  prompt: { textAlign: 'center', fontWeight: '800', color: C.ink, fontSize: 15, marginHorizontal: 16, marginVertical: 10 },
  meter: { width: 280, height: 30, borderRadius: 15, backgroundColor: '#F1E5C8', overflow: 'hidden', borderWidth: 2, borderColor: C.border },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#BFE0A8' },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 5, marginLeft: -2, backgroundColor: C.ink },
  choice: { width: 260, paddingVertical: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 2, borderColor: C.border, alignItems: 'center', marginTop: 10 },
  choiceText: { fontFamily: HAND, fontSize: 26, color: C.ink, letterSpacing: 2 },
  flash: { marginTop: 12, fontWeight: '900', fontSize: 16, color: C.green },
  field: { flex: 1, margin: 12, marginTop: 0, borderRadius: 18, borderWidth: 2, borderColor: C.border, overflow: 'hidden' },
  hint: { position: 'absolute', top: 10, alignSelf: 'center', color: C.soft, fontWeight: '700', fontSize: 12 },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#C9DDA0', borderTopWidth: 3, borderTopColor: '#8FB463' },
  actor: { position: 'absolute', fontSize: 50 },
  bushes: { width: 300, height: 120, marginTop: 20 },
  bush: { position: 'absolute', top: 0, width: '30%' },
  floater: { position: 'absolute', padding: 4 },
  potBox: { width: 320, maxWidth: '94%', height: 260, alignSelf: 'center', borderRadius: 18, backgroundColor: '#FFF0C2', borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  potSpot: { position: 'absolute', fontSize: 34 },
  answers: { flexDirection: 'row', gap: 10, width: 320, maxWidth: '94%', marginTop: 16 },
  track: { width: 320, maxWidth: '94%', height: 110, marginTop: 30, borderBottomWidth: 4, borderBottomColor: '#8FB463' },
  pit: { position: 'absolute', bottom: -18, width: 70, height: 30, marginLeft: -35, borderRadius: 35, backgroundColor: '#6B4A2B', alignItems: 'center', justifyContent: 'center' },
  heff: { position: 'absolute', marginLeft: -32 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', width: 320, maxWidth: '94%', alignSelf: 'center', gap: 8, justifyContent: 'center' },
  card: { width: '22%', aspectRatio: 0.8, borderRadius: 12, backgroundColor: '#D9B45A', borderWidth: 2, borderColor: '#B88A00', alignItems: 'center', justifyContent: 'center' },
  cardUp: { backgroundColor: '#FFF3D1' },
  beeSpot: { position: 'absolute', width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  beeNum: { position: 'absolute', bottom: 0, right: 2, fontWeight: '900', fontSize: 15, color: C.ink, backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 4, overflow: 'hidden' },
  oddGrid: { width: 330, maxWidth: '94%', alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', borderRadius: 18, backgroundColor: '#E3EEDC', borderWidth: 2, borderColor: C.border, padding: 4 },
});
