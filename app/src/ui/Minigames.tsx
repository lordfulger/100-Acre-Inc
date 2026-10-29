// The minigames. Each one is a full-screen overlay that reports its score when done.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GameId, GAMES } from '../game/extras';
import { StickRace } from '../state/GameContext';
import { Button, buzz, C } from './kit';
import { HAND } from './WoodMap';
import { play } from '../audio/sound';

const FRAME_MS = 33;

/** Re-renders every frame while `on`, and gives the time since it started. */
function useFrames(on: boolean) {
  const [, setN] = useState(0);
  const start = useRef(Date.now());
  useEffect(() => {
    if (!on) return;
    start.current = Date.now();
    const id = setInterval(() => setN((n) => n + 1), FRAME_MS);
    return () => clearInterval(id);
  }, [on]);
  return (Date.now() - start.current) / 1000;
}

function Shell({ id, score, right, onQuit, children }: { id: GameId; score: string; right?: string; onQuit: () => void; children: React.ReactNode }) {
  const g = GAMES[id];
  return (
    <View style={styles.shell}>
      <View style={styles.head}>
        <Text style={styles.title}>{g.emoji} {g.name}</Text>
        <Text style={styles.score}>{score}</Text>
        {right ? <Text style={styles.time}>{right}</Text> : null}
        <Pressable onPress={onQuit} hitSlop={12} accessibilityLabel="Stop"><Text style={styles.close}>✕</Text></Pressable>
      </View>
      {children}
    </View>
  );
}

// ---------- Honey Drip ----------

type Drop = { id: number; x: number; y: number; v: number; kind: 'drop' | 'gold' | 'bee' };
const DRIP_SECS = 30;

