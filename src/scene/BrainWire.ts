import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import { aroundPC } from './pcSolids'

// The cable from inside the monitor to Slumpy's brain stem: two halves held
// together by magnetic plugs. Plugged in, it runs from the anchor (inside, behind
// the hatch) to the stem, with glowing pulses of data running along it into the
// PC; pulled apart, the monitor's half dangles out of the hatch and the brain's
// half (the stem carrying on down into its plug) hangs from the brain.

const solid = (rgb: [number, number, number]) => makePicoMaterial(new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1))
const THICK = 0.02 // the cable's radius
const PLUG = 0.035 // half a plug's length
// The brain's side is a short floppy rope (the stem carrying on, in the brain's
// own pink, starting a little inside the stem so there's no seam): it leaves the
// stem in line with it, droops, swings and trails behind as the brain moves, and
// its plug end is pinned at the joint while it's plugged in, or hangs free
const STEM = { color: [0xde, 0x8f, 0xa0] as [number, number, number], thick: 0.024, into: 0.05, length: 0.17, points: 6 }
const GRAVITY = 9
const DAMPING = 0.9 // of its swing kept each step
const STIFF = [0.55, 0.2] // how hard the first rope points keep in line with the stem
const PULSES = 4 // bits of data on their way along the cable at once
const PULSE_SPEED = 0.9 // cable lengths a second

export type BrainWire = {
  group: THREE.Group
  // anchor: inside the monitor, straight behind exit, where the cable comes out
  // through the hatch's opening; end: where the monitor's half ends (where the
  // plugs meet, just under the brain stem, or dangling); stem: the brain stem's
  // tip, and down: the way the stem points; sag: how much the cable droops;
  // time, dt: seconds (for the pulses, and the stem rope's swing); tucked: apart
  // with the hatch (nearly) shut, the monitor's half is back inside, out of sight
  update: (
    anchor: THREE.Vector3,
    exit: THREE.Vector3,
    end: THREE.Vector3,
    stem: THREE.Vector3,
    down: THREE.Vector3,
    joined: boolean,
    sag: number,
    time: number,
    dt: number,
    tucked: boolean,
  ) => void
  reset: () => void // (it was put away: the rope starts fresh next time)
  // the cable and its data in the OS theme's colors (its accent, and its light text color)
  setColors: (cable: string, pulse: string) => void
  onPulse?: () => void // a bit of data's just gone into the PC (for its zap)
  setStemShown: (on: boolean) => void // the brain's come alive (see BrainBuddy): its stem's pulled in
  setInterior: (room: THREE.Box3) => void // the room inside the monitor (where the cable starts): it's not kept out of there
}

