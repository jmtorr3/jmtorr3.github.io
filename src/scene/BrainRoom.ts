import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'

// Inside the monitor, behind the hatch: the brain buddy's little room. A bed, a desk
// with a tiny computer of its own, a rug, a lamp, a window full of stars, a poster
// and a shelf of books, all in the OS theme's colors (setTheme). The cable to the
// brain comes out of a socket on the back wall.

// one color per role, swapped together when the theme changes
type Role = 'wall' | 'floor' | 'ceiling' | 'wood' | 'accent' | 'accentDark' | 'cloth' | 'light' | 'screen' | 'dark' | 'sky'

export type BrainRoom = {
  group: THREE.Group
  socket: THREE.Vector3 // where the cable plugs into the back wall (world)
  bounds: THREE.Box3 // the room's inside (world)
  setTheme: (bg: string, accent: string, light: string) => void
}

// room: the inside of the room (world space; its +z side is the opening in the back of the monitor)
export function makeBrainRoom(room: THREE.Box3): BrainRoom {
  const group = new THREE.Group()
  const textures = new Map<Role, THREE.DataTexture>()
  const materials = new Map<Role, THREE.Material>()
  const material = (role: Role, glow = false) => {
    if (!materials.has(role)) {
      const tex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1)
      textures.set(role, tex)
      // glowing things (the lamp, the little screen, the stars) aren't shaded
      materials.set(role, glow ? new THREE.MeshBasicMaterial({ map: tex }) : makePicoMaterial(tex))
    }
    return materials.get(role)!
  }
  const glowing = new Set<Role>(['light', 'screen', 'sky'])
  const add = (role: Role, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(role, glowing.has(role)))
    m.position.set(x, y, z)
    m.raycast = () => {}
    group.add(m)
    return m
  }

  const { min, max } = room
  const W = max.x - min.x
  const H = max.y - min.y
  const D = max.z - min.z
  const cx = (min.x + max.x) / 2
  const T = 0.01 // walls' thickness

  // the room itself: floor, ceiling, back wall and the two sides
  add('floor', W, T, D, cx, min.y - T / 2, min.z + D / 2)
  add('ceiling', W, T, D, cx, max.y + T / 2, min.z + D / 2)
  add('wall', W, H, T, cx, min.y + H / 2, min.z - T / 2)
  add('wall', T, H, D, min.x - T / 2, min.y + H / 2, min.z + D / 2)
  add('wall', T, H, D, max.x + T / 2, min.y + H / 2, min.z + D / 2)
  // a skirting board along the back
  add('wood', W, 0.025, 0.012, cx, min.y + 0.0125, min.z + 0.006)

  // the rug, in the middle
  add('accentDark', W * 0.42, 0.004, D * 0.5, cx, min.y + 0.002, min.z + D * 0.55)

  // the bed, against the left wall: frame, mattress, blanket, pillow, headboard
  const bedX = min.x + 0.17
  const bedZ = min.z + 0.15
  add('wood', 0.28, 0.05, 0.22, bedX, min.y + 0.025, bedZ)
  add('cloth', 0.27, 0.025, 0.21, bedX, min.y + 0.0625, bedZ)
  add('accent', 0.18, 0.03, 0.215, bedX + 0.045, min.y + 0.07, bedZ)
  add('cloth', 0.07, 0.03, 0.14, bedX - 0.09, min.y + 0.085, bedZ)
  add('wood', 0.02, 0.12, 0.22, min.x + 0.03, min.y + 0.06, bedZ)

  // the desk, against the right wall, with its own little computer (screen glowing)
  const deskX = max.x - 0.14
  const deskZ = min.z + 0.1
  add('wood', 0.2, 0.015, 0.12, deskX, min.y + 0.12, deskZ)
  for (const [lx, lz] of [[-0.09, -0.05], [0.09, -0.05], [-0.09, 0.05], [0.09, 0.05]]) add('wood', 0.012, 0.12, 0.012, deskX + lx, min.y + 0.06, deskZ + lz)
  add('dark', 0.08, 0.06, 0.05, deskX - 0.02, min.y + 0.16, deskZ - 0.02)
  add('screen', 0.064, 0.044, 0.004, deskX - 0.02, min.y + 0.16, deskZ + 0.006)
  add('dark', 0.07, 0.006, 0.025, deskX - 0.02, min.y + 0.13, deskZ + 0.035)
  // and a chair (a little stool)
  add('wood', 0.06, 0.01, 0.06, deskX - 0.02, min.y + 0.07, deskZ + 0.11)
  add('wood', 0.01, 0.07, 0.01, deskX - 0.02, min.y + 0.035, deskZ + 0.11)

  // a lamp in the back corner by the bed, glowing
  add('dark', 0.01, 0.16, 0.01, min.x + 0.34, min.y + 0.08, min.z + 0.04)
  add('light', 0.05, 0.035, 0.05, min.x + 0.34, min.y + 0.17, min.z + 0.04)

  // on the back wall: a window full of stars, a poster, a shelf of books, and the socket
  add('dark', 0.15, 0.11, 0.008, cx - 0.02, min.y + H * 0.62, min.z + 0.004)
  add('sky', 0.13, 0.09, 0.004, cx - 0.02, min.y + H * 0.62, min.z + 0.009)
  add('accent', 0.07, 0.09, 0.004, min.x + 0.14, min.y + H * 0.62, min.z + 0.004)
  add('wood', 0.14, 0.008, 0.04, max.x - 0.13, min.y + H * 0.72, min.z + 0.02)
  ;(['accent', 'light', 'accentDark', 'wall'] as Role[]).forEach((role, i) =>
    add(role, 0.018, 0.04 + (i % 2) * 0.01, 0.03, max.x - 0.18 + i * 0.022, min.y + H * 0.72 + 0.024 + (i % 2) * 0.005, min.z + 0.02),
  )
  const socket = new THREE.Vector3(cx + 0.08, min.y + 0.06, min.z + 0.004)
  add('dark', 0.05, 0.05, 0.006, socket.x, socket.y, socket.z)

  // the stars in the window: little glowing dots
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.002), starMat)
    s.position.set(cx - 0.02 + (Math.sin(i * 12.9) * 0.5) * 0.11, min.y + H * 0.62 + (Math.cos(i * 7.3) * 0.5) * 0.07, min.z + 0.012)
    s.raycast = () => {}
    group.add(s)
  }

  const set = (role: Role, c: THREE.Color) => {
    const tex = textures.get(role)
    if (!tex) return
    ;(tex.image.data as Uint8Array).set([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255])
    tex.needsUpdate = true
  }
  return {
    group,
    socket,
    bounds: room.clone(),
    setTheme: (bgHex, accentHex, lightHex) => {
      const bg = new THREE.Color(bgHex)
      const accent = new THREE.Color(accentHex)
      const light = new THREE.Color(lightHex)
      set('wall', bg.clone().lerp(light, 0.22))
      set('ceiling', bg.clone().lerp(light, 0.1))
      set('floor', bg.clone().lerp(accent, 0.18).multiplyScalar(0.8))
      set('wood', new THREE.Color(0x8a5a3c).lerp(accent, 0.15))
      set('accent', accent)
      set('accentDark', accent.clone().multiplyScalar(0.55))
      set('cloth', light.clone().lerp(bg, 0.15))
      set('light', light)
      set('screen', accent.clone().lerp(light, 0.35))
      set('dark', bg.clone().multiplyScalar(0.6))
      set('sky', bg.clone().multiplyScalar(0.5).lerp(accent, 0.1))
      starMat.color.copy(light)
    },
  }
}
