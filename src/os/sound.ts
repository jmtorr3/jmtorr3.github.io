import { create } from 'zustand'

// CRT power on/off and mouse click sounds, synthesized with Web Audio so there are no audio files.

const KEY = 'sound-muted'
const readMuted = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const useSound = create<{ muted: boolean; toggle: () => void }>((set, get) => ({
  muted: readMuted(),
  toggle: () => {
    const muted = !get().muted
    try {
      localStorage.setItem(KEY, muted ? '1' : '0')
    } catch {
      // storage blocked; the setting just won't persist
    }
    set({ muted })
  },
}))

let ctx: AudioContext | null = null

// Call from a click/keypress: browsers only allow audio to start after a user gesture.
export function unlockAudio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

function audio() {
  if (useSound.getState().muted || !ctx || ctx.state !== 'running') return null
  return ctx
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

// gain node with an attack/decay envelope, wired to the speakers
function env(c: AudioContext, at: number, peak: number, attack: number, decay: number) {
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  g.connect(c.destination)
  return g
}

function noise(c: AudioContext, at: number, dur: number, filter: BiquadFilterType, freq: number, out: AudioNode) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, dur)
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  src.connect(f).connect(out)
  src.start(at)
  src.stop(at + dur)
}

function tone(c: AudioContext, at: number, dur: number, type: OscillatorType, from: number, to: number, out: AudioNode) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(from, at)
  o.frequency.exponentialRampToValueAtTime(to, at + dur)
  o.connect(out)
  o.start(at)
  o.stop(at + dur)
}

export function playPowerOn() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  // relay thunk
  tone(c, t, 0.25, 'sine', 90, 40, env(c, t, 0.5, 0.005, 0.22))
  noise(c, t, 0.05, 'lowpass', 1800, env(c, t, 0.25, 0.002, 0.04))
  // static as the tube warms up
  noise(c, t + 0.15, 0.6, 'bandpass', 3500, env(c, t + 0.15, 0.12, 0.05, 0.5))
  // degauss hum swell
  tone(c, t + 0.1, 0.7, 'sawtooth', 60, 55, env(c, t + 0.1, 0.05, 0.15, 0.55))
  // faint flyback whine that settles
  tone(c, t + 0.2, 1.4, 'sine', 9000, 8600, env(c, t + 0.2, 0.012, 0.1, 1.3))
}

export function playPowerOff() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  // the picture collapsing to a dot
  tone(c, t, 0.35, 'square', 1400, 60, env(c, t, 0.08, 0.005, 0.33))
  tone(c, t, 0.35, 'sine', 700, 40, env(c, t, 0.25, 0.005, 0.33))
  // switch click + discharge crackle
  noise(c, t, 0.04, 'highpass', 2000, env(c, t, 0.3, 0.001, 0.035))
  noise(c, t + 0.05, 0.3, 'bandpass', 5000, env(c, t + 0.05, 0.05, 0.01, 0.28))
}

// one short noise burst reused for every mouse click
let clickBuf: AudioBuffer | null = null

// mouse button tick: a sharp press, and a softer, higher release
export function playClick(release = false) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  clickBuf ??= noiseBuffer(c, 0.03)
  const src = c.createBufferSource()
  src.buffer = clickBuf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = release ? 4200 : 2600
  f.Q.value = 1.5
  src.connect(f).connect(env(c, t, release ? 0.12 : 0.25, 0.001, 0.025))
  src.start(t)
  tone(c, t, 0.02, 'square', release ? 1800 : 1200, 400, env(c, t, release ? 0.015 : 0.03, 0.001, 0.015))
}

