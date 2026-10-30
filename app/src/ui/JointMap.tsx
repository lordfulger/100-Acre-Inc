// The wood's joint map: a clearing in the middle of the Hundred Acre Wood with the
// buildings everyone in the wood pays into together. Like the homes on your own
// map, each one grows new details every 5 levels. All art is original, drawn in code.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { JOINT, JOINT_BY_ID, JointId, jointBonus, lookOf } from '../game/catalog';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { Bar, Button, C } from './kit';
import { play } from '../audio/sound';
import {
  Bees, Bunting, Glow, Grass, HAND, Hive, PineTree, Pot, Sign, Star, Tree, GOLD, HONEY, INK, LEAF_DARK, TRUNK, WATER, WATER_EDGE,
} from './WoodMap';

const W = 600;
const H = 460;
/** The buildings are drawn bigger than the homes on your own map: there are fewer, and they matter. */
const SCALE = 1.35;

/** Where each joint building stands in the clearing. */
const SPOTS: Record<JointId, { x: number; y: number }> = {
  hive: { x: 115, y: 185 },
  market: { x: 300, y: 165 },
  field: { x: 485, y: 185 },
  fair: { x: 160, y: 385 },
  lantern: { x: 440, y: 385 },
};

// ---------- the buildings ----------

function Market({ lv }: { lv: number }) {
  const Stall = ({ x, s = 1 }: { x: number; s?: number }) => (
    <G transform={`translate(${x},0) scale(${s})`}>
      <Line x1={-26} y1={0} x2={-26} y2={-40} stroke={TRUNK} strokeWidth={2} />
      <Line x1={26} y1={0} x2={26} y2={-40} stroke={TRUNK} strokeWidth={2} />
      <Rect x={-28} y={-18} width={56} height={18} fill="#C99A5B" stroke={INK} strokeWidth={1} />
      {/* The striped awning. */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Rect key={i} x={-32 + i * 9.2} y={-48} width={9.2} height={11} fill={i % 2 ? '#FFF3D6' : '#E46A8C'} stroke={INK} strokeWidth={0.5} />
      ))}
      <Path d="M-32 -37 q4.6 6 9.2 0 q4.6 6 9.2 0 q4.6 6 9.2 0 q4.6 6 9.2 0 q4.6 6 9.2 0 q4.6 6 9.2 0 q4.6 6 9.2 0" fill="#E46A8C" stroke={INK} strokeWidth={0.5} />
      <Pot x={-14} y={-18} /><Pot x={0} y={-18} s={1.2} /><Pot x={14} y={-18} />
    </G>
  );
  return (
    <G>
      {lv >= 5 && <Glow r={70} />}
      {lv >= 4 && [-58, 58].map((x) => (
        <G key={x}>
          <Line x1={x} y1={2} x2={x} y2={-64} stroke={INK} strokeWidth={1} />
          <Polygon points={`${x},-64 ${x + (x < 0 ? 14 : -14)},-60 ${x},-56`} fill="#5A8FD6" stroke={INK} strokeWidth={0.5} />
        </G>
      ))}
      {lv >= 1 && <Stall x={-40} s={0.7} />}
      <Stall x={10} />
      {lv >= 2 && <Bunting x1={-58} y1={-60} x2={58} y2={-60} n={8} />}
      {lv >= 3 && (
        <G>
          <Rect x={38} y={-12} width={14} height={12} fill="#B07A43" stroke={INK} strokeWidth={0.8} />
          <Rect x={40} y={-24} width={10} height={12} fill="#C99A5B" stroke={INK} strokeWidth={0.8} />
          <Sign x={-60} y={-14} w={24} lines={['HUNNY', 'HERE']} />
        </G>
      )}
      {lv >= 5 && <Pot x={10} y={-50} s={2} />}
    </G>
  );
}

