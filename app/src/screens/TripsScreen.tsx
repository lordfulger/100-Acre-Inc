// Trips round the wood, and the treasures friends bring home from them.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ARTIFACTS, RARITIES, readArtifact } from '../game/catalog';
import { fmtTime } from '../game/format';
import { collectTrip, COMBINE, combine, DISPLAY_SLOTS, equip, EXPLORERS, explorerOpen, explorerState, startTrip, TRIPS, tripHours, unequip } from '../game/trips';
import { useGame } from '../state/GameContext';
import { Button, buzz, C, Card, Section } from '../ui/kit';
import { Portrait } from '../ui/Portrait';
import { play } from '../audio/sound';

/** "4h", "1.8h" or "36m". */
const hoursLabel = (h: number) => (h >= 1 ? `${+h.toFixed(1)}h` : `${Math.round(h * 60)}m`);

/** A treasure's name in its quality's colour, and what it does. */
export function TreasureLine({ k, big }: { k: string; big?: boolean }) {
  const a = readArtifact(k);
  if (!a) return null;
  return (
    <View style={{ flex: 1 }}>
      <Text style={[big ? styles.bigName : styles.name, { color: RARITIES[a.rarity].color }]}>
        {a.def.name}
      </Text>
      <Text style={styles.small}>{a.def.text(a.value)}</Text>
    </View>
  );
}

/** What an explorer brought home, shown when you welcome them back. */
function Finds({ who, keys, onClose }: { who: string; keys: string[]; onClose: () => void }) {
  return (
    <View style={styles.scrim}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{who} is back!</Text>
        <Text style={[styles.small, { textAlign: 'center', marginBottom: 6 }]}>Look what they found:</Text>
        {keys.map((k, i) => {
          const a = readArtifact(k)!;
          return (
            <View key={i} style={[styles.find, { borderColor: RARITIES[a.rarity].color, backgroundColor: RARITIES[a.rarity].tint }]}>
              <Text style={styles.findEmoji}>{a.def.emoji}</Text>
              <TreasureLine k={k} big />
            </View>
          );
        })}
        <Text style={[styles.small, { textAlign: 'center', marginVertical: 6 }]}>Put treasures on display below to use them.</Text>
        <Button label="Lovely!" onPress={onClose} />
      </View>
    </View>
  );
}