// Machine spinning up before the screen comes on (plays during the zoom, ~1.4s):
// a rising "oooo" hum that opens up like a vowel, fan/drive whir, and seek ticks.
export function playSpinUp(seconds = 1.35) {
  // the context may still be resuming on the very first click; scheduling on it
  // anyway is fine, it starts playing as soon as it's running
  if (useSound.getState().muted || !ctx) return
  const c = ctx
  const t = c.currentTime
  const end = t + seconds

  const out = c.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(1, t + 0.25)
  out.gain.setValueAtTime(1, end - 0.25)
  out.gain.linearRampToValueAtTime(0, end)
  out.connect(c.destination)

  // the "oooo": two detuned voices gliding up, through a lowpass that opens
  const vowel = c.createBiquadFilter()
  vowel.type = 'lowpass'
  vowel.Q.value = 6
  vowel.frequency.setValueAtTime(250, t)
  vowel.frequency.exponentialRampToValueAtTime(1800, end)
  const hum = c.createGain()
  hum.gain.value = 0.07
  vowel.connect(hum).connect(out)

  // slight wobble, like a motor that hasn't settled
  const lfo = c.createOscillator()
  lfo.frequency.value = 7
  const depth = c.createGain()
  depth.gain.value = 6
  lfo.connect(depth)
  lfo.start(t)
  lfo.stop(end)

  for (const [type, from, to] of [
    ['triangle', 70, 330],
    ['sawtooth', 70.6, 333],
  ] as const) {
    const o = c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, end)
    depth.connect(o.frequency)
    o.connect(vowel)
    o.start(t)
    o.stop(end)
  }

  // fan / platter whir rising with it
  const whir = c.createBufferSource()
  whir.buffer = noiseBuffer(c, seconds)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 3
  bp.frequency.setValueAtTime(300, t)
  bp.frequency.exponentialRampToValueAtTime(1600, end)
  const whirGain = c.createGain()
  whirGain.gain.value = 0.05
  whir.connect(bp).connect(whirGain).connect(out)
  whir.start(t)
  whir.stop(end)

  // a few hard-drive seek ticks
  for (const at of [0.3, 0.55, 0.62, 0.9, 1.05]) {
    if (at > seconds - 0.1) continue
    noise(c, t + at, 0.02, 'highpass', 3000, env(c, t + at, 0.08, 0.001, 0.015))
  }
}

// ---- Slumpy face bleeps: tiny chiptune voices, one per expression ----

type Note = [at: number, dur: number, from: number, to: number, type?: OscillatorType, gain?: number]

function bleeps(notes: Note[]) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  for (const [at, dur, from, to, type = 'square', gain = 0.035] of notes)
    tone(c, t + at, dur, type, from, to, env(c, t + at, gain, 0.005, dur - 0.005))
}

