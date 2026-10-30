// Inside a home: the room, whoever lives there, and the decorations you've put up.
// Opens once you've taken enough naps (see INTERIOR_NAPS).
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BIZ_BY_ID, POOH_HOUSE } from '../game/catalog';
import { seasonAt, SEASONS, weatherAt } from '../game/calendar';
import { COSY_BONUS, HEART_BONUS } from '../game/engine';
import {
  buyDecor, DECOR, DECOR_BY_ID, decorCost, MAX_HEARTS, placeDecor, placedIn, resident, ROOM_SLOTS, takeDownDecor, talk,
} from '../game/extras';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { Button, buzz, C } from '../ui/kit';
import { Portrait } from '../ui/Portrait';
import { HAND } from '../ui/WoodMap';
import { ROOM_IMAGES } from '../ui/roomImages';
import { DECOR_IMAGES } from '../ui/decorImages';
import { play } from '../audio/sound';
import { say } from '../audio/voices';

const WALLS: Record<string, string> = {
  pooh: '#F3D9A0', beetree: '#E9E2B0', haycorn: '#F4C9C9', garden: '#D9E6B8', oak: '#D8C7A8', kitchen: '#F6D8B8', thistle: '#C9CFD6',
  ranch: '#F7C88A', works: '#CFE0C3', heffalump: '#D6C4A6', bridge: '#C7DCE8', floody: '#BFD8E6', galleons: '#E3D9F0', camp: '#E6D7B8', pines: '#C8DBC8',
  pole: '#E4ECF4', mist: '#D8DEDC', spot: '#E8DCC0', bluebell: '#D6DDF2', summit: '#D9E6C4',
};
// Where each decoration stands in the room, as fractions of its width and height.
const SLOTS: [number, number][] = [[0.12, 0.62], [0.86, 0.6], [0.3, 0.8], [0.7, 0.82], [0.1, 0.28], [0.88, 0.3]];

/** A decoration's painting, or its emoji if it has none. */
function DecorIcon({ id, size }: { id: string; size: number }) {
  const img = DECOR_IMAGES[id];
  if (img) return <Image source={img} style={{ width: size, height: size }} />;
  return <Text style={{ fontSize: size * 0.75 }}>{DECOR_BY_ID[id]?.emoji}</Text>;
}

