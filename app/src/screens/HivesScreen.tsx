import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Business, BUSINESSES, varietyAt } from '../game/catalog';
import { buyBiz, BuyMode, cycleProgress, hireManager, quote, startCycle } from '../game/engine';
import { fmt, fmtTime } from '../game/format';
import { useGame } from '../state/GameContext';
import { Bar, Button, buzz, C, Card } from '../ui/kit';
import { Portrait } from '../ui/Portrait';

const MODES: BuyMode[] = [1, 10, 100, 'max'];

function BusinessRow({ b, mode }: { b: Business; mode: BuyMode }) {
  const { s, d, now, act } = useGame();
  const st = s.biz[b.id];
  const info = d.biz[b.id];
  const v = varietyAt(s.variety);
  const q = quote(s, b.id, mode);
  const canBuy = s.honey >= q.cost;
  const progress = cycleProgress(s, d, b.id, now);
  const locked = st.owned === 0;
  const idle = !locked && !st.managed && !st.running;

  if (locked) {
    return (
      <Card style={[styles.row, styles.lockedRow]}>
        <View style={[styles.icon, { backgroundColor: '#EFE4C9', borderColor: 'transparent' }]}><Text style={[styles.iconEmoji, { opacity: 0.45 }]}>{b.emoji}</Text></View>
        <View style={styles.mid}>
          <Text style={styles.name}>{b.name}</Text>
          <Text style={styles.blurb} numberOfLines={2}>{b.blurb}</Text>
        </View>
        <Button label="Unlock" sub={fmt(q.cost)} disabled={!canBuy} onPress={() => act((g, t) => buyBiz(g, b.id, mode, t))} />
      </Card>
    );
  }

  const nextAt = info.nextMilestone;
  return (
    <Card style={styles.rowCard}>
      <View style={styles.row}>
        <Pressable
          onPress={() => { if (act((g, t) => startCycle(g, b.id, t))) buzz(); }}
          style={[styles.icon, { backgroundColor: idle ? v.color : '#F6EBCF', borderColor: idle ? v.deep : 'transparent' }]}
          accessibilityLabel={`Start ${b.name}`}
        >
          <Text style={styles.iconEmoji}>{b.emoji}</Text>
          <View style={[styles.badge, { backgroundColor: v.deep }]}><Text style={styles.badgeText}>{st.owned}</Text></View>
          {st.managed && <Portrait emoji={b.manager.emoji} size={28} style={styles.manager} />}
        </Pressable>
        <View style={styles.mid}>
          <Text style={styles.name} numberOfLines={1}>{b.name} {s.levels[b.id] ? <Text style={styles.stars}>Lv {s.levels[b.id]}</Text> : null}</Text>
          <View style={styles.barWrap}>
            <Bar value={progress} color={v.deep} height={16} />
            <Text style={styles.barText} numberOfLines={1}>
              {st.managed ? `${fmt(info.perSec)}/s` : `${fmt(info.perCycle)} · ${fmtTime(info.cycle)}`}
            </Text>
          </View>
          <Text style={styles.hint} numberOfLines={1}>
            {idle ? '👆 Tap the icon to collect!' : `Next ×2 at ${nextAt} (${st.owned}/${nextAt})`}
          </Text>
        </View>
        <Button
          label={`×${q.n}`}
          sub={fmt(q.cost)}
          disabled={!canBuy}
          onPress={() => act((g, t) => buyBiz(g, b.id, mode, t))}
          style={{ minWidth: 76 }}
        />
      </View>
      {!st.managed && (
        <Pressable
          disabled={s.honey < b.manager.cost}
          onPress={() => { if (act((g, t) => hireManager(g, b.id, t))) buzz('success'); }}
          style={[styles.hire, s.honey >= b.manager.cost && { backgroundColor: '#FFE9B0', borderColor: v.deep }]}
        >
          <Text style={[styles.hireText, s.honey < b.manager.cost && { color: C.faint }]}>
            Hire {b.manager.name} to run it forever — {fmt(b.manager.cost)}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

export function HivesScreen() {
  const { s, d } = useGame();
  const [mode, setMode] = useState<BuyMode>(1);
  const lastOwned = BUSINESSES.reduce((m, b, i) => (s.biz[b.id].owned > 0 ? i : m), 0);
  const visible = BUSINESSES.slice(0, Math.min(BUSINESSES.length, lastOwned + 2));
  const next = d.allMilestoneNext;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.modes}>
        <Text style={styles.modesLabel}>Buy</Text>
        {MODES.map((m) => (
          <Pressable key={String(m)} onPress={() => setMode(m)} style={[styles.mode, mode === m && { backgroundColor: varietyAt(s.variety).deep }]}>
            <Text style={[styles.modeText, mode === m && { color: 'white' }]}>{m === 'max' ? 'Max' : `×${m}`}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {visible.map((b) => <BusinessRow key={b.id} b={b} mode={mode} />)}
        {lastOwned + 2 < BUSINESSES.length && (
          <Text style={styles.more}>🌲 {BUSINESSES.length - lastOwned - 2} more places hidden deeper in the wood…</Text>
        )}
        {(

          <Text style={styles.more}>
            ⭐ Own {next} of every business for ×2 all honey{next === 25 ? '' : ' again'}.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 30 },
  modes: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, gap: 6 },
  modesLabel: { fontWeight: '900', color: C.soft, marginRight: 4 },
  mode: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F1E5C8' },
  modeText: { fontWeight: '900', color: C.ink },
  rowCard: { padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  lockedRow: { padding: 10, opacity: 0.95 },
  icon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 3 },
  iconEmoji: { fontSize: 32 },
  badge: { position: 'absolute', bottom: -4, left: -4, borderRadius: 10, minWidth: 24, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  badgeText: { color: 'white', fontWeight: '900', fontSize: 12 },
  manager: { position: 'absolute', top: -8, right: -8 },
  mid: { flex: 1, marginRight: 8 },
  name: { fontSize: 16, fontWeight: '900', color: C.ink, marginBottom: 4 },
  blurb: { fontSize: 12, color: C.soft, fontStyle: 'italic' },
  stars: { fontSize: 12, color: '#C27C0E' },
  barWrap: { justifyContent: 'center' },
  barText: { position: 'absolute', alignSelf: 'center', fontSize: 11, fontWeight: '900', color: C.ink },
  hint: { fontSize: 11, color: C.soft, marginTop: 4, fontWeight: '600' },
  hire: { marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border, paddingVertical: 7, alignItems: 'center' },
  hireText: { fontWeight: '800', fontSize: 13, color: C.ink },
  more: { textAlign: 'center', color: C.soft, marginTop: 8, fontWeight: '700' },
});