const FACE_SOUNDS: Record<string, Note[]> = {
  // little "boot" chirp as the eyes open
  wake: [
    [0, 0.07, 520, 520],
    [0.08, 0.07, 780, 780],
    [0.16, 0.12, 1040, 1040, 'triangle', 0.05],
  ],
  // two quick rising notes
  happy: [
    [0, 0.08, 660, 700],
    [0.09, 0.12, 990, 1050],
  ],
  // a "bwip"
  wink: [[0, 0.09, 500, 1400, 'triangle', 0.05]],
  // soft heartbeat, then a sparkle
  love: [
    [0, 0.09, 330, 300, 'sine', 0.09],
    [0.13, 0.12, 330, 280, 'sine', 0.09],
    [0.32, 0.06, 1760, 1760, 'triangle', 0.025],
    [0.38, 0.08, 2350, 2350, 'triangle', 0.02],
  ],
  // slow yawn sliding down
  sleepy: [[0, 0.7, 520, 180, 'triangle', 0.05]],
  // "oh?" bending up
  surprised: [[0, 0.16, 440, 880, 'square', 0.03]],
  // "aww" two notes down
  sad: [
    [0, 0.18, 620, 560, 'triangle', 0.05],
    [0.2, 0.3, 520, 380, 'triangle', 0.05],
  ],
  // low grumble
  angry: [
    [0, 0.09, 140, 120, 'sawtooth', 0.03],
    [0.1, 0.09, 150, 120, 'sawtooth', 0.03],
    [0.2, 0.14, 130, 90, 'sawtooth', 0.03],
  ],
  // rising arpeggio with a sparkle on top
  excited: [
    [0, 0.06, 523, 523],
    [0.06, 0.06, 659, 659],
    [0.12, 0.06, 784, 784],
    [0.18, 0.12, 1047, 1047],
    [0.32, 0.06, 2093, 2093, 'triangle', 0.025],
  ],
  // "hehehe": quick bouncing notes
  laugh: [
    [0, 0.06, 880, 820],
    [0.09, 0.06, 980, 900],
    [0.18, 0.06, 880, 820],
    [0.27, 0.06, 1040, 960],
  ],
  // wailing slide down, twice
  cry: [
    [0, 0.35, 700, 450, 'triangle', 0.05],
    [0.38, 0.45, 650, 380, 'triangle', 0.05],
  ],
  // cute "uwu" wobble
  uwu: [
    [0, 0.1, 600, 800, 'triangle', 0.05],
    [0.1, 0.1, 800, 600, 'triangle', 0.05],
    [0.2, 0.14, 600, 900, 'triangle', 0.05],
  ],
  // shy little "eep"
  blush: [[0, 0.12, 1200, 1500, 'sine', 0.06]],
  // "yeah": low slide then a high glint
  cool: [
    [0, 0.25, 220, 160, 'square', 0.03],
    [0.5, 0.05, 2600, 2600, 'triangle', 0.03],
    [0.56, 0.08, 3100, 3100, 'triangle', 0.02],
  ],
  // "hmm": a low hum that bends
  thinking: [[0, 0.5, 300, 340, 'triangle', 0.05]],
  // "huh?" bending up at the end
  confused: [
    [0, 0.12, 500, 480, 'square', 0.03],
    [0.14, 0.18, 480, 760, 'square', 0.03],
  ],
  // "hmmm..." low and flat
  suspicious: [[0, 0.4, 240, 230, 'sawtooth', 0.025]],
  // a sigh sliding down
  bored: [[0, 0.6, 400, 260, 'sine', 0.06]],
  // a little tune
  music: [
    [0, 0.12, 659, 659, 'triangle', 0.05],
    [0.13, 0.12, 784, 784, 'triangle', 0.05],
    [0.26, 0.12, 880, 880, 'triangle', 0.05],
    [0.39, 0.24, 784, 784, 'triangle', 0.05],
  ],
  // big yawn: up then a long slide down
  yawn: [
    [0, 0.3, 300, 520, 'triangle', 0.05],
    [0.3, 0.8, 520, 200, 'triangle', 0.05],
  ],
  // computer blips, then a done chime
  loading: [
    [0, 0.03, 1800, 1800],
    [0.25, 0.03, 1800, 1800],
    [0.5, 0.03, 1800, 1800],
    [2.6, 0.08, 880, 880, 'triangle', 0.05],
    [2.68, 0.14, 1320, 1320, 'triangle', 0.05],
  ],
  // garbled bit-crush noise
  glitch: [
    [0, 0.04, 2000, 300],
    [0.05, 0.03, 150, 1800],
    [0.09, 0.05, 3000, 600],
    [0.16, 0.04, 400, 2400],
  ],
  // slow hypnotic wobble
  hypno: [
    [0, 0.3, 400, 600, 'sine', 0.06],
    [0.3, 0.3, 600, 400, 'sine', 0.06],
    [0.6, 0.3, 400, 600, 'sine', 0.06],
  ],
  // wobbly warble
  dizzy: [
    [0, 0.12, 700, 500, 'triangle', 0.04],
    [0.12, 0.12, 500, 760, 'triangle', 0.04],
    [0.24, 0.12, 760, 460, 'triangle', 0.04],
    [0.36, 0.16, 460, 300, 'triangle', 0.04],
  ],
}

export function playFaceSound(expr: string) {
  const notes = FACE_SOUNDS[expr]
  if (notes) bleeps(notes)
}

