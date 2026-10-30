// Builds every sound in the game from scratch (no samples, no recordings):
// an original music-box waltz for the background, plus soft sound effects.
// Run: node scripts/make-sounds.js   → writes assets/sounds/*.wav
//
// Everything goes through a gentle low-pass filter and is mastered quietly:
// the aim is wooden marimba / kalimba / soft-pop sounds, never beeps.
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

/** Writes a mono 16-bit WAV, scaled so its loudest moment hits `peak` (0..1). */
function writeWav(name, samples, peak = 0.35) {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  const gain = max > 0 ? peak / max : 1;
  // Short fades at both ends so nothing clicks.
  const fade = Math.floor(0.004 * RATE);
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => {
    const edge = Math.min(1, i / fade, (samples.length - 1 - i) / fade);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain * edge)) * 32767), 44 + i * 2);
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.wav`), buf);
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)}s  ${(buf.length / 1024).toFixed(0)} KB`);
}

const silence = (secs) => new Float32Array(Math.ceil(secs * RATE));

/** Softens the top end (one-pole low-pass, run twice for a gentler slope). */
function lowpass(x, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  const out = Float32Array.from(x);
  for (let pass = 0; pass < 2; pass++) {
    let y = 0;
    for (let i = 0; i < out.length; i++) { y += a * (out[i] - y); out[i] = y; }
  }
  return out;
}

/** A little room: two quiet feedback echoes. */
function room(x, amount = 1) {
  const out = Float32Array.from(x);
  for (const [delay, fb] of [[0.089, 0.18 * amount], [0.137, 0.14 * amount]]) {
    const d = Math.floor(delay * RATE);
    for (let i = d; i < out.length; i++) out[i] += out[i - d] * fb;
  }
  return out;
}

// ---------- instruments ----------

/** Wooden marimba: round fundamental, a quick "knock" overtone that dies almost at once. */
function marimba(out, start, midi, amp, decay = 7) {
  const f = midiHz(midi);
  const n = Math.floor(Math.min(1.5, 6 / decay) * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const w = 2 * Math.PI * f * t;
    const body = Math.sin(w) * Math.exp(-t * decay);
    const knock = 0.25 * Math.sin(4 * w) * Math.exp(-t * decay * 6);
    out[i0 + i] += amp * Math.min(1, t / 0.002) * (body + knock);
  }
}

/** Kalimba / soft music box: sweet and ringing, with only a whisper of shimmer. */
function kalimba(out, start, midi, amp, decay = 3.2, len = 2) {
  const f = midiHz(midi);
  const n = Math.floor(len * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const w = 2 * Math.PI * f * t;
    const env = Math.min(1, t / 0.003) * Math.exp(-t * decay);
    out[i0 + i] += amp * env * (Math.sin(w) + 0.08 * Math.sin(2 * w) * Math.exp(-t * 4) + 0.03 * Math.sin(5.4 * w) * Math.exp(-t * 20));
  }
}

/** Warm, round tone for bass and pads. */
function warm(out, start, midi, len, amp, attack = 0.03, release = 0.4) {
  const f = midiHz(midi);
  const n = Math.floor((len + release) * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / attack) * (t > len ? Math.exp(-((t - len) / release) * 3) : 1);
    out[i0 + i] += amp * env * Math.sin(2 * Math.PI * f * t);
  }
}

/** A water-drop "bloop": a quick upward pitch glide. */
function drop(out, start, f0, f1, len, amp) {
  let phase = 0;
  const n = Math.floor(len * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const k = t / len;
    phase += (2 * Math.PI * (f0 * (f1 / f0) ** Math.min(1, k * 2.5))) / RATE;
    out[i0 + i] += amp * Math.sin(phase) * Math.min(1, t / 0.002) * Math.exp(-t * 5 / len);
  }
}

/** Soft breathy noise burst (for pops), already muffled. */
function puff(out, start, len, amp, seed = 1) {
  let x = seed;
  const n = Math.floor(len * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[i0 + i] += amp * ((x / 0x7fffffff) * 2 - 1) * Math.exp((-i / RATE) * 45);
  }
}

// ---------- music: "Honey on the Hill", an original waltz (3/4, G major) ----------