function GreatHive({ lv }: { lv: number }) {
  const Skep = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ellipse key={i} cx={0} cy={-6 - i * 9} rx={24 - i * 4} ry={6.5} fill={i % 2 ? GOLD : '#E7B13C'} stroke={INK} strokeWidth={0.9} />
      ))}
      <Ellipse cx={0} cy={-50} rx={6} ry={4} fill={GOLD} stroke={INK} strokeWidth={0.8} />
      <Path d="M-5 0 Q0 -10 5 0 Z" fill={INK} />
    </G>
  );
  return (
    <G>
      {lv >= 5 && <Glow r={66} />}
      {lv >= 2 && [[-50, 2], [-40, 8], [44, 6], [54, 0], [-30, 10], [34, 10]].map(([x, y], i) => (
        <G key={i}>
          <Line x1={x} y1={y} x2={x} y2={y - 7} stroke={LEAF_DARK} strokeWidth={1} />
          <Circle cx={x} cy={y - 9} r={3} fill={['#E46A8C', '#F2C14E', '#B48AD6'][i % 3]} stroke={INK} strokeWidth={0.4} />
        </G>
      ))}
      {lv >= 4 && <Path d="M-62 4 L62 4 M-62 -6 L62 -6" stroke={TRUNK} strokeWidth={1.4} />}
      {lv >= 4 && [-62, -31, 31, 62].map((x) => <Line key={x} x1={x} y1={8} x2={x} y2={-10} stroke={TRUNK} strokeWidth={1.6} />)}
      <Rect x={-22} y={-8} width={44} height={8} fill={TRUNK} stroke={INK} strokeWidth={0.8} />
      <Skep x={0} y={-8} s={1.1} />
      {lv >= 1 && <Hive x={-42} y={-12} s={1.3} />}
      {lv >= 3 && <G><Pot x={34} y={0} s={1.2} /><Pot x={46} y={2} /></G>}
      <Bees x={0} y={-64} n={3 + lv * 2} spread={22 + lv * 3} />
      {lv >= 5 && <Star x={0} y={-74} />}
    </G>
  );
}

function BalloonField({ lv }: { lv: number }) {
  const Balloon = ({ x, y, color, r = 9 }: { x: number; y: number; color: string; r?: number }) => (
    <G>
      <Path d={`M${x} ${y + r} Q${x - 4} ${(y + r + 4) / 2 + 2} ${x} 0`} stroke={INK} strokeWidth={0.6} fill="none" />
      <Ellipse cx={x} cy={y} rx={r * 0.85} ry={r} fill={color} stroke={INK} strokeWidth={0.8} />
      <Ellipse cx={x - r * 0.3} cy={y - r * 0.35} rx={r * 0.18} ry={r * 0.3} fill="white" opacity={0.6} />
    </G>
  );
  const colors = ['#F2C14E', '#E46A8C', '#5A8FD6', '#7FB85A', '#F08A3C'];
  const extra: [number, number][] = [[-24, -54], [26, -60], [-40, -36], [42, -40]];
  return (
    <G>
      {lv >= 5 && <Glow r={70} />}
      <Ellipse cx={0} cy={2} rx={62} ry={11} fill="#BFD98E" />
      {[-46, -20, 14, 40].map((x) => <Grass key={x} x={x} y={4} />)}
      {lv >= 3 && <Bunting x1={-60} y1={-8} x2={60} y2={-8} n={9} />}
      {lv >= 5 && (
        <G>
          <Ellipse cx={0} cy={-88} rx={22} ry={26} fill="#E46A8C" stroke={INK} strokeWidth={1} />
          <Path d="M-12 -110 Q0 -60 -8 -64 M12 -110 Q0 -60 8 -64" stroke="#FFF3D6" strokeWidth={4} fill="none" />
          <Line x1={-10} y1={-64} x2={-7} y2={-50} stroke={INK} strokeWidth={0.7} />
          <Line x1={10} y1={-64} x2={7} y2={-50} stroke={INK} strokeWidth={0.7} />
          <Rect x={-8} y={-50} width={16} height={9} fill="#B07A43" stroke={INK} strokeWidth={0.8} />
        </G>
      )}
      <Balloon x={0} y={-44} color={colors[0]} r={11} />
      {extra.slice(0, Math.min(4, lv)).map(([x, y], i) => <Balloon key={i} x={x} y={y} color={colors[i + 1]} />)}
    </G>
  );
}