// Easter egg: the fan on the back. A fluttering low "pbbbt", a little different each time.
export function playFart() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const len = 0.45 + Math.random() * 0.5
  const base = 70 + Math.random() * 50

  const out = c.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(0.22, t + 0.02)
  out.gain.setValueAtTime(0.22, t + len * 0.7)
  out.gain.exponentialRampToValueAtTime(0.0001, t + len)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 700
  lp.connect(out).connect(c.destination)

  // buzzy tone sliding down, its volume fluttering quickly (the "brrr")
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(base * 1.3, t)
  o.frequency.exponentialRampToValueAtTime(base * 0.7, t + len)
  const flutter = c.createGain()
  flutter.gain.value = 0.5
  const lfo = c.createOscillator()
  lfo.type = 'square'
  lfo.frequency.setValueAtTime(28 + Math.random() * 10, t)
  lfo.frequency.linearRampToValueAtTime(18, t + len)
  const depth = c.createGain()
  depth.gain.value = 0.5
  lfo.connect(depth).connect(flutter.gain)
  o.connect(flutter).connect(lp)
  for (const n of [o, lfo]) {
    n.start(t)
    n.stop(t + len)
  }

  // breathy air through it
  noise(c, t, len, 'bandpass', 380, env(c, t, 0.12, 0.02, len - 0.02))
}

// ---- keyboard & mouse physics ----

// picked up: a light plastic lift
export function playPickup() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  noise(c, t, 0.03, 'highpass', 2500, env(c, t, 0.12, 0.001, 0.025))
  tone(c, t + 0.01, 0.06, 'triangle', 500, 900, env(c, t + 0.01, 0.04, 0.005, 0.05))
}

// hit the desk; strength ~ impact speed. The keyboard thuds and its keys rattle,
// the mouse just taps.
export function playLand(kind: 'keyboard' | 'mouse', speed: number) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const g = Math.min(1, speed / 3)
  if (kind === 'keyboard') {
    tone(c, t, 0.14, 'sine', 130, 55, env(c, t, 0.35 * g, 0.003, 0.13))
    noise(c, t, 0.05, 'lowpass', 900, env(c, t, 0.2 * g, 0.002, 0.045))
    // keys rattling
    for (let i = 0; i < 5; i++) {
      const at = t + 0.015 + Math.random() * 0.09
      noise(c, at, 0.012, 'bandpass', 3000 + Math.random() * 2000, env(c, at, 0.1 * g, 0.001, 0.01))
    }
  } else {
    tone(c, t, 0.07, 'sine', 260, 120, env(c, t, 0.25 * g, 0.002, 0.065))
    noise(c, t, 0.02, 'highpass', 2000, env(c, t, 0.12 * g, 0.001, 0.018))
  }
}

// the keyboard or mouse poofing away (a soft whoosh down) or back (a pop up)
export function playPoof(phase: 'vanish' | 'appear') {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  if (phase === 'vanish') {
    noise(c, t, 0.22, 'bandpass', 1800, env(c, t, 0.14, 0.01, 0.2))
    tone(c, t, 0.16, 'sine', 700, 220, env(c, t, 0.08, 0.005, 0.15))
  } else {
    noise(c, t, 0.12, 'highpass', 2500, env(c, t, 0.08, 0.005, 0.1))
    tone(c, t, 0.09, 'sine', 300, 900, env(c, t, 0.12, 0.003, 0.08))
  }
}

// knocked into the PC: a hollow plastic knock
export function playBump(speed: number) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const g = Math.min(1, speed / 3)
  tone(c, t, 0.1, 'triangle', 190, 120, env(c, t, 0.3 * g, 0.002, 0.095))
  noise(c, t, 0.04, 'lowpass', 1200, env(c, t, 0.15 * g, 0.001, 0.035))
}

// Slumpy bouncing off the edge of the Konsole after a fling; strength 0..1
export function playBoing(strength: number) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const g = Math.max(0.15, Math.min(1, strength))
  tone(c, t, 0.16, 'sine', 260, 620, env(c, t, 0.12 * g, 0.004, 0.15))
  tone(c, t, 0.12, 'triangle', 520, 1100, env(c, t, 0.03 * g, 0.004, 0.11))
}

// login: a soft key tick while the password types itself, and a little chime
export function playKeyTick() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  noise(c, t, 0.015, 'bandpass', 3500 + Math.random() * 1500, env(c, t, 0.06, 0.001, 0.012))
}

export function playLoginChime() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  // a rising major arpeggio over a soft pad
  ;[523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, 0.5, 'triangle', f, f, env(c, t + i * 0.09, 0.06, 0.01, 0.48)))
  tone(c, t, 0.9, 'sine', 262, 262, env(c, t, 0.05, 0.15, 0.75))
}
