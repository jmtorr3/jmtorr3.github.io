import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { makePicoMaterial } from './PicoMaterial'
import { playBoing, playClick, playLand, playPickup, playPoof } from '../os/sound'
import { grabState } from './deskProps'
import { restoreCursor } from './cursor'
import { poofAt } from './DustPuff'

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
// out (or on its way out or back in): clicking the back of the monitor again does nothing
export const brainBusy = { current: false }

// Pulling it out: grab the brain while it's out and it comes away in your hand,
// and Slumpy's off without it (the power button won't work until it's back). Let
// go and it falls and bounces; drop it into the open hatch and it slides back in.
// While he's off, the hatch opens and shuts by hand (toggleHatch).
type Mode = 'inside' | 'show' | 'held' | 'loose' | 'return'
// lastSpot: where it last settled (or was picked up from), for when it's thrown out of the room
const B = { mode: 'inside' as Mode, hatchGoal: 0, hatchK: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3(), lastSpot: null as THREE.Vector3 | null }
export const brainState: Readonly<typeof B> & { at?: THREE.Vector3 } = B // (where it is, for tests and the curious)
const GRAVITY = 9
const RADIUS = 0.17 // about how big it is, for bumping into things
const MAX_THROW = 6
const SNAP = 0.4 // let go this close to the open hatch and it goes back in
const RETURN = 0.35 // seconds to slide in
// the PC, as boxes to bounce off: the case, and the monitor on its stand
const SOLIDS = [
  new THREE.Box3(new THREE.Vector3(-0.125, 0, 0.4375), new THREE.Vector3(1.25, 0.375, 1.4375)),
  new THREE.Box3(new THREE.Vector3(-0.0625, 0.375, 0.5625), new THREE.Vector3(1.1875, 1.6875, 1.5)),
]
const ROOM = 4.5 // further than this from the PC, it poofs back to the last spot it was in
const RESPAWN = new THREE.Vector3(1.8, RADIUS, 0.9) // (if it's never been anywhere: on the desk beside the PC)
const inRoom = (p: THREE.Vector3) => Math.hypot(p.x - 0.56, p.z - 0.9) <= ROOM && p.y <= 6
// grabbing and throwing it is a mouse/trackpad thing: on a touch screen it just
// pops out and spins (dragging there turns the view)
const CAN_GRAB = !matchMedia('(pointer: coarse)').matches

// the hatch is open by hand (to put the brain back): a click on it shuts it
export const hatchOpenByHand = () => B.hatchGoal === 1 && B.mode !== 'show'

