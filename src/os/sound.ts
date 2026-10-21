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

// Slumpy's screen switching on, timed to its flash (SlumpyFace's crtOn, 0.55s):
// a relay thunk on the dot, a rising zip as the line stretches out, a whump as
// the picture opens up, static fizzing away with the dither, the flyback settling
export function playCrtOn() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(c, t, 0.2, 'sine', 95, 40, env(c, t, 0.45, 0.004, 0.18))
  noise(c, t, 0.04, 'lowpass', 1800, env(c, t, 0.22, 0.002, 0.035))
  tone(c, t + 0.08, 0.14, 'sawtooth', 260, 2400, env(c, t + 0.08, 0.025, 0.02, 0.12))
  noise(c, t + 0.08, 0.14, 'highpass', 3000, env(c, t + 0.08, 0.05, 0.1, 0.04))
  tone(c, t + 0.22, 0.3, 'sine', 120, 55, env(c, t + 0.22, 0.3, 0.008, 0.28))
  noise(c, t + 0.22, 0.12, 'lowpass', 700, env(c, t + 0.22, 0.25, 0.005, 0.11))
  noise(c, t + 0.3, 0.3, 'bandpass', 4200, env(c, t + 0.3, 0.07, 0.01, 0.29))
  tone(c, t + 0.3, 1.2, 'sine', 9000, 8600, env(c, t + 0.3, 0.01, 0.1, 1.1))
}

// and off (crtOff, 0.5s): the picture squeezing down with a falling zap, the line
// pulling in, a last tick as the dot goes
export function playCrtOff() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(c, t, 0.18, 'square', 1500, 300, env(c, t, 0.06, 0.005, 0.17))
  noise(c, t, 0.05, 'highpass', 2200, env(c, t, 0.2, 0.001, 0.045))
  tone(c, t + 0.17, 0.18, 'sine', 900, 60, env(c, t + 0.17, 0.2, 0.005, 0.17))
  noise(c, t + 0.36, 0.12, 'bandpass', 5000, env(c, t + 0.36, 0.05, 0.01, 0.1))
}

// the brain buddy's little footsteps (soft, a bit different each time)
export function playStep() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  noise(c, t, 0.03, 'lowpass', 700 + Math.random() * 500, env(c, t, 0.05, 0.002, 0.025))
  tone(c, t, 0.03, 'sine', 160 + Math.random() * 40, 110, env(c, t, 0.025, 0.002, 0.025))
}

// Chiba (the desktop's Shiba) barking: a quick little "wuf"
export function playBark() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  for (const [at, f] of [[0, 520], [0.16, 600]]) {
    tone(c, t + at, 0.09, 'sawtooth', f, f * 0.55, env(c, t + at, 0.05, 0.004, 0.085))
    noise(c, t + at, 0.06, 'bandpass', 900, env(c, t + at, 0.12, 0.003, 0.055))
  }
}

// Hanzo (the desktop's mouse) squeaking
export function playSqueak() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(c, t, 0.07, 'sine', 2600, 3600, env(c, t, 0.05, 0.004, 0.065))
  tone(c, t + 0.09, 0.06, 'sine', 2900, 3900, env(c, t + 0.09, 0.04, 0.004, 0.055))
}

// a USB device plugged in (a rising two-note chime) or pulled out (falling)
export function playUsb(plugged: boolean) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const [a, b] = plugged ? [660, 990] : [990, 660]
  tone(c, t, 0.12, 'triangle', a, a, env(c, t, 0.12, 0.005, 0.11))
  tone(c, t + 0.12, 0.18, 'triangle', b, b, env(c, t + 0.12, 0.12, 0.005, 0.17))
  noise(c, t, 0.03, 'highpass', 3000, env(c, t, 0.15, 0.001, 0.025)) // the click of the plug
}

