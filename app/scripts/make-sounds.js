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

const SFX = {
  // Three slightly different honey "bloops" so rapid tapping doesn't sound like a machine gun.
  tap1: () => { const o = silence(0.16); drop(o, 0, 420, 640, 0.09, 1); return finish(o, 2600, 0.3); },
  tap2: () => { const o = silence(0.16); drop(o, 0, 470, 720, 0.085, 1); return finish(o, 2600, 0.3); },
  tap3: () => { const o = silence(0.16); drop(o, 0, 380, 580, 0.095, 1); return finish(o, 2600, 0.3); },
  lucky: () => { const o = silence(0.9); kalimba(o, 0, 88, 0.6, 5); kalimba(o, 0.07, 93, 0.5, 5); kalimba(o, 0.14, 100, 0.35, 6); return finish(o, 4500); },
  buy: () => { const o = silence(0.7); marimba(o, 0, 72, 0.7, 7); marimba(o, 0.07, 79, 0.6, 7); return finish(o); },
  hire: () => { const o = silence(1.3); [67, 71, 74, 79].forEach((m, i) => marimba(o, i * 0.09, m, 0.6, 5)); return finish(o); },
  upgrade: () => {
    const o = silence(1.8);
    [72, 76, 79, 84].forEach((m, i) => kalimba(o, i * 0.075, m, 0.45, 3.5));
    [48, 55, 64].forEach((m) => warm(o, 0.28, m, 0.6, 0.12, 0.08, 0.6));
    return finish(o, 4000, 1);
  },
  balloon: () => { const o = silence(0.5); puff(o, 0, 0.05, 0.5, 7); drop(o, 0.005, 260, 140, 0.12, 0.6); kalimba(o, 0.06, 91, 0.2, 7); return finish(o, 2400, 0.5); },
  hug: () => {
    const o = silence(2);
    [84, 81, 79, 76, 72].forEach((m, i) => kalimba(o, i * 0.11, m, 0.32, 3));
    [60, 64, 67].forEach((m) => warm(o, 0.05, m, 1.1, 0.08, 0.25, 0.7));
    return finish(o, 3500, 1.2);
  },
  nap: () => { const o = silence(3.2); [79, 76, 72, 67, 64, 60].forEach((m, i) => kalimba(o, i * 0.34, m, 0.35, 1.8, 2)); return finish(o, 3000, 1.3); },
  gift: () => { const o = silence(1.1); [76, 79, 84].forEach((m, i) => kalimba(o, i * 0.1, m, 0.45, 4)); return finish(o); },
  oops: () => { const o = silence(0.35); marimba(o, 0, 55, 0.8, 9); marimba(o, 0.08, 52, 0.6, 9); return finish(o, 2000, 0.3); },
};

writeWav('music', music(), 0.5);
for (const [name, make] of Object.entries(SFX)) writeWav(name, make(), name.startsWith('tap') ? 0.25 : 0.35);