const G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, Fs5 = 78, G5 = 79, A5 = 81;
const CHORDS = {
  G: [43, [55, 59, 62]], C: [48, [55, 60, 64]], D: [50, [54, 57, 62]], Em: [40, [55, 59, 64]],
  Am: [45, [57, 60, 64]], Bm: [47, [54, 59, 62]],
};
// Each bar: [chord, melody as [note, beats]...]
const BARS = [
  // A
  ['G', [[B4, 1], [D5, 1], [G5, 1]]], ['C', [[E5, 2], [C5, 1]]], ['D', [[D5, 1], [A4, 1], [Fs5, 1]]], ['G', [[G5, 3]]],
  ['Em', [[E5, 1], [G5, 1], [B4, 1]]], ['C', [[C5, 1.5], [E5, 0.5], [G5, 1]]], ['D', [[Fs5, 1], [E5, 1], [D5, 1]]], ['D', [[A4, 3]]],
  ['G', [[B4, 1], [C5, 1], [D5, 1]]], ['C', [[E5, 1], [G5, 1], [E5, 1]]], ['Am', [[C5, 1], [E5, 1], [A4, 1]]], ['D', [[D5, 2], [Fs5, 1]]],
  ['G', [[G5, 1], [D5, 1], [B4, 1]]], ['C', [[C5, 1], [E5, 1], [G5, 1]]], ['D', [[Fs5, 1.5], [E5, 0.5], [D5, 1]]], ['G', [[G4, 3]]],
  // B
  ['Em', [[G5, 1], [Fs5, 1], [E5, 1]]], ['C', [[E5, 2], [G5, 1]]], ['G', [[D5, 1], [B4, 1], [D5, 1]]], ['D', [[A4, 3]]],
  ['Em', [[B4, 1], [E5, 1], [G5, 1]]], ['C', [[G5, 1.5], [E5, 0.5], [C5, 1]]], ['D', [[D5, 1], [Fs5, 1], [A5, 1]]], ['D', [[Fs5, 3]]],
  ['C', [[E5, 1], [G5, 1], [C5, 1]]], ['D', [[Fs5, 1], [D5, 1], [A4, 1]]], ['Bm', [[B4, 1], [D5, 1], [Fs5, 1]]], ['Em', [[E5, 3]]],
  ['C', [[G5, 1], [E5, 1], [C5, 1]]], ['D', [[D5, 1], [Fs5, 1], [A5, 1]]], ['G', [[G5, 1.5], [B4, 0.5], [D5, 1]]], ['G', [[G4, 3]]],
];

function music() {
  const beat = 60 / 88;
  const bar = beat * 3;
  const length = BARS.length * bar;
  const out = silence(length + 3);
  BARS.forEach(([chord, melody], b) => {
    const t0 = b * bar;
    const [root, notes] = CHORDS[chord];
    warm(out, t0, root, beat * 1.4, 0.16, 0.03, 0.5); // bass on beat one
    for (const n of notes) {
      marimba(out, t0 + beat, n - 12 + 12, 0.035, 9); // soft "oom-pah-pah" chords
      marimba(out, t0 + beat * 2, n - 12 + 12, 0.03, 9);
      warm(out, t0, n, bar * 0.95, 0.018, 0.4, 0.6); // a faint pad underneath
    }
    let t = t0;
    for (const [note, beats] of melody) { kalimba(out, t, note, 0.22, 2.4, beats * beat + 1.2); t += beats * beat; }
  });
  // Seamless loop: fold the ringing tail back onto the start.
  const loop = Math.floor(length * RATE);
  const wet = room(lowpass(out, 3200), 1.2);
  const res = wet.slice(0, loop);
  for (let i = loop; i < wet.length; i++) res[i - loop] += wet[i];
  return res;
}

// ---------- sound effects ----------

const finish = (o, cutoff = 3500, reverb = 0.8) => room(lowpass(o, cutoff), reverb);

/** A soft rising/falling breath of air (balloon drifting in). */
function swell(out, start, len, amp, seed = 3) {
  let x = seed;
  const n = Math.floor(len * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[i0 + i] += amp * ((x / 0x7fffffff) * 2 - 1) * Math.sin(Math.PI * (i / n)) ** 2;
  }
}

/** A gentle hum with a slight wobble (bees, Owl's "hoo", the Heffalump). */
function hum(out, start, f0, f1, len, amp, { wobble = 5, depth = 0.02, buzz = 0 } = {}) {
  let phase = 0;
  const n = Math.floor(len * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const f = (f0 + (f1 - f0) * (t / len)) * (1 + depth * Math.sin(2 * Math.PI * wobble * t));
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, t / 0.04) * Math.min(1, (len - t) / 0.08);
    const wave = Math.sin(phase) + buzz * (Math.sin(2 * phase) / 2 + Math.sin(3 * phase) / 3);
    out[i0 + i] += amp * env * wave;
  }
}

const notes = (fn, list, gap, ...args) => (o) => list.forEach((m, i) => fn(o, i * gap, m, ...args));

// The tap "melody": a G-major pentatonic scale, walked up and down as you tap quickly.
const PENTA = [67, 69, 71, 74, 76, 79, 81, 83];
// Home upgrades step up a G-major scale, so levelling sounds like climbing.
const MAJOR = [67, 69, 71, 72, 74, 76, 78, 79];

