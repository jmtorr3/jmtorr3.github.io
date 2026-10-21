import * as THREE from 'three'
import { isHalloween, isLateNight } from '../os/occasion'

// A Dasai Mochi style face for the monitor while the PC is off: white pixels on
// black, like the little OLED. Drawn on a 1-bit grid so every pixel stays crisp,
// then uploaded to a CanvasTexture that the screen material samples.

export const FACE_W = 100
export const FACE_H = 80 // the monitor's screen is 5:4

export type Expression =
  | 'neutral'
  | 'happy'
  | 'sleepy'
  | 'asleep' // eyes shut, z's: before he wakes up after the loading screen
  | 'surprised'
  | 'love'
  | 'angry'
  | 'sad'
  | 'wink'
  | 'dizzy'
  | 'excited'
  | 'laugh'
  | 'cry'
  | 'uwu'
  | 'blush'
  | 'cool'
  | 'thinking'
  | 'confused'
  | 'suspicious'
  | 'bored'
  | 'music'
  | 'yawn'
  | 'loading'
  | 'yes' // the whole screen a big bouncing YES!!! ("are you alive?")
  | 'starfield' // the screensaver: stars flying out of the middle (left alone in the room)
  | 'prompt' // a command line showing what's being typed (see typed), when you type at him in the room
  | 'boot' // a Linux boot log scrolling by (see bootLog), when he's turned on
  | 'glitch'
  | 'panic' // wide eyes darting around, sweating, teeth chattering, shaking (`rm -rf /*`)
  | 'hypno'
  | 'off'

// random moods while idling, with how often each comes up
const IDLE_MOODS: [Expression, number][] = [
  ['happy', 3],
  ['wink', 2],
  ['love', 2],
  ['uwu', 2],
  ['music', 2],
  ['thinking', 2],
  ['excited', 2],
  ['laugh', 2],
  ['blush', 2],
  ['cool', 2],
  ['sleepy', 2],
  ['yawn', 1],
  ['bored', 1],
  ['suspicious', 1],
  ['confused', 1],
  ['surprised', 1],
  ['sad', 1],
  ['cry', 1],
  ['angry', 1],
  ['dizzy', 1],
  ['loading', 1],
  ['glitch', 1],
  ['hypno', 1],
]

// moods that play out over time get a fixed length (seconds) instead of a random one
const MOOD_LENGTH: Partial<Record<Expression, number>> = { loading: 3.4, yawn: 2.4, cool: 3.6, thinking: 3.2 }

const EYE_W = 16
const EYE_H = 24
const EYE_GAP = 20 // eye center distance from the middle
const BLINK = 0.14 // seconds to close (and again to open)

const HEART = [
  '.##...##.',
  '####.####',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '....#....',
]

const STAR = [
  '....#....',
  '...###...',
  '...###...',
  '#########',
  '.#######.',
  '..#####..',
  '.###.###.',
  '.##...##.',
  '##.....##',
]

// laughing eyes: > for the left eye, < for the right
const CHEVRON = ['##.....', '.###...', '...###.', '.....##', '...###.', '.###...', '##.....']

const QUESTION = ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..', '..##..']

const NOTE = ['..##..', '..#.#.', '..#..#', '..#...', '###...', '###...', '.#....']

const Z = ['#####', '...#.', '..#..', '.#...', '#####']

const SMILE = ['#........#', '##......##', '.########.', '..######..']
const FROWN = [...SMILE].reverse()

const SMIRK = ['.......##', '#.....##.', '.######..']

const UWU = ['#...#...#', '#..#.#..#', '.##...##.']

const WAVY = ['.##...##..', '#..#.#..#.', '....#....#']

// a 3×5 pixel font for the boot log (rows of 3, top to bottom; lowercase draws as uppercase)
const FONT: Record<string, string> = {
  A: '.#.#.#####.##.#',
  B: '##.#.###.#.###.',
  C: '.###..#..#...##',
  D: '##.#.##.##.###.',
  E: '####..##.#..###',
  F: '####..##.#..#..',
  G: '.###..#.##.#.##',
  H: '#.##.#####.##.#',
  I: '###.#..#..#.###',
  J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#',
  L: '#..#..#..#..###',
  M: '#.########.##.#',
  N: '##.#.##.##.##.#',
  O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..',
  Q: '.#.#.##.###..##',
  R: '##.#.###.#.##.#',
  S: '.###...#...###.',
  T: '###.#..#..#..#.',
  U: '#.##.##.##.####',
  V: '#.##.##.##.#.#.',
  W: '#.##.########.#',
  X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###',
  0: '####.##.##.####',
  1: '.#.##..#..#.###',
  2: '##...#.#.#..###',
  3: '##...#.#...###.',
  4: '#.##.####..#..#',
  5: '####..##...###.',
  6: '.###..####.####',
  7: '###..#.#..#..#.',
  8: '####.#####.####',
  9: '####.####..###.',
  '[': '##.#..#..#..##.',
  ']': '.##..#..#..#.##',
  '.': '.............#.',
  '/': '..#..#.#.#..#..',
  '-': '......###......',
  ':': '....#.....#....',
  '(': '.#.#..#..#...#.',
  ')': '.#...#..#..#.#.',
  '_': '............###',
  '!': '.#..#..#.....#.',
  '?': '##...#.#.....#.',
  ',': '.........#.#...',
  "'": '.#..#..........',
  '"': '#.##.#.........',
  '>': '#...#...#.#.#..',
  '<': '..#.#.#...#...#',
  '$': '.####..#..####.',
  '@': '####.#####...##',
  '=': '...###...###...',
  '+': '....#.###.#....',
  '*': '#.#.#.#.#......',
  '#': '#.#####.#####.#',
  '^': '.#.#.#.........',
}
const CHAR_W = 4 // 3px glyph + 1px gap
// the CRT switching on before the boot log starts (seconds): a dot, a line, the
// whole screen lit up, then it fades out through a dither
const CRT_ON = 0.55
// and switching off: the picture squeezes to a line, the line to a dot, the dot fades
export const CRT_OFF = 0.5
// ordered-dither thresholds (4×4 Bayer), for fading in 1-bit
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const LINE_H = 6

