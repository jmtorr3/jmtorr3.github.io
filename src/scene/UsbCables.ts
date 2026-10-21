import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import type { DeviceKind } from '../data/devices'
import { aroundPC } from './pcSolids'

// Chiba (the keyboard) and Hanzo (the mouse) are wired into two USB ports on the
// back of the case, between the vent slots and the fan. Each cable runs from the
// device along the desk, round the side of the case and up into its port, and
// follows the device wherever it's put. Grab a plug at its port and pull: it
// holds, then comes free (the device is disconnected); carry it, let go and it
// drops onto the desk; bring it back near its port and it's pulled in, clicking
// in (or just click it, or tap it, and it flies back in by itself). An empty
// port glows, so it's easy to see where it goes. (Carrying plugs about is mouse
// and trackpad only, like picking up the keyboard and mouse.) When its device poofs
// home, its cable poofs with it: back in its port if it was plugged in, or else
// lying on the desk just behind it.

const solid = (rgb: [number, number, number]) => makePicoMaterial(new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1))

const BACK = 1.4375 // the case's back face (z)
const FRONT = 0.4375 // and its front face
const CLEAR = 0.16 // how far round the case's corners the cables keep
// the ports, in the gap between the vents and the fan (the back's texels, as world space)
const PORTS: Record<DeviceKind, THREE.Vector3> = {
  keyboard: new THREE.Vector3(0.8125, 0.28, BACK),
  mouse: new THREE.Vector3(0.8125, 0.16, BACK),
}
const PLUG = { w: 0.07, h: 0.035, len: 0.08 } // the plug's housing
const THICK = 0.011 // the cable's radius
const DESK = 0.012 // cables lying on the desk sit this high
const PULL = 0.14 // pulled this far from its port, the plug comes out
const SNAP = 0.32 // let go this close to its port, it goes back in
const ATTRACT = 0.55 // carried this close to its port, it's pulled toward it (like a magnet)
const FLY = 0.45 // seconds it takes flying back in by itself (clicked)
const CLICK = 0.04 // picked up and put down without moving further than this: a click
const FALL = 6 // how fast a dropped plug falls (units/s, it's light)

type Plug = {
  kind: DeviceKind
  state: 'in' | 'tug' | 'held' | 'out' | 'fly' // fly: on its way back into its port by itself
  fly: { from: THREE.Vector3; t: number }
  glow: THREE.Group // round its port while it's out of it
  mesh: THREE.Mesh
  cable: THREE.Mesh
  at: THREE.Vector3 // where the plug is (its middle)
  device: THREE.Object3D // the keyboard or mouse it's on the other end of
}

export type Usb = {
  group: THREE.Group
  find: (o: THREE.Object3D) => DeviceKind | null
  // pressed on a plug: grabbed on this plane (facing the camera, through the point pressed)
  grab: (kind: DeviceKind, point: THREE.Vector3, normal: THREE.Vector3) => void
  release: () => void
  holding: () => boolean
  plugIn: (kind: DeviceKind) => void // (clicked or tapped, unplugged: it flies back in)
  update: (dt: number, ray: THREE.Ray) => void
  // its device poofing away (the cable and plug go too; where the plug was, for its puff)
  // and back (in its port, or by it); see deskProps
  poof: (kind: DeviceKind, phase: 'vanish' | 'appear') => THREE.Vector3
  // came out / went in (for the sounds, Slumpy's face, and the store)
  onChange?: (kind: DeviceKind, plugged: boolean) => void
}

