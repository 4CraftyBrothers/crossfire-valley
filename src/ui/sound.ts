/**
 * Synthesized flash-era sound effects — no audio assets, just WebAudio
 * oscillators and filtered noise. The AudioContext is created lazily on
 * the first effect after a user gesture, per browser autoplay policy.
 */

import type { MoveClass } from '../engine/types';

const STORAGE_KEY = 'crossfire-valley-muted';

class Sfx {
  private ctx: AudioContext | null = null;
  private _muted = localStorage.getItem(STORAGE_KEY) === '1';

  get muted(): boolean {
    return this._muted;
  }

  toggleMuted(): boolean {
    this._muted = !this._muted;
    localStorage.setItem(STORAGE_KEY, this._muted ? '1' : '0');
    return this._muted;
  }

  private audio(): AudioContext | null {
    if (this._muted) return null;
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Simple enveloped oscillator beep. */
  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; vol?: number; delay?: number; slideTo?: number } = {},
  ): void {
    const ctx = this.audio();
    if (!ctx) return;
    const { type = 'square', vol = 0.08, delay = 0, slideTo } = opts;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + duration);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Filtered white-noise burst (explosions, gunfire). */
  private boom(duration: number, filterFreq: number, vol = 0.2, delay = 0): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const frames = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterFreq / 6), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  select(): void {
    this.tone(880, 0.05, { type: 'square', vol: 0.05 });
  }

  cancel(): void {
    this.tone(300, 0.06, { type: 'square', vol: 0.04 });
  }

  /** Movement audio matches how the unit travels. */
  move(moveClass: MoveClass = 'treads'): void {
    switch (moveClass) {
      case 'foot':
        // quick boot-steps: three soft high ticks
        this.boom(0.035, 2600, 0.055);
        this.boom(0.035, 2200, 0.05, 0.11);
        this.boom(0.035, 2600, 0.045, 0.22);
        break;
      case 'tires':
        // engine whir winding up
        this.tone(150, 0.2, { type: 'triangle', vol: 0.055, slideTo: 360 });
        break;
      case 'air':
        // rotor thump-thump-thump
        this.tone(92, 0.055, { type: 'square', vol: 0.06 });
        this.tone(92, 0.055, { type: 'square', vol: 0.06, delay: 0.08 });
        this.tone(92, 0.055, { type: 'square', vol: 0.055, delay: 0.16 });
        this.boom(0.22, 700, 0.045);
        break;
      case 'treads':
      default:
        // low diesel rumble with a track clank
        this.boom(0.26, 360, 0.12);
        this.tone(64, 0.24, { type: 'sawtooth', vol: 0.05, slideTo: 52 });
        this.tone(720, 0.03, { type: 'square', vol: 0.03, delay: 0.05 });
        break;
    }
  }

  /** Mortar launch: a deep hollow thoomp before the shell lands. */
  mortar(): void {
    this.tone(150, 0.28, { type: 'sine', vol: 0.13, slideTo: 44 });
    this.boom(0.12, 500, 0.08);
  }

  attack(): void {
    this.boom(0.16, 1800, 0.16);
    this.tone(140, 0.12, { type: 'sawtooth', vol: 0.07, slideTo: 60 });
  }

  explode(): void {
    this.boom(0.5, 900, 0.3);
    this.tone(90, 0.4, { type: 'sawtooth', vol: 0.1, slideTo: 35 });
  }

  capture(): void {
    this.tone(392, 0.07, { vol: 0.06 });
    this.tone(523, 0.07, { vol: 0.06, delay: 0.08 });
  }

  captured(): void {
    this.tone(523, 0.09, { vol: 0.07 });
    this.tone(659, 0.09, { vol: 0.07, delay: 0.09 });
    this.tone(784, 0.16, { vol: 0.07, delay: 0.18 });
  }

  build(): void {
    this.tone(330, 0.06, { type: 'triangle', vol: 0.07 });
    this.tone(494, 0.06, { type: 'triangle', vol: 0.07, delay: 0.07 });
    this.tone(659, 0.1, { type: 'triangle', vol: 0.07, delay: 0.14 });
  }

  turn(): void {
    this.tone(262, 0.1, { type: 'triangle', vol: 0.06 });
    this.tone(392, 0.14, { type: 'triangle', vol: 0.06, delay: 0.1 });
  }

  undo(): void {
    this.tone(440, 0.05, { vol: 0.05, slideTo: 220 });
  }

  ambush(): void {
    this.tone(620, 0.1, { type: 'sawtooth', vol: 0.09, slideTo: 310 });
    this.tone(415, 0.16, { type: 'sawtooth', vol: 0.08, delay: 0.1, slideTo: 200 });
  }

  victory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.09, delay: i * 0.13 }));
  }

  defeat(): void {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.08, delay: i * 0.16 }));
  }
}

export const sfx = new Sfx();
