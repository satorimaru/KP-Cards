export type SfxName =
  | "deal"
  | "play"
  | "pass"
  | "bomb"
  | "uno"
  | "draw"
  | "chip"
  | "check"
  | "fold"
  | "win"
  | "lose";

let ctx: AudioContext | null = null;
let unlocked = false;
const lastAt = new Map<string, number>();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

export function unlockSfx(): void {
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  unlocked = true;
}

export function armSfxUnlock(): void {
  if (typeof window === "undefined") return;
  const once = () => {
    unlockSfx();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
}

function tone(
  ac: AudioContext,
  freq: number,
  dur: number,
  when: number,
  type: OscillatorType,
  gain: number,
): void {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start(when);
  o.stop(when + dur + 0.02);
}

function noiseBurst(ac: AudioContext, dur: number, when: number, gain: number): void {
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const g = ac.createGain();
  const f = ac.createBiquadFilter();
  src.buffer = buf;
  f.type = "lowpass";
  f.frequency.setValueAtTime(900, when);
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f);
  f.connect(g);
  g.connect(ac.destination);
  src.start(when);
  src.stop(when + dur + 0.02);
}

function trigger(name: SfxName): void {
  const ac = audio();
  if (!ac || !unlocked) return;
  if (ac.state === "suspended") void ac.resume();
  const t = ac.currentTime;
  switch (name) {
    case "play":
      tone(ac, 220, 0.05, t, "triangle", 0.09);
      tone(ac, 330, 0.04, t + 0.03, "triangle", 0.06);
      break;
    case "pass":
      tone(ac, 360, 0.08, t, "sine", 0.06);
      tone(ac, 240, 0.1, t + 0.05, "sine", 0.05);
      break;
    case "bomb":
      noiseBurst(ac, 0.18, t, 0.14);
      tone(ac, 90, 0.22, t, "sawtooth", 0.12);
      break;
    case "uno":
      tone(ac, 520, 0.07, t, "square", 0.05);
      tone(ac, 660, 0.08, t + 0.06, "square", 0.05);
      tone(ac, 784, 0.1, t + 0.12, "square", 0.05);
      break;
    case "deal":
      for (let i = 0; i < 4; i++) {
        tone(ac, 190 + i * 18, 0.035, t + i * 0.045, "triangle", 0.06);
      }
      break;
    case "draw":
      tone(ac, 260, 0.045, t, "triangle", 0.07);
      tone(ac, 200, 0.05, t + 0.03, "triangle", 0.05);
      break;
    case "chip":
      tone(ac, 1400, 0.03, t, "square", 0.035);
      tone(ac, 980, 0.05, t + 0.02, "triangle", 0.05);
      break;
    case "check":
      tone(ac, 480, 0.05, t, "sine", 0.05);
      break;
    case "fold":
      tone(ac, 280, 0.08, t, "triangle", 0.05);
      tone(ac, 160, 0.12, t + 0.05, "sine", 0.04);
      break;
    case "win":
      tone(ac, 523, 0.1, t, "triangle", 0.07);
      tone(ac, 659, 0.1, t + 0.09, "triangle", 0.07);
      tone(ac, 784, 0.16, t + 0.18, "triangle", 0.08);
      break;
    case "lose":
      tone(ac, 330, 0.12, t, "sine", 0.06);
      tone(ac, 247, 0.16, t + 0.1, "sine", 0.05);
      break;
    default:
      break;
  }
}

export function playSfx(name: SfxName, key: string = name): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const prev = lastAt.get(key) ?? 0;
  if (now - prev < 50) return;
  lastAt.set(key, now);
  trigger(name);
}
