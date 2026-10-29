import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BIZ_BY_ID, buildingMult, BUSINESSES, LEVEL_PERKS, LEVEL_STEP, lookName, lookOf, POOH_HOUSE, poohTapMult } from '../game/catalog';
import { addonEffectText } from '../game/catalog';
import { addonList, buildingNext, buyAddon, buyBiz, canUpgradeBuilding, hireManager, homeHasUpgrade, managerCost, mapView, quote, upgradeBuilding } from '../game/engine';
import { fmt, fmtTime } from '../game/format';
import { useGame } from '../state/GameContext';
import { Bar, Button, buzz, C } from '../ui/kit';
import { Portrait, portraitFor } from '../ui/Portrait';
import { HAND, WoodMap } from '../ui/WoodMap';
import { play, playLevel } from '../audio/sound';
import { say } from '../audio/voices';

const ALL_IDS = [POOH_HOUSE.id, ...BUSINESSES.map((b) => b.id)];

function BuildingSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { s, d, act, toast } = useGame();
  const isPooh = id === POOH_HOUSE.id;
  const b = isPooh ? null : BIZ_BY_ID[id];
  const name = isPooh ? POOH_HOUSE.name : b!.name;
  const level = s.levels[id] || 0;
  const next = buildingNext(s, id);
  const owned = b ? s.biz[id].owned : 0;
  const look = lookOf(level);
  const toNextLook = LEVEL_STEP - (level % LEVEL_STEP);
  const nextPerk = LEVEL_PERKS[id]?.[look] ?? 'A grander look';
  const total = isPooh ? poohTapMult(level) : buildingMult(level);
  const buy = b ? quote(s, id, 1) : null;
  const managerId = isPooh ? 'pooh' : portraitFor(b!.manager.emoji);

  const upgrade = () => {
    if (!act((g) => upgradeBuilding(g, id))) return;
    buzz(next.newLook ? 'success' : 'light');
    if (next.newLook) play('upgrade');
    else playLevel(level + 1);
    if (next.newLook) say(managerId, 'upgrade');
    if (next.newLook) toast(`🔨 ${name} is now ${lookName(level + 1)}! ${nextPerk}!`);
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <Portrait id={id === 'heffalump' ? 'heffalump' : managerId} size={44} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          <Text style={styles.blurb} numberOfLines={2}>{isPooh ? POOH_HOUSE.blurb : b!.blurb}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>✕</Text></Pressable>
      </View>

      {b && owned === 0 ? (
        <View style={styles.row}>
          <Text style={[styles.info, { flex: 1 }]}>Nobody lives here yet. Unlock it to start making honey here!</Text>
          <Button label="Unlock" sub={fmt(buy!.cost)} disabled={s.honey < buy!.cost} onPress={() => { if (act((g, t) => buyBiz(g, id, 1, t))) { play('unlock'); say(managerId, 'hello'); } }} />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <Text style={styles.lv}>Lv {level}</Text>
            <Text style={styles.info}>{lookName(level)} · ×{fmt(total)} {isPooh ? 'taps' : 'honey'}</Text>
          </View>
          <Text style={styles.info}>
            {isPooh
              ? `👆 Each tap of the pot makes ${fmt(d.tapValue)} honey`
              : `🏠 ${owned} owned · ${s.biz[id].managed ? `${b!.manager.name} makes ${fmt(d.biz[id].perSec)}/s` : `${fmt(d.biz[id].perCycle)} every ${fmtTime(d.biz[id].cycle)} when you tap it`}`}
          </Text>

          <View style={styles.next}>
            <Text style={styles.nextTitle}>
              Next: Lv {level + 1} — {next.newLook ? `${lookName(level + 1)}! ` : ''}×{Number(next.gain.toFixed(2))} {isPooh ? 'taps' : 'honey'}
            </Text>
            <Text style={styles.info}>🎨 {next.newLook ? `Adds: ${nextPerk}` : `${toNextLook} more level${toNextLook === 1 ? '' : 's'} until: ${nextPerk}`}</Text>
            <View style={{ marginVertical: 6 }}><Bar value={(level % LEVEL_STEP) / LEVEL_STEP} color="#C27C0E" height={8} /></View>
            <Button
              label={next.newLook ? '✨ Upgrade' : 'Upgrade'} sub={fmt(next.cost)}
              disabled={!canUpgradeBuilding(s, id)} onPress={upgrade}
            />
          </View>

          <Text style={styles.addonsTitle}>🧰 Add-ons</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {addonList(s, id).map((a) => (
              <View key={a.index} style={[styles.addon, a.owned && styles.addonOwned, !a.unlocked && { opacity: 0.5 }]}>
                <Text style={styles.addonEmoji}>{a.unlocked || a.owned ? a.emoji : '🔒'}</Text>
                <Text style={styles.addonName} numberOfLines={2}>{a.name}</Text>
                <Text style={styles.addonFx}>{addonEffectText(a)}</Text>
                {a.owned ? (
                  <Text style={styles.addonDone}>✓ Owned</Text>
                ) : a.unlocked ? (
                  <Button small label="Buy" sub={fmt(a.cost)} disabled={s.honey < a.cost} onPress={() => { if (act((g) => buyAddon(g, id, a.index))) { buzz('success'); play('addon'); say(managerId, 'upgrade'); toast(`${a.emoji} ${a.name} added to ${name}!`); } }} />
                ) : (
                  <Text style={styles.addonLock}>At Lv {a.level}</Text>
                )}
              </View>
            ))}
          </ScrollView>

          {b && (
            <View style={[styles.row, { marginTop: 8 }]}>
              <Button small outline label="Buy 1 more" sub={fmt(buy!.cost)} disabled={s.honey < buy!.cost} onPress={() => { if (act((g, t) => buyBiz(g, id, 1, t))) play('buy'); }} style={{ flex: 1 }} />
              {!s.biz[id].managed && (
                <Button
                  small outline color={C.blue} label={`Hire ${b.manager.name}`} sub={fmt(managerCost(s, b))}
                  disabled={s.honey < managerCost(s, b)} onPress={() => { if (act((g, t) => hireManager(g, id, t))) { buzz('success'); play('hire'); say(managerId, 'hire'); } }}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function MapScreen() {
  const { s } = useGame();
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const upgradable = new Set(ALL_IDS.filter((id) => homeHasUpgrade(s, id)));
  const mapWidth = width * zoom;

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView contentContainerStyle={{ paddingBottom: selected ? 320 : 16 }}>
          <ScrollView horizontal scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={zoom > 1}>
            <WoodMap view={mapView(s)} width={mapWidth} selected={selected} upgradable={upgradable} onSelect={setSelected} />
          </ScrollView>
        </ScrollView>
      )}
      {!selected && (
        <Pressable style={styles.zoom} onPress={() => setZoom((z) => (z === 1 ? 1.7 : 1))}>
          <Text style={styles.zoomText}>{zoom === 1 ? '🔍 Zoom in' : '🗺️ Whole wood'}</Text>
        </Pressable>
      )}
      {selected && <BuildingSheet id={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  zoom: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(255,250,232,0.95)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: '#D9C48E' },
  zoomText: { fontFamily: HAND, fontSize: 15, color: C.ink },
  sheet: {
    position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: C.card, borderRadius: 22, padding: 14,
    borderWidth: 2, borderColor: '#D9C48E', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 10,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { fontFamily: HAND, fontSize: 24, color: C.ink },
  close: { fontSize: 20, color: C.soft, fontWeight: '900', paddingHorizontal: 4 },
  blurb: { color: C.soft, fontStyle: 'italic', fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lv: { color: 'white', backgroundColor: '#C27C0E', fontWeight: '900', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
  info: { color: C.ink, fontSize: 13, fontWeight: '600', marginTop: 2 },
  next: { marginTop: 10, backgroundColor: '#FFF6DA', borderRadius: 14, padding: 10 },
  nextTitle: { fontWeight: '900', color: C.ink, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addonsTitle: { fontWeight: '900', color: C.ink, fontSize: 14, marginTop: 10, marginBottom: 6 },
  addon: { width: 104, marginRight: 8, padding: 8, borderRadius: 14, backgroundColor: '#FFF6DA', borderWidth: 1.5, borderColor: '#EBD9AE', alignItems: 'center', gap: 3 },
  addonOwned: { backgroundColor: '#E8F4DC', borderColor: C.green },
  addonEmoji: { fontSize: 24 },
  addonName: { fontSize: 12, fontWeight: '800', color: C.ink, textAlign: 'center', minHeight: 30 },
  addonFx: { fontSize: 11, color: C.soft, fontWeight: '700', textAlign: 'center' },
  addonDone: { color: C.green, fontWeight: '900', fontSize: 12, paddingVertical: 6 },
  addonLock: { color: C.soft, fontWeight: '800', fontSize: 12, paddingVertical: 6 },
});