// The brain's cable carrying its data into the PC: a low electric hum with a
// crackle running through it, louder and higher as the cable's strained (strain
// 0..1, a tug on the brain). Call it every frame; level 0 (or muted) fades it out.
let hum: { gain: GainNode; buzz: OscillatorNode; whine: OscillatorNode; crackle: GainNode; src: AudioBufferSourceNode } | null = null
export function setBrainHum(level: number, strain = 0) {
  const c = audio()
  if (!c || level <= 0) {
    if (hum && ctx) {
      const h = hum
      hum = null
      h.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06)
      setTimeout(() => [h.buzz, h.whine, h.src].forEach((n) => n.stop()), 400)
    }
    return
  }
  if (!hum) {
    const gain = c.createGain()
    gain.gain.value = 0
    gain.connect(c.destination)
    // the mains buzz, mellowed
    const buzz = c.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.value = 60
    const low = c.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 380
    buzz.connect(low).connect(gain)
    // a thin whine on top
    const whine = c.createOscillator()
    whine.type = 'sine'
    whine.frequency.value = 2400
    const whineGain = c.createGain()
    whineGain.gain.value = 0.06
    whine.connect(whineGain).connect(gain)
    // and crackle, flickering
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, 2)
    src.loop = true
    const band = c.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 3200
    const crackle = c.createGain()
    crackle.gain.value = 0
    src.connect(band).connect(crackle).connect(gain)
    buzz.start()
    whine.start()
    src.start()
    hum = { gain, buzz, whine, crackle, src }
  }
  const t = c.currentTime
  hum.gain.gain.setTargetAtTime(0.03 * level * (1 + strain * 1.5), t, 0.08)
  hum.buzz.frequency.setTargetAtTime(60 * (1 + strain * 0.8), t, 0.05)
  hum.whine.frequency.setTargetAtTime(2400 * (1 + strain * 0.5), t, 0.05)
  hum.crackle.gain.setTargetAtTime(Math.random() < 0.08 + strain * 0.3 ? 0.9 : 0.12, t, 0.01)
}

// a little zap: data arriving in the PC, or the cable's loose end sparking (strength 0..1)
export function playZap(strength = 0.4) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const f = 2000 + Math.random() * 3000
  noise(c, t, 0.035, 'highpass', f, env(c, t, 0.12 * strength, 0.001, 0.03))
  tone(c, t, 0.05, 'square', f * 0.4, f * 0.1, env(c, t, 0.025 * strength, 0.001, 0.045))
}

// the brain's magnetic plugs: snapping together (a rising zip and a clack), or
// pulled apart (a spark and a falling zap)
export function playMagnet(connect: boolean) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  if (connect) {
    tone(c, t, 0.08, 'sawtooth', 400, 1400, env(c, t, 0.04, 0.01, 0.07))
    noise(c, t + 0.07, 0.04, 'bandpass', 2600, env(c, t + 0.07, 0.35, 0.001, 0.035))
    tone(c, t + 0.07, 0.08, 'square', 220, 160, env(c, t + 0.07, 0.08, 0.002, 0.07))
  } else {
    noise(c, t, 0.12, 'highpass', 4000, env(c, t, 0.3, 0.001, 0.11))
    tone(c, t, 0.22, 'sawtooth', 1800, 120, env(c, t, 0.08, 0.003, 0.2))
  }
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
  // a triumphant little fanfare
  yes: [
    [0, 0.08, 523, 523, 'square', 0.04],
    [0.09, 0.08, 659, 659, 'square', 0.04],
    [0.18, 0.08, 784, 784, 'square', 0.04],
    [0.27, 0.22, 1047, 1047, 'square', 0.05],
  ],
  // a frantic little alarm
  panic: [
    [0, 0.07, 1250, 1250, 'square', 0.03],
    [0.09, 0.07, 940, 940, 'square', 0.03],
    [0.18, 0.07, 1250, 1250, 'square', 0.03],
    [0.27, 0.07, 940, 940, 'square', 0.03],
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

// being petted: a little rumbling purr, in and out like breathing
export function playPurr() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  for (let i = 0; i < 4; i++) {
    const at = t + i * 0.3
    noise(c, at, 0.24, 'lowpass', 220, env(c, at, 0.22, 0.05, 0.18))
    tone(c, at, 0.24, 'sawtooth', 48, 42, env(c, at, 0.05, 0.05, 0.18))
  }
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

// typing on Chiba: a plasticky clack per key, a deeper thock for the big keys
// (space, enter), with a little randomness so fast typing doesn't sound looped
export function playKeyClack(key: 'key' | 'space' | 'enter' | 'back' = 'key') {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const r = () => 0.85 + Math.random() * 0.3
  const big = key === 'space' || key === 'enter'
  // the click of the switch
  noise(c, t, 0.018, 'bandpass', (big ? 2200 : 3200) * r(), env(c, t, (big ? 0.09 : 0.07) * r(), 0.001, 0.016))
  // the keycap bottoming out
  tone(c, t, big ? 0.06 : 0.035, 'sine', (big ? 150 : key === 'back' ? 260 : 210) * r(), big ? 70 : 110, env(c, t, big ? 0.12 : 0.07, 0.002, big ? 0.055 : 0.03))
  // the spacebar's stabilizer rattles a bit
  if (key === 'space') noise(c, t + 0.012, 0.025, 'bandpass', 1200, env(c, t + 0.012, 0.03, 0.002, 0.02))
}

export function playLoginChime() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  // a rising major arpeggio over a soft pad
  ;[523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, 0.5, 'triangle', f, f, env(c, t + i * 0.09, 0.06, 0.01, 0.48)))
  tone(c, t, 0.9, 'sine', 262, 262, env(c, t, 0.05, 0.15, 0.75))
}