export function toggleHatch() {
  if (B.mode === 'show' || B.mode === 'return') return
  B.hatchGoal = B.hatchGoal ? 0 : 1
  playClick(!B.hatchGoal)
}

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

  // only clickable while it's out (inside the monitor it's hidden, but the raycaster would still find it)
  const pickable = (on: boolean) =>
    brain.traverse((o) => {
      if (on) o.layers.enable(0)
      else o.layers.disableAll()
    })
  useEffect(() => pickable(false), [brain])

  const inside = useMemo(() => new THREE.Vector3(), [])
  const outside = useMemo(() => new THREE.Vector3(), [])
  const grab = useMemo(() => ({ plane: new THREE.Plane(), offset: new THREE.Vector3(), hit: new THREE.Vector3(), last: new THREE.Vector3(), ray: new THREE.Raycaster() }), [])
  const back = useRef({ from: new THREE.Vector3(), t: 0 }) // going back in

  // picked up: out of the PC (and he's off without it)
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!CAN_GRAB || (B.mode !== 'show' && B.mode !== 'loose')) return
    e.stopPropagation()
    if (B.mode === 'show') B.hatchGoal = 1 // grabbed on its way out: the hatch stays open
    B.mode = 'held'
    B.vel.set(0, 0, 0)
    brain.scale.setScalar(1)
    grab.plane.setFromNormalAndCoplanarPoint(e.camera.getWorldDirection(grab.hit).clone(), e.point)
    grab.offset.copy(brain.position).sub(e.point)
    B.lastSpot = brain.position.clone() // where it came from
    grabState.active = true // (dragging doesn't spin the view)
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    document.body.style.cursor = 'var(--cursor-grabbing)'
    playPickup()
    const s = useStore.getState()
    if (!s.brainOut) {
      useStore.setState({ brainOut: true })
      if (!s.poweredOff) s.setPoweredOff(true)
    }
  }
  // let go: back in if it's at the open hatch, otherwise it flies off the way it was moving
  useEffect(() => {
    const up = () => {
      if (B.mode !== 'held') return
      grabState.active = false
      restoreCursor()
      if (atMouth()) return goBack()
      B.mode = 'loose'
      if (B.vel.length() > MAX_THROW) B.vel.setLength(MAX_THROW)
      B.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6).multiplyScalar(0.3 + B.vel.length() * 0.4)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  })
  const atMouth = () => {
    const hatch = brainHatch.current
    return !!hatch && B.hatchK > 0.6 && brain.position.distanceTo(grab.hit.copy(hatch.center).setZ(hatch.center.z + 0.15)) < SNAP
  }
  const goBack = () => {
    B.mode = 'return'
    back.current.from.copy(brain.position)
    back.current.t = 0
  }

  useFrame(({ clock, camera, pointer }, delta) => {
    const hatch = brainHatch.current
    if (!hatch) return
    const now = clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const g = brain
    inside.copy(hatch.center).setZ(hatch.center.z - 0.25)
    if (pending.current) {
      pending.current = false
      // (clicked again while it's still out: nothing, it plays out as it is)
      if (B.mode === 'inside') {
        B.mode = 'show'
        shownAt.current = now
        latched.current = false
        playClick() // the hatch unlatching
        setTimeout(() => playBoing(1), T.out[0] * 1000) // and out it pops
        pickable(CAN_GRAB)
      }
    }

    if (B.mode === 'show') {
      let t = now - shownAt.current
      if (useStore.getState().mode !== 'room') t = SHOW // gone (and shut) while you're at the desk
      // the hatch: open, then shut again (with a little bounce at both ends)
      const opening = t < T.open ? easeOutBack(t / T.open) : 1
      const closing = 1 - easeOutBack(phase(t, T.close))
      B.hatchK = t >= SHOW || t < 0 ? 0 : Math.min(opening, closing)
      hatch.setOpen(B.hatchK)
      if (t >= SHOW) {
        B.mode = 'inside'
        B.hatchGoal = 0
        g.visible = false
        pickable(false)
        if (!latched.current) {
          latched.current = true
          playClick(true)
        }
      } else {
        // the brain: out through the opening, spinning, then back in
        const out = easeOutBack(phase(t, T.out)) * (1 - easeInOut(phase(t, T.in)))
        g.visible = t >= T.out[0] && t < T.in[1]
        outside.set(hatch.center.x, hatch.center.y + LIFT, hatch.center.z + OUT)
        g.position.lerpVectors(inside, outside, out)
        g.position.y += Math.sin(t * 2.4) * 0.025 * Math.min(1, out)
        // spins: a fast twirl as it pops out, settling into a steady turn
        g.rotation.set(0, t * 2.2 + 6 * (1 - Math.exp(-4 * Math.max(0, t - T.out[0]))), Math.sin(t * 1.7) * 0.15)
        const beat = Math.max(0, Math.sin(t * Math.PI * 2.4)) ** 8
        g.scale.setScalar(Math.max(0.01, (0.4 + 0.6 * clamp01(out)) * (1 + beat * 0.06)))
      }
    } else {
      // the hatch by hand (toggleHatch); powering back on shuts it
      if (B.mode === 'inside' && B.hatchGoal && !useStore.getState().poweredOff) {
        B.hatchGoal = 0
        playClick(true)
      }
      B.hatchK += (B.hatchGoal - B.hatchK) * (1 - Math.exp(-dt * 9))
      hatch.setOpen(B.hatchK)
    }

    if (B.mode === 'held') {
      // follows the pointer across a plane facing the camera, never below the desk
      grab.ray.setFromCamera(pointer, camera)
      if (grab.ray.ray.intersectPlane(grab.plane, grab.hit)) {
        grab.hit.add(grab.offset)
        grab.hit.y = Math.max(grab.hit.y, RADIUS)
        grab.last.copy(g.position)
        g.position.lerp(grab.hit, 1 - Math.exp(-dt * 20))
        B.vel.lerp(grab.last.subVectors(g.position, grab.last).divideScalar(Math.max(dt, 1e-3)), 0.3)
      }
      // dangles a little with the motion
      g.rotation.z += (THREE.MathUtils.clamp(-B.vel.x * 0.1, -0.6, 0.6) - g.rotation.z) * 0.2
      g.rotation.x += (THREE.MathUtils.clamp(B.vel.z * 0.1, -0.6, 0.6) - g.rotation.x) * 0.2
    } else if (B.mode === 'loose') {
      const p = g.position
      B.vel.y -= GRAVITY * dt
      p.addScaledVector(B.vel, dt)
      // the desk
      if (p.y < RADIUS) {
        p.y = RADIUS
        if (B.vel.y < -1) playLand('mouse', -B.vel.y * 0.6)
        B.vel.y = B.vel.y < -0.8 ? -B.vel.y * 0.35 : 0
        B.vel.x *= Math.exp(-dt * 5)
        B.vel.z *= Math.exp(-dt * 5)
        B.spin.multiplyScalar(Math.exp(-dt * 4))
        // come to rest somewhere in the room: that's its spot now
        if (B.vel.y === 0 && Math.hypot(B.vel.x, B.vel.z) < 0.05 && inRoom(p)) (B.lastSpot ??= new THREE.Vector3()).copy(p)
      }
      // the PC: pushed out of it the shortest way, losing most of its speed that way
      for (const box of SOLIDS) {
        if (p.x < box.min.x - RADIUS || p.x > box.max.x + RADIUS || p.y < box.min.y - RADIUS || p.y > box.max.y + RADIUS || p.z < box.min.z - RADIUS || p.z > box.max.z + RADIUS) continue
        const pushes: [number, 'x' | 'y' | 'z', number][] = [
          [p.x - (box.min.x - RADIUS), 'x', -1],
          [box.max.x + RADIUS - p.x, 'x', 1],
          [p.y - (box.min.y - RADIUS), 'y', -1],
          [box.max.y + RADIUS - p.y, 'y', 1],
          [p.z - (box.min.z - RADIUS), 'z', -1],
          [box.max.z + RADIUS - p.z, 'z', 1],
        ]
        const [depth, axis, dir] = pushes.reduce((a, b) => (b[0] < a[0] ? b : a))
        p[axis] += depth * dir
        if (B.vel[axis] * dir < 0) {
          if (Math.abs(B.vel[axis]) > 1) playLand('mouse', Math.abs(B.vel[axis]) * 0.5)
          B.vel[axis] *= -0.3
        }
      }
      g.rotation.x += B.spin.x * dt
      g.rotation.y += B.spin.y * dt
      g.rotation.z += B.spin.z * dt
      if (atMouth()) goBack()
      // thrown out of the room: back where it last was, in a puff
      else if (!inRoom(p)) {
        poofAt(p)
        p.copy(B.lastSpot ?? RESPAWN)
        B.spin.set(0, 0, 0)
        B.vel.set(0, 0, 0)
        poofAt(p)
        playPoof('appear')
      }
    } else if (B.mode === 'return') {
      // slides back in through the hatch
      const r = back.current
      r.t = Math.min(1, r.t + dt / RETURN)
      g.position.lerpVectors(r.from, inside, easeInOut(r.t))
      g.scale.setScalar(1 - 0.5 * r.t)
      if (r.t >= 1) {
        B.mode = 'inside'
        g.visible = false
        pickable(false)
        playClick()
        useStore.setState({ brainOut: false }) // (now the power button works again)
      }
    }
    brainBusy.current = B.mode !== 'inside'
    brainState.at = g.position
  })

  return (
    <primitive
      object={brain}
      onPointerDown={onDown}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        if (CAN_GRAB && (B.mode === 'show' || B.mode === 'loose')) document.body.style.cursor = 'var(--cursor-pointer)'
      }}
      onPointerOut={() => B.mode !== 'held' && restoreCursor()}
    />
  )
}

useGLTF.preload(URL)
