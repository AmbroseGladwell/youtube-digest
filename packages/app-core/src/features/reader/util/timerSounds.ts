import type { TimerSound } from "@overview/domain";

interface Engine {
  audio: AudioContext;
  master: GainNode;
  room: GainNode;
}

interface Tone {
  f: number;
  t: number;
  peak: number;
  decay: number;
  attack?: number;
  type?: OscillatorType;
  pan?: number;
}

interface Tine extends Tone {
  ratio?: number;
  index?: number;
  bright?: number;
}

type Voice = (engine: Engine, out: GainNode, t: number) => void;

const VIBRATION_MS = [220, 120, 220];
const QUIET_BETWEEN_RINGS_S = 1.5;

const SEMITONES: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
const note = (name: string): number => {
  const [, letter, octave] = /^([A-G])(\d)$/.exec(name)!;
  return 440 * Math.pow(2, (SEMITONES[letter!]! + (Number(octave) - 4) * 12) / 12);
};

const panned = ({ audio }: Engine, node: AudioNode, pan: number): AudioNode => {
  if (pan === 0) return node;
  const panner = audio.createStereoPanner();
  panner.pan.value = pan;
  node.connect(panner);
  return panner;
};

function partial(engine: Engine, out: AudioNode, { f, t, peak, decay, attack = 0.004, type = "sine", pan = 0 }: Tone): OscillatorNode {
  const { audio } = engine;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.value = f;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  panned(engine, osc.connect(env), pan).connect(out);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
  return osc;
}

function tine(engine: Engine, out: AudioNode, { ratio = 3.5, index = 1.4, bright = 0.09, ...tone }: Tine): void {
  const carrier = partial(engine, out, { ...tone, attack: 0.005 });
  const mod = engine.audio.createOscillator();
  const depth = engine.audio.createGain();
  mod.frequency.value = tone.f * ratio;
  depth.gain.setValueAtTime(tone.f * index, tone.t);
  depth.gain.setTargetAtTime(0, tone.t, bright);
  mod.connect(depth).connect(carrier.frequency);
  mod.start(tone.t);
  mod.stop(tone.t + tone.decay);
}

function mallet(engine: Engine, out: AudioNode, f: number, t: number, level: number, pan = 0): void {
  partial(engine, out, { f, t, peak: level, decay: 0.9, attack: 0.003, pan });
  partial(engine, out, { f: f * 3.93, t, peak: level * 0.22, decay: 0.18, attack: 0.002, pan });
  partial(engine, out, { f: f * 9.24, t, peak: level * 0.06, decay: 0.05, attack: 0.001, pan });
  partial(engine, out, { f: f * 0.5, t, peak: level * 0.12, decay: 0.5, attack: 0.01, pan });
}

function vibe(engine: Engine, out: AudioNode, f: number, t: number, level: number, length: number, pan = 0): void {
  const { audio } = engine;
  const shimmer = audio.createGain();
  const lfo = audio.createOscillator();
  const lfoDepth = audio.createGain();
  lfo.frequency.value = 5.5;
  lfoDepth.gain.value = 0.28;
  lfo.connect(lfoDepth).connect(shimmer.gain);
  lfo.start(t);
  lfo.stop(t + length + 0.1);
  shimmer.connect(out);
  tine(engine, shimmer, { f, t, peak: level, decay: length, ratio: 4, index: 0.5, bright: 0.05, pan });
  partial(engine, shimmer, { f: f * 4, t, peak: level * 0.08, decay: length * 0.3, pan });
}

function pluck(engine: Engine, out: AudioNode, f: number, t: number, level: number, pan = 0): void {
  const { audio } = engine;
  const osc = audio.createOscillator();
  const tone = audio.createBiquadFilter();
  const env = audio.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = f;
  tone.type = "lowpass";
  tone.Q.value = 1.2;
  tone.frequency.setValueAtTime(Math.min(f * 12, 9000), t);
  tone.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.35);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(level, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  panned(engine, osc.connect(tone).connect(env), pan).connect(out);
  osc.start(t);
  osc.stop(t + 1.5);
  partial(engine, out, { f, t, peak: level * 0.5, decay: 1.6, attack: 0.003, pan });
}

function strings(engine: Engine, out: AudioNode, f: number, t: number, level: number, length: number, pan = 0): void {
  const { audio } = engine;
  const section = audio.createGain();
  const tone = audio.createBiquadFilter();
  tone.type = "lowpass";
  tone.Q.value = 0.4;
  tone.frequency.setValueAtTime(700, t);
  tone.frequency.linearRampToValueAtTime(1600, t + 0.6);
  tone.frequency.exponentialRampToValueAtTime(500, t + length);
  section.gain.setValueAtTime(0.0001, t);
  section.gain.linearRampToValueAtTime(level, t + 0.45);
  section.gain.setValueAtTime(level, t + length * 0.45);
  section.gain.exponentialRampToValueAtTime(0.0001, t + length);
  const vibrato = audio.createOscillator();
  const depth = audio.createGain();
  vibrato.frequency.value = 4.8;
  depth.gain.value = 4;
  vibrato.connect(depth);
  vibrato.start(t);
  vibrato.stop(t + length + 0.1);
  for (const cents of [-9, -3, 4, 10]) {
    const player = audio.createOscillator();
    player.type = "sawtooth";
    player.frequency.value = f;
    player.detune.value = cents;
    depth.connect(player.detune);
    player.connect(tone);
    player.start(t);
    player.stop(t + length + 0.1);
  }
  panned(engine, tone.connect(section), pan).connect(out);
}

