import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { makePicoMaterial } from './PicoMaterial'
import { playBoing, playClick } from '../os/sound'

// Easter egg: click the back of the monitor and a hatch in it swings open, his
// brain pops out and spins for a few seconds (with a little heartbeat), then it
// goes back in and the hatch swings shut.
// "the brain" by veryfAtfr0G (https://sketchfab.com/3d-models/the-brain-007847f9d2b5481a882d8996c0fd1847), CC-BY-4.0
const URL = '/models/brain/scene.gltf'
const COLOR = [0xde, 0x8f, 0xa0] // the model's pink (its base color, in sRGB)
const SIZE = 0.5 // world units across its widest side (the hatch is 0.8 wide)

// the hatch: this much of the monitor's back face, centered, hinged along its top edge
const HATCH = { w: 0.8, h: 0.55, thick: 0.03, open: 1.9 } // open: how far it swings (radians)

// timeline, in seconds after the click
const T = {
  open: 0.35, // the hatch swings open
  out: [0.2, 0.75], // the brain pops out through it
  in: [4.1, 4.6], // and goes back in
  close: [4.5, 4.85], // the hatch swings shut (and latches)
}
const SHOW = T.close[1]
// where the brain goes: from inside the monitor, out the back to float behind it
const OUT = 0.65 // how far behind the back face it floats
const LIFT = 0.28 // and how much higher than the hatch's middle

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const phase = (t: number, [a, b]: number[]) => clamp01((t - a) / (b - a))
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2)
const easeInOut = (t: number) => t * t * (3 - 2 * t)

export type Hatch = {
  group: THREE.Group
  door: THREE.Mesh
  hole: THREE.Mesh
  // the middle of the opening, on the back face (which faces +z)
  center: THREE.Vector3
  setOpen: (k: number) => void // 0 shut .. 1 wide open
}

// Built from the monitor's back face: a thin door textured with the same patch of
// the atlas it covers (so it's invisible while shut), and a dark opening behind it.
export function makeHatch(monitor: THREE.Mesh, material: THREE.Material): Hatch {
  monitor.updateMatrixWorld(true)
  const pos = monitor.geometry.getAttribute('position') as THREE.BufferAttribute
  const nor = monitor.geometry.getAttribute('normal') as THREE.BufferAttribute
  const uv = monitor.geometry.getAttribute('uv') as THREE.BufferAttribute
  // the back face's four corners: where they are, and their texture coordinates
  const corners: { p: THREE.Vector3; uv: THREE.Vector2 }[] = []
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    if (n.fromBufferAttribute(nor, i).transformDirection(monitor.matrixWorld).z < 0.5) continue
    corners.push({ p: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(monitor.matrixWorld), uv: new THREE.Vector2().fromBufferAttribute(uv, i) })
  }
  const box = new THREE.Box3().setFromPoints(corners.map((c) => c.p))
  const uvAt = (x: 'min' | 'max', y: 'min' | 'max') =>
    corners.find((c) => Math.abs(c.p.x - box[x].x) < 1e-4 && Math.abs(c.p.y - box[y].y) < 1e-4)!.uv
  const [u00, u10, u01, u11] = [uvAt('min', 'min'), uvAt('max', 'min'), uvAt('min', 'max'), uvAt('max', 'max')]
  // the texture coordinate at a point on the face
  const sample = (x: number, y: number) => {
    const sx = (x - box.min.x) / (box.max.x - box.min.x)
    const sy = (y - box.min.y) / (box.max.y - box.min.y)
    return u00.clone().lerp(u10, sx).lerp(u01.clone().lerp(u11, sx), sy)
  }

  const face = box.max.z
  const center = new THREE.Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, face)
  const top = center.y + HATCH.h / 2

  const geo = new THREE.BoxGeometry(HATCH.w, HATCH.h, HATCH.thick)
  geo.translate(0, -HATCH.h / 2, HATCH.thick / 2) // hangs from the hinge, sitting on the face
  const plain = sample(center.x, center.y) // the edges and inside: the case's plain beige
  const guv = geo.getAttribute('uv') as THREE.BufferAttribute
  const gpos = geo.getAttribute('position')
  for (let i = 0; i < guv.count; i++) {
    // the outside (the +z face: vertices 16..19) shows the bit of the back it covers
    const t = i >= 16 && i < 20 ? sample(center.x + gpos.getX(i), top + gpos.getY(i)) : plain
    guv.setXY(i, t.x, t.y)
  }
  const door = new THREE.Mesh(geo, material)
  const pivot = new THREE.Group()
  pivot.position.set(center.x, top, face)
  pivot.add(door)

  const hole = new THREE.Mesh(new THREE.PlaneGeometry(HATCH.w, HATCH.h), new THREE.MeshBasicMaterial({ color: 0x07070c }))
  hole.position.set(center.x, center.y, face + 0.001)
  hole.visible = false

  const group = new THREE.Group()
  group.add(pivot, hole)
  return {
    group,
    door,
    hole,
    center,
    setOpen: (k) => {
      // swings up and out from the top edge (out is +z)
      pivot.rotation.x = -HATCH.open * k
      hole.visible = k > 0.01
    },
  }
}

