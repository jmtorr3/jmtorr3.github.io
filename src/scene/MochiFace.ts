import * as THREE from 'three'

// A Dasai Mochi style face for the monitor while the PC is off: white pixels on
// black, like the little OLED. Drawn on a 1-bit grid so every pixel stays crisp,
// then uploaded to a CanvasTexture that the screen material samples.

export const FACE_W = 100
export const FACE_H = 80 // the monitor's screen is 5:4

export type Expression =
  | 'neutral'
  | 'happy'
  | 'sleepy'
  | 'surprised'
  | 'love'
  | 'angry'
  | 'sad'
  | 'wink'
  | 'dizzy'
  | 'off'

// random moods while idling, with how often each comes up
const IDLE_MOODS: [Expression, number][] = [
  ['happy', 3],
  ['wink', 2],
  ['love', 2],
  ['sleepy', 2],
  ['surprised', 1],
  ['sad', 1],
  ['angry', 1],
  ['dizzy', 1],
]

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

const Z = ['#####', '...#.', '..#..', '.#...', '#####']

const SMILE = ['#........#', '##......##', '.########.', '..######..']

const MOUTH_O = ['.###.', '#...#', '#...#', '#...#', '.###.']

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function pickMood(): Expression {
  let r = Math.random() * IDLE_MOODS.reduce((s, [, w]) => s + w, 0)
  for (const [m, w] of IDLE_MOODS) if ((r -= w) < 0) return m
  return 'happy'
}

export class MochiFace {
  readonly texture: THREE.CanvasTexture
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
  private look = { x: 0, y: 0 }
  private lookTarget = { x: 0, y: 0 }
  private nextLookAt = 1
  private t = 0