const SOUNDS: Record<TimerSound, { seconds: number; room: number; voice: Voice }> = {
  ready: {
    seconds: 3.2,
    room: 1.2,
    voice: (engine, out, t) => {
      const orchestra = engine.audio.createGain();
      orchestra.gain.value = 0.5;
      orchestra.connect(out);
      strings(engine, orchestra, note("C3"), t, 0.05, 3.0, -0.35);
      strings(engine, orchestra, note("G3"), t, 0.04, 3.0, 0.35);
      strings(engine, orchestra, note("E4"), t + 0.1, 0.025, 2.8, -0.15);
      strings(engine, orchestra, note("C4"), t + 0.1, 0.025, 2.8, 0.15);
      partial(engine, orchestra, { f: note("C2"), t, peak: 0.12, decay: 2.6, attack: 0.3 });
      const call: [string, number][] = [
        ["G5", 0],
        ["C6", 0.095],
        ["E6", 0.19],
        ["D6", 0.4],
        ["G6", 0.5],
      ];
      call.forEach(([name, at], index) => {
        const f = note(name);
        const last = index === call.length - 1;
        const pan = -0.3 + index * 0.15;
        mallet(engine, out, f, t + at, last ? 0.3 : 0.24, pan);
        tine(engine, out, {
          f: f * 2,
          t: t + at,
          peak: last ? 0.09 : 0.06,
          decay: last ? 1.6 : 0.5,
          ratio: 3.5,
          index: 1.1,
          bright: 0.06,
          pan,
        });
      });
      const end = t + 0.5;
      partial(engine, out, { f: note("C5"), t: end, peak: 0.07, decay: 1.4, attack: 0.03 });
      partial(engine, out, { f: note("E6"), t: end, peak: 0.035, decay: 1.2, attack: 0.04, pan: -0.25 });
      partial(engine, out, { f: note("G6") * 2, t: end, peak: 0.02, decay: 0.8, attack: 0.01, pan: 0.25 });
    },
  },
  chime: {
    seconds: 2.2,
    room: 1,
    voice: (engine, out, t) => {
      tine(engine, out, { f: 880, t, peak: 0.26, decay: 1.5, pan: -0.15 });
      partial(engine, out, { f: 440, t, peak: 0.07, decay: 1.2, attack: 0.02, pan: -0.15 });
      partial(engine, out, { f: 2640, t, peak: 0.025, decay: 0.4, pan: -0.15 });
      tine(engine, out, { f: 1318.5, t: t + 0.26, peak: 0.24, decay: 1.8, pan: 0.15 });
      partial(engine, out, { f: 659.25, t: t + 0.26, peak: 0.06, decay: 1.4, attack: 0.02, pan: 0.15 });
      partial(engine, out, { f: 3955.5, t: t + 0.26, peak: 0.02, decay: 0.35, pan: 0.15 });
    },
  },
  lowTone: {
    seconds: 3.4,
    room: 1,
    voice: (engine, out, t) => {
      partial(engine, out, { f: 293.66, t, peak: 0.26, decay: 3.0, attack: 0.06, pan: -0.2 });
      partial(engine, out, { f: 295.1, t, peak: 0.22, decay: 3.0, attack: 0.06, pan: 0.2 });
      partial(engine, out, { f: 293.66 * 2.71, t, peak: 0.06, decay: 1.8, attack: 0.04 });
      partial(engine, out, { f: 293.66 * 5.15, t, peak: 0.02, decay: 0.9, attack: 0.03 });
      partial(engine, out, { f: 146.83, t, peak: 0.08, decay: 2.2, attack: 0.1 });
    },
  },
  rise: {
    seconds: 2.4,
    room: 0.8,
    voice: (engine, out, t) => {
      for (const offset of [0, 0.62]) {
        ["C6", "E6", "G6", "C7"].forEach((name, index) =>
          tine(engine, out, {
            f: note(name),
            t: t + offset + index * 0.11,
            peak: 0.2,
            decay: offset > 0 && index === 3 ? 1.6 : 0.9,
            ratio: 3.5,
            index: 1.8,
            pan: -0.3 + index * 0.2,
          }),
        );
      }
    },
  },
  marimba: {
    seconds: 1.8,
    room: 0.7,
    voice: (engine, out, t) => {
      for (const offset of [0, 0.62]) {
        (
          [
            ["G5", 0],
            ["C6", 0.13],
            ["E6", 0.26],
          ] as const
        ).forEach(([name, at], index) => mallet(engine, out, note(name), t + offset + at, 0.34, -0.2 + index * 0.2));
      }
    },
  },
  pulse: {
    seconds: 1.5,
    room: 0.5,
    voice: (engine, out, t) => {
      [0, 0.16, 0.5, 0.66, 1.0, 1.16].forEach((at, index) => {
        const f = note(index % 2 ? "E6" : "B5");
        tine(engine, out, { f, t: t + at, peak: 0.24, decay: 0.32, ratio: 1, index: 2.2, bright: 0.05 });
        partial(engine, out, { f: f * 2, t: t + at, peak: 0.05, decay: 0.12 });
      });
    },
  },
  crystal: {
    seconds: 3.2,
    room: 1.2,
    voice: (engine, out, t) => {
      partial(engine, out, { f: 1760, t, peak: 0.16, decay: 2.8, attack: 0.008, pan: -0.15 });
      partial(engine, out, { f: 1763.5, t, peak: 0.13, decay: 2.8, attack: 0.008, pan: 0.15 });
      partial(engine, out, { f: 1760 * 2.32, t, peak: 0.035, decay: 1.2, attack: 0.004 });
      partial(engine, out, { f: 1760 * 4.25, t, peak: 0.012, decay: 0.5, attack: 0.002 });
    },
  },
  musicBox: {
    seconds: 2.4,
    room: 0.9,
    voice: (engine, out, t) => {
      (
        [
          ["E6", 0],
          ["G6", 0.18],
          ["C7", 0.36],
          ["B6", 0.54],
          ["G6", 0.72],
        ] as const
      ).forEach(([name, at], index) =>
        tine(engine, out, {
          f: note(name),
          t: t + at,
          peak: 0.16,
          decay: index === 4 ? 1.6 : 0.9,
          ratio: 7.1,
          index: 0.9,
          bright: 0.04,
          pan: (index - 2) * 0.12,
        }),
      );
    },
  },
  vibraphone: {
    seconds: 2.6,
    room: 1,
    voice: (engine, out, t) => {
      vibe(engine, out, note("E5"), t, 0.24, 1.4, -0.15);
      vibe(engine, out, note("C5"), t + 0.42, 0.24, 2.0, 0.15);
    },
  },
  harp: {
    seconds: 2.4,
    room: 1,
    voice: (engine, out, t) => {
      ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"].forEach((name, index) =>
        pluck(engine, out, note(name), t + index * 0.055, index === 7 ? 0.16 : 0.11, -0.35 + index * 0.1),
      );
    },
  },
};

