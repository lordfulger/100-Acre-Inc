// The Hundred Acre Wood, drawn in code: rivers, the 100 Aker Wood, the Six Pine
// Trees, and every home you can upgrade. Buildings grow new details with each
// level. Laid out after the geography of the books' map; all art is original.

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { addonsFor, BIZ_BY_ID, LEVEL_PERKS, lookOf, MAX_LOOK, POOH_HOUSE } from '../game/catalog';
import { MapView } from '../game/engine';
import { nativeDriver } from './kit';
import { Portrait, portraitFor } from './Portrait';

export const MAP_W = 600;
export const MAP_H = 1060;
export const HAND = 'PatrickHand_400Regular';

// Where each home stands (centre of its base).
export const PLACES: Record<string, { x: number; y: number }> = {
  ranch: { x: 330, y: 92 },
  kitchen: { x: 95, y: 140 },
  beetree: { x: 445, y: 145 },
  pooh: { x: 72, y: 300 },
  garden: { x: 365, y: 270 },
  works: { x: 535, y: 290 },
  heffalump: { x: 168, y: 382 },
  oak: { x: 455, y: 400 },
  haycorn: { x: 70, y: 492 },
  thistle: { x: 505, y: 505 },
  bridge: { x: 318, y: 640 },
  // Further into the wood.
  pines: { x: 492, y: 700 },
  floody: { x: 470, y: 830 },
  galleons: { x: 130, y: 930 },
  camp: { x: 360, y: 990 },
};

const INK = '#4B3A26';
const TRUNK = '#8A6440';
const LEAF = '#86AD5E';
const LEAF_DARK = '#5E8A47';
const PINE = '#3F6B4A';
const WATER = '#A9CBE0';
const WATER_EDGE = '#5D7F9C';
const HONEY = '#D98A2B';
const GOLD = '#F2C14E';
const SAND = '#EBCB7E';

// ---------- little drawing helpers ----------

const Pot = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <G transform={`translate(${x},${y}) scale(${s})`}>
    <Path d="M-5 0 Q-7.5 -5 -4.5 -9 L4.5 -9 Q7.5 -5 5 0 Z" fill={HONEY} stroke={INK} strokeWidth={0.8} />
    <Rect x={-5} y={-11.5} width={10} height={3} rx={1.2} fill="#F3D9A0" stroke={INK} strokeWidth={0.6} />
  </G>
);

const Hive = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <G transform={`translate(${x},${y}) scale(${s})`}>
    <Ellipse cx={0} cy={0} rx={6} ry={8} fill={GOLD} stroke={INK} strokeWidth={0.8} />
    <Line x1={-5.5} y1={-3} x2={5.5} y2={-3} stroke={INK} strokeWidth={0.6} />
    <Line x1={-5.8} y1={1} x2={5.8} y2={1} stroke={INK} strokeWidth={0.6} />
    <Line x1={-4.8} y1={5} x2={4.8} y2={5} stroke={INK} strokeWidth={0.6} />
    <Circle cx={0} cy={3} r={1.3} fill={INK} />
  </G>
);

const Bees = ({ x, y, n, spread = 14 }: { x: number; y: number; n: number; spread?: number }) => (
  <G>
    {Array.from({ length: n }, (_, i) => {
      const a = i * 2.4;
      const r = spread * (0.4 + ((i * 37) % 10) / 16);
      return <Circle key={i} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r * 0.7} r={1.4} fill="#F7D046" stroke={INK} strokeWidth={0.5} />;
    })}
  </G>
);

const Canopy = ({ x, y, r, dark }: { x: number; y: number; r: number; dark?: boolean }) => {
  const c = dark ? LEAF_DARK : LEAF;
  return (
    <G>
      <Circle cx={x - r * 0.7} cy={y + r * 0.25} r={r * 0.7} fill={c} stroke={INK} strokeWidth={1} />
      <Circle cx={x + r * 0.7} cy={y + r * 0.2} r={r * 0.72} fill={c} stroke={INK} strokeWidth={1} />
      <Circle cx={x} cy={y - r * 0.3} r={r * 0.85} fill={c} stroke={INK} strokeWidth={1} />
      <Circle cx={x - r * 0.2} cy={y + r * 0.2} r={r * 0.55} fill={c} />
      <Circle cx={x + r * 0.25} cy={y - r * 0.35} r={r * 0.3} fill="#9DC07A" opacity={0.8} />
    </G>
  );
};

const Tree = ({ x, y, s = 1, dark }: { x: number; y: number; s?: number; dark?: boolean }) => (
  <G transform={`translate(${x},${y}) scale(${s})`}>
    <Path d="M-2.5 0 L-1.8 -16 L1.8 -16 L2.5 0 Z" fill={TRUNK} stroke={INK} strokeWidth={0.8} />
    <Canopy x={0} y={-24} r={11} dark={dark} />
  </G>
);

const PineTree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <G transform={`translate(${x},${y}) scale(${s})`}>
    <Rect x={-1.5} y={-8} width={3} height={8} fill={TRUNK} />
    <Polygon points="0,-46 -9,-24 9,-24" fill={PINE} stroke={INK} strokeWidth={0.8} />
    <Polygon points="0,-36 -11,-14 11,-14" fill={PINE} stroke={INK} strokeWidth={0.8} />
    <Polygon points="0,-26 -12,-6 12,-6" fill={PINE} stroke={INK} strokeWidth={0.8} />
  </G>
);

const Grass = ({ x, y }: { x: number; y: number }) => (
  <Path d={`M${x - 4} ${y} l2 -5 M${x} ${y} l0 -6 M${x + 4} ${y} l-2 -5`} stroke={LEAF_DARK} strokeWidth={1} />
);

