import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { THEMES, useTheme } from '../os/theme'
import { makePicoMaterial } from './PicoMaterial'
import { playBoing, playClick, playLand, playMagnet, playPickup, playPoof, playStep, playZap, setBrainHum } from '../os/sound'
import { makeBrainWire } from './BrainWire'
import { makeBrainBuddy } from './BrainBuddy'
import { makeBrainRoom, type BrainRoom } from './BrainRoom'
import { SOLIDS } from './pcSolids'
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
const HATCH = { w: 0.8, h: 0.55, thick: 0.03, open: 2.5 } // open: how far it swings (radians: well past level, clear of the brain)

// timeline, in seconds after the click
const T = {
  open: 0.35, // the hatch swings open
  out: [0.2, 0.75], // the brain pops out through it
  in: [4.1, 4.6], // and goes back in
  close: [4.62, 4.97], // the hatch swings shut (and latches), once it's all the way in
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
  room: BrainRoom // what's behind it (the brain's little room)
  setOpen: (k: number) => void // 0 shut .. 1 wide open
}

// Built from the monitor's back face: a thin door textured with the same patch of
// the atlas it covers (so it's invisible while shut), and behind it a real opening
// (the back face is cut away round it) into the brain's little room.
const LIVING = { w: 0.94, h: 0.62, d: 0.48 } // the room inside the monitor
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

  // the opening: the monitor's back face cut away, a frame round the hole in its
  // place (same texture), and the room behind. (Its own copy of the geometry: the
  // loaded model's is shared.) The hole itself is an invisible pane, for clicks.
  const g = monitor.geometry.clone()
  const index = g.getIndex()!
  const keep: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    if (tri.every((v) => nor.getZ(v) > 0.5)) continue // (the back face)
    keep.push(...tri)
  }
  g.setIndex(keep)
  monitor.geometry = g
  const x0 = center.x - HATCH.w / 2
  const x1 = center.x + HATCH.w / 2
  const y0 = center.y - HATCH.h / 2
  const y1 = center.y + HATCH.h / 2
  const quads = [
    [box.min.x, y1, box.max.x, box.max.y], // above the hole
    [box.min.x, box.min.y, box.max.x, y0], // below
    [box.min.x, y0, x0, y1], // left
    [x1, y0, box.max.x, y1], // right
  ]
  const fp: number[] = []
  const fuv: number[] = []
  const fi: number[] = []
  quads.forEach(([ax, ay, bx, by], q) => {
    for (const [x, y] of [[ax, ay], [bx, ay], [bx, by], [ax, by]]) {
      fp.push(x, y, face)
      const t = sample(x, y)
      fuv.push(t.x, t.y)
    }
    fi.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3)
  })
  const fg = new THREE.BufferGeometry()
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3))
  fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2))
  fg.setIndex(fi)
  fg.computeVertexNormals()
  const frame = new THREE.Mesh(fg, material)

  const room = makeBrainRoom(
    new THREE.Box3(new THREE.Vector3(center.x - LIVING.w / 2, center.y - LIVING.h / 2, face - LIVING.d), new THREE.Vector3(center.x + LIVING.w / 2, center.y + LIVING.h / 2, face)),
  )
  // in the OS theme's colors, following it when it changes
  const theme = (id: string) => {
    const [bg, accent, light] = (THEMES.find((t) => t.id === id) ?? THEMES[0]).swatch
    room.setTheme(bg, accent, light)
  }
  theme(useTheme.getState().theme)
  useTheme.subscribe((s) => theme(s.theme))

  const hole = new THREE.Mesh(new THREE.PlaneGeometry(HATCH.w, HATCH.h), new THREE.MeshBasicMaterial({ visible: false }))
  hole.position.set(center.x, center.y, face + 0.001)

  const group = new THREE.Group()
  group.add(pivot, hole, frame, room.group)
  return {
    group,
    door,
    hole,
    center,
    room,
    setOpen: (k) => {
      // swings up and out from the top edge (out is +z)
      pivot.rotation.x = -HATCH.open * k
    },
  }
}

// set by PCModel once the PC is built
export const brainHatch: { current: Hatch | null } = { current: null }
// out (or on its way out or back in): clicking the back of the monitor again does nothing
export const brainBusy = { current: false }