const SFX = {};
PENTA.forEach((m, i) => {
  SFX[`tap${i}`] = () => {
    const o = silence(0.3);
    const f = 440 * 2 ** ((m - 69) / 12);
    drop(o, 0, f * 0.7, f, 0.08, 0.8);
    kalimba(o, 0.005, m, 0.35, 10, 0.3);
    return finish(o, 3000, 0.3);
  };
});
MAJOR.forEach((m, i) => {
  SFX[`level${i}`] = () => { const o = silence(0.8); marimba(o, 0, m, 0.7, 6); marimba(o, 0.07, m + 12, 0.35, 8); return finish(o); };
});

Object.assign(SFX, {
  // A lucky tap: a soft rolled G-major chord that rings on under the tap's own note,
  // with a warm breath beneath it. Gentle and in key, rather than a bright ping.
  lucky: () => {
    const o = silence(1.6);
    [79, 83, 86].forEach((m, i) => kalimba(o, i * 0.06, m, 0.4 - i * 0.07, 3.2, 1.5));
    warm(o, 0.02, 55, 0.25, 0.1, 0.08, 0.7);
    return finish(o, 2600, 1);
  },
  buy: () => { const o = silence(0.7); marimba(o, 0, 72, 0.7, 7); marimba(o, 0.07, 79, 0.6, 7); return finish(o); },
  hire: () => { const o = silence(1.3); [67, 71, 74, 79].forEach((m, i) => marimba(o, i * 0.09, m, 0.6, 5)); return finish(o); },
  upgrade: () => {
    const o = silence(1.8);
    [72, 76, 79, 84].forEach((m, i) => kalimba(o, i * 0.075, m, 0.45, 3.5));
    [48, 55, 64].forEach((m) => warm(o, 0.28, m, 0.6, 0.12, 0.08, 0.6));
    return finish(o, 4000, 1);
  },
  unlock: () => {
    const o = silence(2);
    [67, 71, 74, 79, 83].forEach((m, i) => kalimba(o, i * 0.07, m, 0.4, 3));
    [43, 55, 59, 62].forEach((m) => warm(o, 0.1, m, 1, 0.1, 0.15, 0.7));
    return finish(o, 3800, 1.2);
  },
  milestone: () => { const o = silence(1.2); [79, 83, 86].forEach((m, i) => marimba(o, i * 0.06, m, 0.55, 6)); kalimba(o, 0.2, 91, 0.4, 4); return finish(o); },
  addon: () => { const o = silence(1.2); kalimba(o, 0, 76, 0.45, 4); kalimba(o, 0.08, 83, 0.45, 4); kalimba(o, 0.2, 88, 0.25, 6); kalimba(o, 0.26, 95, 0.18, 7); return finish(o, 4200); },
  shop: () => { const o = silence(0.8); marimba(o, 0, 84, 0.55, 8); marimba(o, 0.08, 79, 0.6, 7); puff(o, 0, 0.02, 0.08, 11); return finish(o); },
  magic: () => {
    const o = silence(2.4);
    [72, 76, 79, 83, 84, 88, 91, 95, 96].forEach((m, i) => kalimba(o, i * 0.04, m, 0.28, 3.5));
    [48, 55, 64, 67].forEach((m) => warm(o, 0.25, m, 1.2, 0.09, 0.3, 0.8));
    return finish(o, 4500, 1.4);
  },
  balloon: () => { const o = silence(0.5); puff(o, 0, 0.05, 0.5, 7); drop(o, 0.005, 260, 140, 0.12, 0.6); kalimba(o, 0.06, 91, 0.2, 7); return finish(o, 2400, 0.5); },
  whoosh: () => { const o = silence(0.9); swell(o, 0, 0.8, 0.5); kalimba(o, 0.45, 91, 0.12, 5); return finish(o, 1200, 0.6); },
  buzz: () => { const o = silence(0.9); hum(o, 0, 210, 240, 0.8, 0.4, { wobble: 23, depth: 0.03, buzz: 0.8 }); return finish(o, 1400, 0.3); },
  hug: () => {
    const o = silence(2);
    [84, 81, 79, 76, 72].forEach((m, i) => kalimba(o, i * 0.11, m, 0.32, 3));
    [60, 64, 67].forEach((m) => warm(o, 0.05, m, 1.1, 0.08, 0.25, 0.7));
    return finish(o, 3500, 1.2);
  },
  gift: () => { const o = silence(1.1); [76, 79, 84].forEach((m, i) => kalimba(o, i * 0.1, m, 0.45, 4)); return finish(o); },
  pop: () => { const o = silence(0.25); drop(o, 0, 600, 900, 0.06, 0.8); return finish(o, 2600, 0.3); },
  fanfare: () => {
    const o = silence(2.4);
    [67, 71, 74].forEach((m, i) => marimba(o, i * 0.12, m, 0.55, 5));
    [79, 83, 86].forEach((m) => kalimba(o, 0.42, m, 0.35, 2.2, 2));
    [43, 55].forEach((m) => warm(o, 0.42, m, 1, 0.12, 0.05, 0.8));
    return finish(o, 4000, 1.3);
  },
  welcome: () => { const o = silence(2); [55, 59, 62].forEach((m) => warm(o, 0, m, 1, 0.1, 0.2, 0.8)); [79, 74, 79, 83].forEach((m, i) => kalimba(o, 0.1 + i * 0.14, m, 0.35, 3)); return finish(o, 3500, 1.2); },
  tick: () => { const o = silence(0.12); marimba(o, 0, 84, 0.6, 30); return finish(o, 3000, 0.1); },
  nap: () => { const o = silence(3.2); [79, 76, 72, 67, 64, 60].forEach((m, i) => kalimba(o, i * 0.34, m, 0.35, 1.8, 2)); return finish(o, 3000, 1.3); },
  oops: () => { const o = silence(0.35); marimba(o, 0, 55, 0.8, 9); marimba(o, 0.08, 52, 0.6, 9); return finish(o, 2000, 0.3); },
});

