import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeEvent, eventProgress } from '../game/calendar';
import { BIZ_BY_ID, POOH_HOUSE } from '../game/catalog';
import { finishGame, GAME_COOLDOWN_MIN, GAME_IDS, GameId, gameOpen, GAMES, gameReady, gameWait } from '../game/extras';
import { fmt } from '../game/format';
import { StickRace, useGame } from '../state/GameContext';
import { Button, C, Card, Section } from '../ui/kit';
import { HoneyDrip, Poohsticks, RabbitsGarden, WoozleTracks } from '../ui/Minigames';
import { Balloons, BeeLine, Bounce, CountPots, OddOne, Pairs, River, Spelling, Stretch, Tail, Trap } from '../ui/HomeGames';
import { Portrait } from '../ui/Portrait';
import { play } from '../audio/sound';

/** Seconds a stick takes: a good drop takes up to 4s off, and the river adds up to 3s of luck (same as the server). */
const stickTime = (q: number) => 14 - 4 * q + Math.random() * 3;

const SOLO: Partial<Record<GameId, React.ComponentType<{ onDone: (n: number) => void; onQuit: () => void }>>> = {
  stretch: Stretch, drip: HoneyDrip, tracks: WoozleTracks, garden: RabbitsGarden, spelling: Spelling, bounce: Bounce, tail: Tail,
  balloons: Balloons, count: CountPots, trap: Trap, river: River, pairs: Pairs, beeline: BeeLine, oddone: OddOne,
};
const homeName = (home: string) => (home === POOH_HOUSE.id ? POOH_HOUSE.name : BIZ_BY_ID[home].name);

/** Runs one game full-screen and pays out when it ends. Used by the Games tab and the map. */
export function GameRunner({ id, onClose }: { id: GameId; onClose: () => void }) {
  const { s, act, toast } = useGame();
  const [soloRace, setSoloRace] = useState<StickRace | null>(null);
  const done = (score: number, won?: boolean) => {
    onClose();
    const r = act((g, t) => finishGame(g, id, score, t, won));
    if (r.honey > 0) { play('fanfare'); toast(`${GAMES[id].emoji} ${r.newBest ? 'New best! ' : ''}+${fmt(r.honey)} honey`); }
    else toast(`${GAMES[id].emoji} ${r.newBest ? `New best: ${score}! ` : ''}No prize this time. Better luck next time!`);
  };
  // The Games tab and the map only offer games that are unlocked and rested, but check again here.
  const [allowed] = useState(() => gameOpen(s, id) && gameReady(s, id, Date.now()));
  useEffect(() => { if (!allowed) onClose(); }, [allowed, onClose]);
  if (!allowed) return null;
  const Game = SOLO[id];
  if (Game) return <Game onDone={(n) => done(n)} onQuit={onClose} />;

  const soloDrop = (q: number) => {
    const pooh = 0.3 + Math.random() * 0.55;
    const sticks = [
      { pid: 'me', name: 'You', avatar: s.profile.avatar, q, time: stickTime(q) },
      { pid: 'pooh', name: 'Pooh', avatar: '🐻', q: pooh, time: stickTime(pooh) },
    ];
    setSoloRace({ sticks, winner: sticks[0].time <= sticks[1].time ? 'me' : 'pooh', seed: Math.floor(Math.random() * 1e9) });
  };
  return (
    <Poohsticks
      race={soloRace} you="me" dropped={false} waitingFor="Pooh" onDrop={soloDrop}
      onFinish={() => { const won = soloRace?.winner === 'me'; done(won ? 1 : 0, won); }}
      onQuit={onClose}
    />
  );
}

export function GamesScreen() {
  const { s, net, now, stickApi } = useGame();
  const [playing, setPlaying] = useState<GameId | null>(null);
  const event = activeEvent(now);
  const friends = net.status === 'online' ? net.roster.filter((m) => m.id !== net.you && m.online) : [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        <Section title="🎲 Games in the Wood" />
        <Text style={styles.note}>Every home has its own game. Each pays a honey prize, bigger for better scores, then rests for {GAME_COOLDOWN_MIN} minutes before you can play it again.</Text>
        {event?.kind === 'game' && !s.eventsWon.includes(event.id) && (
          <Card style={{ borderColor: C.green }}>
            <Text style={styles.name}>{event.emoji} {event.name}</Text>
            <Text style={styles.note}>{event.task}: {eventProgress(s, event, now)}/{event.goal}</Text>
          </Card>
        )}
        {GAME_IDS.map((id) => {
          const g = GAMES[id];
          if (!gameOpen(s, id)) {
            return (
              <Card key={id} style={{ opacity: 0.6 }}>
                <View style={styles.row}>
                  <Text style={styles.emoji}>🔒</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{g.name}</Text>
                    <Text style={styles.small}>Unlock {homeName(g.home)} on the map to play</Text>
                  </View>
                </View>
              </Card>
            );
          }
          const ready = gameReady(s, id, now);
          const wait = gameWait(s, id, now);
          return (
            <Card key={id}>
              <View style={styles.row}>
                <Text style={styles.emoji}>{g.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{g.name}</Text>
                  <Text style={styles.small}>{homeName(g.home)}</Text>
                  <Text style={styles.small}>
                    {ready ? '🍯 Ready to play' : `💤 Resting · ready in ${wait}m`}{id !== 'sticks' && s.games[id]?.best ? ` · Best ${s.games[id].best}` : ''}{id === 'sticks' ? ` · ${s.stats.sticksWon} wins` : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.blurb}>{g.blurb}</Text>
              {id === 'sticks' ? (
                <View style={styles.buttons}>
                  <Button small label="🐻 Race Pooh" disabled={!ready} onPress={() => { play('pop'); setPlaying('sticks'); }} style={{ flex: 1 }} />
                  {friends.map((m) => (
                    <Button key={m.id} small color={C.pink} label={`${m.avatar} Race ${m.name}`} disabled={!ready} onPress={() => stickApi.invite(m.id)} style={{ flex: 1 }} />
                  ))}
                </View>
              ) : (
                <Button label={ready ? 'Play' : `Ready in ${wait}m`} disabled={!ready} onPress={() => { play('pop'); setPlaying(id); }} style={{ marginTop: 8 }} />
              )}
              {id === 'sticks' && friends.length === 0 && <Text style={styles.small}>When your friend is in the wood, you can race each other live.</Text>}
            </Card>
          );
        })}
      </ScrollView>
      {playing && <GameRunner id={playing} onClose={() => setPlaying(null)} />}
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
