import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fmt, timeAgo } from '../game/format';
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
            {cloud.lastSaved ? `Last saved ${timeAgo(cloud.lastSaved)}` : 'Saving…'} · saves every minute and when you leave the app
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

/** Shown when the cloud has more progress than this phone: pick which to keep. */
export function CloudConflict() {
  const { s, cloud } = useGame();
  if (!cloud.conflict) return null;
  const c = cloud.conflict;
  return (
    <View style={styles.scrim}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>☁️ Which save do you want?</Text>
        <Text style={styles.body}>Your Google account already has a save that's further along than this phone.</Text>
        <Button label="Use the cloud save" sub={`${fmt(c.allTime)} all-time honey · saved ${timeAgo(Date.parse(c.savedAt))}`} onPress={() => cloud.resolve(true)} style={{ marginTop: 12 }} />
        <Button outline color={C.soft} label="Keep this phone's" sub={`${fmt(s.allTimeEarned)} all-time honey · replaces the cloud`} onPress={() => cloud.resolve(false)} style={{ marginTop: 8 }} />
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
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,52,24,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 120 },
  modal: { backgroundColor: C.card, borderRadius: 24, padding: 20, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: C.ink, textAlign: 'center' },
});