// Slumpy talking, Animal Crossing style ("animalese"), in a small cute voice:
// every letter is a quick high chirp that bounces upward, a soft round tone
// plus a little vowel color (two formants; consonants borrow the next vowel's,
// with a tiny click or hiss in front). The phrase sings up at the end and the
// last letter is held a bit, like "hellooo~". Returns false if sound can't
// play yet (no tap or key so far).
const FORMANTS: Record<string, [number, number]> = {
  a: [800, 1200],
  e: [500, 1900],
  i: [320, 2300],
  o: [500, 850],
  u: [350, 750],
  y: [320, 2300],
}
const PLOSIVES = 'bdgkpt'
const HISSES = 'cfhjsxz'
const VOICE = 640 // Hz: high and small
const STEP = 0.07 // seconds per letter

export function speak(text: string, pitch = 1) {
  const c = audio()
  if (!c) return false
  const letters = [...text.toLowerCase()]
  const spoken = letters.filter((ch) => /[a-z]/.test(ch)).length
  let t = c.currentTime + 0.03
  let n = 0
  letters.forEach((ch, i) => {
    if (ch === ' ') return void (t += STEP * 0.7)
    if (!/[a-z]/.test(ch)) return
    const vowel = letters.slice(i).find((x) => x in FORMANTS) ?? 'a'
    const [f1, f2] = FORMANTS[ch] ?? FORMANTS[vowel]
    const k = n / Math.max(1, spoken - 1)
    const last = ++n === spoken
    const len = last ? STEP * 1.8 : STEP
    // each letter its own note, wobbling around the voice, singing up at the end
    const f0 = VOICE * pitch * (1 + (((ch.charCodeAt(0) * 7) % 5) - 2) * 0.05) * (1 + 0.45 * k * k)

    const out = c.createGain()
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(0.18, t + 0.01)
    out.gain.setValueAtTime(0.18, t + len * 0.55)
    out.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.97)
    out.connect(c.destination)
    const voice = (type: OscillatorType, into: AudioNode) => {
      const o = c.createOscillator()
      o.type = type
      // the bounce: each chirp starts low and springs up onto the note
      o.frequency.setValueAtTime(f0 * 0.86, t)
      o.frequency.exponentialRampToValueAtTime(f0 * 1.04, t + 0.045)
      o.frequency.exponentialRampToValueAtTime(f0, t + len)
      o.connect(into)
      o.start(t)
      o.stop(t + len)
      return o
    }
    // soft round body
    const body = c.createGain()
    body.gain.value = 0.55
    body.connect(out)
    const tri = voice('triangle', body)
    // a held last letter gets a little wobble
    if (last) {
      const lfo = c.createOscillator()
      lfo.frequency.value = 9
      const depth = c.createGain()
      depth.gain.value = 25 // cents
      lfo.connect(depth).connect(tri.detune)
      lfo.start(t)
      lfo.stop(t + len)
    }
    // vowel color
    for (const [f, q, g] of [[f1, 5, 1], [f2, 7, 0.5]] as const) {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f
      bp.Q.value = q
      const lvl = c.createGain()
      lvl.gain.value = g * 1.2
      bp.connect(lvl).connect(out)
      voice('sawtooth', bp)
    }
    if (PLOSIVES.includes(ch)) noise(c, t, 0.012, 'highpass', 2500, env(c, t, 0.07, 0.001, 0.011))
    else if (HISSES.includes(ch)) noise(c, t, 0.03, 'highpass', 4500, env(c, t, 0.04, 0.004, 0.026))
    t += len
  })
  return true
}

// speak() right after a tap: the browser may still be switching sound on from
// that same tap, so wait a moment for it rather than staying quiet
export function speakSoon(text: string, pitch = 1) {
  if (speak(text, pitch) || !ctx || useSound.getState().muted) return
  const asked = performance.now()
  void ctx.resume().then(() => {
    if (performance.now() - asked < 500) speak(text, pitch)
  })
}