export function HoneyDrip({ onDone, onQuit }: { onDone: (score: number) => void; onQuit: () => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const g = useRef({ pot: 0.5, drops: [] as Drop[], score: 0, next: 0, last: 0, id: 0, ended: false, hit: 0 }).current;
  const t = useFrames(size.w > 0);
  const left = Math.max(0, DRIP_SECS - t);

  if (size.w > 0 && !g.ended) {
    const dt = g.last ? Math.min(0.1, t - g.last) : 0;
    g.last = t;
    if (t >= g.next) {
      const r = Math.random();
      const kind = r < 0.12 + t / 300 ? 'bee' : r < 0.25 ? 'gold' : 'drop';
      g.drops.push({ id: g.id++, x: 0.05 + Math.random() * 0.9, y: -0.05, v: 0.28 + t / 70 + Math.random() * 0.15, kind });
      g.next = t + Math.max(0.28, 0.75 - t / 60);
    }
    for (const d of g.drops) d.y += d.v * dt;
    const potY = 1 - 70 / size.h;
    g.drops = g.drops.filter((d) => {
      if (d.y >= potY && d.y <= potY + 0.06 && Math.abs(d.x - g.pot) * size.w < 42) {
        if (d.kind === 'bee') { g.score = Math.max(0, g.score - 3); g.hit = t; play('oops'); buzz('medium'); }
        else { g.score += d.kind === 'gold' ? 3 : 1; play('tick'); }
        return false;
      }
      return d.y < 1.05;
    });
    if (left <= 0) { g.ended = true; setTimeout(() => onDone(g.score), 0); }
  }

  const move = (x: number) => { if (size.w) g.pot = Math.max(0.05, Math.min(0.95, x / size.w)); };
  return (
    <Shell id="drip" score={`🍯 ${g.score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <View
        style={styles.field}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => move(e.nativeEvent.locationX)}
        onResponderMove={(e) => move(e.nativeEvent.locationX)}
      >
        <Text pointerEvents="none" style={styles.hint}>Slide your finger to move the pot</Text>
        {g.drops.map((d) => (
          <Text key={d.id} pointerEvents="none" style={[styles.drop, { left: d.x * size.w - 14, top: d.y * size.h }]}>
            {d.kind === 'bee' ? '🐝' : d.kind === 'gold' ? '🌟' : '💧'}
          </Text>
        ))}
        <Text pointerEvents="none" style={[styles.pot, { left: g.pot * size.w - 30, opacity: t - g.hit < 0.4 ? 0.4 : 1 }]}>🍯</Text>
      </View>
    </Shell>
  );
}

// ---------- Woozle Tracks ----------

export function WoozleTracks({ onDone, onQuit }: { onDone: (score: number) => void; onQuit: () => void }) {
  const [seq, setSeq] = useState<number[]>(() => [Math.floor(Math.random() * 9), Math.floor(Math.random() * 9)]);
  const [phase, setPhase] = useState<'show' | 'input' | 'pause' | 'over'>('show');
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const score = seq.length - 2;

  useEffect(() => {
    if (phase !== 'show') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const gap = Math.max(380, 700 - seq.length * 25);
    seq.forEach((cell, i) => {
      timers.push(setTimeout(() => { setLit(cell); play('tick'); }, 700 + i * gap));
      timers.push(setTimeout(() => setLit(null), 700 + i * gap + gap * 0.7));
    });
    timers.push(setTimeout(() => { setStep(0); setPhase('input'); }, 700 + seq.length * gap));
    return () => timers.forEach(clearTimeout);
  }, [phase, seq]);

  const tapCell = (i: number) => {
    if (phase !== 'input') return;
    if (seq[step] !== i) {
      setWrong(i);
      setPhase('over');
      play('oops');
      setTimeout(() => onDone(score), 1200);
      return;
    }
    setLit(i);
    setTimeout(() => setLit((x) => (x === i ? null : x)), 220);
    play('pop');
    if (step + 1 === seq.length) {
      buzz('success');
      setTimeout(() => { setSeq((q) => [...q, Math.floor(Math.random() * 9)]); setPhase('show'); }, 600);
      setPhase('pause');
    } else setStep(step + 1);
  };

  return (
    <Shell id="tracks" score={`🐾 ${score}`} onQuit={onQuit}>
      <Text style={styles.prompt}>
        {phase === 'input' ? `Your turn! Follow the ${seq.length} tracks.` : phase === 'over' ? 'Oh bother, the Woozle got away!' : 'Watch the footprints…'}
      </Text>
      <View style={styles.snow}>
        {Array.from({ length: 9 }, (_, i) => (
          <Pressable key={i} onPress={() => tapCell(i)} style={[styles.cell, lit === i && styles.cellLit, wrong === i && styles.cellWrong]}>
            <Text style={{ fontSize: 36, opacity: lit === i || wrong === i ? 1 : 0.12 }}>🐾</Text>
          </Pressable>
        ))}
      </View>
    </Shell>
  );
}

// ---------- Rabbit's Garden ----------

type Sprout = { kind: string; until: number; bad: boolean };
const VEG = ['🥕', '🥬', '🧅', '🍅', '🌽', '🥔'];
const GARDEN_SECS = 30;

export function RabbitsGarden({ onDone, onQuit }: { onDone: (score: number) => void; onQuit: () => void }) {
  const g = useRef({ holes: Array<Sprout | null>(9).fill(null), score: 0, next: 0, ended: false, pop: -1 as number }).current;
  const t = useFrames(true);
  const left = Math.max(0, GARDEN_SECS - t);
  if (!g.ended) {
    g.holes = g.holes.map((h) => (h && h.until > t ? h : null));
    if (t >= g.next) {
      const free = g.holes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
      if (free.length) {
        const i = free[Math.floor(Math.random() * free.length)];
        const bad = Math.random() < 0.18;
        g.holes[i] = { kind: bad ? '🐘' : VEG[Math.floor(Math.random() * VEG.length)], bad, until: t + Math.max(0.65, 1.4 - t / 40) };
      }
      g.next = t + Math.max(0.3, 0.7 - t / 60);
    }
    if (left <= 0) { g.ended = true; setTimeout(() => onDone(g.score), 0); }
  }
  const pull = (i: number) => {
    const h = g.holes[i];
    if (!h || g.ended) return;
    g.holes[i] = null;
    if (h.bad) { g.score = Math.max(0, g.score - 3); play('oops'); buzz('medium'); }
    else { g.score++; play('pop'); }
  };
  return (
    <Shell id="garden" score={`🥕 ${g.score}`} right={`⏱ ${Math.ceil(left)}s`} onQuit={onQuit}>
      <Text style={styles.prompt}>Pull the vegetables. Leave the Heffalumps!</Text>
      <View style={[styles.snow, { backgroundColor: '#C9DDA0' }]}>
        {g.holes.map((h, i) => (
          <Pressable key={i} onPressIn={() => pull(i)} style={[styles.cell, styles.hole]}>
            <Text style={{ fontSize: 40 }}>{h ? h.kind : ''}</Text>
          </Pressable>
        ))}
      </View>
    </Shell>
  );
}

// ---------- Poohsticks ----------

/** The swinging needle: drop when it's in the middle for the best start. */
export function DropMeter({ onDrop, disabled }: { onDrop: (q: number) => void; disabled?: boolean }) {
  const t = useFrames(!disabled);
  const pos = (Math.sin(t * 3.2) + 1) / 2;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.meter}>
        <View style={styles.sweet} />
        <View style={[styles.needle, { left: `${pos * 100}%` }]} />
      </View>
      <Button label={disabled ? 'Dropped! 🥢' : 'Drop your stick!'} disabled={disabled} onPress={() => { play('pop'); onDrop(1 - Math.abs(pos - 0.5) * 2); }} style={{ marginTop: 12, minWidth: 200 }} />
    </View>
  );
}

/** Two sticks floating down the river, finishing at their given times. */
export function River({ race, you, onFinish }: { race: StickRace; you: string; onFinish: () => void }) {
  const SPEED = 1.6;
  const t = useFrames(true) * SPEED;
  const [h, setH] = useState(0);
  const end = Math.max(...race.sticks.map((s) => s.time));
  const finished = t > end + 0.5;
  const called = useRef(false);
  useEffect(() => { if (finished && !called.current) { called.current = true; onFinish(); } }, [finished, onFinish]);
  return (
    <View style={styles.river} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <View style={styles.bridge}><Text style={styles.bridgeText}>POOHSTICKS BRIDGE</Text></View>
      <View style={[styles.finish, { top: h - 46 }]}><Text style={styles.bridgeText}>FINISH</Text></View>
      {race.sticks.map((s, i) => {
        const p = Math.min(1, t / s.time);
        // A little eddy now and then makes the race exciting: sticks bob and wander.
        const eddy = Math.sin(t * 1.3 + i * 2 + race.seed % 7) * 0.035;
        const y = 60 + (h - 130) * Math.max(0, Math.min(1, p + (p < 1 ? eddy : 0)));
        const x = 32 + i * 34 + Math.sin(t * 1.7 + i * 3) * 14;
        return (
          <View key={s.pid} style={[styles.stick, { top: y, left: `${x}%` }]}>
            <Text style={{ fontSize: 30, transform: [{ rotate: `${Math.sin(t * 2 + i) * 25 + 45}deg` }] }}>🥢</Text>
            <Text style={[styles.stickName, s.pid === you && { color: C.pink }]}>{s.avatar} {s.pid === you ? 'You' : s.name}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function Poohsticks({
  race, you, dropped, waitingFor, onDrop, onFinish, onQuit,
}: {
  race: StickRace | null; you: string; dropped: boolean; waitingFor: string; onDrop: (q: number) => void; onFinish: () => void; onQuit: () => void;
}) {
  const [over, setOver] = useState(false);
  const won = race?.winner === you;
  return (
    <Shell id="sticks" score="" onQuit={onQuit}>
      {!race ? (
        <View style={styles.dropBox}>
          <Text style={styles.prompt}>{dropped ? `Waiting for ${waitingFor} to drop…` : 'Lean over the bridge… drop your stick when the needle is in the green!'}</Text>
          <DropMeter onDrop={onDrop} disabled={dropped} />
        </View>
      ) : (
        <>
          <River race={race} you={you} onFinish={() => { setOver(true); play(won ? 'fanfare' : 'pop'); }} />
          {over && (
            <View style={styles.result}>
              <Text style={styles.resultText}>{won ? '🏆 Your stick came out first!' : `🥢 ${race.sticks.find((s) => s.pid === race.winner)?.name}'s stick won!`}</Text>
              <Button label="Lovely" onPress={onFinish} style={{ marginTop: 8 }} />
            </View>
          )}
        </>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 60 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  title: { flex: 1, fontFamily: HAND, fontSize: 22, color: C.ink },
  score: { fontWeight: '900', fontSize: 18, color: C.ink },
  time: { fontWeight: '900', fontSize: 16, color: C.soft },
  close: { fontSize: 22, fontWeight: '900', color: C.soft },
  field: { flex: 1, margin: 12, marginTop: 0, borderRadius: 18, backgroundColor: '#FFF0C2', borderWidth: 2, borderColor: C.border, overflow: 'hidden' },
  hint: { position: 'absolute', top: 10, alignSelf: 'center', color: C.soft, fontWeight: '700', fontSize: 12 },
  drop: { position: 'absolute', fontSize: 26 },
  pot: { position: 'absolute', bottom: 12, fontSize: 52 },
  prompt: { textAlign: 'center', fontWeight: '800', color: C.ink, fontSize: 15, marginHorizontal: 16, marginBottom: 12 },
  snow: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center', width: 330, maxWidth: '94%', backgroundColor: '#EEF4FA', borderRadius: 20, padding: 6, borderWidth: 2, borderColor: C.border },
  cell: { width: '33.33%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  cellLit: { backgroundColor: '#D6E8F7' },
  cellWrong: { backgroundColor: '#F6C9C0' },
  hole: { borderWidth: 3, borderColor: '#8A6440', backgroundColor: '#7A5A3A', transform: [{ scale: 0.88 }] },
  meter: { width: 260, height: 26, borderRadius: 13, backgroundColor: '#F1E5C8', overflow: 'hidden', borderWidth: 2, borderColor: C.border },
  sweet: { position: 'absolute', left: '40%', width: '20%', top: 0, bottom: 0, backgroundColor: '#BFE0A8' },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 5, marginLeft: -2, backgroundColor: C.ink },
  dropBox: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  river: { flex: 1, margin: 12, marginTop: 0, borderRadius: 18, backgroundColor: '#A9CBE0', borderWidth: 3, borderColor: '#5D7F9C', overflow: 'hidden' },
  bridge: { position: 'absolute', top: 0, left: 0, right: 0, height: 44, backgroundColor: '#B98B5C', borderBottomWidth: 3, borderBottomColor: '#8A6440', alignItems: 'center', justifyContent: 'center' },
  finish: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: 'white', alignItems: 'center', justifyContent: 'flex-start' },
  bridgeText: { fontFamily: HAND, color: '#4B3A26', fontSize: 15 },
  stick: { position: 'absolute', alignItems: 'center', marginLeft: -30, width: 80 },
  stickName: { fontSize: 12, fontWeight: '900', color: C.ink, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' },
  result: { position: 'absolute', bottom: 30, left: 24, right: 24, backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 2, borderColor: '#D9C48E', alignItems: 'center' },
  resultText: { fontFamily: HAND, fontSize: 22, color: C.ink, textAlign: 'center' },
});