const MOUTH_O = ['.###.', '#...#', '#...#', '#...#', '.###.']

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(''))

// late at night (the visitor's time) he's sleepy and yawns a lot more
const NIGHT_MOODS = new Set<Expression>(['sleepy', 'yawn', 'bored'])

function pickMood(): Expression {
  const night = isLateNight()
  const moods = IDLE_MOODS.map(([m, w]): [Expression, number] => [m, night && NIGHT_MOODS.has(m) ? w * 5 : w])
  let r = Math.random() * moods.reduce((s, [, w]) => s + w, 0)
  for (const [m, w] of moods) if ((r -= w) < 0) return m
  return 'happy'
}

// Halloween: his plain face is a jack-o'-lantern
const PUMPKIN_EYE = ['....#....', '...###...', '..#####..', '.#######.', '#########']
const PUMPKIN_GRIN = [
  '#.................#',
  '##..#...#...#....##',
  '.###.###.###.#####.',
  '..####.###.###.##..',
  '....###...###......',
]

export class SlumpyFace {
  readonly texture: THREE.CanvasTexture
  readonly canvas: HTMLCanvasElement
  // called when a new expression appears ('wake' when the eyes first open), for sounds
  onChange?: (expr: Expression | 'wake') => void
  // the tube starting to switch on (its flash, or the boot log's) or off, for its sound
  onCrt?: (kind: 'on' | 'off') => void
  private ctx: CanvasRenderingContext2D
  private img: ImageData
  private px = new Uint8Array(FACE_W * FACE_H)

  private shown: Expression = 'off'
  private next: Expression = 'off'
  private override: Expression | null = 'off' // starts blank; set(null) wakes it
  private moodUntil = 0
  private nextMoodAt = rand(3, 6)
  // eyes: open amount (0..1) and look offset easing toward a target
  private open = 0
  private closing = false
  private nextBlinkAt = rand(1, 3)
  private doubleBlink = false
  private blinksLeft = 0 // queued by blink()
  private look = { x: 0, y: 0 }
  private lookTarget = { x: 0, y: 0 }
  private nextLookAt = 1
  // Mochi-style squish: the eyes squash wide and short for a moment
  private squish = 0
  private nextSquishAt = rand(4, 9)
  private t = 0
  private shownAt = 0 // when the current expression appeared, for ones that play out
  private reactUntil = 0 // a reaction is showing until then (react())
  private watchUntil = 0 // keeping an eye on something until then (watch())
  // the part of the canvas that's actually on screen (see setView)
  private view = { scale: 1, x: FACE_W / 2, y: FACE_H / 2 }
  private copy = new Uint8Array(FACE_W * FACE_H)
  private idle: boolean
  // the tube switching on (before the face appears) or off (before the screen goes black)
  private crt: { kind: 'on' | 'off'; at: number } | null = null
  private halloween = isHalloween()
  // what 'boot' prints: each line shows up `at` seconds in
  bootLog: { at: number; text: string }[] = []
  // what 'prompt' shows after its "> "
  typed = ''
  private transparent: boolean

  // idle: cycle through random moods by itself (off when something else drives it)
  // transparent: no black screen behind the face, just a dark outline, for
  // floating it over other things (the Konsole)
  constructor({ idle = true, transparent = false } = {}) {
    this.idle = idle
    this.transparent = transparent
    const canvas = document.createElement('canvas')
    this.canvas = canvas
    canvas.width = FACE_W
    canvas.height = FACE_H
    this.ctx = canvas.getContext('2d')!
    this.img = this.ctx.createImageData(FACE_W, FACE_H)
    this.texture = new THREE.CanvasTexture(canvas)
    this.texture.magFilter = THREE.NearestFilter
    this.texture.minFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false
    this.texture.colorSpace = THREE.NoColorSpace
    this.render()
  }

