/**
 * Synthesized flash-era sound effects — no audio assets, just WebAudio
 * oscillators and filtered noise. The AudioContext is created lazily on
 * the first effect after a user gesture, per browser autoplay policy.
 * Everything runs through one master gain so the volume slider covers all.
 */

import type { MoveClass, UnitType } from '../engine/types';

const MUTED_KEY = 'crossfire-valley-muted';
const VOLUME_KEY = 'crossfire-valley-volume';
const AMBIENT_KEY = 'crossfire-valley-ambient';

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the setting lasts this session */
  }
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private ambientWanted = false;
  private _muted = load(MUTED_KEY) === '1';
  private _volume = Math.min(1, Math.max(0, Number(load(VOLUME_KEY) ?? '0.8') || 0));
  private _ambient = load(AMBIENT_KEY) === '1';

  get muted(): boolean {
    return this._muted;
  }

  toggleMuted(): boolean {
    this._muted = !this._muted;
    save(MUTED_KEY, this._muted ? '1' : '0');
    if (this._muted) this.stopAmbient();
    else this.syncAmbient();
    return this._muted;
  }

  /** 0..1 */
  get volume(): number {
    return this._volume;
  }

  setVolume(v: number): void {
    this._volume = Math.min(1, Math.max(0, v));
    save(VOLUME_KEY, String(this._volume));
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this._volume, this.ctx.currentTime);
  }

  /** The optional battlefield ambience (wind and distant rumble) while a game is on screen. */
  get ambient(): boolean {
    return this._ambient;
  }

  setAmbient(on: boolean): void {
    this._ambient = on;
    save(AMBIENT_KEY, on ? '1' : '0');
    this.syncAmbient();
  }

  /** Called when the game screen shows or hides. */
  inGame(on: boolean): void {
    this.ambientWanted = on;
    this.syncAmbient();
  }

  private audio(): AudioContext | null {
    if (this._muted) return null;
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private out(): AudioNode {
    return this.master!;
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
    osc.connect(gain).connect(this.out());
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noiseBuffer(ctx: AudioContext, duration: number, decay: boolean): AudioBuffer {
    const frames = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (decay ? 1 - i / frames : 1);
    return buffer;
  }

  /** Filtered white-noise burst (explosions, gunfire). */
  private boom(duration: number, filterFreq: number, vol = 0.2, delay = 0): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, duration, true);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterFreq / 6), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(gain).connect(this.out());
    src.start(t0);
  }

  /** A rising or falling noise sweep (rockets, shells in flight). */
  private whoosh(duration: number, from: number, to: number, vol = 0.07, delay = 0): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, duration, false);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(gain).connect(this.out());
    src.start(t0);
  }

  // ----- ambience ----------------------------------------------------------

  private syncAmbient(): void {
    if (this._ambient && this.ambientWanted && !this._muted) this.startAmbient();
    else this.stopAmbient();
  }

  private startAmbient(): void {
    if (this.ambientNodes) return;
    const ctx = this.audio();
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 4, false);
    src.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 320;
    // A slow wobble on the filter makes the wind breathe.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.08;
    depth.gain.value = 140;
    lfo.connect(depth).connect(low.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
    src.connect(low).connect(gain).connect(this.out());
    src.start();
    lfo.start();
    this.ambientNodes = { src, gain };
  }

  private stopAmbient(): void {
    const nodes = this.ambientNodes;
    if (!nodes || !this.ctx) return;
    this.ambientNodes = null;
    const t = this.ctx.currentTime;
    nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, t);
    nodes.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    nodes.src.stop(t + 0.7);
  }

  // ----- effects -------------------------------------------------------------

  /** Selecting a unit: a short cue in that unit's voice. */
  select(type?: UnitType): void {
    switch (type) {
      case 'infantry':
        this.tone(660, 0.04, { vol: 0.045 });
        this.tone(880, 0.05, { vol: 0.045, delay: 0.05 });
        break;
      case 'bazooka':
        this.tone(520, 0.05, { vol: 0.045 });
        this.boom(0.05, 900, 0.05, 0.05);
        break;
      case 'recon':
        this.tone(900, 0.08, { type: 'triangle', vol: 0.05, slideTo: 1400 });
        break;
      case 'lightTank':
        this.tone(180, 0.1, { type: 'sawtooth', vol: 0.045, slideTo: 240 });
        this.tone(880, 0.03, { vol: 0.03, delay: 0.06 });
        break;
      case 'heavyTank':
        this.tone(95, 0.16, { type: 'sawtooth', vol: 0.06, slideTo: 130 });
        this.boom(0.1, 300, 0.06);
        break;
      case 'artillery':
        this.tone(1200, 0.025, { vol: 0.035 });
        this.tone(160, 0.1, { type: 'triangle', vol: 0.06, delay: 0.03 });
        break;
      case 'antiAir':
        for (let i = 0; i < 3; i++) this.tone(1320, 0.02, { vol: 0.035, delay: i * 0.035 });
        break;
      case 'helicopter':
        this.tone(96, 0.045, { vol: 0.05 });
        this.tone(96, 0.045, { vol: 0.05, delay: 0.07 });
        break;
      case 'cutter':
      case 'frigate':
      case 'destroyer':
      case 'submarine':
      case 'cruiser':
      case 'barge':
        // a short ship's horn
        this.tone(147, 0.18, { type: 'triangle', vol: 0.07 });
        this.tone(110, 0.2, { type: 'triangle', vol: 0.05, delay: 0.02 });
        break;
      default:
        this.tone(880, 0.05, { type: 'square', vol: 0.05 });
    }
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
      case 'sea':
        // hull slap and a low engine
        this.boom(0.3, 500, 0.08);
        this.tone(70, 0.3, { type: 'triangle', vol: 0.05, slideTo: 60 });
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

  /** A hit, in the voice of whatever fired it. */
  fire(shooter?: UnitType): void {
    switch (shooter) {
      case 'infantry':
        // rifle crackle
        for (let i = 0; i < 3; i++) this.boom(0.05, 3000, 0.1, i * 0.07);
        break;
      case 'bazooka':
        this.whoosh(0.18, 600, 2400, 0.08);
        this.boom(0.22, 1400, 0.16, 0.14);
        break;
      case 'cutter':
      case 'recon':
        // machine gun
        for (let i = 0; i < 5; i++) this.boom(0.03, 2600, 0.08, i * 0.05);
        break;
      case 'lightTank':
        this.boom(0.18, 1800, 0.17);
        this.tone(140, 0.12, { type: 'sawtooth', vol: 0.07, slideTo: 60 });
        break;
      case 'destroyer':
      case 'heavyTank':
        this.boom(0.3, 1200, 0.24);
        this.tone(90, 0.22, { type: 'sawtooth', vol: 0.09, slideTo: 40 });
        break;
      case 'cruiser':
      case 'artillery':
        // the shell arriving
        this.whoosh(0.2, 2400, 500, 0.05);
        this.boom(0.28, 1100, 0.2, 0.16);
        break;
      case 'frigate':
      case 'antiAir':
        // flak: rapid bright pops
        for (let i = 0; i < 6; i++) this.boom(0.035, 3600, 0.08, i * 0.04);
        break;
      case 'submarine':
        // a torpedo run, then a deep hit
        this.whoosh(0.35, 300, 900, 0.05);
        this.boom(0.45, 500, 0.24, 0.3);
        break;
      case 'helicopter':
        // two rockets
        this.whoosh(0.16, 900, 3000, 0.07);
        this.whoosh(0.16, 900, 3000, 0.07, 0.09);
        this.boom(0.16, 1600, 0.13, 0.15);
        break;
      default:
        this.attack();
    }
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

  /** A short fanfare: a rising call, then a held major chord over a drum roll. */
  victory(): void {
    const call = [392, 523, 659, 784];
    call.forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.08, delay: i * 0.11 }));
    for (const f of [523, 659, 784, 1047]) this.tone(f, 0.9, { type: 'triangle', vol: 0.05, delay: 0.5 });
    for (let i = 0; i < 6; i++) this.boom(0.06, 700, 0.06, 0.46 + i * 0.05);
  }

  /** A falling line into a low minor chord. */
  defeat(): void {
    const line = [392, 349, 311, 262];
    line.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.07, delay: i * 0.18 }));
    for (const f of [131, 156, 196]) this.tone(f, 1.1, { type: 'sawtooth', vol: 0.03, delay: 0.75 });
    this.boom(0.8, 250, 0.08, 0.75);
  }
}

export const sfx = new Sfx();
