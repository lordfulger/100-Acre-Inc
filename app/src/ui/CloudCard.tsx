import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { timeAgo } from '../game/format';
import { cloudReady } from '../net/cloud';
import { useGame } from '../state/GameContext';
import { Button, C, Card } from './kit';

/** Sign in with Google to keep the game safe in the cloud. */
export function CloudCard() {
  const { s, cloud } = useGame();
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => { cloudReady(s.profile.server).then(setAvailable); }, [s.profile.server]);

  return (
    <Card>
      {cloud.phase === 'on' ? (
        <>
          <Text style={styles.title}>☁️ Saved to Google</Text>
          <Text style={styles.body}>{cloud.email}</Text>
          <Text style={styles.small}>
            {cloud.lastSaved ? `Last saved ${timeAgo(cloud.lastSaved)}` : 'Saving…'} · saves every minute and when you leave the app. Signing out saves, then clears this phone.
          </Text>
          <View style={styles.row}>
            <Button small label="Save now" onPress={cloud.saveNow} style={{ flex: 1 }} />
            <Button small outline color={C.soft} label="Sign out" onPress={cloud.signOut} style={{ flex: 1 }} />
          </View>
        </>
      ) : cloud.phase === 'signing-in' ? (
        <>
          <Text style={styles.title}>☁️ Signing in…</Text>
          <Text style={styles.body}>Finish signing in with Google in the page that just opened, then come back here.</Text>
          <Button small outline color={C.soft} label="Cancel" onPress={cloud.cancelSignIn} style={{ marginTop: 8 }} />
        </>
      ) : (
        <>
          <Text style={styles.title}>☁️ Keep your wood safe</Text>
          <Text style={styles.body}>Sign in with Google to back up your honey, homes and Golden Honeycombs, and bring them back on any phone.</Text>
          {available === false ? (
            <Text style={styles.small}>Cloud saves aren't switched on for this server yet.</Text>
          ) : (
            <Button label="Sign in with Google" color="#4285F4" onPress={cloud.signIn} disabled={!available} style={{ marginTop: 10 }} />
          )}
        </>
      )}
      {cloud.error && <Text style={styles.error}>{cloud.error}</Text>}
    </Card>
  );
}

/**
 * When the server has Google sign-in, the game is played from your cloud save: this covers
 * everything until you're signed in and your save has loaded.
 */
export function CloudGate() {
  const { cloud } = useGame();
  if (cloud.phase === 'on' || (cloud.phase !== 'checking' && !cloud.required)) return null;
  const waiting = cloud.phase === 'checking' || cloud.phase === 'loading';
  return (
    <View style={[styles.scrim, { backgroundColor: C.bg }]}>
      <View style={styles.modal}>
        <Text style={styles.gateEmoji}>🍯</Text>
        <Text style={styles.modalTitle}>{waiting ? 'Opening your wood…' : '100 Acre Inc'}</Text>
        {waiting ? (
          <Text style={[styles.body, { textAlign: 'center' }]}>{cloud.phase === 'loading' ? `Loading your save for ${cloud.email}` : 'Just a moment.'}</Text>
        ) : cloud.phase === 'signing-in' ? (
          <>
            <Text style={[styles.body, { textAlign: 'center' }]}>Finish signing in with Google in the page that just opened, then come back here.</Text>
            <Button small outline color={C.soft} label="Cancel" onPress={cloud.cancelSignIn} style={{ marginTop: 12 }} />
          </>
        ) : (
          <>
            <Text style={[styles.body, { textAlign: 'center' }]}>Sign in with Google to play. Your wood is saved to your account, so it's the same on every phone and never gets lost.</Text>
            <Button label="Sign in with Google" color="#4285F4" onPress={cloud.signIn} style={{ marginTop: 14 }} />
          </>
        )}
        {cloud.error && <Text style={[styles.error, { textAlign: 'center' }]}>{cloud.error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '900', color: C.ink },
  body: { color: C.ink, fontSize: 14, lineHeight: 20, marginTop: 4 },
  small: { color: C.soft, fontSize: 12, fontWeight: '600', marginTop: 4 },
  error: { color: C.red, fontSize: 12, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000, elevation: 1000 },
  modal: { backgroundColor: C.card, borderRadius: 24, padding: 20, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: C.ink, textAlign: 'center' },
  gateEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 6 },
});
