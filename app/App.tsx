import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PatrickHand_400Regular, useFonts } from '@expo-google-fonts/patrick-hand';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RESEARCH, varietyAt } from './src/game/catalog';
import { canBuyResearch, homeHasUpgrade } from './src/game/engine';
import { BUSINESSES } from './src/game/catalog';
import { HivesScreen } from './src/screens/HivesScreen';
import { MapScreen } from './src/screens/MapScreen';
import { NapScreen } from './src/screens/NapScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { WoodScreen } from './src/screens/WoodScreen';
import { GameProvider, useGame } from './src/state/GameContext';
import { Header } from './src/ui/Header';
import { C } from './src/ui/kit';
import { CloudConflict } from './src/ui/CloudCard';
import { BalloonLayer, Onboarding, Toasts, WelcomeBack } from './src/ui/Overlays';

type Tab = 'map' | 'hives' | 'shop' | 'wood' | 'nap';
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'map', label: 'Map', emoji: '🗺️' },
  { id: 'hives', label: 'Hives', emoji: '🐝' },
  { id: 'shop', label: 'Shop', emoji: '🛍️' },
  { id: 'wood', label: 'Friends', emoji: '💕' },
  { id: 'nap', label: 'Nap', emoji: '😴' },
];

function Game() {
  const { s, net } = useGame();
  const [tab, setTab] = useState<Tab>('map');
  const accent = varietyAt(s.variety).deep;

  // Unread chat badge on the Friends tab.
  const seenChat = useRef(net.chat.length);
  useEffect(() => { if (tab === 'wood') seenChat.current = net.chat.length; }, [tab, net.chat.length]);
  const unread = tab === 'wood' ? 0 : Math.max(0, net.chat.length - seenChat.current);
  const affordable = RESEARCH.filter((r) => canBuyResearch(s, r.id)).length;
  const upgradable = ['pooh', ...BUSINESSES.map((b) => b.id)].filter((id) => homeHasUpgrade(s, id)).length;
  const badges: Partial<Record<Tab, string>> = {
    map: upgradable ? String(upgradable) : undefined,
    shop: affordable ? String(affordable) : undefined,
    wood: unread ? String(unread) : undefined,
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <Header />
      <View style={{ flex: 1 }}>
        {tab === 'map' && <MapScreen />}
        {tab === 'hives' && <HivesScreen />}
        {tab === 'shop' && <ShopScreen />}
        {tab === 'wood' && <WoodScreen />}
        {tab === 'nap' && <NapScreen />}
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <Text style={[styles.tabEmoji, tab !== t.id && { opacity: 0.55 }]}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.id && { color: accent }]}>{t.label}</Text>
            {badges[t.id] && <View style={[styles.badge, { backgroundColor: t.id === 'wood' ? C.pink : C.green }]}><Text style={styles.badgeText}>{badges[t.id]}</Text></View>}
            {t.id === 'wood' && net.status === 'online' && net.roster.some((m) => m.online && m.id !== net.you) && <View style={styles.onlineDot} />}
          </Pressable>
        ))}
      </View>
      <BalloonLayer />
      <Toasts />
      <WelcomeBack />
      <CloudConflict />
      {!s.profile.name && <Onboarding />}
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
  tabs: { flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: C.border, backgroundColor: C.card, paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  tabEmoji: { fontSize: 24 },
  tabLabel: { fontSize: 12, fontWeight: '800', color: C.soft, marginTop: 1 },
  badge: { position: 'absolute', top: -2, right: '24%', borderRadius: 9, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '900' },
  onlineDot: { position: 'absolute', top: 2, left: '30%', width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, borderWidth: 1.5, borderColor: 'white' },
});