const Bunting = ({ x1, y1, x2, y2, n = 6 }: { x1: number; y1: number; x2: number; y2: number; n?: number }) => {
  const colors = ['#E46A8C', '#F2C14E', '#5A8FD6', '#7FB85A'];
  return (
    <G>
      <Path d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + 8} ${x2} ${y2}`} stroke={INK} strokeWidth={0.7} fill="none" />
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * 4;
        return <Polygon key={i} points={`${x - 3},${y} ${x + 3},${y} ${x},${y + 6}`} fill={colors[i % colors.length]} stroke={INK} strokeWidth={0.4} />;
      })}
    </G>
  );
};

/** A painted board with hand-lettered words, squeezed to fit whatever font the phone has. */
const Sign = ({ x, y, w, lines }: { x: number; y: number; w: number; lines: string[] }) => {
  const lineH = 5.6;
  const h = lines.length * lineH + 3.4;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} fill="#F4E8C8" stroke={INK} strokeWidth={0.7} />
      {lines.map((text, i) => (
        <SvgText
          key={i} x={x + w / 2} y={y + 6 + i * lineH} fontSize={5.6} fill={INK} textAnchor="middle" fontFamily={HAND}
          textLength={w - 3} lengthAdjust="spacingAndGlyphs"
        >
          {text}
        </SvgText>
      ))}
    </G>
  );
};

const Glow = ({ r }: { r: number }) => <Circle cx={0} cy={-r * 0.6} r={r} fill={GOLD} opacity={0.22} />;

// ---------- the homes ----------

function PoohHouse({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 5 && <Glow r={58} />}
      <Path d="M-20 0 Q-16 -30 -14 -52 L14 -52 Q16 -30 22 0 Z" fill={TRUNK} stroke={INK} strokeWidth={1.2} />
      <Canopy x={0} y={-72} r={30} />
      <Path d="M-8 0 L-8 -20 Q0 -30 8 -20 L8 0 Z" fill="#C98B3E" stroke={INK} strokeWidth={1} />
      <Circle cx={5} cy={-10} r={1.2} fill={INK} />
      <Sign x={-15} y={-38} w={30} lines={['MR SANDERS']} />
      {Array.from({ length: Math.min(6, 1 + lv) }, (_, i) => <Pot key={i} x={14 + i * 8} y={0} s={0.85} />)}
      {lv >= 2 && (
        <G>
          <Rect x={-46} y={-8} width={24} height={7} rx={3.5} fill={TRUNK} stroke={INK} strokeWidth={0.8} />
          <Ellipse cx={-46} cy={-4.5} rx={2.5} ry={3.5} fill="#C9A274" stroke={INK} strokeWidth={0.6} />
        </G>
      )}
      {lv >= 3 && (
        <G>
          <Line x1={22} y1={-22} x2={44} y2={-22} stroke={TRUNK} strokeWidth={2.5} />
          <Pot x={26} y={-23} s={0.7} /><Pot x={33} y={-23} s={0.7} /><Pot x={40} y={-23} s={0.7} />
        </G>
      )}
      {lv >= 4 && <Bunting x1={-30} y1={-46} x2={30} y2={-48} n={7} />}
    </G>
  );
}

function BeeTreeArt({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 5 && <Glow r={50} />}
      <Path d="M-6 0 Q-4 -40 -3 -62 L3 -62 Q4 -40 7 0 Z" fill={TRUNK} stroke={INK} strokeWidth={1} />
      <Path d="M-2 -40 Q-14 -50 -20 -58 M2 -46 Q12 -54 18 -62" stroke={INK} strokeWidth={1.5} fill="none" />
      <Canopy x={0} y={-78} r={24} />
      <Ellipse cx={2} cy={-30} rx={2.5} ry={4} fill="#3A2A1A" />
      {lv >= 1 && <Hive x={16} y={-60} />}
      {lv >= 3 && <Hive x={-18} y={-66} s={0.9} />}
      {lv >= 2 && (
        <G>
          <Path d="M16 -51 q-1.5 4 0 6 q1.5 -2 0 -6" fill={HONEY} />
          <Path d="M13 -51 q-1 3 0 4 q1 -1 0 -4" fill={HONEY} />
        </G>
      )}
      {lv >= 4 && (
        <G>
          <Line x1={-22} y1={0} x2={-8} y2={-44} stroke={TRUNK} strokeWidth={1.5} />
          <Line x1={-15} y1={0} x2={-2} y2={-42} stroke={TRUNK} strokeWidth={1.5} />
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <Line key={t} x1={-22 + 14 * t} y1={-44 * t} x2={-15 + 13 * t} y2={-42 * t} stroke={TRUNK} strokeWidth={1.2} />
          ))}
        </G>
      )}
      <Bees x={4} y={-36} n={4 + lv * 3} spread={16 + lv * 2} />
    </G>
  );
}

function PigletHouse({ lv }: { lv: number }) {
  const blossoms = [0, 4, 4, 9, 9, 14][lv];
  return (
    <G>
      {lv >= 5 && (
        <G><Tree x={-40} y={2} s={0.8} /><Tree x={44} y={4} s={0.75} /></G>
      )}
      <Path d="M-16 0 Q-12 -26 -10 -46 L10 -46 Q12 -26 16 0 Z" fill="#9C7A55" stroke={INK} strokeWidth={1.1} />
      <Canopy x={0} y={-64} r={26} dark />
      <Circle cx={0} cy={-12} r={8} fill="#6E9A4C" stroke={INK} strokeWidth={1} />
      <Line x1={0} y1={-20} x2={0} y2={-4} stroke={INK} strokeWidth={0.6} />
      <Line x1={24} y1={0} x2={24} y2={-22} stroke={TRUNK} strokeWidth={2} />
      <G transform="rotate(-8 30 -20)">
        <Sign x={16} y={-26} w={32} lines={['TRESPASSERS W']} />
      </G>
      {lv >= 4 && (
        <G>
          <Rect x={-7} y={-36} width={9} height={8} fill="#F8E7A8" stroke={INK} strokeWidth={0.7} />
          <Rect x={-8} y={-28} width={11} height={3} fill={TRUNK} />
          <Circle cx={-6} cy={-29} r={1.5} fill="#E46A8C" /><Circle cx={-2} cy={-29} r={1.5} fill={GOLD} /><Circle cx={2} cy={-29} r={1.5} fill="#E46A8C" />
        </G>
      )}
      {lv >= 2 && Array.from({ length: 7 }, (_, i) => (
        <Line key={i} x1={-34 + i * 4} y1={2} x2={-34 + i * 4} y2={-6} stroke={TRUNK} strokeWidth={1} />
      ))}
      {lv >= 2 && <Line x1={-35} y1={-3} x2={-10} y2={-3} stroke={TRUNK} strokeWidth={0.8} />}
      {Array.from({ length: blossoms }, (_, i) => (
        <Circle key={i} cx={-40 + ((i * 17) % 30) + (i > 6 ? 50 : 0)} cy={4 - ((i * 7) % 8)} r={2} fill={i % 2 ? '#F1A7C1' : '#FFFFFF'} stroke={INK} strokeWidth={0.4} />
      ))}
    </G>
  );
}

function RabbitFarm({ lv }: { lv: number }) {
  const rows = [1, 2, 2, 3, 3, 4][lv];
  return (
    <G>
      {lv >= 5 && (
        <G>
          <Rect x={30} y={-40} width={26} height={18} fill="#CFE6F2" opacity={0.85} stroke={INK} strokeWidth={0.8} />
          <Polygon points="28,-40 43,-50 58,-40" fill="#E4F2F8" stroke={INK} strokeWidth={0.8} />
          <Line x1={43} y1={-40} x2={43} y2={-22} stroke={INK} strokeWidth={0.5} />
        </G>
      )}
      <Path d="M-55 0 Q-50 -30 -25 -32 Q0 -30 4 0 Z" fill="#B9C98A" stroke={INK} strokeWidth={1.1} />
      <Ellipse cx={-26} cy={-6} rx={8} ry={7} fill="#4A3624" stroke={INK} strokeWidth={0.8} />
      <Path d="M-38 -26 l-3 -8 M-14 -27 l3 -7" stroke={LEAF_DARK} strokeWidth={1.4} />
      {Array.from({ length: rows }, (_, r) => {
        const y = -2 - r * 8;
        return (
          <G key={r}>
            <Line x1={8} y1={y} x2={56} y2={y} stroke="#8A6440" strokeWidth={3} strokeLinecap="round" />
            {Array.from({ length: 6 }, (_, i) => (
              <G key={i}>
                <Polygon points={`${11 + i * 8},${y - 1} ${13 + i * 8},${y - 1} ${12 + i * 8},${y + 3}`} fill="#E8833A" />
                <Path d={`M${12 + i * 8} ${y - 1} l-2 -4 M${12 + i * 8} ${y - 1} l0 -5 M${12 + i * 8} ${y - 1} l2 -4`} stroke="#5E8A47" strokeWidth={0.9} />
              </G>
            ))}
          </G>
        );
      })}
      {Array.from({ length: 8 }, (_, i) => <Line key={i} x1={4 + i * 8} y1={4} x2={4 + i * 8} y2={-4} stroke={TRUNK} strokeWidth={1} />)}
      <Line x1={3} y1={0} x2={61} y2={0} stroke={TRUNK} strokeWidth={0.8} />
      {lv >= 2 && (
        <G>
          <Line x1={-64} y1={2} x2={-64} y2={-26} stroke={TRUNK} strokeWidth={1.6} />
          <Line x1={-73} y1={-18} x2={-55} y2={-18} stroke={TRUNK} strokeWidth={1.6} />
          <Circle cx={-64} cy={-28} r={4} fill="#F4E8C8" stroke={INK} strokeWidth={0.7} />
          <Rect x={-69} y={-34} width={10} height={3} fill={INK} />
        </G>
      )}
      {lv >= 4 && <G><Hive x={16} y={-38} s={0.7} /><Hive x={26} y={-40} s={0.7} /><Hive x={-2} y={-36} s={0.7} /></G>}
    </G>
  );
}

function OwlHouse({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 5 && <Glow r={56} />}
      <Path d="M-18 0 Q-14 -40 -12 -66 L12 -66 Q14 -40 18 0 Z" fill="#7A5A3A" stroke={INK} strokeWidth={1.2} />
      <Canopy x={0} y={-86} r={32} dark />
      <Path d="M-7 0 L-7 -18 Q0 -25 7 -18 L7 0 Z" fill="#6E4C2E" stroke={INK} strokeWidth={0.9} />
      {/* Owl's notice, spelt the way Christopher Robin wrote it. */}
      <Sign x={-15} y={-40} w={30} lines={['PLES RING IF AN', 'RNSER IS REQIRD']} />
      <Line x1={10} y1={-24} x2={10} y2={-12} stroke={INK} strokeWidth={0.6} />
      <Circle cx={10} cy={-11} r={1.6} fill={GOLD} stroke={INK} strokeWidth={0.4} />
      <Ellipse cx={-2} cy={-52} rx={6} ry={7} fill={lv >= 4 ? '#F8E7A8' : '#3A2A1A'} stroke={INK} strokeWidth={0.8} />
      {lv >= 4 && <G><Line x1={-6} y1={-50} x2={2} y2={-50} stroke="#C8553D" strokeWidth={1.4} /><Line x1={-6} y1={-54} x2={2} y2={-54} stroke="#5A8FD6" strokeWidth={1.4} /></G>}
      {lv >= 2 && <Ellipse cx={8} cy={-44} rx={4} ry={5} fill="#F8E7A8" stroke={INK} strokeWidth={0.7} />}
      {lv >= 1 && (
        <G>
          <Path d="M18 -60 Q28 -62 30 -56" stroke={TRUNK} strokeWidth={2} fill="none" />
          <Line x1={30} y1={-56} x2={30} y2={-50} stroke={INK} strokeWidth={0.5} />
          <Rect x={27} y={-50} width={6} height={8} rx={1} fill={GOLD} stroke={INK} strokeWidth={0.6} />
        </G>
      )}
      {lv >= 3 && (
        <G>
          <Line x1={0} y1={-116} x2={0} y2={-130} stroke={INK} strokeWidth={1} />
          <Polygon points="-7,-127 7,-127 9,-129 7,-131 -7,-131" fill={INK} />
        </G>
      )}
      {lv >= 5 && <Line x1={-6} y1={-52} x2={-22} y2={-62} stroke="#B88A00" strokeWidth={3} strokeLinecap="round" />}
    </G>
  );
}

function KangaHouse({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 4 && (
        <G>
          <Rect x={22} y={-20} width={20} height={20} fill="#F6EBD2" stroke={INK} strokeWidth={0.9} />
          <Polygon points="20,-20 32,-30 44,-20" fill="#B5643E" stroke={INK} strokeWidth={0.9} />
        </G>
      )}
      <Rect x={-24} y={-30} width={46} height={30} fill="#F6EBD2" stroke={INK} strokeWidth={1.1} />
      <Polygon points="-30,-30 -1,-54 28,-30" fill="#B5643E" stroke={INK} strokeWidth={1.1} />
      <Rect x={-6} y={-18} width={11} height={18} fill="#8A5A34" stroke={INK} strokeWidth={0.8} />
      <Rect x={-19} y={-23} width={9} height={8} fill="#CFE6F2" stroke={INK} strokeWidth={0.7} />
      <Rect x={9} y={-23} width={9} height={8} fill="#CFE6F2" stroke={INK} strokeWidth={0.7} />
      {lv >= 1 && (
        <G>
          <Rect x={10} y={-56} width={7} height={14} fill="#9C6B4A" stroke={INK} strokeWidth={0.8} />
          <Path d="M13 -58 q-5 -6 0 -10 q5 -4 0 -9 q-4 -4 1 -8" stroke="#B9B2A6" strokeWidth={2} fill="none" />
        </G>
      )}
      {lv >= 2 && Array.from({ length: 9 }, (_, i) => (
        <Circle key={i} cx={-26 + i * 5} cy={5} r={2} fill={['#E46A8C', GOLD, '#B39DDB'][i % 3]} stroke={INK} strokeWidth={0.4} />
      ))}
      {lv >= 3 && (
        <G>
          <Line x1={-46} y1={2} x2={-40} y2={-26} stroke={TRUNK} strokeWidth={1.5} />
          <Line x1={-30} y1={2} x2={-36} y2={-26} stroke={TRUNK} strokeWidth={1.5} />
          <Line x1={-42} y1={-26} x2={-34} y2={-26} stroke={TRUNK} strokeWidth={1.5} />
          <Line x1={-40} y1={-26} x2={-40} y2={-10} stroke={INK} strokeWidth={0.5} />
          <Line x1={-36} y1={-26} x2={-36} y2={-10} stroke={INK} strokeWidth={0.5} />
          <Rect x={-42} y={-11} width={8} height={2} fill="#C8553D" />
        </G>
      )}
      {lv >= 5 && (
        <G>
          <Circle cx={-1} cy={-40} r={6} fill={GOLD} stroke={INK} strokeWidth={0.8} />
          <Path d="M-4 -41 q3 -3 6 0 q-3 3 -6 0" stroke={HONEY} strokeWidth={1} fill="none" />
        </G>
      )}
    </G>
  );
}

function EeyorePlace({ lv }: { lv: number }) {
  const thistles = [2, 3, 5, 6, 8, 9][lv];
  return (
    <G>
      <Ellipse cx={0} cy={-2} rx={52} ry={14} fill="#9DB39A" opacity={0.75} />
      <Ellipse cx={-10} cy={0} rx={20} ry={5} fill="#7E9AA8" opacity={0.6} />
      {[-40, -22, 14, 34, 46].map((x) => <Grass key={x} x={x} y={4} />)}
      {lv >= 1 && (
        <G>
          {[-12, -6, 0, 6, 12, 18].map((dx, i) => (
            <Line key={i} x1={8 + dx} y1={0} x2={14 + dx * 0.2} y2={-30} stroke={TRUNK} strokeWidth={1.6} />
          ))}
          <Line x1={-6} y1={-20} x2={34} y2={-20} stroke={TRUNK} strokeWidth={1.2} />
        </G>
      )}
      {Array.from({ length: thistles }, (_, i) => {
        const x = -44 + ((i * 23) % 60);
        const h = 12 + ((i * 5) % 7);
        return (
          <G key={i}>
            <Line x1={x} y1={0} x2={x} y2={-h} stroke={LEAF_DARK} strokeWidth={1} />
            <Circle cx={x} cy={-h - 2} r={3} fill="#9B6BB3" stroke={INK} strokeWidth={0.5} />
            <Path d={`M${x - 3} ${-h} l6 0`} stroke={LEAF_DARK} strokeWidth={1.2} />
          </G>
        );
      })}
      {lv >= 3 && <Pot x={40} y={0} s={1.1} />}
      {lv >= 5 && (
        <G>
          <Path d="M28 -6 Q30 -30 34 -50" stroke={INK} strokeWidth={0.6} fill="none" />
          <Ellipse cx={34} cy={-58} rx={8} ry={10} fill="#D9534F" stroke={INK} strokeWidth={0.8} />
        </G>
      )}
    </G>
  );
}

function TiggerHill({ lv }: { lv: number }) {
  return (
    <G>
      <Path d="M-60 2 Q-30 -26 0 -28 Q30 -26 60 2 Z" fill="#C7D98F" stroke={INK} strokeWidth={1} />
      <Tree x={-44} y={-4} s={0.7} /><Tree x={-34} y={-8} s={0.6} />
      {lv >= 2 && (
        <G transform="translate(8,-18)">
          <Rect x={-14} y={-6} width={28} height={12} fill="#E9F0F7" stroke={INK} strokeWidth={0.6} />
          {[-7, 0, 7].map((x) => <Line key={x} x1={x} y1={-6} x2={x} y2={6} stroke="#D9534F" strokeWidth={1.4} />)}
          <Line x1={-14} y1={0} x2={14} y2={0} stroke="#D9534F" strokeWidth={1.4} />
          <Pot x={18} y={6} s={0.8} />
        </G>
      )}
      {lv >= 1 && (
        <G>
          <Path d="M-14 -28 l4 -3 l-8 -3 l8 -3 l-8 -3 l4 -3" stroke={INK} strokeWidth={1} fill="none" />
          <Rect x={-20} y={-46} width={12} height={3} fill="#E8833A" stroke={INK} strokeWidth={0.6} />
        </G>
      )}
      {lv >= 4 && (
        <G>
          <Path d="M36 -12 l4 -3 l-8 -3 l8 -3 l-8 -3 l4 -3" stroke={INK} strokeWidth={1} fill="none" />
          <Rect x={30} y={-30} width={12} height={3} fill="#E8833A" stroke={INK} strokeWidth={0.6} />
        </G>
      )}
      {lv >= 3 && <Bunting x1={-28} y1={-40} x2={46} y2={-36} n={8} />}
      {lv >= 5 && (
        <G>
          <Ellipse cx={22} cy={-4} rx={16} ry={4} fill="#3A3A3A" stroke={INK} strokeWidth={0.6} />
          <Line x1={10} y1={-2} x2={8} y2={4} stroke={INK} strokeWidth={1} /><Line x1={34} y1={-2} x2={36} y2={4} stroke={INK} strokeWidth={1} />
        </G>
      )}
      <Bees x={0} y={-48} n={3 + lv * 2} spread={18} />
    </G>
  );
}

function RobinHouse({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 5 && <Glow r={58} />}
      <Path d="M-20 0 Q-16 -36 -14 -60 L14 -60 Q16 -36 22 0 Z" fill={TRUNK} stroke={INK} strokeWidth={1.2} />
      <Path d="M-10 -50 Q-26 -60 -38 -60 M10 -54 Q24 -62 34 -64" stroke={INK} strokeWidth={2} fill="none" />
      <Canopy x={0} y={-82} r={30} />
      <Path d="M-8 0 L-8 -22 Q0 -32 8 -22 L8 0 Z" fill="#4E8B4A" stroke={INK} strokeWidth={1} />
      <Circle cx={5} cy={-11} r={1.2} fill={GOLD} />
      <Rect x={20} y={-8} width={12} height={8} fill="#C9A274" stroke={INK} strokeWidth={0.7} />
      {lv >= 1 && (
        <G>
          <Line x1={-30} y1={-59} x2={-30} y2={-16} stroke={INK} strokeWidth={0.6} />
          <Line x1={-22} y1={-56} x2={-22} y2={-16} stroke={INK} strokeWidth={0.6} />
          <Rect x={-32} y={-17} width={12} height={2.5} fill={TRUNK} />
        </G>
      )}
      {lv >= 3 && (
        <G>
          <Rect x={-24} y={-70} width={48} height={4} fill={TRUNK} stroke={INK} strokeWidth={0.7} />
          {[-22, -12, 0, 12, 22].map((x) => <Line key={x} x1={x} y1={-70} x2={x} y2={-77} stroke={TRUNK} strokeWidth={1} />)}
          <Line x1={-24} y1={-77} x2={24} y2={-77} stroke={TRUNK} strokeWidth={1} />
        </G>
      )}
      {lv >= 4 && (
        <G>
          <Rect x={-10} y={-96} width={20} height={16} fill="#F6EBD2" stroke={INK} strokeWidth={0.8} />
          <Polygon points="-13,-96 0,-106 13,-96" fill="#B5643E" stroke={INK} strokeWidth={0.8} />
        </G>
      )}
      {lv >= 2 && (
        <G>
          <Line x1={0} y1={lv >= 4 ? -106 : -108} x2={0} y2={-124} stroke={INK} strokeWidth={1} />
          <Polygon points="0,-124 14,-120 0,-116" fill="#5A8FD6" stroke={INK} strokeWidth={0.6} />
        </G>
      )}
      {lv >= 5 && <Line x1={14} y1={-74} x2={30} y2={-84} stroke="#B88A00" strokeWidth={3} strokeLinecap="round" />}
    </G>
  );
}

function HeffalumpTrap({ lv }: { lv: number }) {
  return (
    <G>
      <Ellipse cx={0} cy={-6} rx={30} ry={11} fill="#6B4A2E" stroke={INK} strokeWidth={1.1} />
      <Ellipse cx={0} cy={-5} rx={24} ry={7} fill="#3E2A1A" />
      {[-20, -8, 6, 18].map((x, i) => (
        <Line key={i} x1={x - 8} y1={-12 + (i % 2) * 4} x2={x + 10} y2={-2 - (i % 2) * 4} stroke={TRUNK} strokeWidth={1.6} />
      ))}
      {[-14, 2, 14].map((x) => <Ellipse key={x} cx={x} cy={-8} rx={4} ry={2} fill={LEAF} stroke={INK} strokeWidth={0.4} />)}
      {lv >= 1 && (
        <G>
          <Line x1={-26} y1={-2} x2={-18} y2={-28} stroke={TRUNK} strokeWidth={1.4} />
          <Line x1={-20} y1={0} x2={-12} y2={-26} stroke={TRUNK} strokeWidth={1.4} />
          {[0.3, 0.6, 0.9].map((t) => <Line key={t} x1={-26 + 8 * t} y1={-2 - 26 * t} x2={-20 + 8 * t} y2={-26 * t} stroke={TRUNK} strokeWidth={1} />)}
        </G>
      )}
      {lv >= 2 && <Pot x={2} y={-14} s={1.2} />}
      {lv >= 3 && [-36, 36].map((x) => (
        <G key={x}>
          <Line x1={x} y1={4} x2={x} y2={-24} stroke={TRUNK} strokeWidth={1.4} />
          <Rect x={x - 3} y={-30} width={6} height={7} rx={1} fill={GOLD} stroke={INK} strokeWidth={0.6} />
        </G>
      ))}
      {lv >= 4 && (
        <G>
          <Line x1={28} y1={6} x2={60} y2={6} stroke={INK} strokeWidth={0.8} />
          <Line x1={28} y1={9} x2={60} y2={9} stroke={INK} strokeWidth={0.8} />
          <Rect x={40} y={-4} width={14} height={9} fill="#7A7A7A" stroke={INK} strokeWidth={0.7} />
          <Circle cx={43} cy={6} r={2} fill={INK} /><Circle cx={51} cy={6} r={2} fill={INK} />
          <Ellipse cx={47} cy={-4} rx={6} ry={2.5} fill={HONEY} />
        </G>
      )}
      {lv >= 5 && [-46, -40, -50, 26, 32].map((x, i) => <Pot key={i} x={x} y={i === 2 ? -9 : 4} s={0.8} />)}
    </G>
  );
}

function BridgeArt({ lv }: { lv: number }) {
  const barges = [0, 1, 1, 2, 2, 4][lv];
  return (
    <G>
      {Array.from({ length: barges }, (_, i) => {
        const x = [-6, 12, -16, 20][i];
        const y = [26, 46, 60, -32][i];
        return (
          <G key={i} transform={`translate(${x},${y})`}>
            <Path d="M-10 0 L10 0 L7 5 L-7 5 Z" fill={TRUNK} stroke={INK} strokeWidth={0.7} />
            <Pot x={-3} y={0} s={0.7} /><Pot x={4} y={0} s={0.7} />
          </G>
        );
      })}
      <Path d="M-46 4 Q0 -22 46 4 L46 10 Q0 -14 -46 10 Z" fill="#B48A5E" stroke={INK} strokeWidth={1.2} />
      <Path d="M-46 -8 Q0 -34 46 -8" stroke={INK} strokeWidth={1.2} fill="none" />
      {Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        const x = -46 + 92 * t;
        const yTop = -8 - Math.sin(t * Math.PI) * 13;
        const yBot = 4 - Math.sin(t * Math.PI) * 13;
        return <Line key={i} x1={x} y1={yTop} x2={x} y2={yBot} stroke={INK} strokeWidth={1} />;
      })}
      {lv >= 2 && [-40, 0, 40].map((x) => {
        const y = -8 - Math.sin(((x + 46) / 92) * Math.PI) * 13;
        return <Rect key={x} x={x - 2.5} y={y - 8} width={5} height={6} rx={1} fill={GOLD} stroke={INK} strokeWidth={0.5} />;
      })}
      {lv >= 4 && [-26, 26].map((x) => {
        const y = -8 - Math.sin(((x + 46) / 92) * Math.PI) * 13;
        return (
          <G key={x}>
            <Line x1={x} y1={y} x2={x} y2={y - 16} stroke={INK} strokeWidth={0.8} />
            <Polygon points={`${x},${y - 16} ${x + 9},${y - 13} ${x},${y - 10}`} fill="#E46A8C" stroke={INK} strokeWidth={0.4} />
          </G>
        );
      })}
    </G>
  );
}

function FloodyDock({ lv }: { lv: number }) {
  const Boat = ({ x, y, sail }: { x: number; y: number; sail?: boolean }) => (
    <G transform={`translate(${x},${y})`}>
      {sail && <Polygon points="0,-30 0,-6 16,-8" fill="#F4E8C8" stroke={INK} strokeWidth={0.8} />}
      {sail && <Line x1={0} y1={-32} x2={0} y2={-4} stroke={INK} strokeWidth={1} />}
      <Path d="M-14 -4 L14 -4 L9 4 L-9 4 Z" fill={TRUNK} stroke={INK} strokeWidth={0.8} />
      {!sail && <Pot x={2} y={-4} s={0.8} />}
    </G>
  );
  return (
    <G>
      <Ellipse cx={0} cy={-2} rx={62} ry={17} fill={WATER} stroke={WATER_EDGE} strokeWidth={1.2} />
      <Ellipse cx={-14} cy={-4} rx={30} ry={6} fill="#C3DCEA" opacity={0.7} />
      <Rect x={-58} y={-14} width={46} height={8} fill="#B48A5E" stroke={INK} strokeWidth={0.9} />
      {[-52, -42, -32, -22].map((x) => <Line key={x} x1={x} y1={-14} x2={x} y2={-6} stroke={INK} strokeWidth={0.5} />)}
      {[-56, -16].map((x) => <Rect key={x} x={x - 1.5} y={-26} width={3} height={22} fill={TRUNK} stroke={INK} strokeWidth={0.5} />)}
      {lv >= 1 && <Boat x={18} y={-4} />}
      {lv >= 2 && [-56, -16].map((x) => <Rect key={x} x={x - 3} y={-34} width={6} height={7} rx={1} fill={GOLD} stroke={INK} strokeWidth={0.5} />)}
      {lv >= 3 && <Boat x={-6} y={8} />}
      {lv >= 4 && <Bunting x1={-56} y1={-26} x2={-16} y2={-26} n={5} />}
      {lv >= 5 && <Boat x={42} y={0} sail />}
    </G>
  );
}

function GalleonsLap({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 5 && <Glow r={60} />}
      <Ellipse cx={0} cy={-4} rx={60} ry={20} fill="#C7D98F" stroke={INK} strokeWidth={1} />
      <Ellipse cx={0} cy={-6} rx={30} ry={9} fill="#E3EDB8" />
      {[[-48, -6, 0.7], [-30, -20, 0.6], [30, -20, 0.6], [48, -6, 0.7], [0, -26, 0.55]].map(([x, y, sc], i) => <Tree key={i} x={x} y={y} s={sc} dark={i % 2 === 0} />)}
      {lv >= 1 && (
        <G transform="translate(-8,-8)">
          <Rect x={-10} y={-4} width={20} height={9} fill="#E9F0F7" stroke={INK} strokeWidth={0.5} />
          {[-5, 0, 5].map((x) => <Line key={x} x1={x} y1={-4} x2={x} y2={5} stroke="#5A8FD6" strokeWidth={1.2} />)}
          <Pot x={13} y={4} s={0.7} />
        </G>
      )}
      {lv >= 2 && [[-22, 2], [-12, 6], [12, 6], [22, 2]].map(([x, y], i) => <Ellipse key={i} cx={x} cy={y} rx={3.5} ry={2.5} fill="#C9C2B5" stroke={INK} strokeWidth={0.5} />)}
      {lv >= 3 && (
        <G>
          <Path d="M10 -6 Q20 -30 26 -52" stroke={INK} strokeWidth={0.6} fill="none" />
          <Polygon points="26,-62 33,-52 26,-42 19,-52" fill="#E46A8C" stroke={INK} strokeWidth={0.6} />
        </G>
      )}
      {lv >= 4 && Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI * (0.1 + (0.8 * i) / 8);
        return <Circle key={i} cx={-Math.cos(a) * 44} cy={-14 - Math.sin(a) * 16} r={1.8} fill={['#F2C14E', '#E46A8C', '#5A8FD6'][i % 3]} />;
      })}
    </G>
  );
}

function ExpoCamp({ lv }: { lv: number }) {
  const Tent = ({ x, s: sc = 1 }: { x: number; s?: number }) => (
    <G transform={`translate(${x},0) scale(${sc})`}>
      <Polygon points="-22,0 0,-34 22,0" fill="#E8C27A" stroke={INK} strokeWidth={1} />
      <Polygon points="-5,0 0,-14 5,0" fill="#8A6440" stroke={INK} strokeWidth={0.6} />
      <Line x1={0} y1={-34} x2={0} y2={-40} stroke={INK} strokeWidth={1} />
    </G>
  );
  return (
    <G>
      <Ellipse cx={0} cy={2} rx={56} ry={10} fill="#DCE6B4" />
      <Tent x={-12} />
      {lv >= 1 && <Tent x={-44} s={0.7} />}
      <G transform="translate(26,0)">
        <Line x1={-8} y1={0} x2={8} y2={-4} stroke={TRUNK} strokeWidth={2.5} />
        <Line x1={-8} y1={-4} x2={8} y2={0} stroke={TRUNK} strokeWidth={2.5} />
        <Path d="M-5 -3 Q0 -18 5 -3 Z" fill="#F08A3C" />
        <Path d="M-2 -3 Q0 -11 2 -3 Z" fill={GOLD} />
      </G>
      {lv >= 2 && (
        <G>
          <Line x1={44} y1={2} x2={44} y2={-26} stroke={TRUNK} strokeWidth={1.4} />
          <Rect x={41} y={-32} width={6} height={7} rx={1} fill={GOLD} stroke={INK} strokeWidth={0.5} />
        </G>
      )}
      {lv >= 3 && (
        <G>
          <Rect x={8} y={-14} width={16} height={3} fill={TRUNK} />
          <Line x1={10} y1={-11} x2={10} y2={0} stroke={TRUNK} strokeWidth={1.2} /><Line x1={22} y1={-11} x2={22} y2={0} stroke={TRUNK} strokeWidth={1.2} />
          <Rect x={10} y={-18} width={12} height={4} fill="#F4E8C8" stroke={INK} strokeWidth={0.4} />
        </G>
      )}
      {lv >= 4 && (
        <G>
          <Line x1={-60} y1={2} x2={-60} y2={-50} stroke={INK} strokeWidth={1} />
          <Polygon points="-60,-50 -46,-46 -60,-42" fill="#C8553D" stroke={INK} strokeWidth={0.5} />
        </G>
      )}
      {lv >= 5 && (
        <G>
          <Line x1={52} y1={2} x2={58} y2={-14} stroke={INK} strokeWidth={0.8} /><Line x1={64} y1={2} x2={58} y2={-14} stroke={INK} strokeWidth={0.8} />
          <Line x1={54} y1={-12} x2={70} y2={-24} stroke="#B88A00" strokeWidth={3} strokeLinecap="round" />
        </G>
      )}
    </G>
  );
}

function HeffalumpPines({ lv }: { lv: number }) {
  return (
    <G>
      {lv >= 5 && <Glow r={60} />}
      {lv >= 3 && <G><PineTree x={-50} y={-2} s={0.75} /><PineTree x={52} y={0} s={0.7} /></G>}
      <PineTree x={-26} y={-4} s={1.05} />
      <PineTree x={4} y={-8} s={1.2} />
      <PineTree x={30} y={-2} s={0.95} />
      {/* Big round footprints: something very large walks here. */}
      {[[-30, 8], [-12, 4], [8, 9], [26, 5]].map(([x, y], i) => <Ellipse key={i} cx={x} cy={y} rx={6} ry={3.5} fill="#B9B2A6" opacity={0.8} />)}
      {lv >= 1 && <G><Pot x={-40} y={6} s={1.1} /><Pot x={42} y={7} s={1} /></G>}
      {lv >= 2 && <G><Hive x={-18} y={-30} s={0.7} /><Hive x={14} y={-40} s={0.7} /></G>}
      {lv >= 4 && [-38, 40].map((x) => (
        <G key={x}>
          <Line x1={x} y1={4} x2={x} y2={-22} stroke={TRUNK} strokeWidth={1.4} />
          <Rect x={x - 3} y={-28} width={6} height={7} rx={1} fill={GOLD} stroke={INK} strokeWidth={0.5} />
        </G>
      ))}
    </G>
  );
}

const ART: Record<string, (p: { lv: number }) => React.ReactElement> = {
  pooh: PoohHouse, beetree: BeeTreeArt, haycorn: PigletHouse, garden: RabbitFarm, oak: OwlHouse, kitchen: KangaHouse,
  thistle: EeyorePlace, ranch: TiggerHill, works: RobinHouse, heffalump: HeffalumpTrap, bridge: BridgeArt,
  floody: FloodyDock, galleons: GalleonsLap, camp: ExpoCamp, pines: HeffalumpPines,
};

// Past Legendary every new look adds a gold star round the home, then the stars
// get a golden halo that grows with each look after that.
const NAMED_LOOKS = LEVEL_PERKS.pooh.length;
const STAR_SPOTS: [number, number][] = [
  [-52, -62], [52, -64], [-64, -30], [64, -28], [-38, -104], [40, -106], [-70, -4], [70, -6], [-14, -122], [16, -124],
];
const Star = ({ x, y }: { x: number; y: number }) => (
  <Polygon
    points="0,-6.5 1.7,-1.7 6.5,0 1.7,1.7 0,6.5 -1.7,1.7 -6.5,0 -1.7,-1.7"
    transform={`translate(${x},${y})`} fill={GOLD} stroke="#B88A00" strokeWidth={0.7}
  />
);

/** One home as it looks at a given look (level ÷ 5), including the extras past Legendary. */
export function HomeArt({ id, look }: { id: string; look: number }) {
  const Art = ART[id];
  const extra = Math.min(MAX_LOOK, look) - NAMED_LOOKS;
  const halo = Math.max(0, extra - STAR_SPOTS.length);
  return (
    <G>
      {halo > 0 && <Circle cx={0} cy={-50} r={58 + halo} fill={GOLD} opacity={0.12 + halo * 0.015} />}
      <Art lv={Math.min(NAMED_LOOKS, look)} />
      {STAR_SPOTS.slice(0, Math.max(0, extra)).map(([x, y], i) => <Star key={i} x={x} y={y} />)}
    </G>
  );
}

// How far each home's drawing reaches at its grandest named look (left, top, right, bottom),
// so a close-up can frame it snugly.
const BOUNDS: Record<string, [number, number, number, number]> = {
  pooh: [-58, -106, 59, 8], beetree: [-50, -106, 50, 8], haycorn: [-52, -94, 56, 6], garden: [-73, -50, 61, 6],
  oak: [-56, -131, 56, 8], kitchen: [-46, -85, 44, 7], thistle: [-52, -68, 52, 12], ranch: [-60, -60, 60, 6],
  works: [-58, -124, 58, 8], heffalump: [-55, -30, 60, 9], bridge: [-46, -40, 46, 65], floody: [-62, -34, 62, 15],
  galleons: [-60, -96, 60, 8], camp: [-60, -50, 70, 12], pines: [-60, -96, 60, 8],
};

/** A close-up of one home, big enough to see every detail, with its add-ons. */
export function HomeCloseUp({ id, look, addons = [], size }: { id: string; look: number; addons?: string[]; size: number }) {
  const owned = addonsFor(id, 0).map((_, i) => addons.includes(`${id}:${i}`));
  // Frame the home, plus any add-ons and stars it has.
  let [x0, y0, x1, y1] = BOUNDS[id];
  const fit = (x: number, y: number, w: number, h: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  };
  owned.forEach((has, i) => has && fit(DECOR[i][0], DECOR[i][1], 17, 17));
  STAR_SPOTS.slice(0, Math.max(0, Math.min(MAX_LOOK, look) - NAMED_LOOKS)).forEach(([x, y]) => fit(x - 7, y - 7, 14, 14));
  const pad = 8;
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  // As tall as the home needs: short and wide for the farm, taller for Owl's tree.
  return (
    <Svg width={size} height={size * Math.min(1, Math.max(0.5, h / w))} viewBox={`${x0 - pad} ${y0 - pad} ${w} ${h}`}>
      <Ellipse cx={(x0 + x1) / 2} cy={4} rx={(x1 - x0) / 2 + pad} ry={10} fill="#D5E4AE" />
      <HomeArt id={id} look={look} />
      {owned.map((has, i) => has && (
        <SvgText key={i} x={DECOR[i][0]} y={DECOR[i][1] + 14} fontSize={15}>{addonsFor(id, 0)[i].emoji}</SvgText>
      ))}
    </Svg>
  );
}

// ---------- the land ----------

const RIVERS = [
  'M548 0 C540 40 575 70 560 110 C548 150 520 165 470 178 C410 192 360 172 300 196 C275 206 262 215 255 232',
  'M0 205 C60 198 110 212 150 218 C190 224 225 222 255 232',
  'M255 232 C262 280 250 320 262 360 C272 400 250 450 230 480 C210 510 240 540 285 560 C330 580 325 610 318 640 C310 690 288 740 320 820 C340 880 290 930 300 980 C305 1010 330 1040 340 1060',
  'M600 420 C560 422 520 428 470 438 C420 450 400 470 370 490 C340 510 300 530 285 560',
  'M0 528 C60 532 120 522 160 506 C190 496 210 490 230 480',
  'M0 722 C60 712 120 738 170 760 C200 772 230 790 240 820 C250 850 280 870 312 880',
  'M600 860 C560 850 530 845 500 840',
];

const PATHS = [
  'M72 308 C110 330 140 360 168 388', 'M72 300 C100 250 90 200 95 150', 'M95 145 C160 120 260 100 330 95',
  'M330 95 C370 110 400 130 445 145', 'M168 392 C130 430 100 460 70 492', 'M72 300 C180 300 260 290 365 272',
  'M365 272 C420 280 480 285 535 292', 'M365 272 C400 320 430 360 455 400', 'M455 405 C470 440 490 470 505 505',
  'M168 392 C220 470 260 560 300 630', 'M505 512 C440 560 380 600 330 638',
  'M330 645 C400 660 450 680 492 700', 'M330 650 C390 720 430 790 470 830', 'M310 650 C250 760 180 850 130 930', 'M140 935 C200 965 280 985 360 990',
];

const FOREST: [number, number, number][] = [
  [220, 360, 1.1], [246, 352, 1.2], [272, 360, 1.15], [300, 350, 1.2], [326, 358, 1.1], [352, 366, 1.05],
  [232, 392, 1.15], [260, 398, 1.2], [288, 390, 1.25], [316, 396, 1.2], [344, 400, 1.1], [372, 392, 1.0],
  [246, 430, 1.1], [276, 436, 1.2], [306, 430, 1.15], [334, 436, 1.05], [392, 372, 0.95], [204, 410, 1.0],
  // trees beside Owl
  [500, 360, 0.95], [528, 372, 1.0], [556, 360, 0.9], [580, 376, 0.85],
  // lower wood
  [80, 650, 1.1], [108, 660, 1.15], [136, 652, 1.1], [164, 664, 1.05], [192, 656, 1.0], [96, 690, 1.1], [126, 700, 1.15],
  [156, 694, 1.05], [186, 700, 1.0], [214, 690, 0.95], [390, 730, 1.0], [418, 740, 1.05], [446, 736, 1.0],
  // scattered
  [30, 380, 0.8], [190, 560, 0.85], [420, 560, 0.8], [575, 560, 0.85], [560, 220, 0.75], [180, 40, 0.7],
  [205, 36, 0.75], [230, 42, 0.7], [380, 50, 0.8], [405, 56, 0.75], [570, 690, 0.9], [560, 760, 0.85], [30, 780, 0.8],
  // further into the wood
  [40, 880, 0.9], [230, 900, 0.85], [250, 940, 0.8], [440, 920, 0.95], [470, 950, 1.0], [500, 925, 0.9], [560, 960, 0.9], [580, 1000, 0.85],
  [60, 1010, 0.9], [100, 1030, 0.85], [200, 1030, 0.8], [470, 1030, 0.85], [540, 1035, 0.9], [20, 960, 0.8],
];

const PINES: [number, number][] = [
  [158, 296], [172, 290], [186, 298], [200, 288], [214, 296], [228, 292],
];

function Land() {
  return (
    <G>
      <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#F4ECD3" />
      {[
        [150, 120, 160, 90], [420, 110, 170, 100], [300, 300, 260, 120], [100, 450, 140, 110], [480, 470, 150, 110],
        [300, 560, 220, 80], [150, 680, 180, 100], [460, 700, 180, 110], [140, 930, 170, 90], [380, 990, 200, 80],
      ].map(([cx, cy, rx, ry], i) => (
        <Ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#DCE6B4" opacity={0.75} />
      ))}
      {/* Boggy places */}
      <Ellipse cx={60} cy={555} rx={70} ry={30} fill="#B9CFC0" opacity={0.6} />
      <Ellipse cx={520} cy={530} rx={80} ry={28} fill="#B9CFC0" opacity={0.6} />
      <Ellipse cx={470} cy={840} rx={95} ry={30} fill="#B9CFC0" opacity={0.6} />
      {/* Sandy pit where Roo plays */}
      <Path d="M150 120 C170 100 250 100 268 118 C280 132 250 150 200 148 C165 147 140 138 150 120 Z" fill={SAND} stroke="#C9A64B" strokeWidth={1} strokeDasharray="2,2" />
      {[170, 190, 214, 240, 252].map((x, i) => <Circle key={x} cx={x} cy={124 + (i % 2) * 10} r={1.2} fill="#C9A64B" />)}
      {/* Big stones and rox */}
      {[[560, 82, 7], [574, 96, 5], [552, 100, 6], [580, 112, 4], [566, 124, 5]].map(([x, y, r], i) => (
        <Ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.75} fill="#C9C2B5" stroke={INK} strokeWidth={0.7} />
      ))}
      {RIVERS.map((d, i) => <Path key={`e${i}`} d={d} stroke={WATER_EDGE} strokeWidth={i === 2 ? 12 : 9} fill="none" strokeLinecap="round" />)}
      {RIVERS.map((d, i) => <Path key={`w${i}`} d={d} stroke={WATER} strokeWidth={i === 2 ? 9 : 6} fill="none" strokeLinecap="round" />)}
      {PATHS.map((d, i) => <Path key={`p${i}`} d={d} stroke="#9C8460" strokeWidth={1.4} strokeDasharray="1,5" strokeLinecap="round" fill="none" />)}
      {/* North Pole */}
      <Line x1={518} y1={60} x2={518} y2={28} stroke={TRUNK} strokeWidth={2} />
      <Polygon points="518,28 532,32 518,37" fill="#C8553D" stroke={INK} strokeWidth={0.5} />
      {/* Compass */}
      <G transform="translate(42,62)">
        <Line x1={0} y1={-28} x2={0} y2={28} stroke={INK} strokeWidth={1} />
        <Line x1={-28} y1={0} x2={28} y2={0} stroke={INK} strokeWidth={1} />
        <Path d="M-4 -4 Q0 -14 4 -4 Q14 0 4 4 Q0 14 -4 4 Q-14 0 -4 -4 Z" fill="none" stroke={INK} strokeWidth={1} />
        <SvgText x={0} y={-31} fontSize={9} fill={INK} textAnchor="middle">N</SvgText>
        <SvgText x={0} y={38} fontSize={9} fill={INK} textAnchor="middle">S</SvgText>
        <SvgText x={34} y={3} fontSize={9} fill={INK} textAnchor="middle">E</SvgText>
        <SvgText x={-34} y={3} fontSize={9} fill={INK} textAnchor="middle">W</SvgText>
      </G>
      {FOREST.map(([x, y, s], i) => <Tree key={`t${i}`} x={x} y={y} s={s} dark={i % 3 === 0} />)}
      {PINES.map(([x, y], i) => <PineTree key={`pn${i}`} x={x} y={y} s={0.9} />)}
      <Ellipse cx={193} cy={300} rx={44} ry={6} fill="#C9A274" opacity={0.6} />
      {/* Where the Woozle wasn't */}
      {[150, 160, 170, 180].map((x, i) => <Path key={x} d={`M${x} ${468 - (i % 2) * 4} q2 -26 4 -34`} stroke={LEAF_DARK} strokeWidth={4} strokeLinecap="round" />)}
      {[148, 158, 168, 178, 188].map((x) => <Circle key={x} cx={x} cy={472} r={1.4} fill="#9C8460" />)}
      {/* Rabbit's friends-and-relations */}
      {[[420, 222], [440, 214], [462, 226], [398, 238]].map(([x, y], i) => (
        <G key={i}><Ellipse cx={x} cy={y} rx={3} ry={2.2} fill="#B5A08A" /><Line x1={x - 1} y1={y - 2} x2={x - 2} y2={y - 6} stroke="#B5A08A" strokeWidth={1} /></G>
      ))}
      {/* Frame */}
      <Rect x={4} y={4} width={MAP_W - 8} height={MAP_H - 8} fill="none" stroke="#C9A64B" strokeWidth={3} />
      <Rect x={10} y={10} width={MAP_W - 20} height={MAP_H - 20} fill="none" stroke="#C9A64B" strokeWidth={1} />
    </G>
  );
}

const LABELS: { text: string; x: number; y: number; size?: number; w?: number }[] = [
  { text: 'NICE FOR PIKNICKS', x: 300, y: 18 },
  { text: 'SANDY PIT WHERE ROO PLAYS', x: 200, y: 124, size: 10, w: 110 },
  { text: 'TO NORTH POLE', x: 470, y: 22, w: 100 },
  { text: 'BIG STONES AND ROX', x: 566, y: 136, size: 9, w: 50 },
  { text: 'SIX PINE TREES', x: 196, y: 306, size: 10 },
  { text: 'RABBITS FRENDS AND RALETIONS', x: 440, y: 214, size: 9, w: 100 },
  { text: '100 ACRE WOOD', x: 296, y: 452, size: 15 },
  { text: 'WHERE THE WOOZLE WASNT', x: 168, y: 478, size: 9, w: 80 },
  { text: 'FLOODY PLACE', x: 56, y: 560, size: 12, w: 70 },
  { text: 'RATHER BOGGY AND SAD', x: 505, y: 568, size: 10 },
  { text: 'FURTHER INTO THE WOOD', x: 300, y: 880, size: 11, w: 130 },
  { text: 'NORTH POLE (PROBABLY)', x: 520, y: 1000, size: 9, w: 90 },
];

function Pulse({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: nativeDriver }),
      Animated.timing(v, { toValue: 0, duration: 600, useNativeDriver: nativeDriver }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>{children}</Animated.View>;
}

// The rivers, woods and labels never change, so they are drawn once and reused.
const StillLand = React.memo(Land);

type Props = {
  view: MapView;
  width: number;
  selected?: string | null;
  upgradable?: Set<string>;
  onSelect?: (id: string) => void;
  /** Homes whose friend is out walking on the map, so their portrait isn't shown at home too. */
  away?: Set<string>;
};

/** True when a home is still hidden: not bought yet and not the next one to unlock. */
const isLocked = (view: MapView, id: string) => id !== 'pooh' && !view.owned[id];

function WoodMapView({ view, width, selected, upgradable, onSelect, away }: Props) {
  const k = width / MAP_W;
  const ids = Object.keys(PLACES);
  return (
    <View style={{ width, height: MAP_H * k }}>
      <Svg width={width} height={MAP_H * k} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        <StillLand />
        {ids.sort((a, b) => PLACES[a].y - PLACES[b].y).map((id) => {
          const { x, y } = PLACES[id];
          const locked = isLocked(view, id);
          return (
            <G key={id} transform={`translate(${x},${y})`} opacity={locked ? 0.3 : 1}>
              {selected === id && <Ellipse cx={0} cy={2} rx={56} ry={12} fill="#FFF3B0" opacity={0.9} stroke={GOLD} strokeWidth={2} />}
              <HomeArt id={id} look={locked ? 0 : lookOf(view.levels[id] || 0)} />
            </G>
          );
        })}
      </Svg>
      {LABELS.map((l, i) => (
        <Text
          key={i}
          pointerEvents="none"
          style={[styles.label, {
            left: (l.x - (l.w ?? 140) / 2) * k, top: (l.y - 8) * k, width: (l.w ?? 140) * k,
            fontSize: Math.max(8, (l.size ?? 12) * k * 1.15),
          }]}
        >
          {l.text}
        </Text>
      ))}
      {ids.map((id) => {
        const { x, y } = PLACES[id];
        const locked = isLocked(view, id);
        const lv = view.levels[id] || 0;
        const name = id === 'pooh' ? POOH_HOUSE.name : BIZ_BY_ID[id].name;
        const manager = id === 'pooh' ? 'pooh' : view.managed[id] ? portraitFor(BIZ_BY_ID[id].manager.emoji) : null;
        const boxW = 120;
        return (
          <Pressable
            key={id}
            disabled={!onSelect}
            onPress={() => onSelect?.(id)}
            style={[styles.hit, { left: (x - boxW / 2) * k, top: (y - 90) * k, width: boxW * k, height: 120 * k }]}
            accessibilityRole="button"
            accessibilityLabel={name}
          >
            {!locked && addonsFor(id, 0).map((a, i) => (view.addons || []).includes(`${id}:${i}`) && (
              <Text key={i} pointerEvents="none" style={[styles.decor, { left: (boxW / 2 + DECOR[i][0]) * k, top: (90 + DECOR[i][1]) * k, fontSize: Math.max(10, 15 * k) }]}>{a.emoji}</Text>
            ))}
            {manager && !locked && !away?.has(id) && <Portrait id={manager} size={Math.max(20, 30 * k)} style={[styles.manager, { right: 4 * k, bottom: 24 * k }]} />}
            <View style={[styles.nameTag, { maxWidth: (boxW + 20) * k }, upgradable?.has(id) && styles.nameTagReady]}>
              {upgradable?.has(id) && <Pulse><Text style={{ fontSize: Math.max(10, 13 * k) }}>⬆️</Text></Pulse>}
              <View style={{ alignItems: 'center', flexShrink: 1 }}>
                <Text style={[styles.name, { fontSize: Math.max(9, 13 * k) }]}>{locked ? `🔒 ${name}` : name}</Text>
                {!locked && <Text style={[styles.stars, { fontSize: Math.max(7, 9 * k) }]}>{lv ? `Lv ${lv} ${'★'.repeat(Math.min(5, lookOf(lv)))}` : 'Lv 0'}</Text>}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Where add-on decorations sit around a home (offsets from the centre of its base).
const DECOR: [number, number][] = [[-58, -14], [-60, -40], [-50, -66], [44, -70], [52, -46], [-30, -92]];

const styles = StyleSheet.create({
  decor: { position: 'absolute' },
  label: { position: 'absolute', textAlign: 'center', color: '#4B3A26', fontFamily: HAND, letterSpacing: 1 },
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-end' },
  manager: { position: 'absolute' },
  nameTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,250,232,0.9)', borderRadius: 8, paddingHorizontal: 5, marginBottom: -14, borderWidth: 1, borderColor: '#D9C48E' },
  nameTagReady: { borderColor: '#5E9E3B', borderWidth: 1.5, backgroundColor: 'rgba(236,248,224,0.95)' },
  name: { fontFamily: HAND, color: '#4B3A26', textAlign: 'center' },
  stars: { color: '#C27C0E', marginTop: -2, letterSpacing: 1 },
});

const upgradableKey = (u?: Set<string>) => (u ? [...u].sort().join(",") : "");

/**
 * The map only redraws when something on it changes (a home bought or upgraded,
 * a manager hired, an add-on, the selection, the size), not every time the honey
 * counter ticks. Redrawing hundreds of trees several times a second made phones lag.
 */
export const WoodMap = React.memo(
  WoodMapView,
  (a, b) =>
    a.width === b.width && a.selected === b.selected && a.onSelect === b.onSelect &&
    upgradableKey(a.upgradable) === upgradableKey(b.upgradable) && upgradableKey(a.away) === upgradableKey(b.away) &&
    JSON.stringify(a.view) === JSON.stringify(b.view),
);
