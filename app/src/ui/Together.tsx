// Things you do together on the Friends tab: the leaderboard, shared projects and letters.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { projectBonus } from '../game/calendar';
import { derive, receiveGift, totalCombs } from '../game/engine';
import { fmt, fmtWait, timeAgo } from '../game/format';
import { useGame } from '../state/GameContext';
import { Bar, Button, buzz, C, Card, Section } from './kit';
import { Portrait } from './Portrait';
import { play } from '../audio/sound';
import { pushSupported } from '../net/push';

/** Turn on phone notifications, or a note that they're on. */
export function NotifyCard() {
  const { net, wood } = useGame();
  if (!pushSupported()) return null;
  if (net.pushOn) return <Text style={[styles.small, { marginBottom: 8 }]}>🔔 Notifications are on for this phone.</Text>;
  return (
    <Card style={{ borderColor: C.blue }}>
      <Text style={styles.big}>🔔 Notifications</Text>
      <Text style={styles.small}>Get a ping on this phone for hugs, honey, letters and Poohsticks challenges, even when the game is closed.</Text>
      <Button label="Turn on notifications" color={C.blue} onPress={wood.notifications} style={{ marginTop: 8 }} />
    </Card>
  );
}

const BOARDS = [
  { id: 'hps', label: '🍯 Honey/sec' },
  { id: 'allTime', label: '🏦 All-time honey' },
  { id: 'combs', label: '✨ Honeycombs' },
  { id: 'cards', label: '📖 Album' },
  { id: 'trophies', label: '🏅 Trophies' },
] as const;
type Board = (typeof BOARDS)[number]['id'];
const MEDALS = ['🥇', '🥈', '🥉'];

