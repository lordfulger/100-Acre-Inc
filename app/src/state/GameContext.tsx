import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { addBoost, applyOffline, derive, Derived, GameState, mapView, MapView, migrate, newGame, receiveGift, tick } from '../game/engine';
import { fmt } from '../game/format';
import { checkAlbum } from '../game/album';
import { bumpEvent } from '../game/calendar';
import { checkDecor, checkTrophies, finishGame } from '../game/extras';
import { applySoundSettings, play, setAppActive } from '../audio/sound';
import { say } from '../audio/voices';
import * as Cloud from '../net/cloud';
import { portraitFor } from '../ui/Portrait';
import { NetStatus, WoodClient } from '../net/WoodClient';
import { needsHomeScreen, pushAllowed, pushSupported, registerWorker, subscribe } from '../net/push';

registerWorker();

const SAVE_KEY = 'hundred-acre-honey-tycoon/save/v1';

export type Member = {
  id: string; name: string; avatar: string; online: boolean; lastSeen: number;
  /** Has phone notifications on, so can be reached when not in the wood. */
  notify?: boolean;
  stats: { hps?: number; honey?: number; allTime?: number; combs?: number; variety?: number; naps?: number; cards?: number; trophies?: number; buildings?: MapView };
};
export type ChatMsg = { id: string; from?: string; name?: string; avatar?: string; text: string; at: number; system?: boolean };
export type ContractDef = { id: string; name: string; emoji: string; minutes: number; goalSeconds: number; minGoal: number; combs: number[] };
export type Contract = {
  id: string; goal: number; progress: number; contributions: Record<string, number>; tiersReached: number;
  status: 'active' | 'complete' | 'expired'; startedAt: number; endsAt: number; startedBy: string;
};
export type Project = { id: string; goal: number; progress: number; contributions: Record<string, number> };
export type ProjectDef = { id: string; name: string; emoji: string };
export type Net = {
  status: NetStatus; you: string | null; room: string | null; roster: Member[]; chat: ChatMsg[];
  contract: Contract | null; contracts: ContractDef[]; tiers: number[]; error: string | null;
  project: Project | null; projectDef: ProjectDef | null; built: string[];
  /** The server's key for phone notifications, and whether this player has them on. */
  pushKey: string | null; pushOn: boolean;
};
export type StickPlayer = { pid: string; name: string; avatar: string };
export type StickRace = { sticks: (StickPlayer & { q: number; time: number })[]; winner: string; seed: number };
/** A live Poohsticks game with a friend, from the invite to the finish. */
export type Sticks = {
  id: string; phase: 'invited' | 'waiting' | 'dropping' | 'race'; other: { name: string; avatar: string };
  players?: StickPlayer[]; ms?: number; race?: StickRace;
};
export type Toast = { id: number; text: string };

/** Cloud save status. `conflict` is set when the cloud has further-along progress than this phone. */
export type CloudState = {
  phase: 'off' | 'signing-in' | 'on';
  email?: string;
  lastSaved?: number;
  error?: string;
  conflict?: { data: any; allTime: number; honey: number; savedAt: string };
};

const emptyNet: Net = {
  status: 'offline', you: null, room: null, roster: [], chat: [], contract: null, contracts: [], tiers: [], error: null,
  project: null, projectDef: null, built: [], pushKey: null, pushOn: false,
};

/** The online server baked into app.json (`extra.serverUrl`), if any. */
const configuredServerUrl = () => (Constants.expoConfig?.extra as { serverUrl?: string } | undefined)?.serverUrl || '';

export function defaultServerUrl() {
  const extra = configuredServerUrl();
  if (extra) return extra;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname, host, port } = window.location;
    // In development the page comes from Metro (:8081) and the game server is on :3001;
    // when the game server hosts the web app itself, it's the same address.
    if (port === '8081') return `ws://${hostname}:3001`;
    return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `ws://${host || 'localhost'}:3001`;
}

