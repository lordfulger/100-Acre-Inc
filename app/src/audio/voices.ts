// Character voices: your own recordings from assets/voices/ (see the README
// there). Characters without recordings play their own little musical motif.
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { PortraitId } from '../ui/Portrait';
import { playMotif, soundSettings } from './sound';
import { VOICE_FILES } from './voiceFiles';

export type VoiceEvent = 'hire' | 'upgrade' | 'hello' | 'balloon' | 'hug';

export const hasRecordings = () => Object.values(VOICE_FILES).some((f) => f && f.length > 0);

let lastSpoke = 0;
let player: AudioPlayer | null = null;

/** Plays one of this character's recordings, or their musical motif if there are none. */
export function say(who: PortraitId | null, _event: VoiceEvent) {
  const clips = who ? VOICE_FILES[who] : undefined;
  if (!clips?.length || !soundSettings().voices) return playMotif(who);
  if (Date.now() - lastSpoke < 4000) return;
  try {
    player?.remove();
    player = createAudioPlayer(clips[Math.floor(Math.random() * clips.length)]);
    player.volume = 0.8;
    player.play();
    lastSpoke = Date.now();
  } catch {}
}
