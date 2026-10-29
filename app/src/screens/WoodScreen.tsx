import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { QUICK_PHRASES, varietyAt } from '../game/catalog';
import { ALBUM } from '../game/album';
import { fmt, fmtTime, timeAgo } from '../game/format';
import { Contract, ContractDef, Member, useGame } from '../state/GameContext';
import { Bar, Button, C, Card, Section } from '../ui/kit';
import { HAND, WoodMap } from '../ui/WoodMap';
import { Portrait } from '../ui/Portrait';
import { Letters, NotifyCard, Projects } from '../ui/Together';

/** A room code from an invite link (…/?wood=CODE), if the game was opened from one. */
function invitedCode() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('wood') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

/** A fresh code that's easy to read out (no 0/O or 1/I). */
function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
}

/** Shares a link that opens the game with the wood's code filled in. */
async function invite(room: string, toast: (t: string) => void) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return toast(`Tell your friends the code ${room}`);
  const url = `${window.location.origin}/?wood=${room}`;
  const text = `Come and make honey with me in the Hundred Acre Wood! Our wood's code is ${room}.`;
  try {
    if (navigator.share) await navigator.share({ title: '100 Acre Inc', text, url });
    else { await navigator.clipboard.writeText(`${text} ${url}`); toast('📋 Invite link copied. Paste it to your friends!'); }
  } catch (e: any) {
    // Closing the share sheet isn't a problem; anything else, show the link to copy by hand.
    if (e?.name !== 'AbortError') toast(`📨 Send your friends this link: ${url}`);
  }
}