export function HomeInside({ id, onClose }: { id: string; onClose: () => void }) {
  const { s, act, toast, now } = useGame();
  const { width } = useWindowDimensions();
  const [line, setLine] = useState<string | null>(null);
  const [tab, setTab] = useState<'mine' | 'store'>('mine');
  const who = resident(id);
  const name = id === POOH_HOUSE.id ? POOH_HOUSE.name : BIZ_BY_ID[id].name;
  const room = s.rooms[id] || [];
  const hearts = s.friends[id]?.hearts || 0;
  const w = Math.min(width, 520) - 24;
  const h = w * 0.7;
  const season = SEASONS[seasonAt(now)];
  const weather = weatherAt(now);
  const outside = weather === 'rain' ? '🌧️' : weather === 'snow' ? '🌨️' : weather === 'windy' ? '🍃' : season.emoji;
  const cost = decorCost(s, now);
  const mine = DECOR.filter((d) => s.decor.includes(d.id) && !room.includes(d.id));
  const store = DECOR.filter((d) => d.how === 'shop' && !s.decor.includes(d.id));

  const chat = () => {
    const r = act((g, t) => talk(g, id, t));
    setLine(r.line);
    play('pop');
    say(who.portrait, 'hello');
    if (r.gained) { buzz('success'); toast(`❤️ ${who.name} likes you a little more (${r.hearts}/${MAX_HEARTS})`); }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>🚪 {name}</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Leave"><Text style={styles.close}>✕</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <View style={[styles.room, { width: w, height: h, backgroundColor: WALLS[id] || '#F3D9A0' }]}>
          {ROOM_IMAGES[id] ? (
            // Sized exactly (inside the 3px frame): on the web an image only stretched by its edges shows at full size.
            <Image source={ROOM_IMAGES[id]} style={{ position: 'absolute', left: 0, top: 0, width: w - 6, height: h - 6 }} resizeMode="stretch" />
          ) : (
            <>
              <View style={styles.floor} />
              <View style={[styles.window, { left: w / 2 - 34 }]}><Text style={{ fontSize: 28 }}>{outside}</Text></View>
            </>
          )}
          {room.map((d, i) => DECOR_BY_ID[d] && (
            <Pressable
              key={d}
              onPress={() => { if (act((g) => takeDownDecor(g, id, d))) { play('tick'); toast(`${DECOR_BY_ID[d].emoji} Taken down. It's back in your things.`); } }}
              style={[styles.placed, { left: SLOTS[i][0] * w - 24, top: SLOTS[i][1] * h - 24 }]}
              accessibilityLabel={`Take down ${DECOR_BY_ID[d].name}`}
            >
              <DecorIcon id={d} size={60} />
            </Pressable>
          ))}
          <Pressable onPress={chat} style={[styles.resident, { left: w / 2 - 45, top: h * 0.42 }]} accessibilityLabel={`Talk to ${who.name}`}>
            <Portrait id={who.portrait} size={90} />
          </Pressable>
          {line && <View style={[styles.bubble, { left: w / 2 - 110, top: h * 0.08 + 56 }]}><Text style={styles.bubbleText}>{line}</Text></View>}
        </View>

        <View style={styles.friendRow}>
          <Text style={styles.hearts}>{'❤️'.repeat(hearts)}{'🤍'.repeat(MAX_HEARTS - hearts)}</Text>
          <Button small label={`💬 Talk to ${who.name}`} color={C.pink} onPress={chat} />
        </View>
        <Text style={styles.note}>
          Talk every day to grow your friendship: each heart adds +{HEART_BONUS * 100}% to all honey. Each decoration here adds +{COSY_BONUS * 100}% to this home's {id === 'pooh' ? 'taps' : 'honey'} ({room.length}/{ROOM_SLOTS} spots used). Tap one in the room to take it down.
        </Text>

        <View style={styles.tabs}>
          {(['mine', 'store'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t && { color: 'white' }]}>{t === 'mine' ? `🎒 Your things (${mine.length})` : "🛍️ Rabbit's store"}</Text>
            </Pressable>
          ))}
        </View>
        {tab === 'mine' ? (
          mine.length === 0 ? (
            <Text style={styles.note}>Nothing to put up yet. Buy things in Rabbit's store, help the daily visitors, earn trophies or join holiday events.</Text>
          ) : (
            <View style={styles.grid}>
              {mine.map((d) => {
                const where = placedIn(s, d.id);
                return (
                  <Pressable
                    key={d.id}
                    disabled={room.length >= ROOM_SLOTS}
                    onPress={() => { if (act((g) => placeDecor(g, id, d.id))) { buzz('success'); play('addon'); } }}
                    style={[styles.item, room.length >= ROOM_SLOTS && { opacity: 0.5 }]}
                  >
                    <DecorIcon id={d.id} size={44} />
                    <Text style={styles.itemName} numberOfLines={2}>{d.name}</Text>
                    <Text style={styles.itemSub}>{where ? `Move from ${where === 'pooh' ? "Pooh's" : BIZ_BY_ID[where].name}` : 'Put it up'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )
        ) : (
          <View style={styles.grid}>
            {store.length === 0 && <Text style={styles.note}>You've bought everything Rabbit has. Very Organised.</Text>}
            {store.map((d) => (
              <View key={d.id} style={styles.item}>
                <DecorIcon id={d.id} size={44} />
                <Text style={styles.itemName} numberOfLines={2}>{d.name}</Text>
                <Button small label="Buy" sub={fmt(cost)} disabled={s.honey < cost} onPress={() => { if (act((g, t) => buyDecor(g, d.id, t))) { play('buy'); toast(`${d.emoji} ${d.name} bought! Put it up from Your things.`); } }} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 40 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 4 },
  title: { flex: 1, fontFamily: HAND, fontSize: 24, color: C.ink },
  close: { fontSize: 22, fontWeight: '900', color: C.soft },
  list: { padding: 12, paddingTop: 4, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  room: { borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: '#8A6440', alignSelf: 'center' },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '36%', backgroundColor: '#B98B5C', borderTopWidth: 3, borderTopColor: '#8A6440' },
  window: { position: 'absolute', top: '8%', width: 68, height: 52, borderRadius: 8, backgroundColor: '#CFE6F5', borderWidth: 3, borderColor: '#8A6440', alignItems: 'center', justifyContent: 'center' },
  placed: { position: 'absolute', width: 60, height: 60, marginLeft: -6, marginTop: -6, alignItems: 'center', justifyContent: 'center' },
  resident: { position: 'absolute' },
  bubble: { position: 'absolute', width: 220, backgroundColor: 'white', borderRadius: 14, padding: 9, borderWidth: 1.5, borderColor: '#D9C48E' },
  bubbleText: { fontSize: 14, color: C.ink, fontWeight: '600', textAlign: 'center' },
  friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  hearts: { fontSize: 13, flexShrink: 1 },
  note: { color: C.soft, fontSize: 12, fontWeight: '600', marginTop: 6, lineHeight: 17 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 7, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card },
  tabOn: { backgroundColor: C.green, borderColor: C.green },
  tabText: { fontWeight: '900', color: C.ink, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { width: '31%', padding: 8, borderRadius: 14, backgroundColor: '#FFF6DA', borderWidth: 1.5, borderColor: C.border, alignItems: 'center', gap: 3 },
  itemName: { fontSize: 12, fontWeight: '800', color: C.ink, textAlign: 'center', minHeight: 30 },
  itemSub: { fontSize: 11, color: C.soft, fontWeight: '700', textAlign: 'center' },
});