// Pulling it out: the brain's on a cable from inside the monitor, held together by
// magnetic plugs (see BrainWire). Grab it while it's out and it only stretches a
// little toward the pointer (the tug); pull further and the plugs snap apart, and
// it comes away in your hand, and Slumpy's off without it (the power button won't
// work until it's back). Let go and it falls and bounces. Bring it back to the
// cable's end dangling out of the open hatch and the plugs snap together; it hangs
// there on its cable for a while (to pull it out again, or click the hatch to put
// it away), then the cable reels it in and the hatch shuts. While he's off, the
// hatch opens and shuts by hand (toggleHatch).
type Mode = 'inside' | 'show' | 'tug' | 'held' | 'loose'
// lastSpot: where it last settled (or was picked up from), for when it's thrown out of the room
// joined: the plugs are together (the brain's on its cable). After plugging it
// back in: hanging (out on its cable, waiting), hold (seconds left of that),
// settle (seconds left gliding over to where it hangs), reelNow (the hatch was clicked)
const B = {
  mode: 'inside' as Mode,
  hatchGoal: 0,
  hatchK: 0,
  vel: new THREE.Vector3(),
  spin: new THREE.Vector3(),
  lastSpot: null as THREE.Vector3 | null,
  joined: true,
  hanging: false,
  hold: 0,
  settle: 0,
  reelNow: false,
  tuck: 0, // apart: 1 the cable's end hanging out of the hatch .. 0 pulled back inside
  nextTwitch: 0, // lying loose: when it next twitches and hops (clock seconds)
  alive: false, // up on its legs (see ROAM)
  goal: 'roam' as 'roam' | 'home' | 'climb' | 'enter', // wandering; off home; up the back of the PC; in through the hatch
  homeAt: 0, // (clock seconds) when it sets off home
  looseSince: 0, // (clock seconds) let go of then (lying about, twitching)
  enter: { from: new THREE.Vector3(), t: 0 },
  target: null as THREE.Vector3 | null, // where it's walking to
  pauseUntil: 0, // (clock seconds) standing still, looking about, until then
  walk: 0, // 0 standing .. 1 walking
  phase: 0, // its step cycle
  yaw: 0, // which way it's facing (world)
  born: 0, // (clock seconds) when it came alive (it gets up, then waves)
  waveUntil: 0, // (clock seconds) waving at you until then
  waveK: 0, // 0 .. 1 arm up
  climbK: 0, // 0 .. 1 in its climbing pose
  shuffle: 0, // 0 .. 1 turning on the spot
  steps: 0, // footfalls so far (for their sound)
  climbY: undefined as number | undefined, // how high up the monitor it's got
}
export const brainState: Readonly<typeof B> & { at?: THREE.Vector3; reach?: number } = B // (where it is, for tests and the curious)
const GRAVITY = 9
const RADIUS = 0.17 // about how big it is, for bumping into things
const MAX_THROW = 6
const SNAP = 0.5 // brought this close to the cable's dangling end (hatch open), the plugs snap together
const PULL = 0.45 // the tug: pulled this far, the plugs come apart
const TUG_GIVE = 0.3 // how much of the pull the brain moves while it's still plugged in
const JOINT_DROP = 0.24 // the plugs meet this far below the brain stem's tip (room for its rope to bend)
const REACH = 0.9 // apart, with the brain this close, the cable's plug leans toward it (the magnet)
// holding it with the pointer over the cable's dangling plug (this close to the
// line of sight), the magnet pulls the brain to it: the brain's held at the depth
// it was grabbed at, so this is how it gets there
const MAGNET = 0.45
const HANG = 5 // plugged back in, it hangs out this long before it's reeled in and the hatch shuts
// Out of the PC it's still alive: it breathes (swelling and squishing, with a
// heartbeat), squirms in your hand, and lying loose it twitches every few seconds
// and hops, a little further toward home each time
const TWITCH = { every: [2.2, 5], hop: 1.6, toward: 0.45 } // seconds between, how high, how far toward the PC
const HOME = new THREE.Vector3(0.56, 0, 1.75) // the floor just behind the monitor
// Left lying out of the PC a while, it comes alive: Slumpy's face on its front,
// arms and legs, stem pulled in. It wanders the room, then (whenever it feels like
// it) walks round the back of the PC, climbs up the monitor, opens the hatch if it's
// shut, and climbs back in, plugging its stem back into the cable. Picking it up
// turns it back into a brain.
const ROAM = { after: 6, speed: 0.3, pause: [1, 2.5], near: 1.0, far: 2.2, home: [8, 18], climb: 0.32 } // seconds lying about before; units/s; seconds at each spot; how far from the PC it roams; seconds roaming before it heads home; climbing speed
const MONITOR_BACK = 1.5
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const QX = new THREE.Quaternion()
const QY = new THREE.Quaternion()
const QZ = new THREE.Quaternion()
const PC_CENTER = new THREE.Vector3(0.56, 0, 0.95)
// (and it walks round the PC, not through it)
const FOOTPRINT = { x0: -0.125 - 0.3, x1: 1.25 + 0.3, z0: 0.4375 - 0.3, z1: 1.5 + 0.3 }
const crossesPC = (a: THREE.Vector3, b: THREE.Vector3) => {
  for (let i = 0; i <= 20; i++) {
    const x = a.x + ((b.x - a.x) * i) / 20
    const z = a.z + ((b.z - a.z) * i) / 20
    if (x > FOOTPRINT.x0 && x < FOOTPRINT.x1 && z > FOOTPRINT.z0 && z < FOOTPRINT.z1) return true
  }
  return false
}

