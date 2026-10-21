import * as THREE from 'three'
import type { ScreenInfo } from '../store'

export const FOV = 40
// how much of the viewport the monitor's screen opening takes up (the rest shows the bezel)
const FILL = 0.88

// phones (either orientation) and portrait screens: the monitor's 5:4 opening would be
// a tiny box, so the desktop fills the whole viewport instead
export const isCompact = (w: number, h: number) => w < 720 || h > w || Math.min(w, h) < 500

// Camera distance so the whole screen opening fits the viewport ("contain"),
// plus where that opening lands in CSS pixels. The camera looks straight at the
// screen center, so the projection is a centered rect.
// On compact viewports the camera instead pushes in until the black glass covers
// the whole viewport ("cover"), since the desktop will fill it edge to edge.
// Camera distance at which the whole screen opening fits the viewport, with a
// little bezel around it, on any viewport (phones included)
export function containDistance(screen: ScreenInfo, vw: number, vh: number) {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const dh = screen.height / 2 / tanHalf
  const dw = screen.width / 2 / (tanHalf * (vw / vh))
  return Math.max(dh, dw) / FILL
}

export function fitScreen(screen: ScreenInfo, vw: number, vh: number) {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const aspect = vw / vh
  const dh = screen.height / 2 / tanHalf
  const dw = screen.width / 2 / (tanHalf * aspect)
  // 1.04: a hair past the edges so no bezel peeks in at the sides
  const d = isCompact(vw, vh) ? Math.min(dh, dw) / 1.04 : containDistance(screen, vw, vh)

  const viewH = 2 * d * tanHalf // world units visible vertically at the screen plane
  const h = (screen.height / viewH) * vh
  const w = h * (screen.width / screen.height)
  return { distance: d, rect: { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h } }
}