export function makeBrainWire(): BrainWire {
  // a bright cable (it has to show up against the dark opening behind it): the OS theme's accent (setColors)
  const cableTex = new THREE.DataTexture(new Uint8Array([0xe0, 0x5a, 0x3a, 255]), 1, 1)
  const cableMat = makePicoMaterial(cableTex)
  const plugMat = solid([0xa9, 0xaf, 0xbb])
  const cable = new THREE.Mesh(new THREE.BufferGeometry(), cableMat)
  const rope = new THREE.Mesh(new THREE.BufferGeometry(), solid(STEM.color))
  const plugA = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, PLUG * 2), plugMat) // the monitor's end
  const plugB = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, PLUG * 2), plugMat) // the brain's end
  const group = new THREE.Group()
  for (const m of [cable, rope, plugA, plugB]) {
    m.raycast = () => {} // not something to click: clicks go through to the brain or the PC
    group.add(m)
  }
  // the data: little glowing bits travelling from the brain into the PC (unshaded, so they glow)
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff })
  const pulses = Array.from({ length: PULSES }, () => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), pulseMat)
    p.raycast = () => {}
    group.add(p)
    return p
  })
  group.visible = false

  // the monitor's cable: straight out through the opening, leaving square to the
  // back panel and staying behind it until it curves round to its end (so it
  // never cuts through the monitor's back)
  const inner = new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3())
  const outer = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3())
  const raw = new THREE.CurvePath<THREE.Vector3>()
  raw.curves = [inner, outer]
  let path: THREE.Curve<THREE.Vector3> = raw // (kept out of the PC: see route)
  // rise: which way it comes into its end: up from below (into the joint), or
  // down from above (hanging loose)
  const route = (anchor: THREE.Vector3, exit: THREE.Vector3, end: THREE.Vector3, sag: number, rise: number) => {
    inner.v1.copy(anchor)
    inner.v2.copy(exit)
    outer.v0.copy(exit)
    outer.v3.copy(end)
    // the end still inside (the brain on its way out or back in): straight to it,
    // not out the back and in again
    if (end.z < exit.z + 0.12) {
      outer.v1.lerpVectors(exit, end, 1 / 3)
      outer.v2.lerpVectors(exit, end, 2 / 3)
    } else {
      outer.v1.copy(exit).setZ(exit.z + 0.18)
      outer.v2.set(end.x, end.y - rise - sag, Math.max(end.z, exit.z + 0.12))
    }
    raw.updateArcLengths()
    // lying against the PC rather than through it (except going in through the opening)
    path = aroundPC(raw, THICK, 32, (p) => p.z < exit.z + 0.005 && !!interior?.containsPoint(p))
    cable.geometry.dispose()
    cable.geometry = new THREE.TubeGeometry(path, 32, THICK, 5)
  }

  // the stem rope: points from the stem tip ([0], held there) to the plug end,
  // moved by verlet steps (each remembers where it was, which is its speed)
  const n = STEM.points
  const seg = STEM.length / (n - 1)
  const pts = Array.from({ length: n }, () => new THREE.Vector3())
  const prev = Array.from({ length: n }, () => new THREE.Vector3())
  let fresh = true
  let stemShown = true
  let interior: THREE.Box3 | null = null
  const tmp = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const look = new THREE.Vector3()
  const lastK = Array.from({ length: PULSES }, () => 0) // (to tell when a pulse goes in and starts over)
  const swing = (stem: THREE.Vector3, down: THREE.Vector3, pin: THREE.Vector3 | null, dt: number) => {
    // first time out, or jumped (a poof): lay it straight down from the stem
    if (fresh || pts[0].distanceTo(stem) > 0.5) {
      pts.forEach((p, i) => p.copy(stem).addScaledVector(down, seg * i))
      prev.forEach((p, i) => p.copy(pts[i]))
      fresh = false
    }
    pts[0].copy(stem)
    prev[0].copy(stem)
    const g = GRAVITY * dt * dt
    for (let i = 1; i < n; i++) {
      tmp.subVectors(pts[i], prev[i]).multiplyScalar(DAMPING)
      prev[i].copy(pts[i])
      pts[i].add(tmp)
      pts[i].y -= g
    }
    // it leaves the stem in line with it, bending more further down
    STIFF.forEach((k, i) => pts[i + 1].lerp(tmp.copy(stem).addScaledVector(down, seg * (i + 1)), k))
    // each bit stays its length from the next (the stem end fixed, and the plug end too while it's plugged in)
    for (let it = 0; it < 5; it++) {
      if (pin) pts[n - 1].copy(pin)
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        tmp.subVectors(b, a)
        const d = tmp.length() || 1e-6
        const fix = (d - seg) / d
        const aFixed = i === 0
        const bFixed = !!pin && i + 1 === n - 1
        if (aFixed && bFixed) continue
        if (aFixed) b.addScaledVector(tmp, -fix)
        else if (bFixed) a.addScaledVector(tmp, fix)
        else {
          a.addScaledVector(tmp, fix / 2)
          b.addScaledVector(tmp, -fix / 2)
        }
      }
    }
    if (pin) pts[n - 1].copy(pin)
    // drawn as a smooth tube, starting a little up inside the stem
    const curve = new THREE.CatmullRomCurve3([tmp.copy(stem).addScaledVector(down, -STEM.into), ...pts])
    rope.geometry.dispose()
    rope.geometry = new THREE.TubeGeometry(curve, 12, STEM.thick, 6)
  }

  const wire: BrainWire = {
    group,
    reset: () => {
      fresh = true
    },
    setInterior: (room) => {
      interior = room.clone().expandByScalar(0.02)
    },
    setStemShown: (on) => {
      stemShown = on
      if (!on) fresh = true // (out again, it hangs straight down)
      rope.visible = plugB.visible = on
    },
    setColors: (cableColor, pulseColor) => {
      const c = new THREE.Color(cableColor)
      ;(cableTex.image.data as Uint8Array).set([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255])
      cableTex.needsUpdate = true
      pulseMat.color.set(pulseColor)
    },
    update: (anchor, exit, end, stem, down, joined, sag, time, dt, tucked) => {
      for (const p of pulses) p.visible = joined
      cable.visible = plugA.visible = joined || !tucked
      if (joined) {
        rope.visible = plugB.visible = true
        // the two plugs meet face to face at the joint, lined up with the stem (the
        // brain's above it, the monitor's below); the cable rises into the bottom of
        // the monitor's plug, and the stem rope bends up from the top of the brain's
        dir.subVectors(stem, end).normalize()
        plugA.position.copy(end).addScaledVector(dir, -PLUG)
        plugB.position.copy(end).addScaledVector(dir, PLUG)
        plugA.lookAt(end)
        plugB.lookAt(look.copy(end).addScaledVector(dir, 2))
        route(anchor, exit, look.copy(end).addScaledVector(dir, -PLUG * 2), sag, 0.22)
        swing(stem, down, look.copy(end).addScaledVector(dir, PLUG * 2), dt)
        // from the plug end (the brain's side) back along the cable into the PC
        pulses.forEach((p, i) => {
          const k = (time * PULSE_SPEED + i / PULSES) % 1
          if (k < lastK[i]) wire.onPulse?.() // round again: it got there
          lastK[i] = k
          path.getPointAt(1 - k, p.position)
          p.scale.setScalar(0.6 + 0.4 * Math.sin(k * Math.PI)) // swells along the way
        })
      } else {
        // the monitor's half hangs where it is; the brain's plug swings on the end of its rope
        plugA.position.copy(end)
        plugA.lookAt(look.copy(end).setY(end.y + 1))
        route(anchor, exit, end, sag, -0.18)
        rope.visible = plugB.visible = stemShown
        if (!stemShown) return
        swing(stem, down, null, dt)
        dir.subVectors(pts[n - 1], pts[n - 2]).normalize()
        plugB.position.copy(pts[n - 1]).addScaledVector(dir, PLUG)
        plugB.lookAt(pts[n - 2])
      }
    },
  }
  return wire
}