function Explorer({ id, onFound }: { id: string; onFound: (who: string, keys: string[]) => void }) {
  const { s, act, now, save } = useGame();
  const e = EXPLORERS.find((x) => x.id === id)!;
  if (!explorerOpen(s, id)) {
    return (
      <Card style={[styles.row, { opacity: 0.6 }]}>
        <Portrait id={e.portrait} size={46} />
        <View style={styles.mid}>
          <Text style={styles.name}>🔒 {e.name}</Text>
          <Text style={styles.small}>Joins the trips after {e.naps === 1 ? 'your first nap' : `${e.naps} naps`}.</Text>
        </View>
      </Card>
    );
  }
  const st = explorerState(s, id, now);
  return (
    <Card>
      <View style={styles.row}>
        <Portrait id={e.portrait} size={46} />
        <View style={styles.mid}>
          <Text style={styles.name}>{e.name}</Text>
          <Text style={styles.small}>
            {st.phase === 'home' ? 'Ready for an adventure!'
              : st.phase === 'away' ? `${st.trip.emoji} ${st.trip.name} · back in ${fmtTime(st.left / 1000)}`
              : `${st.trip.emoji} Back from ${st.trip.name}!`}
          </Text>
        </View>
        {st.phase === 'back' && (
          <Button small label="🎒 Welcome back" onPress={() => {
            const keys = act((g, t) => collectTrip(g, id, t)); save(); // straight away, so closing the app can't undo it and pay out again
            if (!keys.length) return;
            play('fanfare'); buzz('success');
            onFound(e.name, keys);
          }} />
        )}
      </View>
      {st.phase === 'home' && (
        <View style={styles.trips}>
          {TRIPS.map((t) => (
            <Button
              key={t.id} small outline color={C.green} label={`${t.emoji} ${hoursLabel(tripHours(s, t.id))}`} sub={t.finds > 1 ? 'finds 2' : t.hours > 1 ? 'rarer finds' : 'quick look'}
              onPress={() => { if (act((g, now2) => startTrip(g, id, t.id, now2))) play('whoosh'); }}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

export function TripsScreen() {
  const { s, act } = useGame();
  const [finds, setFinds] = useState<{ who: string; keys: string[] } | null>(null);
  // Your bag, best first: by rarity, then in the order of the list of treasures.
  const order = (k: string) => { const a = readArtifact(k)!; return -a.rarity * 100 + ARTIFACTS.indexOf(a.def); };
  const bag = Object.keys(s.artifacts).filter((k) => s.artifacts[k] > 0 && readArtifact(k)).sort((a, b) => order(a) - order(b));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        <Section title="🧭 Trips Round the Wood" />
        <Text style={styles.intro}>
          Send friends exploring. They keep going while the game is closed, and come home with treasure: longer trips find rarer things. More friends join as you take naps.
        </Text>
        {EXPLORERS.map((e) => <Explorer key={e.id} id={e.id} onFound={(who, keys) => setFinds({ who, keys })} />)}

        <Section title="🏺 On Display" />
        <Text style={styles.intro}>Up to {DISPLAY_SLOTS} treasures on display at once, and only these count.</Text>
        <Card>
          {Array.from({ length: DISPLAY_SLOTS }, (_, i) => {
            const k = s.equipped[i];
            const a = k ? readArtifact(k) : null;
            return (
              <View key={i} style={[styles.slot, a && { borderColor: RARITIES[a.rarity].color, borderStyle: 'solid' }]}>
                {a ? (
                  <>
                    <Text style={styles.slotEmoji}>{a.def.emoji}</Text>
                    <TreasureLine k={k} />
                    <Pressable onPress={() => { act((g) => unequip(g, k)); play('tick'); }} hitSlop={8}><Text style={styles.link}>Put away</Text></Pressable>
                  </>
                ) : <Text style={styles.small}>An empty shelf</Text>}
              </View>
            );
          })}
        </Card>

        <Section title="🎒 Your Treasures" />
        {bag.length === 0 && <Card><Text style={styles.small}>Nothing yet. Send someone on a trip!</Text></Card>}
        {bag.map((k) => {
          const a = readArtifact(k)!;
          const n = s.artifacts[k];
          const shown = s.equipped.includes(k);
          const canCombine = n >= COMBINE && a.rarity < RARITIES.length - 1;
          const full = s.equipped.length >= DISPLAY_SLOTS && !s.equipped.some((e) => readArtifact(e)?.def.id === a.def.id);
          return (
            <Card key={k} style={{ borderColor: RARITIES[a.rarity].color, backgroundColor: RARITIES[a.rarity].tint, borderWidth: 2 }}>
              <View style={styles.row}>
                <Text style={styles.slotEmoji}>{a.def.emoji}</Text>
                <TreasureLine k={k} />
                <Text style={styles.count}>×{n}</Text>
              </View>
              <View style={styles.trips}>
                <Button
                  small outline color={C.blue} label={shown ? 'On display ✓' : 'Display'} disabled={shown || full}
                  onPress={() => { if (act((g) => equip(g, k))) play('tick'); }} style={{ flex: 1 }}
                />
                {a.rarity < RARITIES.length - 1 && (
                  <Button
                    small outline color={C.green} label={`Combine ${COMBINE}`} sub="into a better one" disabled={!canCombine}
                    onPress={() => { if (act((g) => combine(g, k))) { play('magic'); buzz('success'); } }} style={{ flex: 1 }}
                  />
                )}
              </View>
              {full && !shown && <Text style={[styles.small, { marginTop: 4 }]}>Your shelves are full. Put something away first.</Text>}
            </Card>
          );
        })}
        <Text style={[styles.small, { marginTop: 6 }]}>
          {ARTIFACTS.length} treasures to find. Their colour shows how good they are, from plain to best:{' '}
          {RARITIES.map((r, i) => <Text key={i} style={{ color: r.color, fontWeight: '900', fontSize: 16 }}>● </Text>)}
          Three of the same make one in the next colour.
        </Text>
      </ScrollView>
      {finds && <Finds who={finds.who} keys={finds.keys} onClose={() => setFinds(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  intro: { color: C.soft, fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: -4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mid: { flex: 1 },
  name: { fontSize: 16, fontWeight: '900', color: C.ink },
  bigName: { fontSize: 17, fontWeight: '900' },
  small: { color: C.soft, fontSize: 12, fontWeight: '700', marginTop: 2 },
  trips: { flexDirection: 'row', gap: 6, marginTop: 10 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 8, marginBottom: 6, minHeight: 52 },
  slotEmoji: { fontSize: 30 },
  link: { color: C.blue, fontWeight: '800', fontSize: 13 },
  count: { fontSize: 16, fontWeight: '900', color: C.ink },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,52,24,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 },
  modal: { backgroundColor: C.card, borderRadius: 24, padding: 20, width: '100%', maxWidth: 420, gap: 6 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: C.ink, textAlign: 'center' },
  find: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 14, padding: 10, backgroundColor: 'white' },
  findEmoji: { fontSize: 40 },
});