// and it thinks: little sparks flicker across it, like neurons firing (faster
// while it's out of the PC and on its own)
const SPARKS = { count: 6, size: 0.026, life: 0.14, rate: 7, rateLoose: 14 } // rate: new sparks a second
const ROOM = 4.5 // further than this from the PC, it poofs back to the last spot it was in
const RESPAWN = new THREE.Vector3(1.8, RADIUS, 0.9) // (if it's never been anywhere: on the desk beside the PC)
const inRoom = (p: THREE.Vector3) => Math.hypot(p.x - 0.56, p.z - 0.9) <= ROOM && p.y <= 6
// grabbing and throwing it is a mouse/trackpad thing: on a touch screen it just
// pops out and spins (dragging there turns the view)
const CAN_GRAB = !matchMedia('(pointer: coarse)').matches

// the hatch is open by hand (to put the brain back): a click on it shuts it
export const hatchOpenByHand = () => B.hatchGoal === 1 && B.mode !== 'show'
// plugged back in and hanging out on its cable: a click on the hatch puts it away
export const brainHanging = () => B.mode === 'show' && B.hanging

// the open hatch clicked while the brain's out on its cable: it's reeled in and the hatch shuts
export function closeHatch() {
  if (B.mode === 'show') B.reelNow = true
}