export function makeUsb(devices: Record<DeviceKind, THREE.Mesh>): Usb {
  const group = new THREE.Group()
  const cableMat = solid([0x6e, 0x6c, 0x78])
  const plugMat = solid([0xb8, 0xb4, 0xa8])
  const portMat = solid([0x16, 0x16, 0x1c])
  // unshaded, so it glows
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true })
  const plugs = (Object.keys(PORTS) as DeviceKind[]).map((kind): Plug => {
    // the port: a dark slot in the back panel
    const port = new THREE.Mesh(new THREE.BoxGeometry(PLUG.w + 0.012, PLUG.h + 0.012, 0.01), portMat)
    port.position.copy(PORTS[kind]).setZ(BACK + 0.002)
    port.raycast = () => {}
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(PLUG.w, PLUG.h, PLUG.len), plugMat)
    const cable = new THREE.Mesh(new THREE.BufferGeometry(), cableMat)
    cable.raycast = () => {}
    group.add(port, mesh, cable)
    const at = PORTS[kind].clone().setZ(BACK + PLUG.len / 2)
    mesh.position.copy(at)
    // a bright frame round the port, pulsing, while it's empty
    const glow = new THREE.Group()
    const [gw, gh, t] = [PLUG.w + 0.07, PLUG.h + 0.07, 0.02]
    for (const [w, h, x, y] of [[gw, t, 0, gh / 2], [gw, t, 0, -gh / 2], [t, gh, gw / 2, 0], [t, gh, -gw / 2, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.004), glowMat)
      bar.position.set(x, y, 0)
      bar.raycast = () => {}
      glow.add(bar)
    }
    glow.position.copy(PORTS[kind]).setZ(BACK + 0.008)
    glow.visible = false
    group.add(glow)
    return { kind, state: 'in', mesh, cable, at, device: devices[kind], fly: { from: new THREE.Vector3(), t: 0 }, glow }
  })

  const grab = { plug: null as Plug | null, plane: new THREE.Plane(), offset: new THREE.Vector3(), hit: new THREE.Vector3(), from: new THREE.Vector3(), wasOut: false }
  let time = 0
  const home = (p: Plug) => PORTS[p.kind].clone().setZ(BACK + PLUG.len / 2)
  // unplugged and tidied up: lying on the desk just behind its port
  const byPort = (p: Plug) => PORTS[p.kind].clone().setY(DESK + PLUG.h / 2).setZ(BACK + CLEAR + 0.06)
  const tmp = new THREE.Vector3()

  // the cable's way from the device to the plug, as points for a smooth curve
  const route = (p: Plug) => {
    const d = p.device as THREE.Mesh
    if (!d.geometry.boundingBox) d.geometry.computeBoundingBox()
    const box = d.geometry.boundingBox!
    const end = p.at
    // along the desk to below the plug (plugged in: just behind its port), round
    // the case if it's in the way, never under it or along its front
    const below = new THREE.Vector3(end.x, DESK, p.state === 'in' || p.state === 'tug' ? BACK + CLEAR + 0.05 : end.z)
    // out of whichever of the device's ends makes the shortest way there (its back
    // edge, or either side), low down, then onto the desk
    const cx = (box.min.x + box.max.x) / 2
    const cz = (box.min.z + box.max.z) / 2
    const y = box.min.y + (box.max.y - box.min.y) * 0.3
    let pts: THREE.Vector3[] = []
    let best = Infinity
    for (const [ex, ez, ox, oz] of [
      [cx, box.max.z, 0, 0.08],
      [box.min.x, cz, -0.08, 0],
      [box.max.x, cz, 0.08, 0],
    ]) {
      const from = d.localToWorld(new THREE.Vector3(ex, y, ez))
      const onDesk = outside(d.localToWorld(new THREE.Vector3(ex + ox, box.min.y, ez + oz)).setY(DESK))
      const way = [from, onDesk, ...around(onDesk, below), below]
      const len = way.reduce((sum, q, i) => (i ? sum + q.distanceTo(way[i - 1]) : 0), 0)
      if (len < best) {
        best = len
        pts = way
      }
    }
    // up into the plug's back end (plugged in: straight out of the port first)
    const tail = tmp.copy(end).setZ(end.z + PLUG.len / 2)
    if (p.state === 'in' || p.state === 'tug') pts.push(tail.clone().setZ(tail.z + 0.08).setY(Math.max(DESK, tail.y - 0.05)))
    pts.push(tail.clone())
    return pts
  }

  // the case's footprint, with room to spare, and its corners
  const X0 = -0.125 - CLEAR
  const X1 = 1.25 + CLEAR
  const Z0 = FRONT - CLEAR
  const Z1 = BACK + CLEAR
  const CORNERS = [new THREE.Vector3(X0, DESK, Z0), new THREE.Vector3(X1, DESK, Z0), new THREE.Vector3(X1, DESK, Z1), new THREE.Vector3(X0, DESK, Z1)]
  const blocked = (x: number, z: number) => x > X0 + 1e-3 && x < X1 - 1e-3 && z > Z0 + 1e-3 && z < Z1 - 1e-3
  const clear = (a: THREE.Vector3, b: THREE.Vector3) => {
    for (let i = 1; i < 24; i++) if (blocked(a.x + ((b.x - a.x) * i) / 24, a.z + ((b.z - a.z) * i) / 24)) return false
    return true
  }
  // a point right up against the case: out to the edge of the room round it
  const outside = (q: THREE.Vector3) => {
    if (!blocked(q.x, q.z)) return q
    const out: [number, () => void][] = [
      [q.x - X0, () => (q.x = X0)],
      [X1 - q.x, () => (q.x = X1)],
      [q.z - Z0, () => (q.z = Z0)],
      [Z1 - q.z, () => (q.z = Z1)],
    ]
    out.reduce((a, b) => (b[0] < a[0] ? b : a))[1]()
    return q
  }
  // the corners to go by to get from a to b without crossing the case (none if
  // it's clear): the shortest of going one, two or three corners round either way
  const around = (a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] => {
    if (clear(a, b)) return []
    let best: THREE.Vector3[] = []
    let bestLen = Infinity
    for (let start = 0; start < 4; start++)
      for (const step of [1, 3])
        for (let n = 1; n <= 3; n++) {
          const via = Array.from({ length: n }, (_, i) => CORNERS[(start + step * i) % 4])
          const legs = [a, ...via, b]
          if (!legs.every((q, i) => i === 0 || clear(legs[i - 1], q))) continue
          const len = legs.reduce((sum, q, i) => (i ? sum + q.distanceTo(legs[i - 1]) : 0), 0)
          if (len < bestLen) {
            bestLen = len
            best = via
          }
        }
    return best.map((c) => c.clone())
  }

  const draw = (p: Plug) => {
    // lying along the desk and round the PC, never through it
    const curve = aroundPC(new THREE.CatmullRomCurve3(route(p), false, 'centripetal'), THICK, 90)
    p.cable.geometry.dispose()
    p.cable.geometry = new THREE.TubeGeometry(curve, 90, THICK, 5)
  }

  const usb: Usb = {
    group,
    find: (o) => plugs.find((p) => p.mesh === o)?.kind ?? null,
    holding: () => !!grab.plug,
    plugIn: (kind) => {
      const p = plugs.find((q) => q.kind === kind)!
      if (p.state === 'in' || p.state === 'tug' || p.state === 'fly') return
      if (grab.plug === p) grab.plug = null
      p.state = 'fly'
      p.fly.from.copy(p.at)
      p.fly.t = 0
    },
    grab: (kind, point, normal) => {
      const p = plugs.find((q) => q.kind === kind)!
      if (p.state === 'fly') return
      grab.plug = p
      grab.from.copy(p.at)
      grab.wasOut = p.state === 'out'
      grab.plane.setFromNormalAndCoplanarPoint(normal, point)
      grab.offset.copy(p.at).sub(point)
      p.state = p.state === 'in' ? 'tug' : 'held'
    },
    release: () => {
      const p = grab.plug
      grab.plug = null
      if (!p) return
      if (p.state === 'tug') {
        // didn't pull hard enough: still in
        p.state = 'in'
        p.at.copy(home(p))
      } else if (p.at.distanceTo(home(p)) < SNAP) {
        p.state = 'in'
        p.at.copy(home(p))
        usb.onChange?.(p.kind, true)
      } else if (grab.wasOut && p.at.distanceTo(grab.from) < CLICK) {
        // picked up and put straight down: a click, so in it goes by itself
        p.state = 'out'
        usb.plugIn(p.kind)
      } else p.state = 'out' // falls to the desk
    },
    poof: (kind, phase) => {
      const p = plugs.find((q) => q.kind === kind)!
      const at = p.at.clone()
      if (phase === 'vanish') {
        if (grab.plug === p) usb.release()
        if (p.state === 'tug') p.state = 'in'
        p.mesh.visible = p.cable.visible = false
      } else {
        if (p.state !== 'in') {
          p.state = 'out'
          p.at.copy(byPort(p))
        }
        p.mesh.visible = p.cable.visible = true
      }
      return phase === 'vanish' ? at : p.at.clone()
    },
    update: (dt, ray) => {
      time += dt
      glowMat.opacity = 0.65 + 0.35 * Math.sin(time * 5)
      for (const p of plugs) {
        p.glow.visible = p.state !== 'in' && p.state !== 'tug'
        // flying back in by itself: an arc up and over into the port, then it clicks in
        if (p.state === 'fly') {
          p.fly.t = Math.min(1, p.fly.t + dt / FLY)
          const k = p.fly.t * p.fly.t * (3 - 2 * p.fly.t)
          p.at.lerpVectors(p.fly.from, home(p), k)
          p.at.y += Math.sin(p.fly.t * Math.PI) * 0.15
          if (p.fly.t >= 1) {
            p.state = 'in'
            p.at.copy(home(p))
            usb.onChange?.(p.kind, true)
          }
        }
        if (grab.plug === p && ray.intersectPlane(grab.plane, grab.hit)) {
          const want = grab.hit.add(grab.offset)
          if (p.state === 'tug') {
            // stuck in its port: it only gives a little, then comes out
            const pull = want.clone().sub(home(p))
            if (pull.length() > PULL) {
              p.state = 'held'
              usb.onChange?.(p.kind, false)
            } else p.at.copy(home(p)).addScaledVector(pull, 0.15)
          }
          if (p.state === 'held') {
            want.y = Math.max(want.y, DESK + PLUG.h / 2)
            // near its port: pulled toward it, harder the closer it gets
            const d = want.distanceTo(home(p))
            if (d < ATTRACT) want.lerp(home(p), Math.pow(1 - d / ATTRACT, 1.5) * 0.8)
            p.at.lerp(want, 1 - Math.exp(-dt * 20))
          }
        } else if (p.state === 'out' && p.at.y > DESK + PLUG.h / 2) {
          p.at.y = Math.max(DESK + PLUG.h / 2, p.at.y - FALL * dt)
        }
        if (!p.mesh.visible) continue // (poofed away for a moment)
        p.mesh.position.copy(p.at)
        // plugged in it points straight into the port; out, it lies along its cable
        if (p.state === 'in' || p.state === 'tug' || p.state === 'fly') p.mesh.rotation.set(0, 0, 0)
        else p.mesh.rotation.set(0, Math.atan2(p.device.position.x - p.at.x, p.device.position.z - p.at.z), 0) // (lying back along its cable)
        draw(p)
      }
    },
  }
  return usb
}
