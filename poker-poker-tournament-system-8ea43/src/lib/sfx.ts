/**
 * Синтезированные звуковые события клуба (WebAudio, без внешних файлов — работает офлайн).
 * Начало турнира, выбивание, уровень, перерыв, ребай, ре-ентри, адд-он, финал.
 */

export type SfxName = 'start' | 'eliminate' | 'level' | 'break' | 'rebuy' | 'reentry' | 'addon' | 'end';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneSpec {
  freq: number;
  at: number; // смещение, сек
  dur: number;
  type?: OscillatorType;
  vol?: number;
  glideTo?: number;
}

function render(specs: ToneSpec[]) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + 0.015;
  for (const sp of specs) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = sp.type ?? 'sine';
    const vol = sp.vol ?? 0.16;
    osc.frequency.setValueAtTime(sp.freq, t0 + sp.at);
    if (sp.glideTo) osc.frequency.exponentialRampToValueAtTime(sp.glideTo, t0 + sp.at + sp.dur);
    gain.gain.setValueAtTime(0.0001, t0 + sp.at);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + sp.at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + sp.at + sp.dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0 + sp.at);
    osc.stop(t0 + sp.at + sp.dur + 0.05);
  }
}

const PRESETS: Record<SfxName, ToneSpec[]> = {
  start: [
    { freq: 392, at: 0, dur: 0.16, type: 'triangle', vol: 0.2 },
    { freq: 494, at: 0.13, dur: 0.16, type: 'triangle', vol: 0.2 },
    { freq: 587, at: 0.26, dur: 0.2, type: 'triangle', vol: 0.22 },
    { freq: 784, at: 0.4, dur: 0.5, type: 'triangle', vol: 0.24 },
    { freq: 784, at: 0.4, dur: 0.5, type: 'sine', vol: 0.1 },
  ],
  eliminate: [
    { freq: 220, at: 0, dur: 0.22, type: 'sawtooth', vol: 0.16, glideTo: 82 },
    { freq: 164, at: 0.05, dur: 0.3, type: 'triangle', vol: 0.18, glideTo: 60 },
    { freq: 98, at: 0.16, dur: 0.34, type: 'sine', vol: 0.22, glideTo: 45 },
  ],
  level: [
    { freq: 880, at: 0, dur: 0.7, type: 'sine', vol: 0.2 },
    { freq: 1318.5, at: 0.02, dur: 0.55, type: 'sine', vol: 0.09 },
    { freq: 880, at: 0.16, dur: 0.6, type: 'sine', vol: 0.12 },
  ],
  break: [
    { freq: 587, at: 0, dur: 0.22, type: 'triangle', vol: 0.17 },
    { freq: 440, at: 0.2, dur: 0.34, type: 'triangle', vol: 0.17 },
  ],
  rebuy: [
    { freq: 988, at: 0, dur: 0.08, type: 'square', vol: 0.08 },
    { freq: 1319, at: 0.07, dur: 0.14, type: 'square', vol: 0.08 },
  ],
  reentry: [
    { freq: 330, at: 0, dur: 0.28, type: 'sawtooth', vol: 0.1, glideTo: 990 },
    { freq: 660, at: 0.1, dur: 0.2, type: 'sine', vol: 0.12, glideTo: 1320 },
  ],
  addon: [
    { freq: 660, at: 0, dur: 0.09, type: 'square', vol: 0.07 },
    { freq: 880, at: 0.08, dur: 0.12, type: 'square', vol: 0.07 },
  ],
  end: [
    { freq: 523, at: 0, dur: 0.2, type: 'triangle', vol: 0.2 },
    { freq: 659, at: 0.17, dur: 0.2, type: 'triangle', vol: 0.2 },
    { freq: 784, at: 0.34, dur: 0.24, type: 'triangle', vol: 0.22 },
    { freq: 1047, at: 0.52, dur: 0.8, type: 'triangle', vol: 0.24 },
    { freq: 523, at: 0.52, dur: 0.8, type: 'sine', vol: 0.08 },
    { freq: 784, at: 0.52, dur: 0.8, type: 'sine', vol: 0.06 },
  ],
};

let lastPlay = 0;

export function playSfx(name: SfxName, enabled: boolean): void {
  if (!enabled) return;
  const now = Date.now();
  if (now - lastPlay < 120) return;
  lastPlay = now;
  try {
    render(PRESETS[name]);
  } catch {
    /* без звука — не критично */
  }
}