import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { AVATARS } from '../game/catalog';
import { catchBalloon } from '../game/engine';
import { fmt, fmtTime } from '../game/format';
import { useGame } from '../state/GameContext';
import { Button, buzz, C, nativeDriver } from './kit';
import { Portrait } from './Portrait';
import { play } from '../audio/sound';
import { say } from '../audio/voices';

// Golden balloons drift up the screen now and then. Catch one for a bonus —
// and your partner gets a little shared joy too.
const BALLOON = require('../../assets/art/balloon.png');
// The framed story cards, shown at the game's big moments.
const CARDS = {
  hunny: require('../../assets/art/card-hunny.png'),
  balloon: require('../../assets/art/card-balloon.png'),
  honeycomb: require('../../assets/art/card-honeycomb.png'),
};
const StoryCard = ({ card, height }: { card: keyof typeof CARDS; height: number }) => (
  <Image source={CARDS[card]} style={[styles.card, { height, width: height * 800 / 960 }]} />
);

export function BalloonLayer() {
  const game = useGame();
  const gameRef = useRef(game);
  gameRef.current = game;
  const { height, width } = useWindowDimensions();
  const [balloon, setBalloon] = useState<{ id: number; x: number; anim: Animated.Value } | null>(null);
  const nextAt = useRef(Date.now() + 25_000);

  const scheduleNext = () => {
    nextAt.current = Date.now() + (60_000 + Math.random() * 120_000) / gameRef.current.d.balloonRate;
  };

  useEffect(() => {
    if (balloon) return;
    const id = setInterval(() => {
      if (Date.now() < nextAt.current) return;
      const anim = new Animated.Value(0);
      const b = { id: Date.now(), x: 30 + Math.random() * Math.max(60, width - 130), anim };
      setBalloon(b);
      play('whoosh');
      Animated.timing(anim, { toValue: 1, duration: 13_000, easing: Easing.linear, useNativeDriver: nativeDriver }).start(({ finished }) => {
        if (finished) { setBalloon(null); scheduleNext(); }
      });
    }, 1000);
    return () => clearInterval(id);
  }, [balloon, width]);

  if (!balloon) return null;
  const pop = () => {
    balloon.anim.stopAnimation();
    setBalloon(null);
    scheduleNext();
    buzz('success');
    const g = gameRef.current;
    const r = g.act((s, now) => catchBalloon(s, now));
    play('balloon');
    if (r.kind !== 'lucky') setTimeout(() => play('buzz'), 250);
    g.toast(r.kind === 'lucky' ? `🎈 Lucky Honey! +${fmt(r.amount)}` : `🎈 ${r.title}`);
    g.wood.balloon();
  };
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute', left: balloon.x, top: 0,
          transform: [
            { translateY: balloon.anim.interpolate({ inputRange: [0, 1], outputRange: [height, -160] }) },
            { translateX: balloon.anim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 28, 0, -28, 0] }) },
          ],
        }}
      >
        <Pressable onPress={pop} hitSlop={20} accessibilityLabel="Catch the balloon" style={styles.balloon}>
          <Image source={BALLOON} style={styles.balloonArt} />
          <Portrait id="pooh" size={40} style={{ marginTop: -6 }} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function Toasts() {
  const { toasts } = useGame();
  return (
    <View pointerEvents="none" style={styles.toasts}>
      {toasts.map((t) => (
        <View key={t.id} style={styles.toast}><Text style={styles.toastText}>{t.text}</Text></View>
      ))}
    </View>
  );
}

export function WelcomeBack() {
  const { welcomeBack, dismissWelcome, s } = useGame();
  if (!welcomeBack || !s.profile.name) return null;
  return (
    <View style={styles.scrim}>
      <View style={styles.modal}>
        <StoryCard card="hunny" height={210} />
        <Text style={styles.title}>Welcome back, {s.profile.name}!</Text>
        <Text style={styles.body}>While you were away for {fmtTime(welcomeBack.seconds)}, your managers made</Text>
        <Text style={styles.amount}>{fmt(welcomeBack.earned)} honey</Text>
        <Button label="Lovely!" onPress={() => { dismissWelcome(); play('welcome'); }} />
      </View>
    </View>
  );
}

/** Shown when you wake from a nap. */
export function NapWake({ combs, onClose }: { combs: number; onClose: () => void }) {
  return (
    <View style={styles.scrim}>
      <View style={styles.modal}>
        <StoryCard card="honeycomb" height={240} />
        <Text style={styles.title}>Zzz… good morning!</Text>
        <Text style={styles.body}>You dreamed of honey and woke up with</Text>
        <Text style={styles.amount}>{fmt(combs)} Golden Honeycombs</Text>
        <Button label="Back to work!" onPress={onClose} />
      </View>
    </View>
  );
}

export function Onboarding() {
  const { act } = useGame();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  return (
    <View style={styles.scrim}>
      <View style={styles.modal}>
        <StoryCard card="balloon" height={150} />
        <Text style={styles.title}>100 Acre Inc</Text>
        <Text style={styles.body}>Build a honey empire in the Hundred Acre Wood — with a friend. What shall we call you?</Text>
        <TextInput
          value={name} onChangeText={(t) => setName(t.slice(0, 16))} placeholder="Your name" placeholderTextColor={C.faint}
          style={styles.input} autoFocus
        />
        <View style={styles.avatars}>
          {AVATARS.map((a) => (
            <Pressable key={a} onPress={() => setAvatar(a)} style={[styles.avatar, a === avatar && styles.avatarOn]}>
              <Portrait emoji={a} size={42} ring={a === avatar ? '#FFD66B' : '#FFF8E6'} />
            </Pressable>
          ))}
        </View>
        <Button
          label="Into the wood!"
          disabled={!name.trim()}
          onPress={() => act((s) => { s.profile.name = name.trim(); s.profile.avatar = avatar; })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', borderRadius: 6 },
  balloon: { alignItems: 'center' },
  balloonArt: { width: 110, height: 110, marginBottom: -26 },
  toasts: { position: 'absolute', top: 76, left: 16, right: 16, alignItems: 'center', zIndex: 50 },
  toast: { backgroundColor: 'rgba(74,52,24,0.92)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginBottom: 6, maxWidth: 420 },
  toastText: { color: 'white', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,52,24,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 },
  modal: { backgroundColor: C.card, borderRadius: 24, padding: 20, width: '100%', maxWidth: 420, gap: 10 },
  title: { fontSize: 22, fontWeight: '900', color: C.ink, textAlign: 'center' },
  body: { fontSize: 15, color: C.ink, textAlign: 'center', lineHeight: 21 },
  amount: { fontSize: 28, fontWeight: '900', color: C.greenDeep, textAlign: 'center' },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.ink, backgroundColor: 'white', fontSize: 17, textAlign: 'center' },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  avatar: { borderRadius: 26, padding: 2 },
  avatarOn: { backgroundColor: C.ink },
});
