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
