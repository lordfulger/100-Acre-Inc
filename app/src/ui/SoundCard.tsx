import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { play } from '../audio/sound';
import { say } from '../audio/voices';
import { useGame } from '../state/GameContext';
import { C, Card } from './kit';

const ROWS = [
  { key: 'music', label: '🎵 Music', hint: '"Honey on the Hill", a music-box waltz' },
  { key: 'sfx', label: '🔔 Sound effects', hint: 'Taps, chimes, balloons and hugs' },
  { key: 'voices', label: '🗣️ Character voices', hint: 'Lines when you hire, upgrade and get hugs' },
] as const;

export function SoundCard() {
  const { s, act } = useGame();
  return (
    <Card>
      {ROWS.map((r) => (
        <View key={r.key} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.hint}>{r.hint}</Text>
          </View>
          <Switch
            value={s.settings[r.key]}
            onValueChange={(on) => {
              act((g) => { g.settings = { ...g.settings, [r.key]: on }; });
              // A little preview so you can hear what you switched on.
              if (on && r.key === 'sfx') setTimeout(() => play('buy'), 50);
              if (on && r.key === 'voices') setTimeout(() => say('pooh', 'hello'), 50);
            }}
            trackColor={{ true: C.green, false: C.disabled }}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  label: { fontWeight: '900', color: C.ink, fontSize: 15 },
  hint: { color: C.soft, fontSize: 12, fontWeight: '600' },
});
