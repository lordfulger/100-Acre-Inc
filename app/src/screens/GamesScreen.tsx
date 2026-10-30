import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeEvent, eventProgress } from '../game/calendar';
import { BIZ_BY_ID, POOH_HOUSE } from '../game/catalog';
import { finishGame, GAME_COOLDOWN_MIN, GAME_IDS, GameId, gameOpen, GAMES, gameReady, gameWait, TIMED_GAMES } from '../game/extras';
import { HAND } from '../ui/WoodMap';
import { fmt } from '../game/format';
import { Net, StickRace, useGame } from '../state/GameContext';
import { GameState } from '../game/engine';
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

type Result = { score: number; honey: number; newBest: boolean; best: number };

/** Runs one game full-screen and pays out when it ends. Used by the Games tab and the map. */
export function GameRunner({ id, onClose }: { id: GameId; onClose: () => void }) {
  const { s, act, toast } = useGame();
  const [soloRace, setSoloRace] = useState<StickRace | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const finished = useRef(false);
  const done = (score: number, won?: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const r = act((g, t) => finishGame(g, id, score, t, won));
    if (id === 'sticks') {
      // Poohsticks shows its own finish, so just say what was won.
      onClose();
      if (r.honey > 0) { play('fanfare'); toast(`${GAMES[id].emoji} +${fmt(r.honey)} honey`); }
      return;
    }
    play(r.newBest || r.honey > 0 ? 'fanfare' : 'pop');
    setResult({ score, honey: r.honey, newBest: r.newBest && score > 0, best: s.games[id]?.best ?? score });
  };
  // The Games tab and the map only offer games that are unlocked and rested, but check again here.
  const [allowed] = useState(() => gameOpen(s, id) && gameReady(s, id, Date.now()));
  useEffect(() => { if (!allowed) onClose(); }, [allowed, onClose]);
  if (!allowed) return null;
  if (result) return <GameOver id={id} r={result} onClose={onClose} />;
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

/** The end of a game: time's up or game over, the score, your high score, the prize, and the wood's best. */
function GameOver({ id, r, onClose }: { id: GameId; r: Result; onClose: () => void }) {
  const g = GAMES[id];
  const timed = TIMED_GAMES.has(id);
  return (
    <View style={styles.over}>
      <ScrollView contentContainerStyle={styles.overBody}>
        <Text style={styles.overEmoji}>{r.newBest ? '🏆' : timed ? '⏰' : g.emoji}</Text>
        <Text style={styles.overTitle}>{timed ? "Time's up!" : 'Game over!'}</Text>
        <Text style={[styles.overNote, r.newBest && { color: C.greenDeep }]}>
          {r.newBest ? 'New high score!' : r.score > 0 ? 'Well played!' : 'Have another go when it has rested.'}
        </Text>
        <Text style={styles.overScore}>{r.score}</Text>
        <Text style={styles.small}>{g.emoji} {g.name} · High score {r.best}</Text>
        <Text style={[styles.prize, r.honey <= 0 && { color: C.soft, fontSize: 16 }]}>{r.honey > 0 ? `+${fmt(r.honey)} honey` : 'No honey this time'}</Text>
        <Card style={{ width: '100%', marginTop: 14 }}>
          <Text style={styles.name}>🏆 High scores</Text>
          <Leaderboard id={id} />
        </Card>
        <Button label="Lovely!" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 4 }} />
      </ScrollView>
    </View>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

type ScoreRow = { key: string; name: string; avatar: string; score: number; me: boolean };

/** Everyone in your wood who has played a game, best first (your own score is always the latest). */
function scoresFor(id: GameId, s: GameState, net: Net): ScoreRow[] {
  return [
    ...net.roster.filter((m) => m.id !== net.you).map((m) => ({ key: m.id, name: m.name, avatar: m.avatar, score: m.stats.bests?.[id] || 0, me: false })),
    { key: 'me', name: s.profile.name || 'You', avatar: s.profile.avatar, score: s.games[id]?.best || 0, me: true },
  ].filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

/** One game's leaderboard. */
export function Leaderboard({ id, limit = 5 }: { id: GameId; limit?: number }) {
  const { s, net } = useGame();
  const rows = scoresFor(id, s, net);
  const mine = rows.findIndex((x) => x.me);
  const shown = rows.slice(0, limit);
  const row = (x: (typeof rows)[number], i: number) => (
    <View key={x.key} style={[styles.board, x.me && styles.boardMe]}>
      <Text style={styles.rank}>{MEDALS[i] ?? `${i + 1}.`}</Text>
      <Portrait emoji={x.avatar} size={26} />
      <Text style={[styles.boardName, x.me && { fontWeight: '900' }]} numberOfLines={1}>{x.name}{x.me ? ' (you)' : ''}</Text>
      <Text style={styles.boardScore}>{x.score}</Text>
    </View>
  );
  return (
    <View style={{ marginTop: 6 }}>
      {shown.length === 0 && <Text style={styles.small}>No scores yet. Be the first!</Text>}
      {shown.map(row)}
      {mine >= limit && row(rows[mine], mine)}
      {!net.room && <Text style={[styles.small, { marginTop: 6 }]}>Join a wood on the Friends tab to see your friends' scores here too.</Text>}
    </View>
  );
}

/** Every game's top score in the wood, with yours beside it, at the top of the Games tab. */
function HighScores() {
  const { s, net } = useGame();
  const played = GAME_IDS.filter((id) => id !== 'sticks').map((id) => ({ id, rows: scoresFor(id, s, net) })).filter((x) => x.rows.length);
  return (
    <Card>
      <Text style={styles.name}>🏆 High scores</Text>
      {played.length === 0 && <Text style={styles.small}>Play a game to set your first high score!</Text>}
      {played.map(({ id, rows }) => {
        const top = rows[0];
        const mine = s.games[id]?.best || 0;
        return (
          <View key={id} style={styles.board}>
            <Text style={styles.rank}>{GAMES[id].emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.boardName} numberOfLines={1}>{GAMES[id].name}</Text>
              <Text style={styles.small}>{top.me ? '🥇 You lead!' : `🥇 ${top.name} ${top.score}`}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.boardScore}>{mine || '–'}</Text>
              <Text style={styles.small}>your best</Text>
            </View>
          </View>
        );
      })}
      {!net.room && played.length > 0 && <Text style={[styles.small, { marginTop: 6 }]}>Join a wood on the Friends tab to see your friends' scores here too.</Text>}
    </Card>
  );
}

export function GamesScreen() {
  const { s, net, now, stickApi } = useGame();
  const [playing, setPlaying] = useState<GameId | null>(null);
  const [board, setBoard] = useState<GameId | null>(null);
  const event = activeEvent(now);
  // Friends in the wood, or away but with notifications on (they get a ping).
  const friends = net.status === 'online' ? net.roster.filter((m) => m.id !== net.you && (m.online || m.notify)) : [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        <Section title="🎲 Games in the Wood" />
        <Text style={styles.note}>Every home has its own game. Each pays a honey prize, bigger for better scores, then rests for {GAME_COOLDOWN_MIN} minutes before you can play it again.</Text>
        <HighScores />
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
                <>
                  <Button label={ready ? 'Play' : `Ready in ${wait}m`} disabled={!ready} onPress={() => { play('pop'); setPlaying(id); }} style={{ marginTop: 8 }} />
                  <Button small outline color={C.soft} label={board === id ? '🏆 Hide high scores' : '🏆 High scores'} onPress={() => setBoard((b) => (b === id ? null : id))} style={{ marginTop: 8 }} />
                  {board === id && <Leaderboard id={id} />}
                </>
              )}
              {id === 'sticks' && friends.length === 0 && <Text style={styles.small}>When your friend is in the wood (or has notifications on), you can race each other live.</Text>}
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
  over: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 60 },
  overBody: { padding: 20, paddingTop: 40, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  overEmoji: { fontSize: 64 },
  overTitle: { fontFamily: HAND, fontSize: 38, color: C.ink, marginTop: 4 },
  overNote: { fontSize: 16, fontWeight: '800', color: C.soft },
  overScore: { fontSize: 64, fontWeight: '900', color: C.ink, marginTop: 6 },
  prize: { fontSize: 20, fontWeight: '900', color: C.greenDeep, marginTop: 8 },
  board: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 10 },
  boardMe: { backgroundColor: '#FFF1C9' },
  rank: { width: 28, fontSize: 16, fontWeight: '900', color: C.soft, textAlign: 'center' },
  boardName: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink },
  boardScore: { fontSize: 16, fontWeight: '900', color: C.ink },
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