type Ctx = {
  s: GameState;
  d: Derived;
  now: number;
  act: <T>(fn: (s: GameState, now: number) => T) => T;
  toast: (text: string) => void;
  toasts: Toast[];
  welcomeBack: { seconds: number; earned: number } | null;
  dismissWelcome: () => void;
  hearts: number; // bumps when a hug arrives, for the heart burst animation
  net: Net;
  /** Writes the save to the phone now (it also saves every few seconds). */
  save: () => void;
  /** Wipes all progress but keeps name, character, room, sound settings and Google sign-in. */
  startOver: () => void;
  wood: {
    join: (room: string, server?: string) => void;
    leave: () => void;
    chat: (text: string) => void;
    hug: (to: string) => void;
    gift: (to: string, amount: number) => void;
    startContract: (id: string) => void;
    abandonContract: () => void;
    balloon: () => void;
    donate: (amount: number) => void;
    letter: (to: string, text: string, amount: number) => void;
    /** Asks the phone for permission and turns notifications on. */
    notifications: () => void;
  };
  sticks: Sticks | null;
  stickApi: {
    invite: (to: string) => void;
    answer: (yes: boolean) => void;
    drop: (q: number) => void;
    /** Leave the finished race, recording it (and paying the prize). */
    done: () => void;
  };
  cloud: CloudState & {
    signIn: () => void;
    cancelSignIn: () => void;
    signOut: () => void;
    saveNow: () => void;
    /** Settle a conflict: true = load the cloud save, false = keep this phone's and overwrite the cloud. */
    resolve: (useCloud: boolean) => void;
  };
};

