import { useStore, TASKBAR_H, slumpyLocation } from '../store'
import { getFace, tickFace } from '../os/slumpy'
import { THEMES, useTheme } from '../os/theme'
import { FACE_W, FACE_H, FONT, CHAR_W, type SlumpyFace } from './SlumpyFace'

// The desktop as it looks from across the room (still signed in, see stepAway):
// a tiny pixel version on his screen, in the OS theme's colors, with the
// wallpaper's Slumpy (the very same face, mood and all: see slumpy.ts), the icons down the side, the open windows where they are, the
// taskbar, and Chiba and Hanzo pottering along the bottom. Unplug one in the room
// and it's gone from there too, and he panics (with an error up, like the desktop's).

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, k: number) => {
  const [x, y] = [hex(a), hex(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`
}

let lastT = 0
// typing at him in the room (see PCModel): the line shows in a Konsole window
export const deskTyping = { on: false }

export function paintDesktop(ctx: CanvasRenderingContext2D, t: number, face: SlumpyFace) {
  tickFace(t - lastT)
  lastT = t
  const [bg, accent, light] = (THEMES.find((th) => th.id === useTheme.getState().theme) ?? THEMES[0]).swatch
  const { windows, focused, desk, unplugged } = useStore.getState()
  const missing = unplugged.keyboard || unplugged.mouse
  // (kept up while one's missing, so it wears off by itself once it's back)
  if (missing) getFace().react('panic', 0.6)
  const W = FACE_W
  const H = FACE_H
  const bar = Math.max(5, Math.round((TASKBAR_H / desk.h) * H))
  const box = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  // the wallpaper: the theme's background, a few stars, and Slumpy's big eyes
  box(bg, 0, 0, W, H)
  for (let i = 0; i < 14; i++) {
    const on = Math.sin(t * 1.3 + i * 4.1) > -0.6
    if (on) box(mix(bg, light, 0.35), (Math.sin(i * 91.7) * 0.5 + 0.5) * W, (Math.cos(i * 37.3) * 0.5 + 0.5) * (H - bar), 1, 1)
  }
  // (the wallpaper's face fills the screen, a little see-through, like on the desktop;
  // not there while he's off in a window, the Konsole or the Start menu)
  if (slumpyLocation(useStore.getState()) === 'wallpaper') {
    ctx.globalAlpha = 0.85
    ctx.drawImage(getFace().canvas, 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  // the icons, down the left in two columns
  const icon = [accent, '#ffb000', light, accent, '#3ec46d', light, '#7a7a90']
  icon.forEach((c, i) => {
    box(c, 3, 3 + i * 9, 5, 5)
    box(mix(bg, light, 0.45), 2, 9 + i * 9, 7, 1)
  })
  box(light, 12, 3, 5, 5)
  box(mix(bg, light, 0.45), 11, 9, 7, 1)
  box('#9696a2', 12, 12, 5, 5)
  box(mix(bg, light, 0.45), 11, 18, 7, 1)
  // Chiba and Hanzo, wandering about above the taskbar
  const chiba = (Math.sin(t * 0.21) * 0.5 + 0.5) * (W - 20) + 8
  const hanzo = (Math.sin(t * 0.33 + 2) * 0.5 + 0.5) * (W - 20) + 8
  if (!unplugged.keyboard) {
    box('#e28036', chiba, H - bar - 3, 4, 2)
    box('#e28036', chiba + (Math.cos(t * 0.21) > 0 ? 3 : -1), H - bar - 4, 2, 2)
  }
  if (!unplugged.mouse) box('#9696a2', hanzo, H - bar - 2, 3, 2)
  // the open windows, bottom to top
  const sx = W / desk.w
  const sy = (H - bar) / (desk.h - TASKBAR_H)
  for (const win of [...windows].sort((a, b) => a.z - b.z)) {
    if (win.minimized) continue
    const [x, y, w, h] = win.maximized ? [0, 0, W, H - bar] : [win.x * sx, win.y * sy, Math.max(8, win.w * sx), Math.max(6, win.h * sy)]
    const on = win.id === focused
    box(mix(bg, '#000000', 0.5), x + 1, y + 1, w, h) // (its shadow)
    box(mix(bg, light, 0.1), x, y, w, h)
    box(on ? accent : mix(accent, bg, 0.5), x, y, w, 3)
    box(mix(bg, light, 0.75), x + w - 3, y + 1, 2, 1) // (its close button)
    // a few lines of whatever's in it
    for (let l = 0; 6 + l * 3 < h - 2; l++) box(mix(bg, light, 0.4), x + 2, y + 6 + l * 3, Math.max(2, (w - 4) * (0.5 + 0.4 * Math.abs(Math.sin(l * 2.3 + win.x)))), 1)
  }
  // a device unplugged: the error box, in the middle, its title bar flashing red
  if (missing) {
    const [x, y, w, h] = [W / 2 - 22, H * 0.62, 44, 16]
    box('#000000', x + 1, y + 1, w, h)
    box(mix(bg, light, 0.12), x, y, w, h)
    box(Math.floor(t * 3) % 2 ? '#ff004d' : '#a8002f', x, y, w, 3)
    box('#ffec27', x + 3, y + 6, 6, 6) // (the warning sign)
    box('#000000', x + 5.5, y + 7, 1, 3)
    box('#000000', x + 5.5, y + 11, 1, 1)
    for (let l = 0; l < 2; l++) box(mix(bg, light, 0.55), x + 12, y + 6 + l * 3, l ? 20 : 28, 1)
  }
  // typing at him: a Konsole, with what's being typed in it (the last lines of it)
  if (deskTyping.on) {
    const [x, y, w, h] = [8, 22, W - 16, 26]
    box('#000000', x + 1, y + 1, w, h)
    box('#0b0b10', x, y, w, h)
    box(accent, x, y, w, 3)
    const cols = Math.floor((w - 4) / CHAR_W)
    const text = '> ' + face.typed
    const lines: string[] = []
    for (let i = 0; i < text.length; i += cols) lines.push(text.slice(i, i + cols))
    if (!lines.length || lines[lines.length - 1].length >= cols) lines.push('')
    const shown = lines.slice(-3)
    ctx.fillStyle = light
    shown.forEach((l, i) =>
      [...l.toUpperCase()].forEach((c, j) => {
        const g = FONT[c]
        if (g) for (let k = 0; k < 15; k++) if (g[k] === '#') ctx.fillRect(x + 2 + j * CHAR_W + (k % 3), y + 5 + i * 7 + Math.floor(k / 3), 1, 1)
      }),
    )
    if (Math.floor(t * 2.5) % 2 === 0) box(light, x + 2 + shown[shown.length - 1].length * CHAR_W, y + 5 + (shown.length - 1) * 7, 3, 5)
  }
  // the taskbar: Start on the left, a button for each window, the clock
  box(mix(bg, accent, 0.25), 0, H - bar, W, bar)
  box(mix(bg, accent, 0.55), 0, H - bar, W, 1)
  box(accent, 1, H - bar + 1, 10, bar - 2)
  windows.forEach((win, i) => box(win.id === focused ? mix(bg, accent, 0.6) : mix(bg, accent, 0.4), 13 + i * 11, H - bar + 1, 10, bar - 2))
  box(mix(bg, light, 0.6), W - 11, H - bar + Math.floor(bar / 2) - 1, 9, 2)
}