/** Everyone in the wood ranked by one stat (your own is always the latest). */
export function WoodLeaderboard() {
  const { s, d, net } = useGame();
  const [board, setBoard] = useState<Board>('hps');
  const mine: Record<Board, number> = {
    hps: d.hps, allTime: s.allTimeEarned, combs: totalCombs(s), cards: s.album.length, trophies: s.trophies.length,
  };
  const rows = net.roster
    .map((m) => ({ m, me: m.id === net.you, value: m.id === net.you ? mine[board] : m.stats[board] || 0 }))
    .sort((a, b) => b.value - a.value);
  if (rows.length < 2) return null;
  return (
    <>
      <Section title="🏆 Leaderboard" />
      <Card>
        <View style={styles.row}>
          {BOARDS.map((b) => (
            <Pressable key={b.id} onPress={() => setBoard(b.id)} style={[styles.pick, board === b.id && styles.pickOn]}>
              <Text style={styles.pickText}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
        {rows.map(({ m, me, value }, i) => (
          <View key={m.id} style={[styles.rank, me && styles.rankMe]}>
            <Text style={styles.medal}>{MEDALS[i] ?? `${i + 1}.`}</Text>
            <Portrait emoji={m.avatar} size={30} />
            <Text style={[styles.rankName, me && { fontWeight: '900' }]} numberOfLines={1}>{m.name}{me ? ' (you)' : ''}</Text>
            <Text style={styles.rankValue}>{fmt(value)}{board === 'hps' ? '/s' : ''}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

export function Projects() {
  const { s, net, wood } = useGame();
  const p = net.project;
  const def = net.projectDef;
  if (!p || !def) return null;
  return (
    <>
      <Section title="🔨 Building Together" />
      <Card>
        <Text style={styles.big}>{def.emoji} {def.name}</Text>
        <Text style={styles.small}>Pay in honey together. When it's built, it appears on the map and everyone's honey goes up {Math.round(projectBonus(def.id) * 100)}% for good.</Text>
        <View style={{ marginVertical: 8 }}>
          <Bar value={p.progress / p.goal} color={C.green} height={18} />
          <Text style={styles.barText}>{fmt(p.progress)} / {fmt(p.goal)}</Text>
        </View>
        {Object.entries(p.contributions).sort((a, b) => b[1] - a[1]).map(([id, amt]) => {
          const m = net.roster.find((r) => r.id === id);
          return <Text key={id} style={styles.small}>{m?.avatar} {m?.name ?? 'Someone'} — {fmt(amt)}</Text>;
        })}
        <View style={styles.row}>
          {[0.1, 0.25, 0.5].map((f) => (
            <Button
              key={f} small outline color={C.green} label={`Give ${f * 100}%`} sub={fmt(Math.min(s.honey * f, p.goal - p.progress))}
              disabled={s.honey * f < 1}
              onPress={() => { wood.donate(Math.floor(Math.min(s.honey * f, Math.max(1, p.goal - p.progress)))); play('buy'); }}
              style={{ flex: 1 }}
            />
          ))}
        </View>
        {net.built.length > 0 && <Text style={[styles.small, { marginTop: 8 }]}>Built so far: {net.built.length} · +{Math.round(net.built.reduce((m, id) => m * (1 + projectBonus(id)), 1) * 100 - 100)}% honey</Text>}
      </Card>
    </>
  );
}

export function Letters() {
  const { s, net, wood, act, toast, now } = useGame();
  const giftWait = net.giftReadyAt - now;
  const others = net.roster.filter((m) => m.id !== net.you);
  const [to, setTo] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [share, setShare] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const target = to && others.find((m) => m.id === to) ? to : others[0]?.id;
  const theirs = others.find((m) => m.id === target)?.stats.honey || 0;
  const amount = Math.floor(theirs * share);

  const read = (id: string) => {
    setOpen((o) => (o === id ? null : id));
    const l = s.letters.find((x) => x.id === id);
    if (!l || l.read) return;
    act((g, now) => {
      const x = g.letters.find((y) => y.id === id)!;
      x.read = true;
      if (x.amount > 0) receiveGift(g, x.amount * derive(g, now).giftMult);
    });
    if (l.amount > 0) { play('gift'); buzz('success'); toast(`🍯 ${fmt(l.amount)} honey was tucked inside!`); }
  };

  return (
    <>
      <Section title="✉️ Letters" />
      {others.length > 0 && (
        <Card>
          <Text style={styles.small}>Leave a note for when they next come into the wood. Honey tucked inside is a share of what they have.</Text>
          {others.length > 1 && (
            <View style={styles.row}>
              {others.map((m) => (
                <Pressable key={m.id} onPress={() => setTo(m.id)} style={[styles.pick, target === m.id && styles.pickOn]}>
                  <Text style={styles.pickText}>{m.avatar} {m.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput
            value={text} onChangeText={setText} multiline maxLength={280} placeholder={`Dear ${others.find((m) => m.id === target)?.name},`}
            placeholderTextColor={C.faint} style={styles.input}
          />
          <View style={styles.row}>
            {[0, 0.1, 0.25].map((f) => {
              const off = f > 0 && (Math.floor(theirs * f) > s.honey || giftWait > 0);
              return (
              <Pressable key={f} onPress={() => setShare(f)} disabled={off} style={[styles.pick, share === f && styles.pickOn, off && { opacity: 0.4 }]}>
                <Text style={styles.pickText}>{f ? `🍯 ${f * 100}%` : 'No honey'}</Text>
              </Pressable>
              );
            })}
          </View>
          {giftWait > 0 && <Text style={[styles.small, { marginTop: 4 }]}>🍯 Honey can go in a letter again in {fmtWait(giftWait)} (one gift every 5 minutes).</Text>}
          <Button
            label="✉️ Send letter" sub={amount > 0 ? `with ${fmt(amount)} honey` : undefined} disabled={!text.trim() || !target || amount > s.honey || (amount > 0 && giftWait > 0)}
            onPress={() => { wood.letter(target!, text, amount); setText(''); setShare(0); }} style={{ marginTop: 8 }}
          />
        </Card>
      )}
      {s.letters.length > 0 && (
        <Card>
          {s.letters.map((l) => (
            <Pressable key={l.id} onPress={() => read(l.id)} style={styles.letter}>
              <Text style={[styles.letterHead, !l.read && { color: C.pink }]}>
                {l.read ? '📭' : '📬'} {l.avatar} From {l.name}{l.amount > 0 ? ' · 🍯' : ''}  <Text style={styles.time}>{timeAgo(l.at)}</Text>
              </Text>
              {open === l.id && <Text style={styles.letterText}>{l.text}</Text>}
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 18, fontWeight: '900', color: C.ink },
  small: { color: C.soft, fontSize: 12, fontWeight: '600', marginTop: 2 },
  barText: { position: 'absolute', alignSelf: 'center', top: 1, fontSize: 12, fontWeight: '900', color: C.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10, marginTop: 4 },
  rankMe: { backgroundColor: '#FFF1C9' },
  medal: { width: 28, fontSize: 17, fontWeight: '900', color: C.soft, textAlign: 'center' },
  rankName: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink },
  rankValue: { fontSize: 15, fontWeight: '900', color: C.ink },
  pick: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: C.border, backgroundColor: 'white' },
  pickOn: { borderColor: C.pink, backgroundColor: '#FDE7EE' },
  pickText: { fontWeight: '800', color: C.ink, fontSize: 13 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 10, marginTop: 8, color: C.ink, backgroundColor: '#FFFDF3', fontSize: 15, minHeight: 90, textAlignVertical: 'top' },
  letter: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F5ECD5' },
  letterHead: { fontWeight: '800', color: C.ink, fontSize: 14 },
  letterText: { color: C.ink, fontSize: 15, marginTop: 6, lineHeight: 21, fontStyle: 'italic' },
  time: { color: C.faint, fontSize: 11, fontWeight: '600' },
});