  constructor() {
    const canvas = document.createElement('canvas')
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
  set(expr: Expression | null) {
    if (expr === this.override) return
    this.override = expr
    if (expr === 'off') {
      this.shown = this.next = 'off'
      this.open = 0
      this.render()
    } else if (this.shown === 'off') {
      // waking up: eyes open from closed
      this.shown = this.next = expr ?? 'neutral'
      this.open = 0
      this.closing = false
    } else {
      this.change(expr ?? 'neutral')
    }
  }

  private change(expr: Expression) {
    if (expr === this.next) return
    this.next = expr
    this.closing = true // swap at the bottom of a blink
  }

  update(dt: number) {
    if (this.shown === 'off' && this.next === 'off') return
    this.t += dt

    // idle mood cycle
    if (!this.override) {
      if (this.next !== 'neutral' && this.t > this.moodUntil) this.change('neutral')
      if (this.next === 'neutral' && this.t > this.nextMoodAt) {
        this.change(pickMood())
        this.moodUntil = this.t + rand(2.2, 3.5)
        this.nextMoodAt = this.moodUntil + rand(3, 6)
      }
    }

    // blinks
    if (!this.closing && this.open >= 1 && this.t > this.nextBlinkAt) this.closing = true
    if (this.closing) {
      this.open -= dt / BLINK
      if (this.open <= 0) {
        this.open = 0
        this.closing = false
        this.shown = this.next
        this.nextBlinkAt = this.t + rand(2, 5)
      }
    } else if (this.open < 1) {
      this.open = Math.min(1, this.open + dt / BLINK)
    }

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
  private pill(cx: number, cy: number, w: number, h: number, r: number) {
    const x0 = Math.round(cx - w / 2)
    const y0 = Math.round(cy - h / 2)
    r = Math.min(r, Math.floor(w / 2), Math.floor(h / 2))
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const dx = i < r ? r - i - 0.5 : i >= w - r ? i - (w - r) + 0.5 : 0
        const dy = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : 0
        if (dx * dx + dy * dy <= r * r) this.dot(x0 + i, y0 + j)
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

  private eye(expr: Expression, side: -1 | 1, cx: number, cy: number) {
    // closing squashes the eye to a line (shapes like ^ and hearts just shrink)
    const h = Math.max(2, Math.round(EYE_H * this.open))
    switch (expr) {
      case 'happy':
        return this.open > 0.5 ? this.arc(cx, cy) : this.rect(cx - 8, cy, 16, 2)
      case 'wink':
        if (side === 1) return this.arc(cx, cy)
        return this.pill(cx, cy, EYE_W, h, 6)
      case 'love': {
        const beat = 1 + (Math.sin(this.t * 10) > 0.6 ? 1 : 0)
        return this.open > 0.5 ? this.bitmap(HEART, cx, cy, 2 + beat - 1) : this.rect(cx - 8, cy, 16, 2)
      }
      case 'sleepy':
        // heavy lids: only the bottom of the eye shows
        return this.pill(cx, cy + 6, EYE_W, Math.max(2, Math.round(9 * this.open)), 3)
      case 'surprised':
        return this.pill(cx, cy - 2, EYE_W + 4, Math.max(2, Math.round((EYE_H + 4) * this.open)), 9)
      case 'dizzy': {
        // X eyes
        for (let i = -6; i <= 6; i++) {
          this.rect(cx + i - 1, cy + i - 1, 3, 3)
          this.rect(cx + i - 1, cy - i - 1, 3, 3)
        }
        return
      }
      case 'angry':
      case 'sad': {
        this.pill(cx, cy, EYE_W, h, 6)
        // angry slants down toward the middle, sad slants down to the outside
        const inner = cx - side * (EYE_W / 2)
        const outer = cx + side * (EYE_W / 2)
        const top = cy - h / 2
        const slant = Math.round(9 * this.open) // flattens with the eye as it blinks
        const [yi, yo] = expr === 'angry' ? [top + slant, top] : [top, top + slant]
        return this.cutAbove(inner, yi, outer, yo, Math.min(inner, outer) - 1, Math.max(inner, outer) + 1)
      }
      default:
        return this.pill(cx, cy, EYE_W, h, 6)
    }
  }

  private extras(expr: Expression, cx: number, cy: number) {
    if (expr === 'surprised' && this.open > 0.5) {
      this.bitmap(MOUTH_O, cx, cy + 22, 1)
    }
    if (expr === 'happy' || expr === 'love' || expr === 'wink') {
      this.bitmap(SMILE, cx, cy + 17, 1)
    }
    if (expr === 'sleepy') {
      // z's drifting up and to the right
      for (let i = 0; i < 3; i++) {
        const p = (this.t * 0.5 + i / 3) % 1
        if (p < 0.85) this.bitmap(Z, cx + 30 + p * 12, cy - 6 - p * 28, 1 + (i === 2 ? 1 : 0))
      }
    }
    if (expr === 'sad') this.rect(cx + EYE_GAP + 5, cy + 10 + ((this.t * 14) % 14), 2, 3)
    if (expr === 'dizzy') {
      // little stars circling
      for (let i = 0; i < 3; i++) {
        const a = this.t * 3 + (i * Math.PI * 2) / 3
        const sx = cx + Math.cos(a) * 34
        const sy = cy - 24 + Math.sin(a) * 5
        this.rect(sx - 1, sy, 3, 1)
        this.rect(sx, sy - 1, 1, 3)
      }
    }
  }

  private render() {
    this.px.fill(0)
    if (this.shown !== 'off') {
      // look only moves plain eyes; the expressive ones stay centered
      const moves = this.shown === 'neutral' || this.shown === 'sad' || this.shown === 'angry'
      const cx = FACE_W / 2 + (moves ? this.look.x : 0)
      const cy = FACE_H / 2 - 2 + (moves ? this.look.y : 0)
      this.eye(this.shown, -1, cx - EYE_GAP, cy)
      this.eye(this.shown, 1, cx + EYE_GAP, cy)
      this.extras(this.shown, FACE_W / 2, cy)
    }
    const d = this.img.data
    for (let i = 0; i < this.px.length; i++) {
      const v = this.px[i] ? 235 : 4
      d[i * 4] = v
      d[i * 4 + 1] = v
      d[i * 4 + 2] = this.px[i] ? 240 : 6
      d[i * 4 + 3] = 255
    }
    this.ctx.putImageData(this.img, 0, 0)
    this.texture.needsUpdate = true
  }
}
