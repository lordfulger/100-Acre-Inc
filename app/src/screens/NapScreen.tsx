import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COMB_BONUS, varietyAt } from '../game/catalog';
import { buyVariety, nap, napCombsAvailable, nextCombAt, totalCombs } from '../game/engine';
import { fmt, fmtTime } from '../game/format';
import { useGame } from '../state/GameContext';
import { Bar, Button, buzz, C, Card, Section } from '../ui/kit';

export function NapScreen() {
  const { s, act, toast, now } = useGame();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  const v = varietyAt(s.variety);
  const next = varietyAt(s.variety + 1);
  // Show a window of seven varieties around the current one; there are endlessly many.
  const first = Math.max(0, s.variety - 3);
  const shown = Array.from({ length: 7 }, (_, k) => first + k);
  const combs = totalCombs(s);
  const pending = napCombsAvailable(s);
  const nextAt = nextCombAt(s);
  const newBonus = (combs + pending) * COMB_BONUS * 100;

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Section title="🌼 Honey Varieties" />
      <Card style={{ borderColor: v.deep }}>
        <View style={styles.varRow}>
          {shown.map((i) => varietyAt(i)).map((x, k) => ({ x, i: first + k })).map(({ x, i }) => (
            <View key={i} style={[styles.varDot, { backgroundColor: i <= s.variety ? x.color : '#EEE3C8', borderColor: i === s.variety ? C.ink : 'transparent' }]}>
              <Text style={{ fontSize: 16, opacity: i <= s.variety ? 1 : 0.35 }}>{x.emoji}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.big}>{v.emoji} {v.name}</Text>
        <Text style={styles.body}>Everything you make is worth ×{v.mult}. Varieties are kept forever, even through naps.</Text>
        {next ? (
          <View style={styles.actionRow}>
            <Text style={[styles.body, { flex: 1 }]}>Next: <Text style={{ fontWeight: '900' }}>{next.emoji} {next.name}</Text> (×{next.mult})</Text>
            <Button
              label="Discover" sub={fmt(next.cost)} color={next.deep} disabled={s.honey < next.cost}
              onPress={() => { if (act((g) => buyVariety(g))) { buzz('success'); toast(`${next.emoji} You discovered ${next.name}!`); } }}
            />
          </View>
        ) : <Text style={styles.body}>👑 You've found the finest honey in all the wood.</Text>}
      </Card>

      <Section title="😴 Pooh's Nap" />
      <Card>
        <Text style={styles.body}>
          Curl up for a nap and dream of honey. You start your businesses over, but wake with{' '}
          <Text style={{ fontWeight: '900' }}>Golden Honeycombs</Text> — each one adds +{COMB_BONUS * 100}% honey forever. Combs from Expotitions are kept too.
        </Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNum}>{fmt(combs)}</Text><Text style={styles.statLabel}>combs now</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: C.green }]}>+{fmt(pending)}</Text><Text style={styles.statLabel}>if you nap</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>+{fmt(newBonus)}%</Text><Text style={styles.statLabel}>bonus after</Text></View>
        </View>
        <Text style={styles.small}>Next comb at {fmt(nextAt)} all-time honey (you have {fmt(s.allTimeEarned)})</Text>
        <Bar value={s.allTimeEarned / nextAt} color={v.deep} />
        <Button
          style={{ marginTop: 12 }}
          color={confirm ? C.red : C.blue}
          label={confirm ? 'Tap again to nap — this resets your businesses!' : pending > 0 ? `Take a nap (+${fmt(pending)} combs)` : 'Not sleepy yet'}
          disabled={pending < 1}
          onPress={() => {
            if (!confirm) return setConfirm(true);
            const got = act((g, t) => nap(g, t));
            setConfirm(false);
            if (got) toast(`😴 Zzz… you woke up with ${fmt(got)} Golden Honeycombs!`);
          }}
        />
        <Text style={[styles.small, { marginTop: 8 }]}>Tip: a nap is worth it once it would roughly double your combs.</Text>
      </Card>

      <Section title="📜 Your story so far" />
      <Card>
        {[
          ['Playing for', fmtTime((now - s.stats.startedAt) / 1000)],
          ['All-time honey', fmt(s.allTimeEarned)],
          ['Honey this nap', fmt(s.runEarned)],
          ['Pot taps', fmt(s.stats.taps)],
          ['Balloons caught', fmt(s.stats.balloons)],
          ['Naps taken', fmt(s.stats.naps)],
          ['Hugs received', fmt(s.stats.hugsGot)],
          ['Gifts sent', fmt(s.stats.giftsSent)],
        ].map(([k, val]) => (
          <View key={k} style={styles.kv}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{val}</Text></View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 30 },
  varRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  varDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  big: { fontSize: 20, fontWeight: '900', color: C.ink },
  body: { color: C.ink, fontSize: 14, lineHeight: 20, marginTop: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  stats: { flexDirection: 'row', marginVertical: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: C.ink },
  statLabel: { fontSize: 12, color: C.soft, fontWeight: '700' },
  small: { fontSize: 12, color: C.soft, marginBottom: 6, fontWeight: '600' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3E8CC' },
  k: { color: C.soft, fontWeight: '700' },
  v: { color: C.ink, fontWeight: '900' },
});
