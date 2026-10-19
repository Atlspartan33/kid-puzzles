// Synthesized sound effects (no audio files, so everything works offline) + speech.
let ctx = null, master = null, on = true;

export function setSound(v) { on = v; if (!v && 'speechSynthesis' in window) speechSynthesis.cancel(); }
export function soundOn() { return on; }

export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(freq, at, dur, type = 'sine', vol = 0.3, glideTo = 0) {
  if (!on || !ctx) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(at, dur, vol, fFrom, fTo) {
  if (!on || !ctx) return;
  const t0 = ctx.currentTime + at;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(fFrom, t0); f.frequency.exponentialRampToValueAtTime(fTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0); src.stop(t0 + dur);
}

// C-major pentatonic: every snap climbs one step, so progress is audible.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

export const sfx = {
  tap() { tone(660, 0, 0.07, 'sine', 0.15); },
  pick() { tone(480, 0, 0.08, 'sine', 0.16, 760); },
  drop() { tone(260, 0, 0.12, 'sine', 0.18, 170); },
  snap(progress) {
    const i = Math.min(PENTA.length - 1, Math.round(progress * (PENTA.length - 1)));
    tone(1100, 0, 0.05, 'square', 0.06, 420);           // click "pop"
    tone(PENTA[i], 0.03, 0.38, 'triangle', 0.32);
    tone(PENTA[i] * 2, 0.03, 0.22, 'sine', 0.08);
  },
  hint() { [1318.5, 1568, 2093].forEach((f, i) => tone(f, i * 0.09, 0.28, 'sine', 0.13)); },
  whoosh() { noise(0, 0.55, 0.22, 300, 2600); },
  win() {
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093];
    arp.forEach((f, i) => tone(f, i * 0.09, 0.32, 'triangle', 0.26));
    [523.25, 659.25, 783.99, 1046.5].forEach(f => tone(f, 0.72, 1.1, 'triangle', 0.16));
    for (let i = 0; i < 10; i++) tone(1800 + Math.random() * 1800, 0.8 + i * 0.07, 0.15, 'sine', 0.05);
  },
};

let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /en[-_]US/i.test(v.lang) && /female|google/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export function speak(text, { rate = 0.95, pitch = 1.15 } = {}) {
  if (!on || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    speechSynthesis.speak(u);
  } catch { /* speech is a bonus, never required */ }
}
