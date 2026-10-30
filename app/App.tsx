import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PatrickHand_400Regular, useFonts } from '@expo-google-fonts/patrick-hand';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RESEARCH, varietyAt } from './src/game/catalog';
import { canBuyResearch, homeHasUpgrade, napDue } from './src/game/engine';
import { BUSINESSES } from './src/game/catalog';
import { AlbumScreen } from './src/screens/AlbumScreen';
import { GamesScreen, SticksLive } from './src/screens/GamesScreen';
import { HivesScreen } from './src/screens/HivesScreen';
import { MapScreen } from './src/screens/MapScreen';
import { NapScreen } from './src/screens/NapScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { WoodScreen } from './src/screens/WoodScreen';
import { GameProvider, useGame } from './src/state/GameContext';
import { Header } from './src/ui/Header';
import { C } from './src/ui/kit';
import { play, startMusic, unlockAudio } from './src/audio/sound';
import { CloudConflict } from './src/ui/CloudCard';
import { BalloonLayer, DailyGift, Onboarding, Toasts, WelcomeBack } from './src/ui/Overlays';
import { TripsScreen } from './src/screens/TripsScreen';
import { EXPLORERS, explorerState } from './src/game/trips';
import { WhatsNew } from './src/ui/WhatsNew';
import { NEWS_VERSION } from './src/game/news';

type Tab = 'map' | 'hives' | 'shop' | 'games' | 'trips' | 'wood' | 'album' | 'nap';
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'map', label: 'Map', emoji: '🗺️' },
  { id: 'hives', label: 'Hives', emoji: '🐝' },
  { id: 'shop', label: 'Shop', emoji: '🛍️' },
  { id: 'games', label: 'Games', emoji: '🎲' },
  { id: 'trips', label: 'Trips', emoji: '🧭' },
  { id: 'wood', label: 'Friends', emoji: '💕' },
  { id: 'album', label: 'Album', emoji: '📖' },
  { id: 'nap', label: 'Nap', emoji: '😴' },
];

// Phones and browsers only allow music to start after the first tap.
// Phone browsers only allow sound after a *finished* tap, and pause it again when you
// switch apps, so on the web every tap makes sure sound is unlocked and running
// (cheap when it already is).
let musicStarted = false;
const musicOnFirstTouch = () => { if (Platform.OS !== 'web' && !musicStarted) { musicStarted = true; startMusic(); } };
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  for (const e of ['touchend', 'click', 'keydown']) document.addEventListener(e, () => unlockAudio(), true);
}

function Game() {
  const { s, net, welcomeBack, now } = useGame();
  const [tab, setTab] = useState<Tab>('map');
  const accent = varietyAt(s.variety).deep;

  // Unread chat badge on the Friends tab: messages from others newer than the last one read.
  const newest = net.chat.length ? net.chat[net.chat.length - 1].at : 0;
  useEffect(() => { if (tab === 'wood' && newest > s.chatSeen) s.chatSeen = newest; }, [tab, newest, s]);
  const unread = (tab === 'wood' ? 0 : net.chat.filter((m) => m.at > s.chatSeen && m.from !== net.you).length) + s.letters.filter((l) => !l.read).length;
  const affordable = RESEARCH.filter((r) => canBuyResearch(s, r.id)).length;
  const upgradable = ['pooh', ...BUSINESSES.map((b) => b.id)].filter((id) => homeHasUpgrade(s, id)).length;
  // Explorers back from a trip with treasure to show you.
  const back = EXPLORERS.filter((e) => explorerState(s, e.id, now).phase === 'back').length;
  const badges: Partial<Record<Tab, string>> = {
    map: upgradable ? String(upgradable) : undefined,
    shop: affordable ? String(affordable) : undefined,
    trips: back ? String(back) : undefined,
    wood: unread ? String(unread) : undefined,
    album: s.albumNew.length ? String(s.albumNew.length) : undefined,
    // Pooh is sleepy: a nap would at least double your combs.
    nap: napDue(s) ? '💤' : undefined,
  };

  return (
    // The honey bar at the bottom fills the space by the iPhone's home bar itself (see Header).
    <SafeAreaView style={styles.root} edges={['top']} onTouchStart={musicOnFirstTouch}>
      <StatusBar style="dark" />
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => { if (t.id !== tab) play('tick'); setTab(t.id); }} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <Text style={[styles.tabEmoji, tab !== t.id && { opacity: 0.55 }]}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.id && { color: accent }]}>{t.label}</Text>
            {badges[t.id] && <View style={[styles.badge, { backgroundColor: t.id === 'wood' ? C.pink : C.green }]}><Text style={styles.badgeText}>{badges[t.id]}</Text></View>}
            {t.id === 'wood' && net.status === 'online' && net.roster.some((m) => m.online && m.id !== net.you) && <View style={styles.onlineDot} />}
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'map' && <MapScreen />}
        {tab === 'hives' && <HivesScreen />}
        {tab === 'shop' && <ShopScreen />}
        {tab === 'games' && <GamesScreen />}
        {tab === 'trips' && <TripsScreen />}
        {tab === 'wood' && <WoodScreen />}
        {tab === 'album' && <AlbumScreen />}
        {tab === 'nap' && <NapScreen />}
      </View>
      <Header />
      <BalloonLayer />
      <Toasts />
      <WelcomeBack />
      <SticksLive />
      <CloudConflict />
      {!s.profile.name && <Onboarding />}
      {s.profile.name && s.newsSeen < NEWS_VERSION && !welcomeBack && <WhatsNew />}
      {s.profile.name && s.newsSeen >= NEWS_VERSION && !welcomeBack && <DailyGift />}
    </SafeAreaView>
  );
}

export default function App() {
  // The map's hand-lettered labels; the app still renders while it loads.
  useFonts({ PatrickHand_400Regular });
  return (
    <SafeAreaProvider>
      <GameProvider>
        <Game />
      </GameProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  tabs: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: C.border, backgroundColor: C.card, paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  tabEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 11, fontWeight: '800', color: C.soft, marginTop: 1 },
  badge: { position: 'absolute', top: -2, right: '24%', borderRadius: 9, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '900' },
  onlineDot: { position: 'absolute', top: 2, left: '30%', width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, borderWidth: 1.5, borderColor: 'white' },
});