// set by PCModel once the PC is built
export const brainHatch: { current: Hatch | null } = { current: null }

export function Brain() {
  const { scene } = useGLTF(URL)
  const brain = useMemo(() => {
    const model = scene.clone(true)
    const material = makePicoMaterial(new THREE.DataTexture(new Uint8Array([...COLOR, 255]), 1, 1))
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material
    })
    // centered on its middle and scaled to SIZE, inside a group that does the moving
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const k = SIZE / Math.max(size.x, size.y, size.z)
    model.scale.setScalar(k)
    model.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-k))
    const group = new THREE.Group()
    group.add(model)
    group.visible = false
    return group
  }, [scene])

  const shownAt = useRef(-Infinity)
  const latched = useRef(true) // the click when the hatch shuts, once per showing
  const n = useStore((s) => s.brain)
  const pending = useRef(false)
  useEffect(() => {
    if (n) pending.current = true // starts on the next frame (that's where the clock is)
  }, [n])

  const inside = useMemo(() => new THREE.Vector3(), [])
  const outside = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const hatch = brainHatch.current
    if (!hatch) return
    const now = clock.elapsedTime
    if (pending.current) {
      pending.current = false
      const t = now - shownAt.current
      if (t >= SHOW) {
        shownAt.current = now
        latched.current = false
        playClick() // the hatch unlatching
        setTimeout(() => playBoing(1), T.out[0] * 1000) // and out it pops
      }
      // clicked again while it's out: it stays out longer (no second pop)
      else if (t > T.out[1] && t < T.in[0]) shownAt.current = now - T.out[1]
    }
    let t = now - shownAt.current
    if (useStore.getState().mode !== 'room') t = Infinity // gone (and shut) while you're at the desk
    if (t >= SHOW && !latched.current) {
      latched.current = true
      playClick(true)
    }

    // the hatch: open, then shut again (with a little bounce at both ends)
    const opening = t < T.open ? easeOutBack(t / T.open) : 1
    const closing = 1 - easeOutBack(phase(t, T.close))
    hatch.setOpen(t >= SHOW || t < 0 ? 0 : Math.min(opening, closing))

    // the brain: out through the opening, spinning, then back in
    const g = brain
    const out = easeOutBack(phase(t, T.out)) * (1 - easeInOut(phase(t, T.in)))
    g.visible = t >= T.out[0] && t < T.in[1]
    if (!g.visible) return
    inside.copy(hatch.center).setZ(hatch.center.z - 0.25)
    outside.set(hatch.center.x, hatch.center.y + LIFT, hatch.center.z + OUT)
    g.position.lerpVectors(inside, outside, out)
    g.position.y += Math.sin(t * 2.4) * 0.025 * Math.min(1, out)
    // spins: a fast twirl as it pops out, settling into a steady turn
    g.rotation.y = t * 2.2 + 6 * (1 - Math.exp(-4 * Math.max(0, t - T.out[0])))
    g.rotation.z = Math.sin(t * 1.7) * 0.15
    const beat = Math.max(0, Math.sin(t * Math.PI * 2.4)) ** 8
    g.scale.setScalar(Math.max(0.01, (0.4 + 0.6 * clamp01(out)) * (1 + beat * 0.06)))
  })

  return <primitive object={brain} />
}

useGLTF.preload(URL)
