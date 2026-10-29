import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { addBoost, applyOffline, derive, Derived, GameState, mapView, MapView, migrate, newGame, receiveGift, tick } from '../game/engine';
import { fmt } from '../game/format';
import { applySoundSettings, play, setAppActive } from '../audio/sound';
import { say } from '../audio/voices';
import * as Cloud from '../net/cloud';
import { portraitFor } from '../ui/Portrait';
import { NetStatus, WoodClient } from '../net/WoodClient';

const SAVE_KEY = 'hundred-acre-honey-tycoon/save/v1';

export type Member = {
  id: string; name: string; avatar: string; online: boolean; lastSeen: number;
  stats: { hps?: number; honey?: number; allTime?: number; combs?: number; variety?: number; naps?: number; buildings?: MapView };
};
export type ChatMsg = { id: string; from?: string; name?: string; avatar?: string; text: string; at: number; system?: boolean };
export type ContractDef = { id: string; name: string; emoji: string; minutes: number; goalSeconds: number; minGoal: number; combs: number[] };
export type Contract = {
  id: string; goal: number; progress: number; contributions: Record<string, number>; tiersReached: number;
  status: 'active' | 'complete' | 'expired'; startedAt: number; endsAt: number; startedBy: string;
};
export type Net = {
  status: NetStatus; you: string | null; room: string | null; roster: Member[]; chat: ChatMsg[];
  contract: Contract | null; contracts: ContractDef[]; tiers: number[]; error: string | null;
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

const emptyNet: Net = { status: 'offline', you: null, room: null, roster: [], chat: [], contract: null, contracts: [], tiers: [], error: null };

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
  const netRef = useRef(net);
  netRef.current = net;
  const [cloud, setCloud] = useState<CloudState>({ phase: 'off' });
  const signInCancelled = useRef(false);
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
    const loop = setInterval(() => {
      tick(sRef.current!, Date.now());
      rerender();
    }, 200);
    const autosave = setInterval(save, 5_000);
    const sub = AppState.addEventListener('change', (state) => {
      // No music or sounds while the game is off screen.
      setAppActive(state === 'active');
      if (state !== 'active') return save();
      const off = applyOffline(sRef.current!, Date.now());
      if (off.earned > 0 && off.seconds > 60) setWelcomeBack(off);
    });
    return () => { clearInterval(loop); clearInterval(autosave); sub.remove(); save(); };
  }, [ready, rerender, save]);

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
      stats: { hps: d.hps, honey: s.honey, allTime: s.allTimeEarned, combs: s.combsFromNaps + s.combsBonus, variety: s.variety, naps: s.stats.naps, name: s.profile.name, avatar: s.profile.avatar, buildings: mapView(s) },
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
          setNet((n) => ({ ...n, you: m.you, room: m.room, roster: m.roster, chat: m.chat, contract: m.contract, contracts: m.contracts, tiers: m.tiers, error: null }));
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
          if (m.boost) addBoost(s, 'profit', m.boost.mult, m.boost.secs, m.name, now);
          toast(`🏆 ${m.name}: +${m.combs} Golden Honeycombs${m.boost ? ` and ×${m.boost.mult} honey!` : ''}`);
          save();
          break;
        case 'giftSent': toast('🎁 Gift delivered!'); break;
        case 'hugSent': toast('💕 Hug sent!'); break;
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
    if (sRef.current!.profile.room && sRef.current!.profile.name) client.connect(sRef.current!.profile.server, hello);
    return () => client.close();
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
      if (amount <= 0 || amount > s.honey) return;
      if (client.send({ t: 'gift', to, amount })) {
        s.honey -= amount;
        s.stats.giftsSent++;
        rerender();
      }
    },
    startContract: (id) => { client.send({ t: 'startContract', id }); },
    abandonContract: () => { client.send({ t: 'abandonContract' }); },
    balloon: () => { client.send({ t: 'balloon' }); },
  };

  const startOver = () => {
    const fresh = newGame(Date.now());
    fresh.profile = { ...s.profile };
    fresh.settings = { ...s.settings };
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
      s, d: derive(s, now), now, act, toast, toasts, welcomeBack, dismissWelcome: () => setWelcomeBack(null), hearts, net, wood, cloud: cloudApi, startOver,
    }}>
      {children}
    </GameCtx.Provider>
  );
}
