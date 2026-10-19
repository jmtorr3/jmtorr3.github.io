import * as THREE from 'three'
import type { ScreenInfo } from '../store'

export const FOV = 40
// how much of the viewport the monitor's screen opening takes up (the rest shows the bezel)
const FILL = 0.88

// Camera distance so the whole screen opening fits the viewport ("contain"),
// plus where that opening lands in CSS pixels. The camera looks straight at the
// screen center, so the projection is a centered rect.
export function fitScreen(screen: ScreenInfo, vw: number, vh: number) {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const aspect = vw / vh
  const dh = screen.height / 2 / tanHalf
  const dw = screen.width / 2 / (tanHalf * aspect)
  const d = Math.max(dh, dw) / FILL

  const viewH = 2 * d * tanHalf // world units visible vertically at the screen plane
  const h = (screen.height / viewH) * vh
  const w = h * (screen.width / screen.height)
  return { distance: d, rect: { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h } }
}
