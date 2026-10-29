// Builds every sound in the game from scratch (no samples, no recordings):
// an original music-box waltz for the background, plus the sound effects.
// Run: node scripts/make-sounds.js   → writes assets/sounds/*.wav
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function writeWav(name, samples) {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.85 / peak : 1;
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), 44 + i * 2));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.wav`), buf);
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(1)}s  ${(buf.length / 1024).toFixed(0)} KB`);
}

// ---------- instruments ----------

/** Music-box / bell note: a few harmonics (one slightly off, for shimmer) with a soft decay. */
function bell(out, start, midi, len, amp, decay = 3) {
  const f = midiHz(midi);
  const n = Math.floor(len * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * decay);
    const w = 2 * Math.PI * f * t;
    out[i0 + i] += amp * env * (Math.sin(w) + 0.35 * Math.sin(2 * w) + 0.12 * Math.sin(3 * w) + 0.05 * Math.sin(4.2 * w));
  }
}

/** Soft round tone for bass and pads. */
function soft(out, start, midi, len, amp, attack = 0.02, release = 0.3) {
  const f = midiHz(midi);
  const n = Math.floor((len + release) * RATE);
  const i0 = Math.floor(start * RATE);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / attack) * (t > len ? Math.exp(-(t - len) / release * 3) : 1);
    const w = 2 * Math.PI * f * t;
    out[i0 + i] += amp * env * (Math.sin(w) + 0.15 * Math.sin(3 * w));
  }
}

/** A little room sound: two feedback echoes. */
function reverb(x) {
  const out = Float32Array.from(x);
  for (const [delay, fb] of [[0.113, 0.28], [0.171, 0.22]]) {
    const d = Math.floor(delay * RATE);
    for (let i = d; i < out.length; i++) out[i] += out[i - d] * fb;
  }
  return out;
}

const silence = (secs) => new Float32Array(Math.ceil(secs * RATE));

// ---------- music: "Honey on the Hill", an original waltz (3/4, G major) ----------

const G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, Fs5 = 78, G5 = 79, A5 = 81;
// Each bar: [chord root (MIDI), chord notes, melody as [note, beats]...]
const CHORDS = {
  G: [43, [55, 59, 62]], C: [48, [55, 60, 64]], D: [50, [54, 57, 62]], Em: [40, [55, 59, 64]],
  Am: [45, [57, 60, 64]], Bm: [47, [54, 59, 62]],
};
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
  const beat = 60 / 92;
  const bar = beat * 3;
  const length = BARS.length * bar;
  const out = silence(length + 3);
  BARS.forEach(([chord, melody], b) => {
    const t0 = b * bar;
    const [root, notes] = CHORDS[chord];
    soft(out, t0, root, beat * 1.6, 0.22, 0.02, 0.4); // bass on beat one
    soft(out, t0 + beat, root + 7, beat * 0.8, 0.1); // a lighter fifth
    soft(out, t0 + beat * 2, root + 7, beat * 0.8, 0.1);
    for (const n of notes) soft(out, t0, n, bar * 0.95, 0.035, 0.25, 0.5); // gentle pad
    let t = t0;
    for (const [note, beats] of melody) { bell(out, t, note, beats * beat + 1, 0.3, 2.6); t += beats * beat; }
  });
  // Seamless loop: fold the ringing tail back onto the start.
  const loop = Math.floor(length * RATE);
  const wet = reverb(out);
  const res = wet.slice(0, loop);
  for (let i = loop; i < wet.length; i++) res[i - loop] += wet[i];
  return res;
}

// ---------- sound effects ----------

function sweep(out, start, f0, f1, len, amp) {
  let phase = 0;
  const n = Math.floor(len * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += (2 * Math.PI * (f0 + (f1 - f0) * (t / len))) / RATE;
    out[Math.floor(start * RATE) + i] += amp * Math.sin(phase) * Math.min(1, t / 0.003) * Math.exp(-t * 6 / len);
  }
}

function noise(out, start, len, amp, seed = 1) {
  let x = seed;
  const n = Math.floor(len * RATE);
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[Math.floor(start * RATE) + i] += amp * ((x / 0x7fffffff) * 2 - 1) * Math.exp((-i / RATE) * 60);
  }
}

const SFX = {
  tap: () => { const o = silence(0.18); sweep(o, 0, 620, 240, 0.12, 0.8); return o; },
  lucky: () => { const o = silence(0.7); bell(o, 0, 88, 0.7, 0.5, 5); bell(o, 0.06, 95, 0.6, 0.4, 5); return o; },
  buy: () => { const o = silence(0.8); bell(o, 0, 84, 0.8, 0.5, 4); bell(o, 0.09, 91, 0.7, 0.5, 4); return reverb(o); },
  hire: () => { const o = silence(1.2); [79, 86, 91].forEach((m, i) => bell(o, i * 0.11, m, 1, 0.45, 3)); return reverb(o); },
  upgrade: () => {
    const o = silence(1.6);
    [79, 83, 86, 91].forEach((m, i) => bell(o, i * 0.08, m, 1.2, 0.4, 3));
    [55, 59, 62].forEach((m) => soft(o, 0.32, m, 0.8, 0.12, 0.05, 0.4));
    return reverb(o);
  },
  balloon: () => { const o = silence(0.5); noise(o, 0, 0.12, 0.9, 7); sweep(o, 0.01, 180, 60, 0.15, 0.6); bell(o, 0.06, 96, 0.4, 0.2, 8); return o; },
  hug: () => { const o = silence(1.6); [96, 93, 91, 88, 86].forEach((m, i) => bell(o, i * 0.09, m, 1, 0.3, 4)); [60, 64, 67].forEach((m) => soft(o, 0.1, m, 1, 0.08, 0.2, 0.5)); return reverb(o); },
  nap: () => { const o = silence(3); [79, 76, 72, 67, 64, 60].forEach((m, i) => bell(o, i * 0.32, m, 1.5, 0.35, 2)); return reverb(o); },
  gift: () => { const o = silence(1); bell(o, 0, 84, 0.9, 0.45, 4); bell(o, 0.12, 88, 0.9, 0.45, 4); bell(o, 0.24, 91, 0.9, 0.45, 4); return reverb(o); },
  oops: () => { const o = silence(0.4); sweep(o, 0, 220, 150, 0.25, 0.6); return o; },
};

writeWav('music', music());
for (const [name, make] of Object.entries(SFX)) writeWav(name, make());