  // Force an expression (hover, zooming), or null to go back to idling.
  // 'off' blanks the screen at once, for when the desktop takes over.
  // gentle: don't cut a reaction short; the new expression shows once it's over
  set(expr: Expression | null, gentle = false) {
    if (expr === this.override) return
    this.override = expr
    if (gentle && this.reactUntil) return
    this.reactUntil = 0
    // a switch-off that didn't get to finish (the canvas stopped drawing): it's off now
    if (this.crt?.kind === 'off') {
      this.crt = null
      this.shown = this.next = 'off'
    }
    if (expr === 'off') {
      this.shown = this.next = 'off'
      this.open = 0
      this.render()
    } else if (this.shown === 'off') {
      // waking up: the tube flashes on, then the eyes open from closed (the boot
      // log does its own flash; copies over other things have no tube to flash)
      this.shown = this.next = expr ?? 'neutral'
      this.shownAt = this.t
      this.onChange?.('wake')
      this.open = 0
      this.closing = false
      if (!this.transparent) {
        if (expr !== 'boot') this.crt = { kind: 'on', at: this.t }
        this.onCrt?.('on')
      }
    } else {
      this.change(expr ?? 'neutral')
    }
  }

  // Switch off like an old tube (the power button): the picture collapses, then black.
  powerDown() {
    if (this.shown === 'off' || this.crt?.kind === 'off') return
    this.override = 'off'
    this.reactUntil = 0
    this.crt = { kind: 'off', at: this.t }
    this.onCrt?.('off')
  }

  // Show an expression for a while, then go back to resting.
  react(expr: Expression, seconds = 1.8) {
    if (this.shown === 'off') return
    this.reactUntil = this.t + seconds
    this.change(expr)
  }

  // Look toward an offset (eye px) and hold it before glancing around again.
  glance(x: number, y: number, hold = 1.2) {
    this.lookTarget = { x, y }
    this.nextLookAt = this.t + hold
  }

  // Keep an eye on something moving (call every frame while it moves): look
  // toward it, and drop the idle moods so the eyes are the plain ones that can
  // actually look around. Reactions and set() expressions still take priority.
  watch(x: number, y: number) {
    this.glance(x, y, 0.4)
    this.watchUntil = this.t + 0.6
    if (!this.override && !this.reactUntil && this.next !== 'neutral') this.change('neutral')
  }

  // When the camera is so close that only part of the screen is visible (zooming
  // in on a phone), shrink the face by `scale` and center it on canvas point (x, y)
  // so it stays in view instead of being cropped.
  setView(scale: number, x: number, y: number) {
    this.view = { scale, x, y }
  }

  // Blink now, `times` times in a row (arriving somewhere, waking up a bit).
  blink(times = 1) {
    if (this.shown === 'off') return
    this.blinksLeft = times
    this.doubleBlink = false
    this.closing = true
  }

  // A little squish, like it was poked.
  poke() {
    if (this.shown === 'neutral') this.squish = 1
  }

  private change(expr: Expression) {
    if (expr === this.next) return
    this.next = expr
    this.closing = true // swap at the bottom of a blink
  }

  private get since() {
    return this.t - this.shownAt
  }

  update(dt: number) {
    if (this.shown === 'off' && this.next === 'off') return
    this.t += dt

    // the tube switching on or off: nothing else happens until it's done
    if (this.crt) {
      const k = (this.t - this.crt.at) / (this.crt.kind === 'on' ? CRT_ON : CRT_OFF)
      if (k < 1) return this.render()
      const off = this.crt.kind === 'off'
      this.crt = null
      this.open = 0 // (the eyes open once the picture's up)
      if (off) {
        this.shown = this.next = 'off'
        return this.render() // black
      }
    }

    if (this.reactUntil && this.t > this.reactUntil) {
      this.reactUntil = 0
      this.change(this.override ?? 'neutral')
    }

    // idle mood cycle
    if (this.idle && !this.override && !this.reactUntil && this.t > this.watchUntil) {
      if (this.next !== 'neutral' && this.t > this.moodUntil) this.change('neutral')
      if (this.next === 'neutral' && this.t > this.nextMoodAt) {
        const mood = pickMood()
        this.change(mood)
        this.moodUntil = this.t + (MOOD_LENGTH[mood] ?? rand(2.2, 3.5))
        this.nextMoodAt = this.moodUntil + rand(2.5, 5)
      }
    }

    // blinks (sometimes two in a row)
    if (!this.closing && this.open >= 1 && this.t > this.nextBlinkAt) this.closing = true
    if (this.closing) {
      this.open -= dt / BLINK
      if (this.open <= 0) {
        this.open = 0
        this.closing = false
        if (this.shown !== this.next) {
          this.onChange?.(this.next)
          this.shown = this.next
          this.shownAt = this.t
        }
        if (this.blinksLeft > 0) {
          // the queued ones, then a normal pause
          this.blinksLeft--
          this.nextBlinkAt = this.t + (this.blinksLeft ? 0.18 : rand(2, 5))
        } else if (this.doubleBlink) {
          this.doubleBlink = false
          this.nextBlinkAt = this.t + 0.22
        } else {
          this.doubleBlink = Math.random() < 0.2
          this.nextBlinkAt = this.t + (this.doubleBlink ? 0.2 : rand(2, 5))
        }
      }
    } else if (this.open < 1) {
      this.open = Math.min(1, this.open + dt / BLINK)
    }

    // squish now and then while resting
    if (this.shown === 'neutral' && this.t > this.nextSquishAt) {
      this.squish = 1
      this.nextSquishAt = this.t + rand(5, 10)
    }
    this.squish = Math.max(0, this.squish - dt * 3)

    // glance around now and then
    if (this.t > this.nextLookAt) {
      const centered = Math.random() < 0.4
      this.lookTarget = centered ? { x: 0, y: 0 } : { x: Math.round(rand(-10, 10)), y: Math.round(rand(-5, 5)) }
      this.nextLookAt = this.t + rand(1, 3)
    }
    const k = 1 - Math.exp(-dt * 12)
    this.look.x += (this.lookTarget.x - this.look.x) * k
    this.look.y += (this.lookTarget.y - this.look.y) * k

    this.render()
  }

