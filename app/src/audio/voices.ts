// Character voices. Uses your own recordings from assets/voices/ when there are
// any (see assets/voices/README.md); otherwise the phone's built-in speech,
// pitched and paced for each character. All lines are original.
import * as Speech from 'expo-speech';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { PortraitId } from '../ui/Portrait';
import { soundSettings } from './sound';
import { VOICE_FILES } from './voiceFiles';

export type VoiceEvent = 'hire' | 'upgrade' | 'hello' | 'balloon' | 'hug';

const STYLE: Record<PortraitId, { pitch: number; rate: number }> = {
  pooh: { pitch: 0.8, rate: 0.85 },
  piglet: { pitch: 1.7, rate: 1.1 },
  tigger: { pitch: 1.2, rate: 1.25 },
  rabbit: { pitch: 1.15, rate: 1.15 },
  owl: { pitch: 0.9, rate: 0.85 },
  eeyore: { pitch: 0.55, rate: 0.7 },
  kanga: { pitch: 1.25, rate: 0.95 },
  robin: { pitch: 1.4, rate: 1.0 },
  small: { pitch: 1.9, rate: 1.25 },
  bee: { pitch: 1.8, rate: 1.3 },
  woozle: { pitch: 0.7, rate: 0.85 },
};

const LINES: Partial<Record<PortraitId, Partial<Record<VoiceEvent, string[]>>>> = {
  pooh: {
    hire: ['Oh, this is a very good job. Mostly because of the honey.'],
    upgrade: ['Look at that. Even nicer than before.', 'I think this calls for a little something.'],
    hello: ['Hello! I was just thinking about honey.', 'Oh, there you are. I saved you some honey. Most of it.'],
    balloon: ['A balloon! Just the thing for reaching high-up honey.', 'Up, up, and towards the bees!'],
    hug: ['A hug! That is almost as good as honey.', 'That was a very warm hug. Thank you.'],
  },
  piglet: {
    hire: ['Oh! M-me? I will try my very best.'],
    upgrade: ['It is ever so much bigger now!', 'Oh my. It looks quite grand.'],
    hug: ['Oh! A hug. That makes me feel very brave.'],
  },
  tigger: {
    hire: ['Running a bee ranch? That is exactly what I am best at!'],
    upgrade: ['Bigger and bouncier! Wheee!', 'Now that is a bounce-worthy upgrade!'],
    hug: ['Hugs are my second favourite thing. After bouncing.'],
  },
  rabbit: {
    hire: ['Right. A plan. Everyone in their places.'],
    upgrade: ['Neat rows. Proper labels. Excellent.', 'Organised, as it should be.'],
  },
  owl: {
    hire: ['Ahem. You have come to exactly the right bird.'],
    upgrade: ['A most impressive improvement, if I may say so.', 'Remarkable. Quite remarkable.'],
  },
  eeyore: {
    hire: ['Me? Well. I suppose somebody has to.'],
    upgrade: ['Nicer. Not that anyone asked me.', 'Oh. A new thing. How unexpected.'],
    hug: ['A hug. For me. Well. Thank you.'],
  },
  kanga: {
    hire: ['Of course, dear. Roo, come and help.'],
    upgrade: ['Lovely. Now, who would like a honey bun?'],
  },
  robin: {
    hire: ['Leave it to me. I have got a plan.'],
    upgrade: ['That is brilliant. Wait till everyone sees!'],
  },
  small: {
    hire: ['I am small, but I am very busy!'],
    upgrade: ['Even small things get bigger!'],
  },
  woozle: {
    hire: ['Did you hear something? It might have been a Woozle.'],
    upgrade: ['Footprints everywhere. The Woozles approve.'],
  },
};

let lastSpoke = 0;
let recordingPlayer: AudioPlayer | null = null;
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Has this character say something fitting. Quietly does nothing if voices are off or it spoke a moment ago. */
export function say(who: PortraitId | null, event: VoiceEvent) {
  if (!who || !soundSettings().voices || Date.now() - lastSpoke < 4000) return;
  const recordings = VOICE_FILES[who];
  try {
    if (recordings?.length) {
      recordingPlayer?.remove();
      recordingPlayer = createAudioPlayer(pick(recordings));
      recordingPlayer.play();
    } else {
      const lines = LINES[who]?.[event];
      if (!lines) return;
      Speech.stop();
      Speech.speak(pick(lines), STYLE[who]);
    }
    lastSpoke = Date.now();
  } catch {}
}
