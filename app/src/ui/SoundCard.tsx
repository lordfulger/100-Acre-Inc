import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { play } from '../audio/sound';
import { hasRecordings, say } from '../audio/voices';
import { useGame } from '../state/GameContext';
import { refreshLocalWeather } from '../net/localWeather';
import { weatherAt, WEATHER_NAMES } from '../game/calendar';
import { C, Card } from './kit';
import { lightEffects, seemsSlow } from './effects';

const ROWS = [
  { key: 'music', label: '🎵 Music', hint: '"Honey on the Hill", a music-box waltz' },
  { key: 'sfx', label: '🔔 Sound effects', hint: 'Soft taps, chimes and pops' },
  { key: 'voices', label: '🗣️ Your recorded voices', hint: 'Plays your clips from assets/voices' },
] as const;

/** Match the wood's weather to the weather outside (asks to use the phone's rough location). */
export function WeatherCard() {
  const { s, act, toast } = useGame();
  const [busy, setBusy] = useState(false);
  const on = s.settings.localWeather;
  const turn = async (want: boolean) => {
    if (!want) { act((g) => { g.settings = { ...g.settings, localWeather: false }; }); return; }
    setBusy(true);
    const r = await refreshLocalWeather(true);
    setBusy(false);
    if (r === 'denied') { toast("🌦️ The game wasn't allowed to know where you are, so the wood keeps its own weather."); return; }
    act((g) => { g.settings = { ...g.settings, localWeather: true }; });
    toast(r === 'ok' ? `🌦️ The wood now has your weather: ${WEATHER_NAMES[weatherAt(Date.now())]}.` : "🌦️ Couldn't get your weather just now. The game will keep trying.");
  };
  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>🌦️ My real weather</Text>
          <Text style={styles.hint}>
            Rain, snow, wind or sun in the wood to match outside. Uses your rough location (about 10 km), only to ask a weather service. It's never sent to the game or saved.
          </Text>
        </View>
        <Switch value={on} disabled={busy} onValueChange={turn} trackColor={{ true: C.green, false: C.disabled }} />
      </View>
    </Card>
  );
}

export function SoundCard() {
  const { s, act } = useGame();
  return (
    <Card>
      {ROWS.filter((r) => r.key !== 'voices' || hasRecordings()).map((r) => (
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
              if (on && r.key === 'sfx') setTimeout(() => play('shop'), 50);
              if (on && r.key === 'voices') setTimeout(() => say('pooh', 'hello'), 50);
            }}
            trackColor={{ true: C.green, false: C.disabled }}
          />
        </View>
      ))}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>✨ Fancy effects</Text>
          <Text style={styles.hint}>
            {s.settings.effects === 'auto' && seemsSlow() ? 'Turned down automatically, as this phone seemed slow' : 'Weather, fireflies, birds and smoke on the map'}
          </Text>
        </View>
        <Switch
          value={!lightEffects(s.settings.effects)}
          onValueChange={(on) => act((g) => { g.settings = { ...g.settings, effects: on ? 'full' : 'light' }; })}
          trackColor={{ true: C.green, false: C.disabled }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  label: { fontWeight: '900', color: C.ink, fontSize: 15 },
  hint: { color: C.soft, fontSize: 12, fontWeight: '600' },
});
