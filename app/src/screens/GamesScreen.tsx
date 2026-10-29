import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeEvent, eventProgress } from '../game/calendar';
import { finishGame, GAME_COOLDOWN_MIN, GameId, GAMES, gameReady } from '../game/extras';
import { fmt } from '../game/format';
import { StickRace, useGame } from '../state/GameContext';
import { Button, C, Card, Section } from '../ui/kit';
import { HoneyDrip, Poohsticks, RabbitsGarden, WoozleTracks } from '../ui/Minigames';
import { Portrait } from '../ui/Portrait';
import { play } from '../audio/sound';

/** Seconds a stick takes: a good drop takes up to 4s off, and the river adds up to 3s of luck (same as the server). */
const stickTime = (q: number) => 14 - 4 * q + Math.random() * 3;

export function GamesScreen() {
  const { s, act, toast, net, now, stickApi } = useGame();
  const [playing, setPlaying] = useState<GameId | null>(null);
  const [soloRace, setSoloRace] = useState<StickRace | null>(null);
  const event = activeEvent(now);
  const friends = net.status === 'online' ? net.roster.filter((m) => m.id !== net.you && m.online) : [];

  const done = (id: GameId, score: number, won?: boolean) => {
    setPlaying(null);
    setSoloRace(null);
    const r = act((g, t) => finishGame(g, id, score, t, won));
    if (r.honey > 0) { play('fanfare'); toast(`${GAMES[id].emoji} ${r.newBest ? 'New best! ' : ''}+${fmt(r.honey)} honey`); }
    else toast(`${GAMES[id].emoji} ${r.newBest ? `New best: ${score}! ` : ''}${score || won ? 'Just for fun this time.' : 'Better luck next time!'}`);
  };

  const soloDrop = (q: number) => {
    const pooh = 0.3 + Math.random() * 0.55;
    const sticks = [
      { pid: 'me', name: 'You', avatar: s.profile.avatar, q, time: stickTime(q) },
      { pid: 'pooh', name: 'Pooh', avatar: '🐻', q: pooh, time: stickTime(pooh) },
    ];
    setSoloRace({ sticks, winner: sticks[0].time <= sticks[1].time ? 'me' : 'pooh', seed: Math.floor(Math.random() * 1e9) });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        <Section title="🎲 Games in the Wood" />
        <Text style={styles.note}>Each game pays a honey prize once every {GAME_COOLDOWN_MIN} minutes, bigger for better scores. In between, play just for fun.</Text>
        {event?.kind === 'game' && !s.eventsWon.includes(event.id) && (
          <Card style={{ borderColor: C.green }}>
            <Text style={styles.name}>{event.emoji} {event.name}</Text>
            <Text style={styles.note}>{event.task}: {eventProgress(s, event, now)}/{event.goal}</Text>
          </Card>
        )}
        {(Object.keys(GAMES) as GameId[]).map((id) => {
          const g = GAMES[id];
          const ready = gameReady(s, id, now);
          const wait = Math.ceil((GAME_COOLDOWN_MIN * 60_000 - (now - (s.games[id]?.last || 0))) / 60_000);
          return (
            <Card key={id}>
              <View style={styles.row}>
                <Text style={styles.emoji}>{g.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{g.name}</Text>
                  <Text style={styles.small}>
                    {ready ? '🍯 Prize ready' : `Prize again in ${wait}m`}{id !== 'sticks' && s.games[id]?.best ? ` · Best ${s.games[id].best}` : ''}{id === 'sticks' ? ` · ${s.stats.sticksWon} wins` : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.blurb}>{g.blurb}</Text>
              {id === 'sticks' ? (
                <View style={styles.buttons}>
                  <Button small label="🐻 Race Pooh" onPress={() => { play('pop'); setPlaying('sticks'); }} style={{ flex: 1 }} />
                  {friends.map((m) => (
                    <Button key={m.id} small color={C.pink} label={`${m.avatar} Race ${m.name}`} onPress={() => stickApi.invite(m.id)} style={{ flex: 1 }} />
                  ))}
                </View>
              ) : (
                <Button label="Play" onPress={() => { play('pop'); setPlaying(id); }} style={{ marginTop: 8 }} />
              )}
              {id === 'sticks' && friends.length === 0 && <Text style={styles.small}>When your friend is in the wood, you can race each other live.</Text>}
            </Card>
          );
        })}
      </ScrollView>
      {playing === 'drip' && <HoneyDrip onDone={(n) => done('drip', n)} onQuit={() => setPlaying(null)} />}
      {playing === 'tracks' && <WoozleTracks onDone={(n) => done('tracks', n)} onQuit={() => setPlaying(null)} />}
      {playing === 'garden' && <RabbitsGarden onDone={(n) => done('garden', n)} onQuit={() => setPlaying(null)} />}
      {playing === 'sticks' && (
        <Poohsticks
          race={soloRace} you="me" dropped={false} waitingFor="Pooh" onDrop={soloDrop}
          onFinish={() => { const won = soloRace?.winner === 'me'; done('sticks', won ? 1 : 0, won); }}
          onQuit={() => { setPlaying(null); setSoloRace(null); }}
        />
      )}
    </View>
  );
}

/** Live Poohsticks with a friend: the invite (on any tab), and the race itself. */
export function SticksLive() {
  const { sticks, stickApi, net } = useGame();
  const [dropped, setDropped] = useState<string | null>(null);
  if (!sticks) return null;
  if (sticks.phase === 'invited' || sticks.phase === 'waiting') {
    const invited = sticks.phase === 'invited';
    return (
      <View style={styles.invite}>
        <View style={styles.row}>
          <Portrait emoji={sticks.other.avatar} size={44} />
          <Text style={[styles.name, { flex: 1, marginLeft: 10 }]}>
            {invited ? `${sticks.other.name} wants to play Poohsticks!` : `Asking ${sticks.other.name} to play Poohsticks…`}
          </Text>
        </View>
        <View style={styles.buttons}>
          {invited && <Button small label="🥢 Play!" onPress={() => stickApi.answer(true)} style={{ flex: 1 }} />}
          <Button small outline color={C.soft} label={invited ? 'Not now' : 'Cancel'} onPress={() => stickApi.answer(false)} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }
  return (
    <Poohsticks
      race={sticks.race || null} you={net.you || ''} dropped={dropped === sticks.id} waitingFor={sticks.other.name}
      onDrop={(q) => { setDropped(sticks.id); stickApi.drop(q); }}
      onFinish={stickApi.done} onQuit={stickApi.done}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  note: { color: C.soft, fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: -4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 34, marginRight: 10 },
  name: { fontSize: 17, fontWeight: '900', color: C.ink },
  small: { color: C.soft, fontSize: 12, fontWeight: '700', marginTop: 2 },
  blurb: { color: C.ink, fontSize: 14, marginTop: 6, lineHeight: 19 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  invite: {
    position: 'absolute', left: 12, right: 12, top: 70, backgroundColor: C.card, borderRadius: 18, padding: 14, zIndex: 70,
    borderWidth: 2, borderColor: C.pink, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 12,
  },
});