export const timerSoundSeconds = (sound: TimerSound): number => SOUNDS[sound].seconds;

export const timerSoundEveryMs = (sound: TimerSound): number => (SOUNDS[sound].seconds + QUIET_BETWEEN_RINGS_S) * 1000;

const roomEcho = (audio: AudioContext): AudioBuffer => {
  const length = Math.floor(audio.sampleRate * 1.8);
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i += 1) {
      low = low * 0.72 + (Math.random() * 2 - 1) * 0.28;
      data[i] = low * Math.pow(1 - i / length, 3.2);
    }
  }
  return buffer;
};

let engine: Engine | null = null;

const audioEngine = (): Engine | null => {
  if (engine !== null) return engine;
  const Context = typeof window === "undefined" ? undefined : window.AudioContext;
  if (Context === undefined) return null;
  const audio = new Context();
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 8;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  const master = audio.createGain();
  master.gain.value = 0.9;
  master.connect(limiter).connect(audio.destination);
  const echo = audio.createConvolver();
  echo.buffer = roomEcho(audio);
  const echoTone = audio.createBiquadFilter();
  echoTone.type = "lowpass";
  echoTone.frequency.value = 5200;
  const room = audio.createGain();
  room.gain.value = 0.22;
  room.connect(echo).connect(echoTone).connect(master);
  engine = { audio, master, room };
  return engine;
};

export function unlockTimerSound(): void {
  const audio = audioEngine()?.audio;
  if (audio !== undefined && audio.state === "suspended") void audio.resume();
}

// Every sound is made here with Web Audio, so none needs a file and they play in the panel too
// (docs/features/recipe-notes.md, "Timers"). Returns a stop that fades the sound out.
export function playTimerSound(sound: TimerSound, { vibrate = true } = {}): () => void {
  if (vibrate) navigator.vibrate?.(VIBRATION_MS);
  const ready = audioEngine();
  if (ready === null) return () => {};
  const { audio, master, room } = ready;
  if (audio.state === "suspended") void audio.resume();
  const { voice, room: roomAmount } = SOUNDS[sound];
  const out = audio.createGain();
  out.connect(master);
  const send = audio.createGain();
  send.gain.value = roomAmount;
  out.connect(send).connect(room);
  voice(ready, out, audio.currentTime + 0.03);
  return () => {
    out.gain.setTargetAtTime(0, audio.currentTime, 0.03);
    setTimeout(() => out.disconnect(), 200);
  };
}