// A short musical signature for each character, played when you hire them,
// when their home gets a new look, and when they send a hug.
const MOTIFS = {
  pooh: (o) => { [55, 59, 62, 59].forEach((m, i) => marimba(o, i * 0.16, m, 0.7, 4)); },
  piglet: (o) => { [84, 86, 88, 86, 88].forEach((m, i) => kalimba(o, i * 0.05, m, 0.35, 6)); },
  tigger: (o) => { drop(o, 0, 180, 520, 0.18, 0.5); drop(o, 0.2, 220, 640, 0.18, 0.5); kalimba(o, 0.4, 79, 0.4, 4); kalimba(o, 0.47, 84, 0.4, 4); },
  rabbit: (o) => { [72, 74, 76, 77, 79].forEach((m, i) => marimba(o, i * 0.05, m, 0.55, 8)); },
  owl: (o) => { hum(o, 0, 330, 320, 0.28, 0.45, { wobble: 6, depth: 0.015 }); hum(o, 0.36, 262, 255, 0.4, 0.45, { wobble: 6, depth: 0.015 }); },
  eeyore: (o) => { [55, 53, 50, 48].forEach((m, i) => marimba(o, i * 0.32, m, 0.6, 2.5)); },
  kanga: (o) => { marimba(o, 0, 67, 0.6, 6); marimba(o, 0.14, 74, 0.6, 6); kalimba(o, 0.3, 86, 0.3, 6); kalimba(o, 0.38, 91, 0.3, 6); },
  robin: (o) => { hum(o, 0, 900, 1350, 0.16, 0.3, { wobble: 0 }); hum(o, 0.22, 1200, 1000, 0.22, 0.3, { wobble: 0 }); },
  small: (o) => { kalimba(o, 0, 96, 0.3, 8); kalimba(o, 0.06, 100, 0.25, 8); },
  bee: (o) => { hum(o, 0, 240, 280, 0.5, 0.35, { wobble: 25, depth: 0.03, buzz: 0.7 }); },
  woozle: (o) => { [64, 67, 70, 67].forEach((m, i) => kalimba(o, i * 0.18, m, 0.35, 3)); warm(o, 0, 40, 0.8, 0.12, 0.2, 0.6); },
  heffalump: (o) => { hum(o, 0, 110, 165, 0.5, 0.45, { wobble: 4, depth: 0.03, buzz: 0.4 }); warm(o, 0.1, 31, 0.6, 0.15, 0.1, 0.5); },
};
for (const [id, play] of Object.entries(MOTIFS)) SFX[`motif-${id}`] = () => { const o = silence(1.6); play(o); return finish(o, 3500, 0.9); };

writeWav('music', music(), 0.5);
// Taps (and the lucky chime that plays with them) are quieter than everything else.
for (const [name, make] of Object.entries(SFX)) writeWav(name, make(), name.startsWith('tap') || name === 'tick' ? 0.22 : name === 'lucky' ? 0.18 : 0.35);

// The game loads sounds by name from this generated list.
const names = Object.keys(SFX).sort();
fs.writeFileSync(path.join(__dirname, '..', 'src', 'audio', 'soundFiles.ts'), `// Generated by scripts/make-sounds.js. Don't edit by hand.
export const SOUND_FILES = {
${names.map((n) => `  '${n}': require('../../assets/sounds/${n}.wav'),`).join('\n')}
} as const;
export type SoundName = keyof typeof SOUND_FILES;
`);
console.log(`soundFiles.ts: ${names.length} sounds`);
