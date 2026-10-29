import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RESEARCH, researchEffect } from '../game/catalog';
import { buyResearch, researchNext } from '../game/engine';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { Button, buzz, C, Card, Section } from '../ui/kit';

export function ShopScreen() {
  const { s, act } = useGame();

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Section title="🛍️ Rabbit's General Store" />
      <Text style={styles.intro}>Everything here can be bought again and again. Each level costs a little more than the last.</Text>
      {RESEARCH.map((r) => {
        const n = researchNext(s, r.id);
        return (
          <Card key={r.id} style={styles.row}>
            <Text style={styles.emoji}>{r.emoji}</Text>
            <View style={styles.mid}>
              <Text style={styles.name}>{r.name} <Text style={styles.level}>Lv {n.level}{r.max ? ` / ${r.max}` : ''}</Text></Text>
              <Text style={styles.desc}>{n.level ? researchEffect(r, n.level) : 'Not bought yet'}</Text>
              {!n.maxed && <Text style={styles.next}>Next: {researchEffect(r, n.level + 1)}</Text>}
            </View>
            {n.maxed ? (
              <Text style={styles.maxed}>Maxed!</Text>
            ) : (
              <Button label="Buy" sub={fmt(n.cost)} disabled={s.honey < n.cost} onPress={() => { if (act((g) => buyResearch(g, r.id))) buzz('success'); }} />
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 30 },
  intro: { color: C.soft, fontWeight: '600', marginBottom: 10, marginTop: -4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 30, width: 44, textAlign: 'center', marginRight: 8 },
  mid: { flex: 1, marginRight: 8 },
  name: { fontWeight: '900', fontSize: 15, color: C.ink },
  level: { color: '#C27C0E', fontSize: 13 },
  desc: { color: C.ink, fontSize: 13, marginTop: 1 },
  next: { color: C.green, fontSize: 12, marginTop: 2, fontWeight: '700' },
  maxed: { fontWeight: '900', color: C.green },
});
