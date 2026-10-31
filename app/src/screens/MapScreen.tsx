import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BIZ_BY_ID, buildingMult, BUSINESSES, LEVEL_STEP, lookName, lookOf, perkFor, POOH_HOUSE, poohTapMult } from '../game/catalog';
import { addonEffectText } from '../game/catalog';
import { addonList, buildingNext, buyAddon, buyBiz, BuyMode, hireManager, homeHasUpgrade, levelQuote, managerCost, mapView, quote, totalCombs, upgradeBuildingBy } from '../game/engine';
import { fmt, fmtTime } from '../game/format';
import { useGame } from '../state/GameContext';
import { Bar, Button, buzz, C, nativeDriver } from '../ui/kit';
import { Portrait, portraitFor } from '../ui/Portrait';
import { HAND, HomeCloseUp, WoodMap } from '../ui/WoodMap';
import { play, playLevel } from '../audio/sound';
import { varietyAt } from '../game/catalog';
import { activeEvent, eventProgress, seasonAt, SEASONS, WEATHER_NAMES, weatherAt } from '../game/calendar';
import { findThing, gameForHome, GameId, GAMES, gameReady, gameWait, doorCost, homeOpen, openDoor, thankVisitor, visitorToday } from '../game/extras';
import { GameRunner } from './GamesScreen';
import { MapLife, wanderers, Weather } from '../ui/MapLife';
import { skyAt } from '../ui/MapAlive';
import { lightEffects } from '../ui/effects';
import { HomeInside } from './HomeInside';
import { say } from '../audio/voices';

const ALL_IDS = [POOH_HOUSE.id, ...BUSINESSES.map((b) => b.id)];

/** The home up close, big enough to see every detail. */
function CloseUp({ id, look, addons }: { id: string; look: number; addons: string[] }) {
  const { width } = useWindowDimensions();
  const size = Math.min(280, Math.min(width, 520) - 70);
  // A little pop when the home gets a new look.
  const pop = useRef(new Animated.Value(1)).current;
  const shown = useRef(look);
  useEffect(() => {
    if (look === shown.current) return;
    shown.current = look;
    pop.setValue(1.18);
    Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: nativeDriver }).start();
  }, [look, pop]);
  return (
    <View style={styles.closeUps}>
      <Animated.View style={[styles.closeUp, { transform: [{ scale: pop }] }]}>
        <HomeCloseUp id={id} look={look} addons={addons} size={size} />
      </Animated.View>
    </View>
  );
}