export function toggleHatch() {
  if (brainHanging()) {
    B.reelNow = true
    return
  }
  if (B.mode === 'show') return
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
    // the brain stem's tip (its lowest point, in the brain's own space): where the cable plugs in
    group.updateMatrixWorld(true)
    const stem = new THREE.Vector3(0, Infinity, 0)
    const v = new THREE.Vector3()
    const surface: THREE.Vector3[] = [] // places on it for the sparks
    model.traverse((o) => {
      const pos = (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute) : null
      if (pos)
        for (let i = 0; i < pos.count; i++) {
          if (v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).y < stem.y) stem.copy(v)
          if (i % 23 === 0) surface.push(v.clone())
        }
    })
    group.userData.stem = stem
    // the sparks: unshaded little bits (so they glow) that live on its surface
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const sparks = Array.from({ length: SPARKS.count }, () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(SPARKS.size, SPARKS.size, SPARKS.size), sparkMat)
      m.visible = false
      m.raycast = () => {}
      m.userData.left = 0
      group.add(m)
      return m
    })
    group.userData.sparks = { sparks, surface, material: sparkMat }
    // its arms, legs and face for when it comes alive. Its front is away from the
    // stem (a brain stem's at the back), so they go on that side
    const back = new THREE.Vector3(stem.x, 0, stem.z)
    const frontYaw = back.lengthSq() > 1e-6 ? Math.atan2(-back.x, -back.z) : 0
    const turned = new THREE.Box3().setFromPoints(surface.map((q) => q.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -frontYaw)))
    const buddy = makeBrainBuddy(turned)
    buddy.group.rotation.y = frontYaw
    group.add(buddy.group)
    group.userData.buddy = buddy
    group.userData.frontYaw = frontYaw // (to face a way, the brain turns by that way's angle less this)
    group.userData.frontDepth = turned.max.z // how far its front is from its middle
    group.userData.standY = -turned.min.y + buddy.legHeight // its middle's height, standing on the desk
    // where the plugs meet, a little below the stem tip: what it spins about
    group.userData.joint = stem.clone().setY(stem.y - JOINT_DROP)
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
  const scratch = useMemo(() => new THREE.Vector3(), [])
  const tug = useMemo(() => ({ home: new THREE.Vector3(), t: 0 }), []) // where it was, and how far into its show
  const nowRef = useRef(0) // the frame clock, for the pointer handlers
  const wire = useMemo(() => makeBrainWire(), [])
  // the cable in the OS theme's accent, its data and the brain's sparks in its light color
  const theme = useTheme((s) => s.theme)
  useEffect(() => {
    const [, accent, light] = (THEMES.find((t) => t.id === theme) ?? THEMES[0]).swatch
    wire.setColors(accent, light)
    wire.onPulse = () => playZap(0.25) // data arriving in the PC
    ;(brain.userData.sparks.material as THREE.MeshBasicMaterial).color.set(light)
  }, [theme, wire, brain])
  useEffect(() => () => setBrainHum(0), []) // (no hum left behind)
  const dangling = useMemo(() => new THREE.Vector3(), []) // the cable's end, once it's apart
  const plugAt = useMemo(() => new THREE.Vector3(), []) // where the brain's cable comes out (its stem)
  const jointAt = useMemo(() => new THREE.Vector3(), []) // where the plugs meet, under the stem
  const stemDown = useMemo(() => new THREE.Vector3(), []) // the way the stem points
  const anchor = useMemo(() => new THREE.Vector3(), []) // where the cable starts, inside the monitor
  const exit = useMemo(() => new THREE.Vector3(), []) // where it comes out through the hatch's opening
  // grabbed: still plugged in, it's a tug first; already apart, it's picked up
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!CAN_GRAB || (B.mode !== 'show' && B.mode !== 'loose')) return
    e.stopPropagation()
    grab.plane.setFromNormalAndCoplanarPoint(e.camera.getWorldDirection(grab.hit).clone(), e.point)
    grab.offset.copy(brain.position).sub(e.point)
    grabState.active = true // (dragging doesn't spin the view)
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    document.body.style.cursor = 'var(--cursor-grabbing)'
    if (B.mode === 'show') {
      B.mode = 'tug'
      B.hanging = false
      B.hatchGoal = 1 // the hatch stays open
      tug.home.copy(brain.position)
      tug.t = nowRef.current - shownAt.current // (its show waits while you tug)
      return
    }
    endBuddy() // (picked up, it's just a brain again)
    B.mode = 'held'
    B.vel.set(0, 0, 0)
    B.lastSpot = brain.position.clone() // where it came from
    playPickup()
  }
  // the plugs pulled apart: it's free, and he's off without it
  const separate = () => {
    B.mode = 'held'
    B.joined = false
    B.tuck = 1 // (its end's out of the hatch already)
    B.vel.set(0, 0, 0)
    brain.scale.setScalar(1)
    B.lastSpot = tug.home.clone()
    playMagnet(false)
    poofAt(plugAt) // a little spark where they came apart
    const s = useStore.getState()
    useStore.setState({ brainOut: true })
    if (!s.poweredOff) s.setPoweredOff(true)
  }
  // back to the cable's end: they snap together (he's whole again), and it hangs
  // out on its cable for a while, just popped out, before it's put away
  const reconnect = () => {
    B.joined = true
    playMagnet(true)
    B.mode = 'show'
    shownAt.current = nowRef.current - T.out[1]
    latched.current = false
    B.hanging = true
    B.hold = HANG
    B.settle = 0.6
    useStore.setState({ brainOut: false }) // (the power button works again)
  }
  // let go: back in if it's at the open hatch, otherwise it flies off the way it was moving
  useEffect(() => {
    const up = () => {
      // let go before the plugs came apart: it carries on with its show
      if (B.mode === 'tug') {
        grabState.active = false
        restoreCursor()
        B.mode = 'show'
        shownAt.current = nowRef.current - tug.t
        return
      }
      if (B.mode !== 'held') return
      grabState.active = false
      restoreCursor()
      if (atPlug()) return reconnect()
      B.mode = 'loose'
      B.looseSince = nowRef.current
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
  // the PC (and the hatch's door, open or shut): pushed out of it the shortest
  // way (and, falling, losing most of its speed that way)
  const collide = (p: THREE.Vector3, vel: THREE.Vector3 | null) => {
    collideDoor(p, vel)
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
      if (vel && vel[axis] * dir < 0) {
        if (Math.abs(vel[axis]) > 1) playLand('mouse', Math.abs(vel[axis]) * 0.5)
        vel[axis] *= -0.3
      }
    }
  }
  // the door's a tilted thin box: work in its own space
  const door = useMemo(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion() }), [])
  const collideDoor = (p: THREE.Vector3, vel: THREE.Vector3 | null) => {
    const mesh = brainHatch.current?.door
    if (!mesh) return
    mesh.updateWorldMatrix(true, false)
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    const l = mesh.worldToLocal(door.p.copy(p))
    if (l.x < box.min.x - RADIUS || l.x > box.max.x + RADIUS || l.y < box.min.y - RADIUS || l.y > box.max.y + RADIUS || l.z < box.min.z - RADIUS || l.z > box.max.z + RADIUS) return
    const pushes: [number, 'x' | 'y' | 'z', number][] = [
      [l.x - (box.min.x - RADIUS), 'x', -1],
      [box.max.x + RADIUS - l.x, 'x', 1],
      [l.y - (box.min.y - RADIUS), 'y', -1],
      [box.max.y + RADIUS - l.y, 'y', 1],
      [l.z - (box.min.z - RADIUS), 'z', -1],
      [box.max.z + RADIUS - l.z, 'z', 1],
    ]
    const [depth, axis, dir] = pushes.reduce((a, b) => (b[0] < a[0] ? b : a))
    l[axis] += depth * dir
    p.copy(mesh.localToWorld(l))
    if (!vel) return
    mesh.getWorldQuaternion(door.q)
    const lv = door.v.copy(vel).applyQuaternion(door.q.invert())
    if (lv[axis] * dir < 0) {
      if (Math.abs(lv[axis]) > 1) playLand('mouse', Math.abs(lv[axis]) * 0.5)
      lv[axis] *= -0.3
      vel.copy(lv.applyQuaternion(door.q.invert()))
    }
  }
  // off its legs and back to being a brain (picked up, or home)
  const endBuddy = () => {
    if (!B.alive) return
    B.alive = false
    B.goal = 'roam'
    ;(brain.userData.buddy as ReturnType<typeof makeBrainBuddy>).show(false)
    wire.setStemShown(true)
  }
  const atPlug = () => !B.alive && !B.joined && B.tuck > 0.6 && plugAt.distanceTo(dangling) < SNAP

  useFrame(({ clock, camera, pointer }, delta) => {
    const hatch = brainHatch.current
    if (!hatch) return
    const now = clock.elapsedTime
    nowRef.current = now
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
      // the hatch clicked while it's hanging out: in it goes, now
      if (B.reelNow) {
        B.reelNow = false
        B.hold = 0
        shownAt.current = Math.min(shownAt.current, now - T.in[0])
      }
      // hanging out after being plugged back in: the show waits, just after the pop
      if (B.hold > 0 && now - shownAt.current >= T.out[1]) {
        B.hold -= dt
        shownAt.current += dt
        if (B.hold <= 0) shownAt.current = Math.min(shownAt.current, now - T.in[0]) // waited long enough: in it goes
      }
      let t = now - shownAt.current
      if (useStore.getState().mode !== 'room') t = SHOW // gone (and shut) while you're at the desk
      // the hatch: open, then shut again (with a little bounce at both ends)
      const opening = t < T.open ? easeOutBack(t / T.open) : 1
      const closing = 1 - easeOutBack(phase(t, T.close))
      B.hatchK = t >= SHOW || t < 0 ? 0 : Math.min(opening, closing)
      hatch.setOpen(B.hatchK)
      if (t >= SHOW) {
        B.mode = 'inside'
        B.hanging = false
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
        scratch.lerpVectors(inside, outside, out)
        scratch.y += Math.sin(now * 2.4) * 0.025 * Math.min(1, out) // (bobs on its own clock, so it keeps going while it waits)
        // spins: a quick twirl as it pops out, settling into a steady turn, with a
        // little wobble. It turns about the joint where the plugs meet (like on a
        // swivel), so the monitor's cable stays put while the brain goes round
        const since = Math.max(0, t - T.out[0])
        const settled = Math.min(1, since / 1.2)
        g.rotation.set(
          Math.sin(now * 1.1) * 0.08 * settled,
          now * 1.6 + 6 * (1 - Math.exp(-4 * since)),
          Math.sin(now * 1.7) * 0.1 * settled,
        )
        const beat = Math.max(0, Math.sin(t * Math.PI * 2.4)) ** 8
        g.scale.setScalar(Math.max(0.01, (0.4 + 0.6 * clamp01(out)) * (1 + beat * 0.06)))
        // keep the joint where it'd be unturned: shift the middle by what the turn moved it
        const pivot = g.userData.joint as THREE.Vector3
        const s = g.scale.x
        scratch.add(grab.last.copy(pivot).multiplyScalar(s)).sub(grab.hit.copy(pivot).multiplyScalar(s).applyEuler(g.rotation))
        // just plugged back in: glides over from where the plugs met
        if (B.settle > 0) {
          B.settle -= dt
          g.position.lerp(scratch, 1 - Math.exp(-dt * 8))
        } else g.position.copy(scratch)
      }
    } else {
      // the hatch by hand (toggleHatch); powering back on shuts it
      if (B.mode === 'inside' && B.hatchGoal && !useStore.getState().poweredOff) {
        B.hatchGoal = 0
        playClick(true)
      }
      // apart, the cable's loose end goes back in before the hatch shuts, and drops
      // back out once it's open (so the hatch never swings through it)
      const k = 1 - Math.exp(-dt * 10)
      B.tuck += ((B.hatchGoal && B.hatchK > 0.85 ? 1 : 0) - B.tuck) * k
      const door = B.hatchGoal || B.joined || B.tuck < 0.05 ? B.hatchGoal : B.hatchK
      B.hatchK += (door - B.hatchK) * (1 - Math.exp(-dt * 9))
      hatch.setOpen(B.hatchK)
    }

    if (B.mode === 'tug') {
      // still plugged in: it gives a little toward the pointer, and comes apart past PULL
      grab.ray.setFromCamera(pointer, camera)
      if (grab.ray.ray.intersectPlane(grab.plane, grab.hit)) {
        const pull = grab.hit.add(grab.offset).sub(tug.home)
        if (pull.length() > PULL) separate()
        else g.position.copy(tug.home).addScaledVector(pull, TUG_GIVE)
      }
    } else if (B.mode === 'held') {
      // follows the pointer across a plane facing the camera, never below the desk
      grab.ray.setFromCamera(pointer, camera)
      if (grab.ray.ray.intersectPlane(grab.plane, grab.hit)) {
        grab.hit.add(grab.offset)
        grab.hit.y = Math.max(grab.hit.y, RADIUS)
        const aim = grab.ray.ray.distanceToPoint(dangling)
        // (aimed so the stem, not the middle, meets the plug)
        if (!B.joined && B.tuck > 0.6 && aim < MAGNET) grab.hit.lerp(scratch.copy(dangling).add(g.position).sub(plugAt), 1 - aim / MAGNET)
        grab.last.copy(g.position)
        g.position.lerp(grab.hit, 1 - Math.exp(-dt * 20))
        collide(g.position, null) // (it doesn't go through the PC, even carried)
        B.vel.lerp(grab.last.subVectors(g.position, grab.last).divideScalar(Math.max(dt, 1e-3)), 0.3)
      }
      // dangles a little with the motion, and squirms
      g.rotation.z += (THREE.MathUtils.clamp(-B.vel.x * 0.1, -0.6, 0.6) + Math.sin(now * 9) * 0.12 - g.rotation.z) * 0.2
      g.rotation.x += (THREE.MathUtils.clamp(B.vel.z * 0.1, -0.6, 0.6) + Math.sin(now * 7.3) * 0.08 - g.rotation.x) * 0.2
      // the plugs touch: they snap together right there (no need to let go)
      if (atPlug()) {
        grabState.active = false
        restoreCursor()
        reconnect()
      }
    } else if (B.mode === 'loose' && B.alive) {
      // alive: up on its legs, wandering the room, then off home and up the back of the PC
      const p = g.position
      const buddy = g.userData.buddy as ReturnType<typeof makeBrainBuddy>
      const age = now - B.born
      // turns toward a way, k: how quickly; how far it still had to go
      const turnTo = (yaw: number, k: number) => {
        let turn = yaw - B.yaw
        turn = Math.atan2(Math.sin(turn), Math.cos(turn))
        B.yaw += turn * (1 - Math.exp(-dt * k))
        return Math.abs(turn)
      }
      const atYou = Math.atan2(camera.position.x - p.x, camera.position.z - p.z)
      // the spot on the desk right behind the monitor, under the hatch, facing it
      const base = scratch.set(hatch.center.x, 0, MONITOR_BACK + (g.userData.frontDepth as number) + 0.03)
      if (B.goal === 'roam' && now > B.homeAt && now > B.pauseUntil) {
        B.goal = 'home'
        B.target = null
      }
      let walking = false
      let turning = 0
      if (B.goal === 'roam' || B.goal === 'home') {
        if (now > B.pauseUntil && (!B.target || Math.hypot(B.target.x - p.x, B.target.z - p.z) < 0.05)) {
          if (B.goal === 'home') {
            if (B.target && Math.hypot(base.x - p.x, base.z - p.z) < 0.06) {
              B.goal = 'climb' // at the foot of the monitor
              B.target = null
            } else if (p.z < FOOTPRINT.z1 && crossesPC(p, base))
              // round the back corner first (not through the PC)
              B.target = new THREE.Vector3(p.x > PC_CENTER.x ? FOOTPRINT.x1 : FOOTPRINT.x0, 0, FOOTPRINT.z1 + 0.05)
            else B.target = base.clone()
          } else if (B.target) {
            // got there: a look about first (and now and then a wave at you)
            B.target = null
            B.pauseUntil = now + THREE.MathUtils.lerp(ROAM.pause[0], ROAM.pause[1], Math.random())
            if (Math.random() < 0.35) B.waveUntil = now + 1.4
          } else
            for (let i = 0; i < 12 && !B.target; i++) {
              const a = Math.random() * Math.PI * 2
              const r = THREE.MathUtils.lerp(ROAM.near, ROAM.far, Math.random())
              const to = new THREE.Vector3(PC_CENTER.x + Math.cos(a) * r, 0, PC_CENTER.z + Math.sin(a) * r)
              if (!crossesPC(p, to)) B.target = to
            }
        }
        if (B.target && now > B.pauseUntil) {
          const dx = B.target.x - p.x
          const dz = B.target.z - p.z
          const d = Math.hypot(dx, dz)
          // turns to face the way first (shuffling round), then sets off
          turning = turnTo(Math.atan2(dx, dz), 5)
          walking = turning < 0.5
          if (walking) {
            const step = Math.min(d, ROAM.speed * dt * B.walk)
            p.x += (dx / d) * step
            p.z += (dz / d) * step
          }
        } else turning = turnTo(atYou + Math.sin(now * 1.3) * 0.3, 3) // stopped: a look at you
        if (B.goal === 'roam') collide(p, null)
      } else if (B.goal === 'climb') {
        // facing the monitor, hand over hand up its back to the hatch (rising with each
        // pull); opens it if it's shut
        turning = turnTo(Math.PI, 8)
        const top = hatch.center.y
        if (p.y < top - 0.001 && B.climbK > 0.7) {
          B.phase += dt * 6
          B.climbY = Math.min(top, (B.climbY ?? p.y) + ROAM.climb * dt * (0.25 + 1.5 * Math.max(0, -Math.cos(B.phase))))
        } else if (p.y >= top - 0.001 && B.hatchGoal !== 1) {
          B.hatchGoal = 1
          playClick()
        } else if (p.y >= top - 0.001 && B.hatchK > 0.85) {
          B.goal = 'enter'
          B.enter.from.copy(p)
          B.enter.t = 0
        }
      } else {
        // a little hop in through the opening, and its stem plugs back into the cable
        B.enter.t = Math.min(1, B.enter.t + dt / 0.7)
        p.lerpVectors(B.enter.from, inside, easeInOut(B.enter.t))
        p.y += Math.sin(B.enter.t * Math.PI) * 0.08
        g.scale.setScalar(1 - 0.4 * B.enter.t)
        B.phase += dt * 8
        if (B.enter.t >= 1) {
          endBuddy()
          B.joined = true
          playMagnet(true)
          B.mode = 'inside'
          B.hatchGoal = 0 // (it shuts behind it)
          g.visible = false
          pickable(false)
          useStore.setState({ brainOut: false }) // (now he just needs turning on)
        }
      }
      if (B.alive) {
        // how it's moving, blended smoothly between
        const k = 1 - Math.exp(-dt * 7)
        B.walk += ((walking ? 1 : 0) - B.walk) * k
        B.shuffle += ((!walking && turning > 0.25 ? 1 : 0) - B.shuffle) * k
        B.climbK += ((B.goal === 'climb' || B.goal === 'enter' ? 1 : 0) - B.climbK) * k
        B.waveK += ((now < B.waveUntil ? 1 : 0) - B.waveK) * k
        if (B.goal !== 'climb' && B.goal !== 'enter') B.phase += dt * (9 * B.walk + 6 * B.shuffle)
        // footfalls
        const steps = Math.floor(B.phase / Math.PI)
        if (steps !== B.steps && (B.walk > 0.4 || B.shuffle > 0.4) && B.goal !== 'climb') playStep()
        B.steps = steps
        const crouch = 1 - easeInOut(clamp01(age / 0.8)) // getting up off the desk
        const pose = buddy.animate(dt, { phase: B.phase, walk: B.walk, climb: B.climbK, wave: B.waveK, crouch, shuffle: B.shuffle, time: now })
        // its face: its own moods wandering about, happy waving, determined going home
        // and climbing, all heart going back in
        buddy.feel(B.goal === 'enter' ? 'love' : B.goal === 'climb' ? 'excited' : B.waveK > 0.3 ? 'happy' : B.goal === 'home' ? 'cool' : null)
        // standing (or clinging) at its height, bobbing, rocking and leaning with it
        const stand = (g.userData.standY as number) * g.scale.y
        if (B.goal === 'climb') p.y = Math.max(stand, B.climbY ?? stand) + pose.bob
        else if (B.goal !== 'enter') p.y = stand + pose.bob
        g.quaternion
          .setFromAxisAngle(Y_AXIS, B.yaw)
          .multiply(QX.setFromAxisAngle(X_AXIS, pose.lean))
          .multiply(QZ.setFromAxisAngle(Z_AXIS, pose.roll))
          .multiply(QY.setFromAxisAngle(Y_AXIS, -(g.userData.frontYaw as number)))
      }
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
      collide(p, B.vel)
      g.rotation.x += B.spin.x * dt
      g.rotation.y += B.spin.y * dt
      g.rotation.z += B.spin.z * dt
      // lying still: every so often it twitches and hops, a bit toward home
      const resting = p.y <= RADIUS + 0.001 && B.vel.lengthSq() < 0.003
      // and lying about a while, it comes alive (once it's landed)
      if (resting && now - B.looseSince > ROAM.after && useStore.getState().mode === 'room') {
        B.alive = true
        B.goal = 'roam'
        B.homeAt = now + THREE.MathUtils.lerp(ROAM.home[0], ROAM.home[1], Math.random())
        B.target = null
        B.born = now
        // it gets up, has a look at you, gives you a wave, then sets off
        B.pauseUntil = now + 2.4
        B.waveUntil = now + 2.1
        B.walk = B.shuffle = B.climbK = B.waveK = 0
        B.climbY = undefined
        // facing whichever way its front was lying
        const front = scratch.set(Math.sin(g.userData.frontYaw as number), 0, Math.cos(g.userData.frontYaw as number)).applyQuaternion(g.quaternion)
        B.yaw = Math.atan2(front.x, front.z)
        ;(g.userData.buddy as ReturnType<typeof makeBrainBuddy>).show(true)
        wire.setStemShown(false)
        playBoing(0.5)
      }
      if (!resting) B.nextTwitch = Math.max(B.nextTwitch, now + 1)
      else if (now > B.nextTwitch) {
        B.nextTwitch = now + THREE.MathUtils.lerp(TWITCH.every[0], TWITCH.every[1], Math.random())
        const home = scratch.subVectors(HOME, p).setY(0)
        const far = home.length()
        home.normalize().multiplyScalar(Math.min(TWITCH.toward, far) * 1.4)
        B.vel.set(home.x + (Math.random() - 0.5) * 0.4, TWITCH.hop * (0.7 + Math.random() * 0.5), home.z + (Math.random() - 0.5) * 0.4)
        B.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3)
        playBoing(0.3)
      }
      if (atPlug()) reconnect()
      // thrown out of the room: back where it last was, in a puff
      else if (!inRoom(p)) {
        poofAt(p)
        p.copy(B.lastSpot ?? RESPAWN)
        B.spin.set(0, 0, 0)
        B.vel.set(0, 0, 0)
        poofAt(p)
        playPoof('appear')
      }
    }
    // thinking: sparks flicker on and off across it
    if (g.visible) {
      const { sparks, surface } = g.userData.sparks as { sparks: THREE.Mesh[]; surface: THREE.Vector3[] }
      const rate = B.mode === 'held' || B.mode === 'loose' ? SPARKS.rateLoose : SPARKS.rate
      for (const sp of sparks) {
        sp.userData.left -= dt
        if (sp.userData.left > 0) continue
        sp.visible = Math.random() < (rate * dt) / sparks.length
        if (!sp.visible) continue
        sp.userData.left = SPARKS.life * (0.6 + Math.random() * 0.8)
        sp.position.copy(surface[Math.floor(Math.random() * surface.length)])
      }
    }
    // alive: breathing (a slow swell and squish) with a heartbeat, while it's out of the PC
    if (B.mode === 'held' || B.mode === 'loose') {
      const beat = Math.max(0, Math.sin(now * Math.PI * 2.4)) ** 8
      const breath = Math.sin(now * 1.8) * 0.03
      g.scale.set(1 + breath + beat * 0.07, 1 - breath + beat * 0.05, 1 + breath + beat * 0.07)
    }
    // the cable: from inside the monitor to the brain, or (apart) hanging out of
    // the hatch, tucked back in as it shuts
    g.updateMatrixWorld()
    g.localToWorld(plugAt.copy(g.userData.stem as THREE.Vector3)) // the stem, wherever it's turned
    g.localToWorld(jointAt.copy(g.userData.joint as THREE.Vector3))
    stemDown.subVectors(jointAt, plugAt).normalize()
    // apart, the cable's end hangs out of the opening; as the hatch shuts it's
    // pulled back up into the opening (and out of sight once it's mostly shut)
    dangling
      .set(hatch.center.x + Math.sin(now * 1.3) * 0.03, hatch.center.y - 0.42, hatch.center.z + 0.12)
      .lerp(anchor.copy(hatch.center).setZ(hatch.center.z - 0.05), 1 - B.tuck)
    // it comes out through the part of the opening nearest where it's headed (a
    // little in from the edges), from straight behind
    const toward = B.joined ? jointAt : dangling
    const edge = 0.07
    exit.set(
      THREE.MathUtils.clamp(toward.x, hatch.center.x - HATCH.w / 2 + edge, hatch.center.x + HATCH.w / 2 - edge),
      THREE.MathUtils.clamp(toward.y, hatch.center.y - HATCH.h / 2 + edge, hatch.center.y + HATCH.h / 2 - edge),
      hatch.center.z + 0.02,
    )
    anchor.copy(hatch.room.socket) // (the socket on the room's back wall)
    if (!wire.group.userData.room) {
      wire.setInterior(hatch.room.bounds)
      wire.group.userData.room = true
    }
    const reach = plugAt.distanceTo(dangling)
    brainState.reach = reach
    if (!B.joined && B.tuck > 0.6 && reach < REACH) dangling.lerp(plugAt, (1 - reach / REACH) * 0.5)
    wire.group.visible = g.visible || (!B.joined && B.tuck > 0.1)
    const stretch = B.mode === 'tug' ? clamp01(g.position.distanceTo(tug.home) / (PULL * TUG_GIVE)) : 0
    // the sound of it: plugged in and out of the PC, it hums (straining as it's
    // tugged); pulled apart, the cable's loose end sparks now and then
    const live = wire.group.visible && B.joined && useStore.getState().mode === 'room'
    setBrainHum(live ? 1 : 0, stretch)
    if (!B.joined && B.tuck > 0.6 && Math.random() < dt * 0.6) {
      playZap(0.6)
      poofAt(dangling)
    }
    if (wire.group.visible) {
      wire.update(anchor, exit, B.joined ? jointAt : dangling, plugAt, stemDown, B.joined, B.joined ? 0.12 * (1 - stretch) : 0.12, now, dt, B.tuck < 0.1)
    } else wire.reset()
    brainBusy.current = B.mode !== 'inside'
    brainState.at = g.position
  })

  return (
    <>
      <primitive object={wire.group} />
      <primitive
        object={brain}
        onPointerDown={onDown}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          if (CAN_GRAB && (B.mode === 'show' || B.mode === 'loose')) document.body.style.cursor = 'var(--cursor-pointer)'
        }}
        onPointerOut={() => B.mode !== 'held' && B.mode !== 'tug' && restoreCursor()}
      />
    </>
  )
}

useGLTF.preload(URL)