function JoinCard() {
  const { s, net, wood } = useGame();
  const [room, setRoom] = useState(s.profile.room || invitedCode());
  const [server, setServer] = useState(s.profile.server);
  const [advanced, setAdvanced] = useState(false);
  const connecting = net.status === 'connecting';
  return (
    <Card>
      <Text style={styles.big}>🌳 Find your wood</Text>
      <Text style={styles.body}>
        Make up a secret code (like <Text style={{ fontWeight: '900' }}>HUNNYPOT</Text>) and share it with your friends. Everyone who enters it joins the same wood to share Expotitions, hugs, gifts and chat.
      </Text>
      <TextInput
        value={room}
        onChangeText={(t) => setRoom(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
        placeholder="ROOM CODE"
        placeholderTextColor={C.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[styles.input, styles.codeInput]}
      />
      <Pressable onPress={() => setRoom(newCode())}><Text style={styles.link}>🎲 Make up a new code for me</Text></Pressable>
      {advanced && (
        <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="ws://192.168.1.10:3001" placeholderTextColor={C.faint} />
      )}
      {net.error && <Text style={styles.error}>{net.error}</Text>}
      <Button
        label={connecting ? 'Connecting…' : 'Enter the wood'}
        disabled={room.length < 3 || connecting}
        onPress={() => wood.join(room, server)}
        style={{ marginTop: 8 }}
      />
      {connecting && <Button small outline label="Cancel" color={C.soft} onPress={wood.leave} style={{ marginTop: 8 }} />}
      <Pressable onPress={() => setAdvanced((a) => !a)}><Text style={styles.link}>{advanced ? 'Hide server settings' : 'Server settings'}</Text></Pressable>
    </Card>
  );
}

function MemberCard({ m, me, onVisit }: { m: Member; me: boolean; onVisit: () => void }) {
  const { s, net, wood } = useGame();
  const [giving, setGiving] = useState(false);
  const [more, setMore] = useState(false);
  const blocked = s.blocked.includes(m.id);
  const iLookAfter = net.roster.some((r) => r.id === net.you && r.owner);
  const variety = varietyAt(m.stats.variety || 0);
  return (
    <Card style={[styles.member, me && { borderColor: variety.deep }]}>
      <View style={styles.memberTop}>
        <View style={[styles.avatar, { backgroundColor: variety.color }]}>
          <Portrait emoji={m.avatar} size={50} ring={variety.color} />
          <View style={[styles.dot, { backgroundColor: m.online ? C.green : C.faint }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{m.name}{me ? ' (you)' : ''}{m.owner ? ' 🗝️' : ''}{blocked ? ' · 🚫 blocked' : ''}</Text>
          <Text style={styles.small}>{m.online ? '🟢 in the wood now' : `💤 ${timeAgo(m.lastSeen)}`} · {variety.emoji} {variety.name}</Text>
          <Text style={styles.memberStats}>🍯 {fmt(m.stats.hps || 0)}/s  ·  🏦 {fmt(m.stats.honey || 0)}  ·  ✨ {fmt(m.stats.combs || 0)}  ·  📖 {m.stats.cards || 1}/{ALBUM.length}  ·  🏅 {m.stats.trophies || 0}</Text>
        </View>
      </View>
      {!me && !blocked && (
        <View style={styles.memberActions}>
          <Button small label="💕 Hug" color={C.pink} onPress={() => wood.hug(m.id)} style={{ flex: 1 }} />
          <Button small label="🎁 Honey" color={C.blue} onPress={() => setGiving((g) => !g)} style={{ flex: 1 }} />
          <Button small label="🗺️ Visit" color={C.green} disabled={!m.stats.buildings} onPress={onVisit} style={{ flex: 1 }} />
        </View>
      )}
      {!me && (
        <Pressable onPress={() => setMore((x) => !x)} hitSlop={8}><Text style={[styles.small, { textAlign: 'right', marginTop: 6 }]}>{more ? 'Less ▲' : 'More ▼'}</Text></Pressable>
      )}
      {!me && more && (
        <View style={styles.memberActions}>
          <Button small outline color={C.soft} label={blocked ? 'Unblock' : '🚫 Block'} onPress={() => wood.block(m.id, !blocked)} style={{ flex: 1 }} />
          {iLookAfter && <Button small outline color={C.blue} label="🗝️ Hand over" onPress={() => wood.makeOwner(m.id)} style={{ flex: 1 }} />}
          {iLookAfter && <Button small outline color={C.red} label="Remove" onPress={() => wood.remove(m.id)} style={{ flex: 1 }} />}
        </View>
      )}
      {giving && (
        <View style={styles.memberActions}>
          {[0.1, 0.25, 0.5].map((f) => (
            <Button
              key={f} small outline color={C.blue} label={`${f * 100}%`} sub={fmt(s.honey * f)}
              disabled={s.honey * f < 1}
              onPress={() => { wood.gift(m.id, Math.floor(s.honey * f)); setGiving(false); }}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

function ContractCard({ c, def }: { c: Contract; def: ContractDef }) {
  const { net, wood, now } = useGame();
  const done = c.status !== 'active';
  const left = Math.max(0, (c.endsAt - now) / 1000);
  const elapsed = Math.max(1, (now - c.startedAt) / 1000);
  const rate = c.progress / elapsed;
  const eta = rate > 0 ? (c.goal - c.progress) / rate : Infinity;
  return (
    <Card style={{ borderColor: c.status === 'complete' ? C.green : C.border }}>
      <Text style={styles.big}>{def.emoji} {def.name}</Text>
      <Text style={styles.small}>
        {c.status === 'complete' ? '🏆 Complete! Well done, everyone.' : c.status === 'expired' ? '⌛ Ended' : `⏳ ${fmtTime(left)} left${eta < left ? ' · on track! 🎉' : eta < Infinity ? ` · need to speed up!` : ''}`}
      </Text>
      <View style={{ marginVertical: 8 }}>
        <Bar value={c.progress / c.goal} color={C.green} height={18} marks={net.tiers.slice(0, -1)} />
        <Text style={styles.barText}>{fmt(c.progress)} / {fmt(c.goal)}</Text>
      </View>
      <View style={styles.tiers}>
        {def.combs.map((n, i) => (
          <Text key={i} style={[styles.tier, i < c.tiersReached && { color: C.green }]}>
            {i < c.tiersReached ? '✅' : '⭐'} {Math.round((net.tiers[i] || 0) * 100)}%: +{n} ✨
          </Text>
        ))}
      </View>
      {Object.entries(c.contributions).sort((a, b) => b[1] - a[1]).map(([id, amt]) => {
        const m = net.roster.find((r) => r.id === id);
        return <Text key={id} style={styles.small}>{m?.avatar} {m?.name ?? 'Someone'} — {fmt(amt)} ({Math.round((amt / Math.max(1, c.progress)) * 100)}%)</Text>;
      })}
      {!done && <Button small outline color={C.red} label="Call it off" onPress={wood.abandonContract} style={{ marginTop: 8, alignSelf: 'flex-start' }} />}
    </Card>
  );
}

function Expotitions() {
  const { net, wood } = useGame();
  const c = net.contract;
  const active = c?.status === 'active';
  const def = c && net.contracts.find((x) => x.id === c.id);
  return (
    <>
      <Section title="🧭 Co-op Expotitions" />
      {c && def && <ContractCard c={c} def={def} />}
      {!active && (
        <Card>
          <Text style={styles.body}>Team up: all the honey everyone makes counts toward the goal. Every tier pays Golden Honeycombs to everyone, and finishing gives ×2 honey for 20 minutes.</Text>
          {net.contracts.map((x) => (
            <View key={x.id} style={styles.contractRow}>
              <Text style={{ fontSize: 26, marginRight: 8 }}>{x.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{x.name}</Text>
                <Text style={styles.small}>{fmtTime(x.minutes * 60)} · up to {x.combs.reduce((a, b) => a + b, 0)} ✨ each</Text>
              </View>
              <Button small label="Start" onPress={() => wood.startContract(x.id)} />
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function Chat() {
  const { net, wood } = useGame();
  const [text, setText] = useState('');
  const send = (t: string) => { wood.chat(t); setText(''); };
  const { s } = useGame();
  const msgs = net.chat.filter((m) => !m.from || !s.blocked.includes(m.from)).slice(-30).reverse();
  return (
    <>
      <Section title="💬 Chatter" />
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {QUICK_PHRASES.map((p) => (
            <Pressable key={p} onPress={() => send(p)} style={styles.phrase}><Text style={styles.phraseText}>{p}</Text></Pressable>
          ))}
        </ScrollView>
        <View style={styles.chatRow}>
          <TextInput
            value={text} onChangeText={setText} placeholder="Say something nice…" placeholderTextColor={C.faint}
            style={[styles.input, { flex: 1, marginTop: 0 }]} maxLength={140} onSubmitEditing={() => send(text)} returnKeyType="send"
          />
          <Button small label="Send" disabled={!text.trim()} onPress={() => send(text)} style={{ marginLeft: 8 }} />
        </View>
        {msgs.map((m) => (
          <View key={m.id} style={styles.msg}>
            {m.system ? (
              <Text style={styles.system}>{m.text}</Text>
            ) : (
              <Text style={styles.msgText}>
                <Text style={{ fontWeight: '900' }}>{m.avatar} {m.name}: </Text>{m.text}
                <Text style={styles.time}>  {timeAgo(m.at)}</Text>
              </Text>
            )}
          </View>
        ))}
      </Card>
    </>
  );
}

function Visit({ m, onClose }: { m: Member; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const view = m.stats.buildings!;
  return (
    <View style={styles.visit}>
      <View style={styles.visitHead}>
        <Text style={styles.visitTitle} numberOfLines={1}>{m.avatar} {m.name}'s Hundred Acre Wood</Text>
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.visitClose}>✕</Text></Pressable>
      </View>
      <ScrollView>
        <WoodMap view={{ owned: view.owned || {}, levels: view.levels || {}, managed: view.managed || {} }} width={Math.min(width, 700)} />
      </ScrollView>
    </View>
  );
}

export function WoodScreen() {
  const { net, wood, toast } = useGame();
  const [visiting, setVisiting] = useState<string | null>(null);
  const visited = net.roster.find((m) => m.id === visiting);
  const online = net.status === 'online';
  const me = net.roster.find((m) => m.id === net.you);
  const others = net.roster.filter((m) => m.id !== net.you);
  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      {!online ? (
        <>
          <JoinCard />
          <Letters />
        </>
      ) : (
        <>
          <Section
            title="🌳 The Hundred Acre Wood"
            right={<Pressable onPress={wood.leave}><Text style={styles.link}>Leave</Text></Pressable>}
          />
          <View style={styles.codeRow}>
            <Text style={[styles.small, { flex: 1 }]}>Room code: <Text style={{ fontWeight: '900', color: C.ink }}>{net.room}</Text> · up to 8 friends</Text>
            <Button small label="📨 Invite friends" onPress={() => invite(net.room!, toast)} />
          </View>
          <NotifyCard />
          {others.length === 0 && (
            <Card><Text style={styles.body}>It's just you here so far. Tell your friends the code <Text style={{ fontWeight: '900' }}>{net.room}</Text> 💛</Text></Card>
          )}
          {others.map((m) => <MemberCard key={m.id} m={m} me={false} onVisit={() => setVisiting(m.id)} />)}
          {me && <MemberCard m={me} me onVisit={() => {}} />}
          <Projects />
          <Expotitions />
          <Letters />
          <Chat />
        </>
      )}
    </ScrollView>
    {visited?.stats.buildings && <Visit m={visited} onClose={() => setVisiting(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 40 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -6, marginBottom: 10 },
  visit: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 30 },
  visitHead: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  visitTitle: { flex: 1, fontFamily: HAND, fontSize: 22, color: C.ink },
  visitClose: { fontSize: 20, fontWeight: '900', color: C.soft },
  big: { fontSize: 18, fontWeight: '900', color: C.ink },
  body: { color: C.ink, fontSize: 14, lineHeight: 20, marginTop: 4 },
  small: { color: C.soft, fontSize: 12, fontWeight: '600', marginTop: 2 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, color: C.ink, backgroundColor: 'white', fontSize: 15 },
  codeInput: { fontSize: 24, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
  error: { color: C.red, fontWeight: '700', marginTop: 8 },
  link: { color: C.blue, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  member: { padding: 10 },
  memberTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dot: { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'white' },
  memberName: { fontSize: 16, fontWeight: '900', color: C.ink },
  memberStats: { fontSize: 13, color: C.ink, fontWeight: '700', marginTop: 3 },
  memberActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  barText: { position: 'absolute', alignSelf: 'center', top: 1, fontSize: 12, fontWeight: '900', color: C.ink },
  tiers: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  tier: { fontSize: 12, fontWeight: '800', color: C.soft },
  contractRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  phrase: { backgroundColor: '#FFF0C7', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, borderWidth: 1, borderColor: C.border },
  phraseText: { fontWeight: '700', color: C.ink, fontSize: 13 },
  chatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  msg: { paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#F5ECD5' },
  msgText: { color: C.ink, fontSize: 14 },
  system: { color: C.soft, fontSize: 13, fontStyle: 'italic' },
  time: { color: C.faint, fontSize: 11 },
});