/** The season, the weather, any holiday event, and today's visitor, along the top of the map. */
function TopBar() {
  const { s, act, toast, now, save } = useGame();
  const [open, setOpen] = useState(false);
  const season = SEASONS[seasonAt(now)];
  const event = activeEvent(now);
  const v = visitorToday(s, now);
  const thank = () => {
    const honey = act((g, t) => thankVisitor(g, t)); save(); // straight away, so closing the app can't undo it and pay out again
    if (!honey) return;
    buzz('success');
    play('fanfare');
    say(v.def.who, 'hire');
    toast(`💛 ${v.def.name} says thank you! +${fmt(honey)} honey`);
    setOpen(false);
  };
  return (
    <View style={styles.top} pointerEvents="box-none">
      <View style={styles.chips}>
        <Pressable style={styles.chip} onPress={() => toast(`${season.emoji} ${season.name}: ${season.bonus}`)}>
          <Text style={styles.chipText}>{season.emoji} {WEATHER_NAMES[weatherAt(now)]}</Text>
        </Pressable>
        {event && (
          <Pressable style={styles.chip} onPress={() => toast(`${event.emoji} ${event.name}: ${event.task.toLowerCase()} for a special album card and decoration.`)}>
            <Text style={styles.chipText}>
              {event.emoji} {s.eventsWon.includes(event.id) ? 'Done! ✓' : `${eventProgress(s, event, now)}/${event.goal}`}
            </Text>
          </Pressable>
        )}
        {!v.done && (
          <Pressable style={[styles.chip, v.ready && styles.chipReady]} onPress={() => setOpen((o) => !o)}>
            <Text style={styles.chipText}>🚪 {v.ready ? `${v.def.name} is waiting!` : 'A visitor'}</Text>
          </Pressable>
        )}
      </View>
      {open && !v.done && (
        <View style={styles.visitor}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Portrait id={v.def.who} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.visitorName}>{v.def.name} knocks at the door</Text>
              <Text style={styles.visitorLine}>“{v.def.line}”</Text>
            </View>
          </View>
          <Text style={styles.info}>
            {v.def.kind === 'find'
              ? v.ready ? `✓ You found ${v.def.thing}!` : `🔍 Tap the homes on the map to look for ${v.def.thing}.`
              : `Progress: ${v.progress}/${v.def.target}`}
          </Text>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Button small label={v.ready ? '💛 Hand it over' : 'On it!'} disabled={false} onPress={() => (v.ready ? thank() : setOpen(false))} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </View>
  );
}

const LEVEL_MODES: BuyMode[] = [1, 10, 100, 'max'];

function BuildingSheet({ id, onClose, onEnter, onPlay, mode, setMode }: { id: string; onClose: () => void; onEnter: () => void; onPlay: (g: GameId) => void; mode: BuyMode; setMode: (m: BuyMode) => void }) {
  const { s, d, act, toast, now, save } = useGame();
  const isPooh = id === POOH_HOUSE.id;
  const b = isPooh ? null : BIZ_BY_ID[id];
  const name = isPooh ? POOH_HOUSE.name : b!.name;
  const level = s.levels[id] || 0;
  const next = buildingNext(s, id);
  const owned = b ? s.biz[id].owned : 0;
  const look = lookOf(level);
  const toNextLook = LEVEL_STEP - (level % LEVEL_STEP);
  const nextPerk = perkFor(id, look);
  const total = isPooh ? poohTapMult(level) : buildingMult(level);
  const buy = b ? quote(s, id, 1) : null;
  const managerId = isPooh ? 'pooh' : portraitFor(b!.manager.emoji);
  // Upgrading several levels at once, like buying hives.
  const lq = levelQuote(s, id, mode);
  const to = level + lq.n;
  const lookUp = lookOf(to) > look;
  const multAt = (l: number) => (isPooh ? poohTapMult(l) : buildingMult(l));
  const canUpgrade = next.ready && s.honey >= lq.cost;

  const upgrade = () => {
    const r = act((g) => upgradeBuildingBy(g, id, mode));
    if (!r) return;
    const newLook = lookOf(r.to) > lookOf(r.from);
    buzz(newLook ? 'success' : 'light');
    if (newLook) play('upgrade');
    else playLevel(r.to);
    if (newLook) say(managerId, 'upgrade');
    // The newest thing the home gained: the perk of the last look it reached.
    const perk = perkFor(id, lookOf(r.to) - 1);
    if (newLook) toast(`🔨 ${name} is now ${lookName(r.to)}!${perk ? ` ${perk}!` : ''}`);
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

      <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
      <CloseUp id={id} look={b && owned === 0 ? 0 : look} addons={s.addons} />
      <Finder id={id} />
      {(() => {
        const game = gameForHome(id);
        if (!game || (b && owned === 0)) return null;
        return (
          <Button
            label={`${GAMES[game].emoji} Play ${GAMES[game].name}`} sub={gameReady(s, game, now) ? '🍯 Ready to play' : `💤 Resting · ready in ${gameWait(s, game, now)}m`}
            disabled={!gameReady(s, game, now)} color={C.blue} onPress={() => onPlay(game)} style={{ marginBottom: 6 }}
          />
        );
      })()}
      {/* An opened door stays open for good, through naps, even before the home is bought back. */}
      {(homeOpen(s, id) || !b || owned > 0) && (
        homeOpen(s, id)
          ? <Button label={`🚪 Go inside${s.rooms[id]?.length ? ` (${s.rooms[id].length} 🛋️)` : ''}`} color={C.pink} onPress={() => { play('pop'); onEnter(); }} style={{ marginBottom: 6 }} />
          : (
            <Button
              label={`🔑 Open the door · ${fmt(doorCost(id))} ✨`} sub="Combs, once: it stays open through every nap"
              color={C.pink} outline disabled={totalCombs(s) < doorCost(id)}
              onPress={() => { if (act((g) => openDoor(g, id))) { buzz('success'); play('unlock'); save(); toast('🚪 The door is open for good. Come in!'); } }}
              style={{ marginBottom: 6 }}
            />
          )
      )}
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
            <View style={styles.modes}>
              {LEVEL_MODES.map((m) => (
                <Pressable key={String(m)} onPress={() => setMode(m)} style={[styles.mode, mode === m && { backgroundColor: varietyAt(s.variety).deep }]}>
                  <Text style={[styles.modeText, mode === m && { color: 'white' }]}>{m === 'max' ? 'Max' : `×${m}`}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.nextTitle}>
              {lq.n === 1 ? 'Next' : `+${lq.n} levels`}: Lv {to} — {lookUp ? `${lookName(to)}! ` : ''}×{Number((multAt(to) / multAt(level)).toFixed(2))} {isPooh ? 'taps' : 'honey'}
            </Text>
            <Text style={styles.info}>
              🎨 {!nextPerk ? 'As grand as a home can look!' : next.newLook ? `Adds: ${nextPerk}` : `${toNextLook} more level${toNextLook === 1 ? '' : 's'} until: ${nextPerk}`}
            </Text>
            <View style={{ marginVertical: 6 }}><Bar value={(level % LEVEL_STEP) / LEVEL_STEP} color="#C27C0E" height={8} /></View>
            <Button
              label={`${lookUp ? '✨ ' : ''}Upgrade${lq.n > 1 ? ` ×${lq.n}` : ''}`} sub={fmt(lq.cost)}
              disabled={!canUpgrade} onPress={upgrade}
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
      </ScrollView>
    </View>
  );
}

/** When today's visitor lost something here: the button to pick it up. */
function Finder({ id }: { id: string }) {
  const { s, act, toast, now } = useGame();
  const v = visitorToday(s, now);
  if (v.def.kind !== 'find' || v.place !== id || v.ready || v.done) return null;
  return (
    <Button
      label={`🔍 Something's here… it's ${v.def.thing}!`} color={C.blue}
      onPress={() => { if (act((g) => findThing(g, id))) { buzz('success'); play('unlock'); toast(`🔍 Found ${v.def.thing}! Take it back to ${v.def.name} (top of the map).`); } }}
      style={{ marginBottom: 6 }}
    />
  );
}

export function MapScreen() {
  const { s, now, act, toast } = useGame();
  const [inside, setInside] = useState<string | null>(null);
  // How many levels the Upgrade button buys (kept while you go from home to home).
  const [mode, setMode] = useState<BuyMode>(1);
  const [game, setGame] = useState<GameId | null>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const tapHome = useCallback((id: string) => setSelected(id), []);
  const upgradable = new Set(ALL_IDS.filter((id) => homeHasUpgrade(s, id)));
  const away = new Set(wanderers(s).map((w) => w.home));
  const mapWidth = width * zoom;
  const [height, setHeight] = useState(0);
  const across = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const down = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const at = useRef({ x: 0, y: 0 });

  // Zooming keeps the same spot of the wood in the middle of the screen.
  const toggleZoom = () => {
    const next = zoom === 1 ? 1.7 : 1;
    const ratio = next / zoom;
    const x = Math.max(0, (at.current.x + width / 2) * ratio - width / 2);
    const y = Math.max(0, (at.current.y + height / 2) * ratio - height / 2);
    setZoom(next);
    // After the map has been drawn at its new size.
    setTimeout(() => {
      across.current?.scrollTo({ x: next === 1 ? 0 : x, animated: false });
      down.current?.scrollTo({ y, animated: false });
    }, 0);
  };

  return (
    <View style={{ flex: 1 }} onLayout={(e) => { setWidth(e.nativeEvent.layout.width); setHeight(e.nativeEvent.layout.height); }}>
      {width > 0 && (
        <ScrollView
          ref={down} contentContainerStyle={{ paddingBottom: selected ? 520 : 16 }}
          scrollEventThrottle={32} onScroll={(e) => { at.current.y = e.nativeEvent.contentOffset.y; }}
        >
          <ScrollView
            ref={across} horizontal scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={zoom > 1}
            scrollEventThrottle={32} onScroll={(e) => { at.current.x = e.nativeEvent.contentOffset.x; }}
          >
            <View>
              <WoodMap view={mapView(s)} width={mapWidth} selected={selected} upgradable={upgradable} onSelect={tapHome} away={away} tints={[SEASONS[seasonAt(now)].tint, skyAt(now).tint]} />
              <MapLife s={s} width={mapWidth} now={now} />
            </View>
          </ScrollView>
        </ScrollView>
      )}
      {!selected && (
        <>
          <Pressable style={styles.zoom} onPress={toggleZoom}>
            <Text style={styles.zoomText}>{zoom === 1 ? '🔍 Zoom in' : '🗺️ Whole wood'}</Text>
          </Pressable>
        </>
      )}
      {!lightEffects(s.settings.effects) && <Weather now={now} />}
      {!selected && <TopBar />}
      {selected && <BuildingSheet id={selected} onClose={() => setSelected(null)} onEnter={() => setInside(selected)} onPlay={setGame} mode={mode} setMode={setMode} />}
      {inside && <HomeInside id={inside} onClose={() => setInside(null)} />}
      {game && <GameRunner id={game} onClose={() => setGame(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 8, left: 8, right: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: 'rgba(255,250,232,0.95)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderColor: '#D9C48E' },
  chipReady: { borderColor: C.green, backgroundColor: 'rgba(236,248,224,0.97)' },
  chipText: { fontFamily: HAND, fontSize: 15, color: C.ink },
  visitor: { marginTop: 8, backgroundColor: C.card, borderRadius: 18, padding: 12, borderWidth: 2, borderColor: '#D9C48E', maxWidth: 520 },
  visitorName: { fontFamily: HAND, fontSize: 19, color: C.ink },
  visitorLine: { color: C.ink, fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  locked: { color: C.soft, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  modes: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  mode: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: '#F1E5C8' },
  modeText: { fontWeight: '900', color: C.ink },
  zoom: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(255,250,232,0.95)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: '#D9C48E' },
  zoomText: { fontFamily: HAND, fontSize: 15, color: C.ink },
  sheet: {
    position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: C.card, borderRadius: 22, padding: 14,
    maxHeight: '82%', borderWidth: 2, borderColor: '#D9C48E', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 10,
  },
  closeUps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 },
  closeUp: { backgroundColor: '#EEF4D8', borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: '#D9E3B8' },
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
