const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg'];

// After the named suffixes, keep going with aa, ab, … zz (enough for any number JavaScript can hold).
function suffix(tier: number) {
  if (tier < SUFFIXES.length) return SUFFIXES[tier];
  const i = tier - SUFFIXES.length;
  return String.fromCharCode(97 + Math.floor(i / 26) % 26) + String.fromCharCode(97 + (i % 26));
}

export function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n, decimals);
  if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  const tier = Math.floor(Math.log10(n) / 3);
  const scaled = n / 10 ** (tier * 3);
  return `${scaled.toFixed(scaled >= 100 ? 1 : decimals)}${suffix(tier)}`;
}

export function fmtTime(secs: number): string {
  if (secs < 1) return `${secs.toFixed(1)}s`;
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  const h = Math.floor(secs / 3600);
  if (h >= 24) return `${Math.floor(h / 24)}d${h % 24 ? ` ${h % 24}h` : ''}`;
  return `${h}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function timeAgo(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** A short wait: "4m 05s", or "35s" under a minute. */
export const fmtWait = (ms: number) => {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(secs / 60);
  return m ? `${m}m ${String(secs % 60).padStart(2, '0')}s` : `${secs}s`;
};