function Fairground({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 5 && <Glow r={72} />}
      {lv >= 2 && (
        <G transform="translate(-44,0)">
          <Line x1={-10} y1={0} x2={0} y2={-30} stroke={TRUNK} strokeWidth={1.6} />
          <Line x1={10} y1={0} x2={0} y2={-30} stroke={TRUNK} strokeWidth={1.6} />
          <Circle cx={0} cy={-30} r={22} fill="none" stroke={INK} strokeWidth={1.2} />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <G key={i}>
                <Line x1={0} y1={-30} x2={Math.cos(a) * 22} y2={-30 + Math.sin(a) * 22} stroke={INK} strokeWidth={0.6} />
                <Rect x={Math.cos(a) * 22 - 3} y={-30 + Math.sin(a) * 22} width={6} height={5} fill={['#E46A8C', '#5A8FD6', '#F2C14E'][i % 3]} stroke={INK} strokeWidth={0.4} />
              </G>
            );
          })}
        </G>
      )}
      {/* The carousel. */}
      <G transform="translate(8,0)">
        <Ellipse cx={0} cy={-4} rx={30} ry={7} fill="#C99A5B" stroke={INK} strokeWidth={1} />
        {[-20, -7, 7, 20].map((x) => <Line key={x} x1={x} y1={-6} x2={x} y2={-36} stroke={GOLD} strokeWidth={1.6} />)}
        {[-20, 7].map((x) => <Ellipse key={x} cx={x} cy={-20} rx={6} ry={4} fill="#FFF3D6" stroke={INK} strokeWidth={0.6} />)}
        {[-7, 20].map((x) => <Ellipse key={x} cx={x} cy={-24} rx={6} ry={4} fill="#F4C7D2" stroke={INK} strokeWidth={0.6} />)}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Polygon key={i} points={`0,-62 ${-34 + i * 11.3},-36 ${-34 + (i + 1) * 11.3},-36`} fill={i % 2 ? '#FFF3D6' : '#C8553D'} stroke={INK} strokeWidth={0.6} />
        ))}
        {lv >= 1 && <G><Line x1={0} y1={-62} x2={0} y2={-74} stroke={INK} strokeWidth={1} /><Polygon points="0,-74 12,-70 0,-66" fill="#5A8FD6" stroke={INK} strokeWidth={0.5} /></G>}
      </G>
      {lv >= 3 && <Bunting x1={-66} y1={-46} x2={60} y2={-46} n={10} />}
      {lv >= 4 && (
        <G transform="translate(52,0)">
          <Rect x={-10} y={-14} width={20} height={14} fill="#F4E8C8" stroke={INK} strokeWidth={0.8} />
          <Polygon points="-12,-14 0,-24 12,-14" fill="#7FB85A" stroke={INK} strokeWidth={0.8} />
          <Circle cx={-3} cy={-7} r={2.5} fill="#E46A8C" /><Circle cx={4} cy={-7} r={2.5} fill="#F2C14E" />
        </G>
      )}
    </G>
  );
}

function LanternTree({ lv }: { lv: number }) {
  const spots: [number, number][] = [[-30, -50], [26, -54], [-10, -40], [40, -38], [-42, -34], [8, -62], [-22, -66], [34, -70], [-48, -54], [50, -54], [-4, -78]];
  return (
    <G>
      {lv >= 5 && <Glow r={74} />}
      <Tree x={0} y={0} s={2.6} dark />
      {spots.slice(0, 1 + lv * 2).map(([x, y], i) => (
        <G key={i}>
          <Line x1={x} y1={y - 8} x2={x} y2={y - 3} stroke={INK} strokeWidth={0.5} />
          <Circle cx={x} cy={y + 2} r={7} fill={GOLD} opacity={0.3} />
          <Rect x={x - 3} y={y - 3} width={6} height={8} rx={2} fill="#F08A3C" stroke={INK} strokeWidth={0.5} />
        </G>
      ))}
      {lv >= 2 && <G><Rect x={-34} y={-4} width={22} height={4} fill={TRUNK} stroke={INK} strokeWidth={0.6} /><Line x1={-31} y1={0} x2={-31} y2={5} stroke={TRUNK} strokeWidth={1.4} /><Line x1={-15} y1={0} x2={-15} y2={5} stroke={TRUNK} strokeWidth={1.4} /></G>}
      {lv >= 3 && <Pot x={22} y={4} s={1.1} />}
      {lv >= 4 && <G><Line x1={-58} y1={4} x2={-58} y2={-24} stroke={TRUNK} strokeWidth={1.4} /><Rect x={-61} y={-30} width={6} height={7} rx={1} fill={GOLD} stroke={INK} strokeWidth={0.5} /></G>}
    </G>
  );
}

