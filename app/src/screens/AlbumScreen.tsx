import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ALBUM, ALBUM_BY_ID, AlbumCard, albumMult, CARD_BONUS, SET_BONUS, SETS, setsDone } from '../game/album';
import { TROPHIES } from '../game/extras';
import { useGame } from '../state/GameContext';
import { ALBUM_FULL, ALBUM_THUMBS } from '../ui/albumImages';
import { Bar, C, Card, Section } from '../ui/kit';
import { HAND } from '../ui/WoodMap';
import { play } from '../audio/sound';

const RATIO = 960 / 800;

/** A card with no painted picture yet: drawn as a framed emoji. */
function EmojiCard({ card, width }: { card: AlbumCard; width: number }) {
  return (
    <View style={[styles.slot, styles.emojiCard, { width, height: width * RATIO }]}>
      <Text style={{ fontSize: width * 0.42 }}>{card.emoji}</Text>
      <Text style={[styles.emojiName, { fontSize: Math.max(11, width * 0.11) }]} numberOfLines={2}>{card.name}</Text>
    </View>
  );
}

export function AlbumScreen() {
  const { s, act } = useGame();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<AlbumCard | null>(null);
  const [view, setView] = useState<'cards' | 'trophies'>('cards');
  // Cards found since you last looked keep their "New!" ribbon for this visit.
  const [fresh] = useState(() => [...s.albumNew]);
  useEffect(() => { if (s.albumNew.length) act((g) => { g.albumNew = []; }); }, [s.albumNew.length, act]);

  const found = ALBUM.filter((c) => s.album.includes(c.id)).length;
  const cardW = (Math.min(width, 520) - 24 - 16) / 3;
  const done = setsDone(s.album);
  const bigW = Math.min(width - 48, 400);

  const cardSlot = (c: AlbumCard) => {
    const has = s.album.includes(c.id);
    if (!has) {
      const p = c.progress(s);
      return (
        <View key={c.id} style={[styles.slot, styles.locked, { width: cardW, height: cardW * RATIO }]}>
          <Text style={styles.lock}>🔒</Text>
          <Text style={styles.goal}>{c.goal}</Text>
          {p > 0 && <View style={{ alignSelf: 'stretch', marginTop: 6 }}><Bar value={p} color={C.faint} height={6} /></View>}
        </View>
      );
    }
    return (
      <Pressable key={c.id} onPress={() => { play('pop'); setOpen(c); }} accessibilityRole="button" accessibilityLabel={c.name}>
        {ALBUM_THUMBS[c.id] ? <Image source={ALBUM_THUMBS[c.id]} style={[styles.slot, { width: cardW, height: cardW * RATIO }]} /> : <EmojiCard card={c} width={cardW} />}
        {fresh.includes(c.id) && <Text style={styles.ribbon}>New!</Text>}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.switch}>
          {(['cards', 'trophies'] as const).map((v) => (
            <Pressable key={v} onPress={() => { play('tick'); setView(v); }} style={[styles.switchBtn, view === v && styles.switchOn]}>
              <Text style={[styles.switchText, view === v && { color: 'white' }]}>{v === 'cards' ? `📖 Cards ${found}/${ALBUM.length}` : `🏅 Trophies ${s.trophies.length}/${TROPHIES.length}`}</Text>
            </Pressable>
          ))}
        </View>
        {view === 'cards' ? (
          <>
            <Card>
              <Text style={styles.big}>{found} of {ALBUM.length} cards found</Text>
              <Text style={styles.body}>
                Every card adds +{CARD_BONUS * 100}% honey forever, and each full set adds +{SET_BONUS * 100}% more (+{Math.round((albumMult(s.album) - 1) * 100)}% now). Cards stay in your album through naps and fresh starts.
              </Text>
              <Bar value={found / ALBUM.length} color={C.green} />
            </Card>
            {SETS.map((set) => {
              const have = set.cards.filter((id) => s.album.includes(id)).length;
              const complete = done.includes(set);
              return (
                <View key={set.name}>
                  <Section title={`${set.emoji} ${set.name}`} right={<Text style={[styles.setCount, complete && { color: C.green }]}>{complete ? `✓ +${SET_BONUS * 100}%` : `${have}/${set.cards.length}`}</Text>} />
                  <View style={styles.grid}>{set.cards.map((id) => ALBUM_BY_ID[id]).filter(Boolean).map(cardSlot)}</View>
                </View>
              );
            })}
          </>
        ) : (
          <Card>
            <Text style={styles.body}>Trophies are for showing off. Your friends can see how many you have.</Text>
            {TROPHIES.map((t) => {
              const has = s.trophies.includes(t.id);
              return (
                <View key={t.id} style={[styles.trophy, !has && { opacity: 0.45 }]}>
                  <Text style={styles.trophyEmoji}>{has ? t.emoji : '🔒'}</Text>
                  <Text style={[styles.trophyName, has && { color: C.ink }]}>{t.name}</Text>
                  {has && <Text style={{ color: C.green, fontWeight: '900' }}>✓</Text>}
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
      {open && (
        <Pressable style={styles.scrim} onPress={() => setOpen(null)} accessibilityLabel="Close">
          {ALBUM_FULL[open.id]
            ? <Image source={ALBUM_FULL[open.id]} style={{ width: bigW, height: bigW * RATIO, borderRadius: 8 }} />
            : <EmojiCard card={open} width={bigW * 0.8} />}
          <Text style={styles.caption}>✓ {open.goal}</Text>
          <Text style={styles.hint}>Tap anywhere to close</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 30, maxWidth: 520, width: '100%', alignSelf: 'center' },
  big: { fontSize: 20, fontWeight: '900', color: C.ink },
  body: { color: C.ink, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  slot: { borderRadius: 6 },
  locked: { borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, backgroundColor: '#F6EEDC', alignItems: 'center', justifyContent: 'center', padding: 8 },
  lock: { fontSize: 22, opacity: 0.6 },
  goal: { fontSize: 11, color: C.soft, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  emojiCard: { backgroundColor: '#FFF3D1', borderWidth: 3, borderColor: '#D9B45A', alignItems: 'center', justifyContent: 'center', padding: 6 },
  emojiName: { fontFamily: HAND, color: C.ink, textAlign: 'center', marginTop: 4 },
  ribbon: { position: 'absolute', top: 6, right: -4, backgroundColor: C.pink, color: 'white', fontWeight: '900', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  setCount: { color: C.soft, fontWeight: '900', fontSize: 13 },
  switch: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  switchBtn: { flex: 1, borderRadius: 14, paddingVertical: 8, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card },
  switchOn: { backgroundColor: C.green, borderColor: C.green },
  switchText: { fontWeight: '900', color: C.ink, fontSize: 14 },
  trophy: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F5ECD5' },
  trophyEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  trophyName: { flex: 1, fontSize: 14, fontWeight: '700', color: C.soft },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,52,24,0.85)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 },
  caption: { color: 'white', fontWeight: '800', fontSize: 15, marginTop: 14, textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
});