  // ---- drawing on the 1-bit grid ----

  private dot(x: number, y: number, on = 1) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < FACE_W && y < FACE_H) this.px[y * FACE_W + x] = on
  }

  private rect(x: number, y: number, w: number, h: number, on = 1) {
    for (let j = Math.round(y); j < Math.round(y + h); j++)
      for (let i = Math.round(x); i < Math.round(x + w); i++) this.dot(i, j, on)
  }

  // rounded rect centered on (cx, cy); corners cut as a pixel circle
  private pill(cx: number, cy: number, w: number, h: number, r: number, on = 1) {
    w = Math.round(w)
    h = Math.round(h)
    const x0 = Math.round(cx - w / 2)
    const y0 = Math.round(cy - h / 2)
    r = Math.min(r, Math.floor(w / 2), Math.floor(h / 2))
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const dx = i < r ? r - i - 0.5 : i >= w - r ? i - (w - r) + 0.5 : 0
        const dy = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : 0
        if (dx * dx + dy * dy <= r * r) this.dot(x0 + i, y0 + j, on)
      }
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number, on = 1, onlyTop = false) {
    for (let j = -ry; j <= ry; j++) {
      if (onlyTop && j > 0) break
      for (let i = -rx; i <= rx; i++)
        if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) this.dot(cx + i, cy + j, on)
    }
  }

  // "^" eye: the top half of a thick ring
  private arc(cx: number, cy: number) {
    this.ellipse(cx, cy + 4, 9, 9, 1, true)
    this.ellipse(cx, cy + 4, 5, 5, 0, true)
    this.rect(cx - 9, cy + 5, 19, 6, 0)
  }

  private bitmap(rows: string[], cx: number, cy: number, scale: number) {
    const w = rows[0].length * scale
    const h = rows.length * scale
    rows.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c === '#') this.rect(cx - w / 2 + i * scale, cy - h / 2 + j * scale, scale, scale)
      }),
    )
  }

  // clear everything above a line through (x0,y0)-(x1,y1): slanted brows
  private cutAbove(x0: number, y0: number, x1: number, y1: number, left: number, right: number) {
    for (let x = Math.round(left); x <= right; x++) {
      const yl = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
      for (let y = 0; y < yl; y++) this.dot(x, y, 0)
    }
  }

  // eyes that aren't plain pills just shut to a line while blinking
  private shut(cx: number, cy: number) {
    this.rect(cx - 8, cy, 16, 2)
  }

  private eye(expr: Expression, side: -1 | 1, cx: number, cy: number) {
    // closing squashes the eye to a line (shapes like ^ and hearts just shrink)
    const h = Math.max(2, Math.round(EYE_H * this.open))
    const closed = this.open < 0.5
    switch (expr) {
      case 'happy':
      case 'uwu':
      case 'blush':
      case 'music':
        return closed ? this.shut(cx, cy) : this.arc(cx, cy)
      case 'wink':
        if (side === 1) return this.arc(cx, cy)
        return this.pill(cx, cy, EYE_W, h, 6)
      case 'love': {
        const beat = Math.sin(this.t * 10) > 0.6 ? 1 : 0
        return closed ? this.shut(cx, cy) : this.bitmap(HEART, cx, cy, 2 + beat)
      }
      case 'excited': {
        if (closed) return this.shut(cx, cy)
        // stars that twinkle between two sizes
        return this.bitmap(STAR, cx, cy, Math.sin(this.t * 12 + side) > 0 ? 2 : 1.75)
      }
      case 'laugh':
        return closed ? this.shut(cx, cy) : this.bitmap(side === -1 ? CHEVRON : mirror(CHEVRON), cx, cy, 2)
      case 'asleep':
        return this.shut(cx, cy + 4)
      case 'sleepy':
        // heavy lids: only the bottom of the eye shows
        return this.pill(cx, cy + 6, EYE_W, Math.max(2, Math.round(9 * this.open)), 3)
      case 'bored': {
        // half-lidded, flat on top
        this.pill(cx, cy + 3, EYE_W, Math.max(2, Math.round(14 * this.open)), 5)
        return this.rect(cx - 9, cy - 8, 18, 6, 0)
      }
      case 'suspicious':
        return this.pill(cx, cy + 2, EYE_W + 2, Math.max(2, Math.round(7 * this.open)), 3)
      case 'surprised':
        return this.pill(cx, cy - 2, EYE_W + 4, Math.max(2, Math.round((EYE_H + 4) * this.open)), 9)
      case 'panic': {
        // wide open and hollow, with tiny pupils darting around (both the same way)
        this.pill(cx, cy - 2, EYE_W + 6, EYE_H + 6, 10)
        this.pill(cx, cy - 2, EYE_W + 1, EYE_H + 1, 8, 0)
        const dart = Math.floor(this.t * 7)
        const px = [-4, 3, -1, 4, -3, 1][dart % 6]
        const py = [-2, 1, 2, -3, 0, -1][(dart * 5) % 6]
        return this.rect(cx + px - 2, cy - 2 + py - 2, 4, 5)
      }
      case 'confused':
        // one eye wide, the other squinting
        return side === -1
          ? this.pill(cx, cy - 1, EYE_W + 2, Math.max(2, Math.round((EYE_H + 2) * this.open)), 8)
          : this.pill(cx, cy + 2, EYE_W - 4, Math.max(2, Math.round(12 * this.open)), 4)
      case 'thinking':
        // looking up and off to the side
        return this.pill(cx + 4, cy - 5, EYE_W - 2, Math.max(2, Math.round((EYE_H - 4) * this.open)), 6)
      case 'cool':
        return // the sunglasses cover the eyes (drawn in extras)
      case 'yawn':
        return this.rect(cx - 8, cy + 2, 16, 2) // squeezed shut
      case 'loading':
        return // the progress bar replaces the eyes (drawn in extras)
      case 'hypno': {
        if (closed) return this.shut(cx, cy)
        // spinning spiral
        const spin = this.t * 6 * side
        for (let a = 0; a < Math.PI * 4; a += 0.12) {
          const r = a * 0.8
          this.rect(cx + Math.cos(a + spin) * r - 1, cy + Math.sin(a + spin) * r - 1, 2, 2)
        }
        return
      }
      case 'dizzy': {
        // X eyes
        for (let i = -6; i <= 6; i++) {
          this.rect(cx + i - 1, cy + i - 1, 3, 3)
          this.rect(cx + i - 1, cy - i - 1, 3, 3)
        }
        return
      }
      case 'angry':
      case 'sad':
      case 'cry': {
        this.pill(cx, cy, EYE_W, h, 6)
        // angry slants down toward the middle, sad slants down to the outside
        const inner = cx - side * (EYE_W / 2)
        const outer = cx + side * (EYE_W / 2)
        const top = cy - h / 2
        const slant = Math.round(9 * this.open) // flattens with the eye as it blinks
        const [yi, yo] = expr === 'angry' ? [top + slant, top] : [top, top + slant]
        return this.cutAbove(inner, yi, outer, yo, Math.min(inner, outer) - 1, Math.max(inner, outer) + 1)
      }
      default: {
        if (expr === 'neutral' && !closed && this.halloween) return this.bitmap(PUMPKIN_EYE, cx, cy, 2)
        // plain eyes, squashed wide and short during a squish
        const s = Math.sin(this.squish * Math.PI)
        return this.pill(cx, cy + s * 3, EYE_W * (1 + 0.35 * s), h * (1 - 0.35 * s), 6)
      }
    }
  }

  private extras(expr: Expression, cx: number, cy: number) {
    const since = this.since
    switch (expr) {
      case 'neutral':
        if (this.halloween) this.bitmap(PUMPKIN_GRIN, cx, cy + 20, 2)
        return
      case 'surprised':
        if (this.open > 0.5) this.bitmap(MOUTH_O, cx, cy + 22, 1)
        return
      case 'panic': {
        // a jagged mouth, teeth chattering
        const chatter = Math.floor(this.t * 14) % 2
        for (let i = 0; i < 22; i++) this.rect(cx - 11 + i, cy + 20 + ((i + chatter * 2) % 4 < 2 ? 0 : 2), 1, 2)
        // sweat drops running off both sides, over and over
        for (const [dx, offset] of [[-38, 0], [38, 0.45]]) {
          const fall = (this.t * 1.6 + offset) % 1
          const y = cy - 16 + fall * 22
          this.rect(cx + dx, y - 2, 1, 2)
          this.rect(cx + dx - 1, y, 3, 3)
        }
        return
      }
      case 'happy':
      case 'love':
      case 'wink':
        return this.bitmap(SMILE, cx, cy + 17, 1)
      case 'excited': {
        this.bitmap(SMILE, cx, cy + 17, 1)
        // sparkles popping around
        for (let i = 0; i < 4; i++) {
          if ((Math.floor(this.t * 6) + i) % 3) continue
          const sx = cx + [-42, 42, -36, 38][i]
          const sy = cy + [-20, -16, 16, 20][i]
          this.rect(sx - 2, sy, 5, 1)
          this.rect(sx, sy - 2, 1, 5)
        }
        return
      }
      case 'laugh': {
        // open "D" mouth, flapping
        const open = Math.floor(this.t * 10) % 2 ? 5 : 3
        this.ellipse(cx, cy + 15, 8, open + 3)
        this.rect(cx - 9, cy + 7, 19, 8, 0)
        this.ellipse(cx, cy + 15, 5, open, 0)
        this.rect(cx - 6, cy + 13, 13, 2, 1)
        return
      }
      case 'uwu':
        return this.bitmap(UWU, cx, cy + 17, 2)
      case 'blush':
        this.bitmap(SMILE, cx, cy + 17, 1)
        // hatched cheeks
        for (const sx of [cx - EYE_GAP - 2, cx + EYE_GAP - 2])
          for (let i = 0; i < 3; i++) this.rect(sx - 4 + i * 4, cy + 9, 2, 3)
        return
      case 'cool': {
        // sunglasses slide down into place, then a glint sweeps across
        const drop = Math.min(1, since / 0.5)
        const gy = -20 + (cy - 1 + 20) * (1 - Math.pow(1 - drop, 3))
        this.rect(cx - 36, gy - 7, 72, 2) // top bar
        for (const lx of [cx - EYE_GAP, cx + EYE_GAP]) {
          this.pill(lx, gy + 2, 26, 16, 5)
          // glint: a diagonal black stripe crossing each lens every 1.5s
          const g = ((since * 1.2) % 1.5) * 30 - 14
          for (let j = -7; j <= 9; j++) this.rect(lx + g - j * 0.6, gy + 2 + j, 2, 1, 0)
        }
        this.rect(cx - 7, gy - 1, 14, 2) // bridge
        if (drop >= 1) this.bitmap(SMIRK, cx + 4, cy + 18, 2)
        return
      }
      case 'thinking': {
        this.rect(cx - 2, cy + 18, 8, 2)
        // "..." typing out, then starting over
        const n = Math.floor(since * 3) % 4
        for (let i = 0; i < n; i++) this.rect(cx + 30 + i * 5, cy - 22, 3, 3)
        return
      }
      case 'confused':
        this.bitmap(WAVY, cx, cy + 18, 1)
        this.bitmap(QUESTION, cx + 38, cy - 22 + Math.round(Math.sin(this.t * 4) * 2), 1)
        return
      case 'suspicious':
      case 'bored':
        return this.rect(cx - 6, cy + 18, 12, 2)
      case 'music': {
        // singing: mouth opens on the beat, notes float up on alternating sides
        if (Math.floor(this.t * 4) % 2) {
          this.ellipse(cx, cy + 17, 4, 4)
          this.ellipse(cx, cy + 17, 2, 2, 0)
        } else this.rect(cx - 4, cy + 17, 8, 2)
        for (let i = 0; i < 2; i++) {
          const p = (this.t * 0.6 + i / 2) % 1
          const sx = cx + (i ? 38 : -40) + Math.sin(p * 6) * 3
          this.bitmap(NOTE, sx, cy + 16 - p * 40, 1 + (i ? 1 : 0))
        }
        return
      }
      case 'yawn': {
        // mouth stretches open, holds, then closes
        const p = Math.min(1, since / 1.8)
        const r = Math.round(Math.sin(p * Math.PI) * 8)
        if (r > 0) {
          this.ellipse(cx, cy + 16, Math.max(3, Math.round(r * 0.7)), r)
          this.ellipse(cx, cy + 16, Math.max(1, Math.round(r * 0.7) - 2), Math.max(1, r - 2), 0)
        } else this.rect(cx - 3, cy + 16, 6, 2)
        return
      }
      case 'loading': {
        // progress bar with a spinner above it
        const p = Math.min(1, since / 2.6)
        this.rect(cx - 30, cy - 5, 60, 2)
        this.rect(cx - 30, cy + 5, 60, 2)
        this.rect(cx - 30, cy - 5, 2, 12)
        this.rect(cx + 28, cy - 5, 2, 12)
        this.rect(cx - 27, cy - 2, Math.round(54 * p), 6)
        if (p < 1) {
          const step = Math.floor(this.t * 10) % 8
          for (let i = 0; i < 8; i++) {
            if (i === step) continue
            const a = (i / 8) * Math.PI * 2
            this.rect(cx + Math.cos(a) * 6 - 1, cy - 20 + Math.sin(a) * 6 - 1, 2, 2)
          }
        } else this.bitmap(SMILE, cx, cy + 17, 1) // done
        return
      }
      case 'sleepy':
      case 'asleep':
        // z's drifting up and to the right
        for (let i = 0; i < 3; i++) {
          const p = (this.t * 0.5 + i / 3) % 1
          if (p < 0.85) this.bitmap(Z, cx + 30 + p * 12, cy - 6 - p * 28, 1 + (i === 2 ? 1 : 0))
        }
        return
      case 'sad':
        return this.rect(cx + EYE_GAP + 5, cy + 10 + ((this.t * 14) % 14), 2, 3)
      case 'cry': {
        this.bitmap(FROWN, cx, cy + 20, 1)
        // two streams of tears running down
        for (const ex of [cx - EYE_GAP, cx + EYE_GAP])
          for (let i = 0; i < 4; i++) {
            const y = cy + 11 + ((this.t * 30 + i * 7) % 28)
            this.rect(ex + (ex < cx ? -5 : 4), y, 2, 3)
          }
        return
      }
      case 'dizzy':
        // little stars circling
        for (let i = 0; i < 3; i++) {
          const a = this.t * 3 + (i * Math.PI * 2) / 3
          const sx = cx + Math.cos(a) * 34
          const sy = cy - 24 + Math.sin(a) * 5
          this.rect(sx - 1, sy, 3, 1)
          this.rect(sx, sy - 1, 1, 3)
        }
        return
    }
  }

  // YES!!! as big as it goes, bouncing and shaking with excitement
  private drawYes() {
    const scale = 4
    const w = (6 * CHAR_W - 1) * scale
    const bounce = Math.round(Math.abs(Math.sin(this.t * 9)) * 4)
    const shake = (Math.floor(this.t * 24) % 2) * 2 - 1
    this.text('YES!!!', Math.round((FACE_W - w) / 2) + shake, Math.round((FACE_H - 5 * scale) / 2) - bounce, scale)
  }

  // the screensaver: stars streaming out from the middle, faster and bigger as
  // they get closer (each star starts over at a new angle once it's off screen)
  private drawStarfield() {
    for (let i = 0; i < 46; i++) {
      const lap = this.t * 0.35 + i / 46
      const n = Math.floor(lap)
      const k = lap - n // 0 at the middle .. 1 at the edge
      const a = (Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453) % (Math.PI * 2)
      const d = k * k * 70
      const size = k > 0.6 ? 2 : 1
      this.rect(FACE_W / 2 + Math.cos(a) * d, FACE_H / 2 + Math.sin(a) * d * 0.8, size, size)
    }
  }

  // scale 2 doubles every pixel (readable from across the room)
  private text(s: string, x: number, y: number, scale = 1) {
    ;[...s.toUpperCase()].forEach((c, i) => {
      const g = FONT[c]
      if (g)
        for (let j = 0; j < 15; j++)
          if (g[j] === '#') this.rect(x + (i * CHAR_W + (j % 3)) * scale, y + Math.floor(j / 3) * scale, scale, scale)
    })
  }

  // a command line: "> " and what's been typed in big letters, wrapping at
  // spaces (or mid-word if a word won't fit a line), the last lines once it's
  // full, and a blinking block cursor
  private drawPrompt() {
    const cols = Math.floor((FACE_W - 4) / (CHAR_W * 2))
    const lines = ['']
    for (const word of ('> ' + this.typed).split(/(?<= )/)) {
      let w = word
      while (w) {
        const room = cols - lines[lines.length - 1].length
        // a word that fits on a fresh line moves down; a longer one is cut
        if (w.trimEnd().length > room && w.trimEnd().length <= cols && lines[lines.length - 1]) lines.push('')
        const r = cols - lines[lines.length - 1].length
        lines[lines.length - 1] += w.slice(0, r)
        w = w.slice(r)
        if (w) lines.push('')
      }
    }
    // the cursor goes on the next line when this one's full
    if (lines[lines.length - 1].length >= cols) lines.push('')
    const fits = Math.floor((FACE_H - 4) / (LINE_H * 2))
    const shown = lines.slice(-fits)
    shown.forEach((l, i) => this.text(l, 2, 3 + i * LINE_H * 2, 2))
    const last = shown[shown.length - 1]
    if (Math.floor(this.t * 2.5) % 2 === 0) this.rect(2 + last.length * CHAR_W * 2, 3 + (shown.length - 1) * LINE_H * 2, 6, 10)
  }

  // the lines printed so far, scrolling up once the screen's full, and a
  // blinking cursor under the last one
  private drawBootLog() {
    if (this.since < CRT_ON) return this.crtOn(this.since / CRT_ON)
    const shown = this.bootLog.filter((l) => l.at <= this.since).map((l) => l.text)
    const fits = Math.floor((FACE_H - 4) / LINE_H) - 1 // room for the cursor
    const lines = shown.slice(-fits)
    lines.forEach((l, i) => this.text(l, 2, 2 + i * LINE_H))
    if (Math.floor(this.t * 3) % 2 === 0) this.text('_', 2, 2 + lines.length * LINE_H)
  }

  // k: 0..1 through the switch-off: a bright picture squeezing down to a line,
  // the line pulling in to a dot, and the dot fading away
  private crtOff(k: number) {
    const cx = FACE_W / 2
    const cy = FACE_H / 2
    const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))
    if (k < 0.35) {
      const h = lerp(FACE_H, 2, k / 0.35)
      this.rect(0, cy - h / 2, FACE_W, h)
    } else if (k < 0.7) {
      const w = lerp(FACE_W, 2, (k - 0.35) / 0.35)
      this.rect(cx - w / 2, cy - 1, w, 2)
    } else if (Math.floor(k * 40) % 2 === 0) this.rect(cx - 1, cy - 1, 2, 2)
  }

  // k: 0..1 through the switch-on
  private crtOn(k: number) {
    const cx = FACE_W / 2
    const cy = FACE_H / 2
    const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))
    if (k < 0.15) this.rect(cx - 1, cy - 1, 2, 2)
    else if (k < 0.4) {
      const w = lerp(4, FACE_W, (k - 0.15) / 0.25)
      this.rect(cx - w / 2, cy - 1, w, 2)
    } else if (k < 0.7) {
      const h = lerp(2, FACE_H, (k - 0.4) / 0.3)
      this.rect(0, cy - h / 2, FACE_W, h)
    } else {
      const level = 16 * (1 - (k - 0.7) / 0.3)
      for (let y = 0; y < FACE_H; y++) for (let x = 0; x < FACE_W; x++) if (BAYER[(y % 4) * 4 + (x % 4)] < level) this.dot(x, y)
    }
  }

  // CRT-style tearing: shift bands of rows sideways and sprinkle static
  private glitch() {
    const seed = Math.floor(this.t * 12)
    const hash = (n: number) => {
      const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    const row = new Uint8Array(FACE_W)
    for (let y = 0; y < FACE_H; y++) {
      if (hash(Math.floor(y / 3)) > 0.25) continue
      const shift = Math.round((hash(y + 500) - 0.5) * 16)
      for (let x = 0; x < FACE_W; x++) row[x] = this.px[y * FACE_W + ((x - shift + FACE_W) % FACE_W)]
      this.px.set(row, y * FACE_W)
    }
    for (let i = 0; i < 40; i++) this.dot(hash(i + 900) * FACE_W, hash(i + 1300) * FACE_H, hash(i + 1700) > 0.5 ? 1 : 0)
  }

  // any lit pixel around pixel i (the 1px outline in transparent mode)
  private touchesOn(i: number) {
    const x = i % FACE_W
    const y = (i - x) / FACE_W
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < FACE_W && ny < FACE_H && this.px[ny * FACE_W + nx]) return true
      }
    return false
  }

  // resample the finished face smaller and centered on the visible part
  private fitView() {
    const { scale, x: vx, y: vy } = this.view
    this.copy.set(this.px)
    for (let y = 0; y < FACE_H; y++)
      for (let x = 0; x < FACE_W; x++) {
        const sx = Math.floor((x - vx) / scale + FACE_W / 2)
        const sy = Math.floor((y - vy) / scale + FACE_H / 2)
        const inside = sx >= 0 && sy >= 0 && sx < FACE_W && sy < FACE_H
        this.px[y * FACE_W + x] = inside ? this.copy[sy * FACE_W + sx] : 0
      }
  }

  private render() {
    this.px.fill(0)
    const expr = this.shown
    const crt = this.crt
    if (crt) {
      const k = Math.min(1, (this.t - crt.at) / (crt.kind === 'on' ? CRT_ON : CRT_OFF))
      if (crt.kind === 'on') this.crtOn(k)
      else this.crtOff(k)
    } else if (expr === 'boot') this.drawBootLog()
    else if (expr === 'prompt') this.drawPrompt()
    else if (expr === 'starfield') this.drawStarfield()
    else if (expr === 'yes') this.drawYes()
    else if (expr !== 'off') {
      // look only moves plain eyes; the expressive ones stay put
      const moves = ['neutral', 'sad', 'angry', 'glitch'].includes(expr)
      let lx = moves ? this.look.x : 0
      const ly = moves ? this.look.y : 0
      if (expr === 'suspicious') lx = Math.round(Math.sin(this.since * 1.6) * 9) // slow side-eye
      if (expr === 'bored') lx = Math.round(Math.sin(this.since * 0.8) * 6)
      // whole-face motion: bounce, shake, sway
      let fx = 0
      let fy = 0
      if (expr === 'excited') fy = -Math.round(Math.abs(Math.sin(this.t * 9)) * 4)
      if (expr === 'laugh') fy = (Math.floor(this.t * 12) % 2) * 2
      if (expr === 'music') fx = Math.round(Math.sin(this.t * 4) * 3)
      if (expr === 'panic') {
        // trembling
        const shake = Math.floor(this.t * 30)
        fx = (shake % 2) * 2 - 1
        fy = shake % 3 === 0 ? 1 : 0
      }
      const cx = FACE_W / 2 + fx
      const cy = FACE_H / 2 - 2 + fy
      this.eye(expr, -1, cx + lx - EYE_GAP, cy + ly)
      this.eye(expr, 1, cx + lx + EYE_GAP, cy + ly)
      this.extras(expr, cx, cy)
      if (expr === 'glitch') this.glitch()
      const v = this.view
      if (v.scale < 0.999 || Math.abs(v.x - FACE_W / 2) > 0.5 || Math.abs(v.y - FACE_H / 2) > 0.5) this.fitView()
    }
    const d = this.img.data
    for (let i = 0; i < this.px.length; i++) {
      const on = this.px[i] === 1
      const v = on ? 235 : 4
      d[i * 4] = v
      d[i * 4 + 1] = v
      d[i * 4 + 2] = on ? 240 : 6
      d[i * 4 + 3] = on || !this.transparent || this.touchesOn(i) ? 255 : 0
    }
    this.ctx.putImageData(this.img, 0, 0)
    this.texture.needsUpdate = true
  }
}