const ART: Record<JointId, (p: { lv: number }) => React.ReactElement> = {
  market: Market, hive: GreatHive, field: BalloonField, fair: Fairground, lantern: LanternTree,
};

/** A joint building at its level: a new look every 5 levels, then a gold star for every 5 after the fifth. */
function JointArt({ id, level }: { id: JointId; level: number }) {
  const Art = ART[id];
  const look = lookOf(level);
  const stars = Math.min(8, Math.max(0, look - 5));
  return (
    <G>
      <Art lv={Math.min(5, look)} />
      {Array.from({ length: stars }, (_, i) => <Star key={i} x={-56 + (i % 4) * 37} y={-96 - Math.floor(i / 4) * 14} />)}
    </G>
  );
}

// ---------- the clearing ----------

const RING: [number, number, number][] = [
  [30, 60, 1.2], [80, 40, 1], [210, 50, 1.1], [390, 46, 1], [520, 42, 1.2], [575, 90, 1], [20, 260, 1.1], [580, 250, 1],
  [30, 450, 1.2], [300, 456, 1], [575, 450, 1.1], [250, 262, 0.8], [350, 262, 0.8],
];

const Clearing = React.memo(function Clearing() {
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H} fill="#E9DDB0" />
      <Ellipse cx={300} cy={255} rx={292} ry={215} fill="#D5E4AE" />
      {/* Paths in from every side to the meeting place in the middle. */}
      <Path d="M300 0 Q290 120 300 255 Q310 370 300 460 M0 235 Q150 225 300 255 Q450 285 600 245" stroke="#E8D29A" strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d="M300 0 Q290 120 300 255 Q310 370 300 460 M0 235 Q150 225 300 255 Q450 285 600 245" stroke="#C9AE6E" strokeWidth={1} strokeDasharray="3 6" fill="none" />
      {/* A stream along the bottom corner. */}
      <Path d="M0 410 Q50 395 75 425 Q95 450 120 460" stroke={WATER} strokeWidth={14} fill="none" />
      <Path d="M0 410 Q50 395 75 425 Q95 450 120 460" stroke={WATER_EDGE} strokeWidth={1} fill="none" opacity={0.5} />
      {/* The meeting place: a ring of logs round a honey-pot maypole. */}
      <Circle cx={300} cy={252} r={30} fill="#E8D29A" stroke="#C9AE6E" strokeWidth={1} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return <Ellipse key={i} cx={300 + Math.cos(a) * 24} cy={252 + Math.sin(a) * 15} rx={6} ry={3.5} fill={TRUNK} stroke={INK} strokeWidth={0.6} />;
      })}
      <Line x1={300} y1={252} x2={300} y2={208} stroke={TRUNK} strokeWidth={2.4} />
      <Pot x={300} y={208} s={1.4} />
      <Bunting x1={300} y1={212} x2={262} y2={246} n={4} />
      <Bunting x1={300} y1={212} x2={338} y2={246} n={4} />
      {RING.map(([x, y, s], i) => (i % 3 === 1 ? <PineTree key={i} x={x} y={y} s={s * 0.9} /> : <Tree key={i} x={x} y={y} s={s * 1.3} dark={i % 2 === 0} />))}
      {[[120, 280], [480, 280], [250, 420], [355, 430], [40, 330]].map(([x, y], i) => <Grass key={i} x={x} y={y} />)}
      <G transform="translate(300,300) scale(1.7)"><Sign x={-30} y={0} w={60} lines={['OUR WOOD', 'BILT TOGETHER']} /></G>
    </G>
  );
});

// ---------- the map, and the building you're looking at ----------

