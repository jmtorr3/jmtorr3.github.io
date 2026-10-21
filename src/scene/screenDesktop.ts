import { useStore, TASKBAR_H, slumpyLocation } from '../store'
import { getFace, tickFace } from '../os/slumpy'
import { THEMES, useTheme } from '../os/theme'
import { FACE_W, FACE_H } from './SlumpyFace'

// The desktop as it looks from across the room (still signed in, see stepAway):
// a tiny pixel version on his screen, in the OS theme's colors, with the
// wallpaper's Slumpy (the very same face, mood and all: see slumpy.ts), the icons down the side, the open windows where they are, the
// taskbar, and Chiba and Hanzo pottering along the bottom.

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, k: number) => {
  const [x, y] = [hex(a), hex(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`
}

let lastT = 0

export function paintDesktop(ctx: CanvasRenderingContext2D, t: number) {
  tickFace(t - lastT)
  lastT = t
  const [bg, accent, light] = (THEMES.find((th) => th.id === useTheme.getState().theme) ?? THEMES[0]).swatch
  const { windows, focused, desk } = useStore.getState()
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
  box('#e28036', chiba, H - bar - 3, 4, 2)
  box('#e28036', chiba + (Math.cos(t * 0.21) > 0 ? 3 : -1), H - bar - 4, 2, 2)
  box('#9696a2', hanzo, H - bar - 2, 3, 2)
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
  // the taskbar: Start on the left, a button for each window, the clock
  box(mix(bg, accent, 0.25), 0, H - bar, W, bar)
  box(mix(bg, accent, 0.55), 0, H - bar, W, 1)
  box(accent, 1, H - bar + 1, 10, bar - 2)
  windows.forEach((win, i) => box(win.id === focused ? mix(bg, accent, 0.6) : mix(bg, accent, 0.4), 13 + i * 11, H - bar + 1, 10, bar - 2))
  box(mix(bg, light, 0.6), W - 11, H - bar + Math.floor(bar / 2) - 1, 9, 2)
}