const GameCtx = createContext<Ctx | null>(null);

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const sRef = useRef<GameState | null>(null);
  const [ready, setReady] = useState(false);
  const [, setFrame] = useState(0);
  const [welcomeBack, setWelcomeBack] = useState<Ctx['welcomeBack']>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hearts, setHearts] = useState(0);
  const [net, setNet] = useState<Net>(emptyNet);
  const [sticks, setSticks] = useState<Sticks | null>(null);
  const sticksRef = useRef(sticks);
  sticksRef.current = sticks;
  const netRef = useRef(net);
  netRef.current = net;
  const [cloud, setCloud] = useState<CloudState>({ phase: 'off' });
  const signInCancelled = useRef(false);
  // Honey in gifts sent but not yet confirmed by the server (paid for on confirmation).
  const giftsPending = useRef(0);
  const clientRef = useRef<WoodClient | null>(null);
  if (!clientRef.current) clientRef.current = new WoodClient();
  const client = clientRef.current;

  const rerender = useCallback(() => setFrame((f) => (f + 1) % 1e9), []);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const save = useCallback(() => {
    if (sRef.current) AsyncStorage.setItem(SAVE_KEY, JSON.stringify(sRef.current)).catch(() => {});
  }, []);

  const act = useCallback(<T,>(fn: (s: GameState, now: number) => T): T => {
    const result = fn(sRef.current!, Date.now());
    rerender();
    return result;
  }, [rerender]);

  // ---------- load save + offline earnings ----------
  useEffect(() => {
    (async () => {
      const now = Date.now();
      let raw: unknown = null;
      try {
        const txt = await AsyncStorage.getItem(SAVE_KEY);
        raw = txt ? JSON.parse(txt) : null;
      } catch {}
      const s = migrate(raw, now);
      if (raw) {
        const off = applyOffline(s, now);
        if (off.earned > 0 && off.seconds > 30) setWelcomeBack(off);
      }
      // A built-in online server wins over an old home-network address saved during testing.
      const isLocal = /^wss?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(s.profile.server);
      if (!s.profile.server || (isLocal && configuredServerUrl())) s.profile.server = defaultServerUrl();
      sRef.current = s;
      setReady(true);
    })();
  }, []);

  // ---------- game loop + autosave ----------
  useEffect(() => {
    if (!ready) return;
    // Coming back after a while goes through the offline payout (capped), whether
    // the game loop or the app-switch event notices first. The welcome-back note
    // waits until the game is on screen (browsers still run hidden tabs now and then).
    const away = { seconds: 0, earned: 0 };
    const catchUp = () => {
      const off = applyOffline(sRef.current!, Date.now());
      away.seconds += off.seconds;
      away.earned += off.earned;
    };
    const welcome = () => {
      if (away.earned > 0 && away.seconds > 60) setWelcomeBack({ ...away });
      away.seconds = 0;
      away.earned = 0;
    };
    const eventsSeen = { current: sRef.current!.eventsWon.length };
    const loop = setInterval(() => {
      const s = sRef.current!;
      if (Date.now() - s.lastTick > 5_000) catchUp();
      else tick(s, Date.now());
      if (away.seconds && AppState.currentState === 'active') welcome();
      const found = checkAlbum(s);
      if (found.length) {
        play('unlock');
        toast(found.length === 1 ? `📖 New album card: ${found[0].name}!` : `📖 You found ${found.length} new album cards!`);
      }
      const trophies = checkTrophies(s);
      if (trophies.length) {
        play('fanfare');
        toast(trophies.length === 1 ? `${trophies[0].emoji} Trophy: ${trophies[0].name}!` : `🏅 You earned ${trophies.length} trophies! See them in the Album.`);
      }
      for (const item of checkDecor(s)) toast(`${item.emoji} New decoration: ${item.name}! Put it up inside a home.`);
      if (s.eventsWon.length > eventsSeen.current) {
        eventsSeen.current = s.eventsWon.length;
        play('fanfare');
        toast('🎉 Holiday event complete! A new album card and decoration are yours.');
      }
      rerender();
    }, 200);
    const autosave = setInterval(save, 5_000);
    const sub = AppState.addEventListener('change', (state) => {
      // No music or sounds while the game is off screen.
      setAppActive(state === 'active');
      if (state !== 'active') return save();
      catchUp();
      welcome();
    });
    // Closing or reloading the page doesn't always count as going to the background.
    const onLeave = () => save();
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('pagehide', onLeave);
    return () => {
      clearInterval(loop); clearInterval(autosave); sub.remove(); save();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('pagehide', onLeave);
    };
  }, [ready, rerender, save, toast]);

  // ---------- multiplayer ----------
  const hello = useCallback(() => {
    const p = sRef.current!.profile;
    return { t: 'hello', secret: p.secret, name: p.name || 'Bear', avatar: p.avatar, room: p.room };
  }, []);

  const sendStats = useCallback(() => {
    const s = sRef.current!;
    const d = derive(s, Date.now());
    client.send({
      t: 'stats',
      stats: { hps: d.hps, honey: s.honey, allTime: s.allTimeEarned, combs: s.combsFromNaps + s.combsBonus, variety: s.variety, naps: s.stats.naps, cards: s.album.length, trophies: s.trophies.length, name: s.profile.name, avatar: s.profile.avatar, buildings: mapView(s) },
    });
  }, [client]);

  useEffect(() => {
    if (!ready) return;
    client.onStatus = (status) => setNet((n) => ({ ...n, status }));
    client.onMessage = (m) => {
      const s = sRef.current!;
      const now = Date.now();
      switch (m.t) {
        case 'welcome':
          giftsPending.current = 0;
          setNet((n) => ({
            ...n, you: m.you, room: m.room, roster: m.roster, chat: m.chat, contract: m.contract, contracts: m.contracts, tiers: m.tiers, error: null,
            project: m.project || null, projectDef: m.projectDef || null, built: m.built || [],
            pushKey: m.pushKey || null, pushOn: !!m.pushOn,
          }));
          // Already allowed on this phone: keep the server's copy of the address fresh.
          if (m.pushKey && pushAllowed()) {
            subscribe(m.pushKey, false).then((sub) => { if (sub) client.send({ t: 'push', sub }); }).catch(() => {});
          }
          // Projects built in this wood count for everyone in it, even ones finished before you joined.
          for (const id of m.built || []) if (!s.projects.includes(id)) s.projects.push(id);
          setSticks(null);
          if (m.contract?.status !== 'active') s.pendingContribution = 0;
          sendStats();
          break;
        case 'roster': setNet((n) => ({ ...n, roster: m.roster })); break;
        case 'chat':
          setNet((n) => ({ ...n, chat: [...n.chat.slice(-59), m.msg] }));
          if (m.msg.from !== netRef.current.you) play('pop');
          break;
        case 'contract': setNet((n) => ({ ...n, contract: m.contract })); break;
        case 'gift':
          receiveGift(s, m.amount * derive(s, now).giftMult);
          play('gift');
          toast(`🎁 ${m.avatar} ${m.name} sent you ${fmt(m.amount)} honey!`);
          break;
        case 'hug':
          addBoost(s, 'profit', 2, derive(s, now).hugSecs, `Hug from ${m.name}`, now);
          s.stats.hugsGot++;
          play('hug');
          say(portraitFor(m.avatar), 'hug');
          setHearts((h) => h + 1);
          toast(`💕 ${m.avatar} ${m.name} sent you a big hug! ×2 honey for ${derive(s, now).hugSecs}s`);
          break;
        case 'balloon':
          addBoost(s, 'profit', 2, 20, 'Shared joy', now);
          toast(`🎈 ${m.avatar} ${m.name} caught a balloon — shared joy! ×2 honey for 20s`);
          break;
        case 'reward':
          play('fanfare');
          s.combsBonus += m.combs;
          if (m.boost) { addBoost(s, 'profit', m.boost.mult, m.boost.secs, m.name, now); s.stats.expos++; }
          toast(`🏆 ${m.name}: +${m.combs} Golden Honeycombs${m.boost ? ` and ×${m.boost.mult} honey!` : ''}`);
          save();
          break;
        case 'giftSent':
          // Paid for once the server has it, so a dropped connection can't lose the honey.
          s.honey = Math.max(0, s.honey - (Number(m.amount) || 0));
          giftsPending.current = Math.max(0, giftsPending.current - (Number(m.amount) || 0));
          s.stats.giftsSent++;
          toast('🎁 Gift delivered!');
          break;
        case 'hugSent':
          s.stats.hugsSent++;
          bumpEvent(s, 'hug', now);
          toast('💕 Hug sent!');
          break;
        case 'pushOn': setNet((n) => ({ ...n, pushOn: true })); break;
        case 'project': setNet((n) => ({ ...n, project: m.project, projectDef: m.projectDef, built: m.built })); break;
        case 'projectDone':
          if (!s.projects.includes(m.id)) s.projects.push(m.id);
          play('fanfare');
          toast(`${m.emoji} ${m.name} is built! Your honey is up for good.`);
          save();
          break;
        case 'donated':
          s.honey = Math.max(0, s.honey - (Number(m.amount) || 0));
          giftsPending.current = Math.max(0, giftsPending.current - (Number(m.amount) || 0));
          toast('🔨 Thank you for helping build!');
          break;
        case 'letter': {
          const l = m.letter;
          if (!l || s.letters.some((x) => x.id === l.id)) break;
          s.letters = [{ ...l, read: false }, ...s.letters].slice(0, 30);
          play('pop');
          toast(`✉️ ${l.avatar} ${l.name} left you a letter!`);
          save();
          break;
        }
        case 'letterSent':
          s.honey = Math.max(0, s.honey - (Number(m.amount) || 0));
          giftsPending.current = Math.max(0, giftsPending.current - (Number(m.amount) || 0));
          s.stats.lettersSent++;
          toast('✉️ Letter delivered!');
          break;
        case 'stickInvite':
          if (sticksRef.current) { client.send({ t: 'stickAnswer', id: m.id, yes: false }); break; }
          play('pop');
          setSticks({ id: m.id, phase: 'invited', other: { name: m.name, avatar: m.avatar } });
          break;
        case 'stickWaiting': setSticks({ id: m.id, phase: 'waiting', other: { name: m.name, avatar: m.avatar } }); break;
        case 'stickGo': setSticks((x) => (x && x.id === m.id ? { ...x, phase: 'dropping', players: m.players, ms: m.ms } : x)); break;
        case 'stickRace': setSticks((x) => (x && x.id === m.id ? { ...x, phase: 'race', race: { sticks: m.sticks, winner: m.winner, seed: m.seed } } : x)); break;
        case 'stickOff':
          setSticks((x) => (x && x.id === m.id ? null : x));
          if (m.why) toast(`🥢 ${m.why}`);
          break;
        case 'error':
          if (client.status !== 'online') {
            client.close();
            setNet((n) => ({ ...n, error: m.text }));
          }
          toast(`Oh bother: ${m.text}`);
          break;
      }
      rerender();
    };
    const join = () => {
      const p = sRef.current!.profile;
      if (p.room && p.name) client.connect(p.server, hello);
    };
    join();
    // After the phone sleeps or switches apps the old connection is often silently
    // dead (the game would look online while messages go nowhere), so start a fresh one.
    let hiddenAt = 0;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 10_000) join();
    });
    return () => { sub.remove(); client.close(); };
  }, [ready, client, hello, sendStats, toast, save, rerender]);

  // Share stats and pour honey into the co-op Expotition every few seconds.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const s = sRef.current!;
      const n = netRef.current;
      if (n.status !== 'online') return;
      sendStats();
      if (n.contract?.status === 'active') {
        if (s.pendingContribution > 0 && client.send({ t: 'contribute', amount: s.pendingContribution * derive(s, Date.now()).expoMult })) s.pendingContribution = 0;
      } else {
        s.pendingContribution = 0;
      }
    }, 3_000);
    return () => clearInterval(id);
  }, [ready, client, sendStats]);

  // ---------- cloud save (Google) ----------

  /** The save as uploaded: everything except this phone's sign-in. */
  const snapshot = useCallback(() => {
    const { cloud: _signIn, ...profile } = sRef.current!.profile;
    return { ...sRef.current!, profile };
  }, []);

  const signedOut = useCallback(() => {
    delete sRef.current!.profile.cloud;
    save();
    setCloud({ phase: 'off', error: 'Signed out. Please sign in again.' });
  }, [save]);

  const uploadNow = useCallback(async (force = false) => {
    const s = sRef.current!;
    if (!s.profile.cloud) return;
    try {
      const r = await Cloud.uploadCloud(s.profile.server, s.profile.cloud.token, snapshot(), force);
      const c = r.conflict;
      if (c) {
        setCloud((x) => ({ ...x, conflict: { data: c.data, allTime: c.allTime, honey: c.data?.honey ?? 0, savedAt: c.updatedAt } }));
      } else {
        setCloud((x) => ({ ...x, lastSaved: Date.now(), error: undefined }));
      }
    } catch (e: any) {
      if (e.message === 'signed-out') signedOut();
      else setCloud((x) => ({ ...x, error: e.message }));
    }
  }, [snapshot, signedOut]);

  /** Swap in a different save (the cloud copy) without losing this phone's sign-in or server address. */
  const replaceState = useCallback((data: any) => {
    const cur = sRef.current!;
    const next = migrate(data, Date.now());
    next.profile.cloud = cur.profile.cloud;
    next.profile.server = cur.profile.server;
    // Album cards are kept forever, so ones found on this phone stay.
    next.album = [...new Set([...next.album, ...cur.album])];
    const off = applyOffline(next, Date.now());
    if (off.earned > 0 && off.seconds > 60) setWelcomeBack(off);
    sRef.current = next;
    save();
    client.close();
    setNet(emptyNet);
    if (next.profile.room && next.profile.name) { setNet({ ...emptyNet, status: 'connecting' }); client.connect(next.profile.server, hello); }
    rerender();
  }, [client, hello, save, rerender]);

  useEffect(() => {
    if (!ready) return;
    const c = sRef.current!.profile.cloud;
    if (c) setCloud({ phase: 'on', email: c.email });
    // Back up a minute after changes, and whenever the app goes to the background.
    const id = setInterval(() => uploadNow(), 60_000);
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') uploadNow(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [ready, uploadNow]);

  if (!ready || !sRef.current) return null;
  const s = sRef.current;
  applySoundSettings(s.settings);
  const now = Date.now();

  const wood: Ctx['wood'] = {
    join: (room, server) => {
      s.profile.room = room.trim().toUpperCase();
      if (server) s.profile.server = server.trim();
      setNet({ ...emptyNet, status: 'connecting' });
      client.connect(s.profile.server, hello);
      save();
    },
    leave: () => {
      client.close();
      s.profile.room = '';
      setNet(emptyNet);
      save();
    },
    chat: (text) => { if (text.trim()) client.send({ t: 'chat', text: text.trim() }); },
    hug: (to) => { client.send({ t: 'hug', to }); },
    gift: (to, amount) => {
      if (amount <= 0 || amount > s.honey - giftsPending.current) return;
      if (client.send({ t: 'gift', to, amount })) giftsPending.current += amount;
      else toast('Oh bother: not connected to the wood right now.');
    },
    startContract: (id) => { client.send({ t: 'startContract', id }); },
    abandonContract: () => { client.send({ t: 'abandonContract' }); },
    balloon: () => { client.send({ t: 'balloon' }); },
    donate: (amount) => {
      if (!(amount > 0) || amount > s.honey - giftsPending.current) return;
      if (client.send({ t: 'donate', amount })) giftsPending.current += amount;
      else toast('Oh bother: not connected to the wood right now.');
    },
    notifications: async () => {
      if (needsHomeScreen()) { toast('📱 On iPhone, first add the game to your Home Screen (Share → Add to Home Screen), then open it from there.'); return; }
      if (!pushSupported()) { toast("Oh bother: this browser can't show notifications."); return; }
      if (!net.pushKey) { toast('Oh bother: not connected to the wood right now.'); return; }
      try {
        const sub = await subscribe(net.pushKey, true);
        if (!sub) { toast('🔕 Notifications are blocked. You can allow them in your browser settings.'); return; }
        if (client.send({ t: 'push', sub })) toast("🔔 Notifications on! You'll hear about hugs, letters and Poohsticks.");
      } catch {
        toast('Oh bother: notifications could not be turned on.');
      }
    },
    letter: (to, text, amount) => {
      if (!text.trim() || amount < 0 || amount > s.honey - giftsPending.current) return;
      if (client.send({ t: 'letter', to, text: text.trim(), amount })) giftsPending.current += amount;
      else toast('Oh bother: not connected to the wood right now.');
    },
  };

  const stickApi: Ctx['stickApi'] = {
    invite: (to) => { if (!client.send({ t: 'stickInvite', to })) toast('Oh bother: not connected to the wood right now.'); },
    answer: (yes) => { if (sticks) client.send({ t: 'stickAnswer', id: sticks.id, yes }); if (!yes) setSticks(null); },
    drop: (q) => { if (sticks) client.send({ t: 'stickDrop', id: sticks.id, q }); },
    done: () => {
      const race = sticks?.race;
      setSticks(null);
      if (!race) return;
      const won = race.winner === net.you;
      const r = act((g, t) => finishGame(g, 'sticks', won ? 1 : 0, t, won));
      if (r.honey > 0) toast(`🥢 ${won ? 'You won' : 'Good race'}! +${fmt(r.honey)} honey`);
    },
  };

  const startOver = () => {
    const fresh = newGame(Date.now());
    fresh.profile = { ...s.profile };
    fresh.settings = { ...s.settings };
    fresh.album = [...s.album];
    fresh.albumNew = [...s.albumNew];
    fresh.chatSeen = s.chatSeen;
    fresh.trophies = [...s.trophies];
    fresh.newsSeen = s.newsSeen;
    sRef.current = fresh;
    save();
    setWelcomeBack(null);
    rerender();
    // Replace the cloud copy too, or the game would offer to bring the old progress back.
    if (fresh.profile.cloud) uploadNow(true);
    toast('🌱 A fresh start in the Hundred Acre Wood!');
  };

  const cloudApi: Ctx['cloud'] = {
    ...cloud,
    signIn: async () => {
      signInCancelled.current = false;
      setCloud({ phase: 'signing-in' });
      try {
        const session = await Cloud.signIn(s.profile.server, () => signInCancelled.current);
        sRef.current!.profile.cloud = session;
        save();
        setCloud({ phase: 'on', email: session.email });
        toast(`☁️ Signed in as ${session.email}`);
        // A save already in the cloud that's further along? Ask which to keep.
        const existing = await Cloud.loadCloud(s.profile.server, session.token);
        if (existing && existing.allTime > sRef.current!.allTimeEarned) {
          setCloud((x) => ({ ...x, conflict: { data: existing.data, allTime: existing.allTime, honey: existing.data?.honey ?? 0, savedAt: existing.updatedAt } }));
        } else {
          await uploadNow(true);
        }
      } catch (e: any) {
        setCloud({ phase: 'off', error: signInCancelled.current ? undefined : e.message });
      }
    },
    cancelSignIn: () => { signInCancelled.current = true; setCloud({ phase: 'off' }); },
    signOut: () => { delete s.profile.cloud; save(); setCloud({ phase: 'off' }); },
    saveNow: () => { uploadNow(); },
    resolve: (useCloud) => {
      const c = cloud.conflict;
      setCloud((x) => ({ ...x, conflict: undefined }));
      if (!c) return;
      if (useCloud) { replaceState(c.data); toast('☁️ Loaded your cloud save'); }
      else uploadNow(true);
    },
  };

  return (
    <GameCtx.Provider value={{
      s, d: derive(s, now), now, act, toast, toasts, welcomeBack, dismissWelcome: () => setWelcomeBack(null), hearts, net, wood, cloud: cloudApi, startOver, save,
      sticks, stickApi,
    }}>
      {children}
    </GameCtx.Provider>
  );
}
