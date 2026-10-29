// Shown once after an update, so new things don't go unnoticed.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NEWS } from '../game/news';
import { pushSupported } from '../net/push';
import { useGame } from '../state/GameContext';
import { Button, C } from './kit';
import { HAND } from './WoodMap';
import { play } from '../audio/sound';

export function WhatsNew() {
  const { s, act, net, wood } = useGame();
  // Everything not seen yet, oldest first, in case a note or two was missed.
  const unseen = NEWS.filter((n) => n.v > s.newsSeen);
  const title = unseen.length === 1 ? unseen[0].title : "What's new in the wood";
  const items = unseen.flatMap((n) => n.items);
  const close = () => { play('pop'); act((g) => { g.newsSeen = NEWS[NEWS.length - 1].v; }); };
  return (
    <View style={styles.scrim}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView style={{ flexShrink: 1 }}>
          {items.map(([emoji, title, text]) => (
            <View key={title} style={styles.item}>
              <Text style={styles.emoji}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.text}>{text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {pushSupported() && s.profile.room && !net.pushOn && (
          <Button label="🔔 Turn on notifications" sub="Hear about hugs, letters and Poohsticks" color={C.blue} onPress={wood.notifications} style={{ marginTop: 10 }} />
        )}
        <Button label="Lovely!" onPress={close} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,52,24,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 16, maxWidth: 480, width: '100%', maxHeight: '88%', borderWidth: 2, borderColor: '#D9C48E' },
  title: { fontFamily: HAND, fontSize: 28, color: C.ink, textAlign: 'center', marginBottom: 8 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F5ECD5' },
  emoji: { fontSize: 26, width: 34, textAlign: 'center' },
  itemTitle: { fontWeight: '900', color: C.ink, fontSize: 15 },
  text: { color: C.ink, fontSize: 13, lineHeight: 18, marginTop: 1 },
});
