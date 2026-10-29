import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ALBUM, AlbumCard, albumMult, CARD_BONUS } from '../game/album';
import { useGame } from '../state/GameContext';
import { ALBUM_FULL, ALBUM_THUMBS } from '../ui/albumImages';
import { Bar, C, Card, Section } from '../ui/kit';
import { play } from '../audio/sound';

const RATIO = 960 / 800;

export function AlbumScreen() {
  const { s, act } = useGame();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<AlbumCard | null>(null);
  // Cards found since you last looked keep their "New!" ribbon for this visit.
  const [fresh] = useState(() => [...s.albumNew]);
  useEffect(() => { if (s.albumNew.length) act((g) => { g.albumNew = []; }); }, [s.albumNew.length, act]);

  const found = ALBUM.filter((c) => s.album.includes(c.id)).length;
  const cardW = (Math.min(width, 520) - 24 - 16) / 3;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        <Section title="📖 Card Album" />
        <Card>
          <Text style={styles.big}>{found} of {ALBUM.length} cards found</Text>
          <Text style={styles.body}>Every card you find adds +{CARD_BONUS * 100}% honey forever (+{Math.round((albumMult(s.album) - 1) * 100)}% now). Cards stay in your album through naps and fresh starts.</Text>
          <Bar value={found / ALBUM.length} color={C.green} />
        </Card>
        <View style={styles.grid}>
          {ALBUM.map((c) => {
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
                <Image source={ALBUM_THUMBS[c.id]} style={[styles.slot, { width: cardW, height: cardW * RATIO }]} />
                {fresh.includes(c.id) && <Text style={styles.ribbon}>New!</Text>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {open && (
        <Pressable style={styles.scrim} onPress={() => setOpen(null)} accessibilityLabel="Close">
          <Image source={ALBUM_FULL[open.id]} style={{ width: Math.min(width - 48, 400), height: Math.min(width - 48, 400) * RATIO, borderRadius: 8 }} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slot: { borderRadius: 6 },
  locked: { borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, backgroundColor: '#F6EEDC', alignItems: 'center', justifyContent: 'center', padding: 8 },
  lock: { fontSize: 22, opacity: 0.6 },
  goal: { fontSize: 11, color: C.soft, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  ribbon: { position: 'absolute', top: 6, right: -4, backgroundColor: C.pink, color: 'white', fontWeight: '900', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,52,24,0.85)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 },
  caption: { color: 'white', fontWeight: '800', fontSize: 15, marginTop: 14, textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
});
