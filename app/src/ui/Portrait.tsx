// Character portraits. Each one is an original storybook drawing made in code.
// If you put your own picture in assets/portraits/ (e.g. pooh.png) and run
// `npm run portraits`, that picture is used instead — see assets/portraits/README.md.

import React from 'react';
import { Image, StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { PORTRAIT_IMAGES } from './portraitImages';

export type PortraitId = 'pooh' | 'piglet' | 'tigger' | 'rabbit' | 'owl' | 'eeyore' | 'kanga' | 'robin' | 'small' | 'bee' | 'woozle';

const BY_EMOJI: Record<string, PortraitId> = {
  '🐻': 'pooh', '🐷': 'piglet', '🐯': 'tigger', '🐰': 'rabbit', '🦉': 'owl', '🐴': 'eeyore',
  '🦘': 'kanga', '🧒': 'robin', '🐞': 'small', '🐝': 'bee', '🐾': 'woozle',
};

export const portraitFor = (emoji: string): PortraitId | null => BY_EMOJI[emoji] ?? null;

const INK = '#4B3A26';
const sw = { stroke: INK, strokeWidth: 1.6 };

const Eyes = ({ y = 50, dx = 10, r = 3 }: { y?: number; dx?: number; r?: number }) => (
  <G>
    <Circle cx={50 - dx} cy={y} r={r} fill={INK} />
    <Circle cx={50 + dx} cy={y} r={r} fill={INK} />
    <Circle cx={50 - dx + 1} cy={y - 1} r={r * 0.35} fill="white" />
    <Circle cx={50 + dx + 1} cy={y - 1} r={r * 0.35} fill="white" />
  </G>
);

const Cheeks = ({ y = 62, dx = 18 }: { y?: number; dx?: number }) => (
  <G>
    <Circle cx={50 - dx} cy={y} r={5} fill="#F08DA0" opacity={0.35} />
    <Circle cx={50 + dx} cy={y} r={5} fill="#F08DA0" opacity={0.35} />
  </G>
);

const Whiskers = ({ y = 66 }: { y?: number }) => (
  <G stroke={INK} strokeWidth={0.8}>
    <Line x1={30} y1={y - 2} x2={16} y2={y - 5} /><Line x1={30} y1={y + 1} x2={16} y2={y + 2} />
    <Line x1={70} y1={y - 2} x2={84} y2={y - 5} /><Line x1={70} y1={y + 1} x2={84} y2={y + 2} />
  </G>
);

const ART: Record<PortraitId, () => React.ReactElement> = {
  pooh: () => (
    <G>
      <Circle cx={27} cy={30} r={12} fill="#D9A55B" {...sw} /><Circle cx={27} cy={30} r={6} fill="#EBC48A" />
      <Circle cx={73} cy={30} r={12} fill="#D9A55B" {...sw} /><Circle cx={73} cy={30} r={6} fill="#EBC48A" />
      <Ellipse cx={50} cy={57} rx={32} ry={30} fill="#E3B26A" {...sw} />
      <Ellipse cx={50} cy={69} rx={14} ry={10} fill="#F3D9A8" />
      <Ellipse cx={50} cy={63} rx={5} ry={3.6} fill={INK} />
      <Path d="M44 71 Q50 76 56 71" stroke={INK} strokeWidth={1.4} fill="none" />
      <Eyes y={50} />
      <Cheeks />
      <Path d="M80 82 q6 -8 12 -2 l-2 10 q-6 4 -12 0 Z" fill="#D98A2B" {...sw} />
    </G>
  ),
  piglet: () => (
    <G>
      <Polygon points="28,20 20,46 42,38" fill="#F4B6C2" {...sw} />
      <Polygon points="72,20 80,46 58,38" fill="#F4B6C2" {...sw} />
      <Circle cx={50} cy={56} r={30} fill="#F7C4CE" {...sw} />
      <Path d="M48 26 q2 -6 6 -4" stroke={INK} strokeWidth={1.4} fill="none" />
      <Ellipse cx={50} cy={64} rx={11} ry={8} fill="#EE95A8" {...sw} />
      <Ellipse cx={46} cy={64} rx={1.8} ry={2.6} fill={INK} /><Ellipse cx={54} cy={64} rx={1.8} ry={2.6} fill={INK} />
      <Eyes y={50} dx={9} r={2.6} />
      <Cheeks y={60} dx={20} />
      <Path d="M24 82 Q50 92 76 82 L74 90 Q50 98 26 90 Z" fill="#7FB85A" {...sw} />
    </G>
  ),
  tigger: () => (
    <G>
      <Circle cx={28} cy={30} r={10} fill="#F0A04B" {...sw} /><Circle cx={28} cy={30} r={5} fill="#7A4A2A" />
      <Circle cx={72} cy={30} r={10} fill="#F0A04B" {...sw} /><Circle cx={72} cy={30} r={5} fill="#7A4A2A" />
      <Ellipse cx={50} cy={56} rx={32} ry={29} fill="#F0A04B" {...sw} />
      <Path d="M44 28 l2 10 M50 27 l0 11 M56 28 l-2 10 M20 52 l10 2 M19 60 l10 0 M80 52 l-10 2 M81 60 l-10 0" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <Ellipse cx={50} cy={68} rx={16} ry={11} fill="#FBF0DE" />
      <Polygon points="45,61 55,61 50,66" fill="#E07A8A" stroke={INK} strokeWidth={1} />
      <Path d="M44 70 Q50 76 56 70" stroke={INK} strokeWidth={1.4} fill="none" />
      <Eyes y={49} />
      <Whiskers y={68} />
    </G>
  ),
  rabbit: () => (
    <G>
      <Ellipse cx={38} cy={24} rx={7} ry={20} fill="#D8CBB8" {...sw} /><Ellipse cx={38} cy={24} rx={3.5} ry={14} fill="#F1C9CF" />
      <Ellipse cx={62} cy={24} rx={7} ry={20} fill="#D8CBB8" {...sw} /><Ellipse cx={62} cy={24} rx={3.5} ry={14} fill="#F1C9CF" />
      <Circle cx={50} cy={60} r={27} fill="#E6DACB" {...sw} />
      <Ellipse cx={50} cy={66} rx={4} ry={3} fill="#E07A8A" />
      <Rect x={46.5} y={70} width={7} height={7} rx={1} fill="white" stroke={INK} strokeWidth={0.8} />
      <Line x1={50} y1={70} x2={50} y2={77} stroke={INK} strokeWidth={0.6} />
      <Eyes y={54} dx={10} r={2.8} />
      <Whiskers y={67} />
      <Rect x={60} y={80} width={20} height={14} rx={2} fill="#F4E8C8" {...sw} />
      <Line x1={64} y1={85} x2={76} y2={85} stroke={INK} strokeWidth={0.8} /><Line x1={64} y1={89} x2={74} y2={89} stroke={INK} strokeWidth={0.8} />
    </G>
  ),
  owl: () => (
    <G>
      <Polygon points="24,22 32,40 40,30" fill="#8E6A47" {...sw} />
      <Polygon points="76,22 68,40 60,30" fill="#8E6A47" {...sw} />
      <Ellipse cx={50} cy={58} rx={32} ry={32} fill="#A27B55" {...sw} />
      <Circle cx={38} cy={50} r={13} fill="#F3E3C3" />
      <Circle cx={62} cy={50} r={13} fill="#F3E3C3" />
      <Circle cx={38} cy={50} r={6} fill={INK} /><Circle cx={62} cy={50} r={6} fill={INK} />
      <Circle cx={40} cy={48} r={2} fill="white" /><Circle cx={64} cy={48} r={2} fill="white" />
      <Circle cx={38} cy={50} r={10} fill="none" stroke="#B88A00" strokeWidth={2} />
      <Circle cx={62} cy={50} r={10} fill="none" stroke="#B88A00" strokeWidth={2} />
      <Line x1={48} y1={49} x2={52} y2={49} stroke="#B88A00" strokeWidth={2} />
      <Polygon points="45,62 55,62 50,72" fill="#E8A33A" stroke={INK} strokeWidth={1} />
      <Path d="M34 80 q4 -4 8 0 M46 82 q4 -4 8 0 M58 80 q4 -4 8 0" stroke="#7A5A3A" strokeWidth={1.4} fill="none" />
    </G>
  ),
  eeyore: () => (
    <G>
      <Ellipse cx={30} cy={26} rx={7} ry={19} fill="#A9A9B3" {...sw} transform="rotate(-25 30 26)" />
      <Ellipse cx={70} cy={26} rx={7} ry={19} fill="#A9A9B3" {...sw} transform="rotate(25 70 26)" />
      <Ellipse cx={50} cy={50} rx={25} ry={24} fill="#A9A9B3" {...sw} />
      <Path d="M42 26 q4 -10 8 -2 q4 -10 8 0" fill="#4B4B55" {...sw} />
      <Ellipse cx={50} cy={72} rx={20} ry={15} fill="#CFCFD6" {...sw} />
      <Ellipse cx={43} cy={72} rx={2} ry={3} fill={INK} /><Ellipse cx={57} cy={72} rx={2} ry={3} fill={INK} />
      <Path d="M44 80 Q50 78 56 80" stroke={INK} strokeWidth={1.4} fill="none" />
      <Path d="M35 47 q5 4 10 0 M55 47 q5 4 10 0" stroke={INK} strokeWidth={1.8} fill="none" />
      <Path d="M34 44 l10 1 M56 45 l10 -1" stroke={INK} strokeWidth={1.2} />
    </G>
  ),
  kanga: () => (
    <G>
      <Ellipse cx={34} cy={24} rx={7} ry={15} fill="#C99B6B" {...sw} transform="rotate(-15 34 24)" />
      <Ellipse cx={66} cy={24} rx={7} ry={15} fill="#C99B6B" {...sw} transform="rotate(15 66 24)" />
      <Ellipse cx={48} cy={52} rx={26} ry={24} fill="#C99B6B" {...sw} />
      <Ellipse cx={48} cy={62} rx={13} ry={9} fill="#E7C9A6" />
      <Ellipse cx={48} cy={57} rx={4.5} ry={3} fill={INK} />
      <Path d="M43 65 Q48 69 53 65" stroke={INK} strokeWidth={1.3} fill="none" />
      <Eyes y={46} dx={9} r={2.6} />
      <Ellipse cx={74} cy={77} rx={7} ry={5} fill="#C99B6B" {...sw} transform="rotate(-20 74 77)" />
      <Ellipse cx={80} cy={70} rx={2.5} ry={5} fill="#C99B6B" {...sw} />
      <Circle cx={72} cy={84} r={10} fill="#D8AE80" {...sw} />
      <Circle cx={69} cy={82} r={1.5} fill={INK} /><Circle cx={75} cy={82} r={1.5} fill={INK} />
      <Ellipse cx={72} cy={87} rx={2} ry={1.4} fill={INK} />
    </G>
  ),
  robin: () => (
    <G>
      <Path d="M18 100 Q20 80 50 78 Q80 80 82 100 Z" fill="#6E9BC8" {...sw} />
      <Path d="M40 79 L50 88 L60 79" fill="white" {...sw} />
      <Circle cx={22} cy={52} r={6} fill="#F6D3B3" {...sw} /><Circle cx={78} cy={52} r={6} fill="#F6D3B3" {...sw} />
      <Ellipse cx={50} cy={52} rx={27} ry={28} fill="#F6D3B3" {...sw} />
      <Path d="M23 48 Q22 22 50 21 Q78 22 77 48 Q66 36 50 38 Q34 36 23 48 Z" fill="#8A5A34" {...sw} />
      <Eyes y={53} dx={10} r={2.6} />
      <Cheeks y={62} dx={16} />
      <Path d="M43 66 Q50 72 57 66" stroke={INK} strokeWidth={1.4} fill="none" />
    </G>
  ),
  small: () => (
    <G>
      <Line x1={42} y1={28} x2={34} y2={14} stroke={INK} strokeWidth={1.6} /><Circle cx={34} cy={14} r={2.5} fill={INK} />
      <Line x1={58} y1={28} x2={66} y2={14} stroke={INK} strokeWidth={1.6} /><Circle cx={66} cy={14} r={2.5} fill={INK} />
      <Ellipse cx={50} cy={64} rx={30} ry={26} fill="#D9534F" {...sw} />
      <Line x1={50} y1={40} x2={50} y2={90} stroke={INK} strokeWidth={1.6} />
      {[[36, 58], [64, 58], [32, 74], [68, 74], [44, 80], [56, 80]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={4.5} fill={INK} />)}
      <Ellipse cx={50} cy={36} rx={16} ry={12} fill="#3A3A3A" {...sw} />
      <Circle cx={44} cy={35} r={3.6} fill="white" /><Circle cx={56} cy={35} r={3.6} fill="white" />
      <Circle cx={44.5} cy={35.5} r={1.8} fill={INK} /><Circle cx={56.5} cy={35.5} r={1.8} fill={INK} />
    </G>
  ),
  bee: () => (
    <G>
      <Ellipse cx={30} cy={34} rx={14} ry={10} fill="#DDEFF7" opacity={0.9} {...sw} transform="rotate(-30 30 34)" />
      <Ellipse cx={70} cy={34} rx={14} ry={10} fill="#DDEFF7" opacity={0.9} {...sw} transform="rotate(30 70 34)" />
      <Line x1={44} y1={30} x2={38} y2={16} stroke={INK} strokeWidth={1.4} /><Circle cx={38} cy={16} r={2.2} fill={INK} />
      <Line x1={56} y1={30} x2={62} y2={16} stroke={INK} strokeWidth={1.4} /><Circle cx={62} cy={16} r={2.2} fill={INK} />
      <Ellipse cx={50} cy={60} rx={28} ry={27} fill="#F7D046" {...sw} />
      <Path d="M24 66 Q50 72 76 66 L74 74 Q50 80 26 74 Z" fill={INK} />
      <Path d="M30 80 Q50 86 70 80 L64 86 Q50 90 36 86 Z" fill={INK} />
      <Eyes y={50} />
      <Path d="M44 58 Q50 63 56 58" stroke={INK} strokeWidth={1.4} fill="none" />
      <Cheeks y={56} dx={20} />
    </G>
  ),
  woozle: () => (
    <G>
      <Path d="M20 70 Q16 40 30 30 Q36 18 50 24 Q64 18 70 30 Q84 40 80 70 Q74 88 50 86 Q26 88 20 70 Z" fill="#6B5B7B" {...sw} />
      <Path d="M28 34 l-6 -8 M72 34 l6 -8 M40 26 l-2 -8 M60 26 l2 -8" stroke="#6B5B7B" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={40} cy={52} r={8} fill="#FFF3B0" /><Circle cx={60} cy={52} r={8} fill="#FFF3B0" />
      <Circle cx={41} cy={53} r={3.5} fill={INK} /><Circle cx={61} cy={53} r={3.5} fill={INK} />
      <Path d="M44 68 Q50 72 56 68" stroke={INK} strokeWidth={1.4} fill="none" />
      {[[22, 92], [34, 96], [70, 94]].map(([x, y], i) => <Ellipse key={i} cx={x} cy={y} rx={3} ry={2} fill="#9C8460" />)}
    </G>
  ),
};

type Props = { id?: PortraitId | null; emoji?: string; size: number; style?: StyleProp<ViewStyle>; ring?: string };

/** A round character portrait. Pass an `id`, or an `emoji` to map from (falls back to the emoji itself). */
export function Portrait({ id, emoji, size, style, ring = '#FFF8E6' }: Props) {
  const pid = id ?? (emoji ? portraitFor(emoji) : null);
  const frame: ViewStyle = {
    width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: Math.max(1.5, size * 0.05),
    borderColor: ring, backgroundColor: '#EAF2D3', alignItems: 'center', justifyContent: 'center',
  };
  if (!pid) {
    return <View style={[frame, style]}><Text style={{ fontSize: size * 0.6 }}>{emoji}</Text></View>;
  }
  const image = PORTRAIT_IMAGES[pid];
  if (image) {
    return <View style={[frame, style]}><Image source={image} style={{ width: '100%', height: '100%' }} resizeMode="cover" /></View>;
  }
  const Art = ART[pid];
  return (
    <View style={[frame, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100"><Art /></Svg>
    </View>
  );
}
