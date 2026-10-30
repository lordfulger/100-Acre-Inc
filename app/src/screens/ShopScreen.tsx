import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RESEARCH, RESEARCH_SECTIONS, researchEffect } from '../game/catalog';
import { buyResearch, combPower, researchNext, totalCombs } from '../game/engine';
import { fmt } from '../game/format';
import { useGame } from '../state/GameContext';
import { Button, buzz, C, Card, Section } from '../ui/kit';
import { play } from '../audio/sound';

const SECTION_EMOJI: Record<string, string> = { Honey: '🍯', Taps: '👆', Balloons: '🎈', Helpers: '🧑‍🌾', Friends: '💕' };

export function ShopScreen() {
  const { s, act } = useGame();
  // Locked items: show only the next two to unlock, as a teaser.
  const teasers = RESEARCH.filter((r) => !researchNext(s, r.id).unlocked).sort((a, b) => a.unlock - b.unlock).slice(0, 2);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Section title="🛍️ Rabbit's General Store" />
      <Text style={styles.intro}>Everything here can be bought again and again. Each level costs a little more than the last. New items arrive as you make more honey.</Text>
      {RESEARCH_SECTIONS.map((section) => {
        const items = RESEARCH.filter((r) => r.section === section && researchNext(s, r.id).unlocked);
        if (!items.length) return null;
        return (
          <View key={section}>
            <Text style={styles.section}>{SECTION_EMOJI[section]} {section}</Text>
            {items.map((r) => {
              const n = researchNext(s, r.id);
              return (
                <Card key={r.id} style={styles.row}>
                  <Text style={styles.emoji}>{r.emoji}</Text>
                  <View style={styles.mid}>
                    <Text style={styles.name}>{r.name} <Text style={styles.level}>Lv {n.level}{r.max ? ` / ${r.max}` : ''}</Text></Text>
                    <Text style={styles.desc}>{n.level ? researchEffect(r, n.level) : 'Not bought yet'}</Text>
                    {!n.maxed && <Text style={styles.next}>Next: {researchEffect(r, n.level + 1)}</Text>}
                    {r.kind === 'combPower' && totalCombs(s) > 0 && (
                      <Text style={styles.desc}>
                        ✨ Your {fmt(totalCombs(s))} combs together: +{fmt(totalCombs(s) * combPower(s) * 100)}% honey
                        {!n.maxed ? ` → +${fmt(totalCombs(s) * combPower(s, n.level + 1) * 100)}%` : ''}
                      </Text>
                    )}
                  </View>
                  {n.maxed ? (
                    <Text style={styles.maxed}>Maxed!</Text>
                  ) : (
                    <Button label="Buy" sub={fmt(n.cost)} disabled={s.honey < n.cost} onPress={() => { if (act((g) => buyResearch(g, r.id))) { buzz('success'); play('shop'); } }} />
                  )}
                </Card>
              );
            })}
          </View>
        );
      })}
      {teasers.length > 0 && <Text style={styles.section}>🔒 Coming soon</Text>}
      {teasers.map((r) => (
        <Card key={r.id} style={[styles.row, { opacity: 0.6 }]}>
          <Text style={styles.emoji}>{r.emoji}</Text>
          <View style={styles.mid}>
            <Text style={styles.name}>{r.name}</Text>
            <Text style={styles.desc}>{researchEffect(r, 1)}</Text>
            <Text style={styles.lock}>Arrives at {fmt(r.unlock)} all-time honey (you have {fmt(s.allTimeEarned)})</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 30 },
  intro: { color: C.soft, fontWeight: '600', marginBottom: 6, marginTop: -4 },
  section: { fontSize: 15, fontWeight: '900', color: C.soft, marginTop: 10, marginBottom: 6, marginLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 30, width: 44, textAlign: 'center', marginRight: 8 },
  mid: { flex: 1, marginRight: 8 },
  name: { fontWeight: '900', fontSize: 15, color: C.ink },
  level: { color: '#C27C0E', fontSize: 13 },
  desc: { color: C.ink, fontSize: 13, marginTop: 1 },
  next: { color: C.green, fontSize: 12, marginTop: 2, fontWeight: '700' },
  lock: { color: C.red, fontSize: 12, marginTop: 2, fontWeight: '700' },
  maxed: { fontWeight: '900', color: C.green },
});