/** The joint map on the Friends tab: tap a building to see it and pay toward its next level. */
export function JointMap({ width }: { width: number }) {
  const { net } = useGame();
  const [selected, setSelected] = useState<JointId>('market');
  const k = width / W;
  const level = (id: JointId) => net.joint[id]?.level || 0;
  return (
    <View>
      <View style={{ width, height: H * k }}>
        <Svg width={width} height={H * k} viewBox={`0 0 ${W} ${H}`}>
          <Clearing />
          {JOINT.map((j) => {
            const { x, y } = SPOTS[j.id];
            return (
              <G key={j.id} transform={`translate(${x},${y}) scale(${SCALE})`}>
                {selected === j.id && <Ellipse cx={0} cy={2} rx={66} ry={13} fill="#FFF3B0" opacity={0.9} stroke={GOLD} strokeWidth={2} />}
                <JointArt id={j.id} level={level(j.id)} />
              </G>
            );
          })}
        </Svg>
        {JOINT.map((j) => {
          const { x, y } = SPOTS[j.id];
          const box = 170;
          return (
            <Pressable
              key={j.id}
              onPress={() => { play('tick'); setSelected(j.id); }}
              style={[styles.hit, { left: (x - box / 2) * k, top: (y - 130) * k, width: box * k, height: 150 * k }]}
              accessibilityRole="button"
              accessibilityLabel={j.name}
            >
              <View style={[styles.tag, selected === j.id && styles.tagOn]}>
                <Text style={[styles.tagName, { fontSize: Math.max(11, 15 * k) }]} numberOfLines={1}>{j.name.replace(/^The /, '')}</Text>
                <Text style={[styles.tagLevel, { fontSize: Math.max(9, 11 * k) }]}>Lv {level(j.id)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <JointSheet id={selected} />
    </View>
  );
}

function JointSheet({ id }: { id: JointId }) {
  const { s, net, wood } = useGame();
  const j = JOINT_BY_ID[id];
  const site = net.joint[id];
  if (!site) return null;
  const now = jointBonus(id, site.level);
  const left = Math.max(1, site.goal - site.progress);
  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>{j.emoji} {j.name} · Lv {site.level}</Text>
      <Text style={styles.small}>
        Everyone in the wood: {site.level ? j.perk(now) : 'nothing yet'} → <Text style={{ color: C.greenDeep }}>{j.perk(jointBonus(id, site.level + 1))}</Text> at level {site.level + 1}.
      </Text>
      <Text style={styles.small}>Each level up: ×2 honey for everyone for 10 min (×3 for 30 min every 5th level).</Text>
      <View style={{ marginVertical: 8 }}>
        <Bar value={site.progress / site.goal} color={C.green} height={18} />
        <Text style={styles.barText}>{fmt(site.progress)} / {fmt(site.goal)}</Text>
      </View>
      {Object.entries(site.contributions).sort((a, b) => b[1] - a[1]).map(([pid, amt]) => {
        const m = net.roster.find((r) => r.id === pid);
        return <Text key={pid} style={styles.small}>{m?.avatar} {m?.name ?? 'Someone'} — {fmt(amt)}</Text>;
      })}
      <View style={styles.row}>
        {[0.1, 0.25, 0.5].map((f) => (
          <Button
            key={f} small outline color={C.green} label={`Give ${f * 100}%`} sub={fmt(Math.min(s.honey * f, left))}
            disabled={s.honey * f < 1}
            onPress={() => { wood.giveJoint(id, Math.floor(Math.min(s.honey * f, left))); play('buy'); }}
            style={{ flex: 1 }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-end' },
  tag: { alignItems: 'center', backgroundColor: 'rgba(255,250,232,0.92)', borderRadius: 8, paddingHorizontal: 6, marginBottom: -14, borderWidth: 1, borderColor: '#D9C48E', maxWidth: '100%' },
  tagOn: { borderColor: C.green, borderWidth: 1.5, backgroundColor: 'rgba(236,248,224,0.96)' },
  tagName: { fontFamily: HAND, color: INK },
  tagLevel: { color: '#C27C0E', marginTop: -2, letterSpacing: 1, fontWeight: '700' },
  sheet: { marginTop: 20 },
  title: { fontSize: 17, fontWeight: '900', color: C.ink, marginBottom: 2 },
  small: { color: C.soft, fontSize: 13, fontWeight: '600', marginTop: 2 },
  barText: { textAlign: 'center', fontWeight: '800', color: C.ink, fontSize: 12, marginTop: 3 },
  row: { flexDirection: 'row', gap: 6, marginTop: 6 },
});
