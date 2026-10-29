import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AVATARS } from '../game/catalog';
import { useGame } from '../state/GameContext';
import { C, Card } from './kit';
import { Portrait } from './Portrait';

/** Change your character portrait and name any time (your partner sees it in Friends). */
export function ProfileCard() {
  const { s, act } = useGame();
  const [name, setName] = useState(s.profile.name);
  const saveName = () => {
    const clean = name.trim().slice(0, 16);
    if (clean) act((g) => { g.profile.name = clean; });
    else setName(s.profile.name);
  };
  return (
    <Card>
      <View style={styles.row}>
        <Portrait emoji={s.profile.avatar} size={64} ring="#FFD66B" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            value={name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName}
            maxLength={16} returnKeyType="done" style={styles.input} placeholder="Your name" placeholderTextColor={C.faint}
          />
        </View>
      </View>
      <Text style={[styles.label, { marginTop: 12 }]}>Your character</Text>
      <View style={styles.avatars}>
        {AVATARS.map((a) => (
          <Pressable
            key={a}
            onPress={() => act((g) => { g.profile.avatar = a; })}
            style={[styles.avatar, a === s.profile.avatar && styles.avatarOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: a === s.profile.avatar }}
          >
            <Portrait emoji={a} size={46} ring={a === s.profile.avatar ? '#FFD66B' : '#FFF8E6'} />
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontWeight: '900', color: C.soft, fontSize: 13 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4, color: C.ink, backgroundColor: 'white', fontSize: 16 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  avatar: { borderRadius: 27, padding: 2 },
  avatarOn: { backgroundColor: C.ink },
});
