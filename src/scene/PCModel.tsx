import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import { makeScreenMaterial } from './ScreenMaterial'
import { SlumpyFace, FACE_W, FACE_H, CRT_OFF, type Expression } from './SlumpyFace'
import { paintDesktop } from './screenDesktop'
import { DURATION as ZOOM_SECONDS } from './CameraRig'
import { useStore, isOff } from '../store'
import { unlockAudio, playKeyClack, playCrtOn, playCrtOff, playSpinUp, playFaceSound, playFart, playPickup, playLand, playBump, playPoof, playClick, playPurr, playUsb, speak, speakSoon } from '../os/sound'
import { DeskProps, grabState } from './deskProps'
import { poofAt } from './DustPuff'
import { brainBusy, brainHanging, brainHatch, closeHatch, hatchOpenByHand, makeHatch, toggleHatch } from './Brain'
import { makeFloppy } from './Floppy'
import { makeKeyCaps } from './KeyCaps'
import { makeUsb } from './UsbCables'
import { makeSantaHat } from './SantaHat'
import { isDecember } from '../os/occasion'
import { chatReply, SIGN_IN_COMMANDS } from '../os/chat'
import { openRoomKeyboard } from './RoomKeyboard'
import { restoreCursor, type HoverKind } from './cursor'
import { devices } from '../data/devices'
import { profile } from '../data/profile'

const URL = '/models/pc.gltf'
// Blockbench names every node "cube"; the monitor's screen panel is the 8th mesh
const SCREEN_MESH_INDEX = 7
const KEYBOARD_MESH_INDEX = 10
const MOUSE_MESH_INDEX = 11 // the little mouse next to the keyboard
// how far the 3D mouse slides from its rest spot (world units) as the cursor crosses the screen
const MOUSE_RANGE = { side: 0.12, depth: 0.09 }
// easter egg: the round fan grille on the back of the case, as texels in the
// 128px atlas (with a texel of slack so it's easy to hit on a phone)
const FAN_TEXELS = { x0: 60, x1: 67, y0: 51, y1: 58 }
// easter egg: the back of the monitor (the big box behind the screen) has a hatch
// in it: his brain pops out (see Brain)
const MONITOR_BACK_MESH_INDEX = 8
// all of the monitor seen from behind: its housing, its neck, and the back of the
// frame round the screen (which shows above and beside the housing)
const MONITOR_REAR_MESH_INDICES = [3, 4, 5, 6, MONITOR_BACK_MESH_INDEX, 9]
// Typing in the room (before going into the desktop) turns his screen into a
// command line; Enter and his face comes back to answer it (see os/chat)
export const TYPED_LENGTH = 72 // letters on the line, at most
const TYPING_IDLE_MS = 10_000 // left alone this long, the line clears and his face comes back
// easter eggs: the screensaver comes on after the room's been left alone this long
const SAVER_AFTER_MS = 90_000
// petting: rub the pointer back and forth over the top of the monitor (above
// the screen): this many turns within PET_WINDOW_MS, each at least PET_SWIPE px
const PET = { above: 1.5, turns: 4, windowMs: 1500, swipe: 12, everyMs: 1600 }
// picking up the keyboard and mouse is a mouse/trackpad thing; on touch screens
// dragging orbits the camera and tapping them turns the PC on like the rest of it
const CAN_GRAB = !matchMedia('(pointer: coarse)').matches
// on a touch screen a finger on the PC isn't "hovering": rotating the view would
// keep setting off the smile. Holding a finger still on him does it instead.
const TOUCH_HOLD_MS = 450
const TOUCH_SLOP = 10 // px the finger can drift before it's a drag, not a hold
// the power button, added to the case (the model doesn't have one): the right end
// of the front panel as you face it (the PC faces -z, so the viewer's right is -x).
// at: the middle of where it meets the panel
const POWER_BUTTON = { at: new THREE.Vector3(0, 0.19, 0.4375), size: 0.09, depth: 0.025, travel: 0.015 }
const BUTTON_COLOR = [0x8c, 0x86, 0x79] // a shade darker than the beige case
// on a touch screen the button is a few px across: there, tapping the right end
// of the case's front panel (around the button) presses it too. Texels in the
// atlas, like the fan; the front panel is u 45..66 (left to right as you face it), v 46..51
const POWER_PANEL_TEXELS = { x0: 59, x1: 66, y0: 46, y1: 51 }
const CASE_MESH_INDEX = 0

// what scrolls by on the screen as he boots from the power button (up to 24
// characters a line fit), and when each line shows up, in seconds
// (it starts once the camera has mostly leaned in to read it)
const BOOT_LOG = [
  [0.6, 'SLUMPYOS 1.0 TTY1'],
  [0.9, 'LINUX 6.1.0-SLUMPY'],
  [1.3, '[ OK ] MOUNTED /HOME'],
  [1.6, '[ OK ] PICOCAD DITHER'],
  [1.8, `[ OK ] FOUND ${devices.keyboard.name}`],
  [1.95, `[ OK ] FOUND ${devices.mouse.name}`],
  [2.3, '[ OK ] STARTED SOUND'],
  [2.7, '[ OK ] STARTED FACE'],
  [3.0, '[ OK ] REACHED GUI'],
  [3.5, `${profile.host} LOGIN: ${profile.user}`],
  [3.9, `WAKING UP ${profile.host}...`],
].map(([at, text]) => ({ at: at as number, text: (text as string).slice(0, 24) }))
const BOOT_MS = 4900 // the log, plus a moment on the last line

// where the power button is on screen (CSS px), for the arrow pointing at it
// while Slumpy is off (see PowerHint)
export const powerButtonOnScreen = { x: 0, y: 0, visible: false }

// typing at him in the room from a phone's on-screen keyboard (see RoomKeyboard):
// the whole line so far each time it changes, and Enter
export const roomChat: { current: { setLine: (text: string) => void; enter: () => void } | null } = { current: null }

type ClickEvent = {
  stopPropagation: () => void
  delta: number
  uv?: THREE.Vector2
  point: THREE.Vector3
  face?: THREE.Face | null
  object: THREE.Object3D
}

type PressEvent = {
  stopPropagation: () => void
  point: THREE.Vector3
  button: number
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
  object: THREE.Object3D
  ray: THREE.Ray
  camera: THREE.Camera
  target: EventTarget | null
}

export type { HoverKind }

const hitFan = (e: ClickEvent) => {
  if (!e.uv) return false
  const x = Math.floor(e.uv.x * 128)
  const y = Math.floor(e.uv.y * 128)
  return x >= FAN_TEXELS.x0 && x <= FAN_TEXELS.x1 && y >= FAN_TEXELS.y0 && y <= FAN_TEXELS.y1
}

// which way the clicked face points along z: -1 the front (the PC faces -z), +1 the back
const _n = new THREE.Vector3()
const facing = (e: ClickEvent) => (e.face ? _n.copy(e.face.normal).transformDirection(e.object.matrixWorld).z : 0)

// the right end of the front panel (the atlas reuses some of these texels on
// other faces, so it has to be the front-facing side)
const hitPowerPanel = (e: ClickEvent) => {
  if (!e.uv || !e.face) return false
  if (facing(e) > -0.5) return false
  const x = Math.floor(e.uv.x * 128)
  const y = Math.floor(e.uv.y * 128)
  const t = POWER_PANEL_TEXELS
  return x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1
}

export function PCModel({ onHover }: { onHover: (kind: HoverKind) => void }) {
  const { scene } = useGLTF(URL)
  const setScreen = useStore((s) => s.setScreen)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)

  const model = useMemo(() => {
    const root = scene.clone(true)
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
    })
    const map = (meshes[0]?.material as THREE.MeshStandardMaterial | undefined)?.map ?? null
    const material = makePicoMaterial(map)
    meshes.forEach((m) => (m.material = material))

    // the screen glows with the Slumpy face (black while the desktop is up)
    const face = new SlumpyFace()
    face.paintDesktop = paintDesktop // (still signed in, back in the room)
    face.bootLog = BOOT_LOG
    const screen = meshes[SCREEN_MESH_INDEX]
    let screenBox: THREE.Box3 | null = null
    if (screen) {
      root.updateMatrixWorld(true)
      screenBox = new THREE.Box3().setFromObject(screen)
      screen.material = makeScreenMaterial(face.texture, screenBox)
    }
    // the keyboard and mouse can be picked up; they can't go into the rest of the PC
    root.updateMatrixWorld(true)
    const pc = new THREE.Box3()
    meshes.forEach((m, i) => {
      if (i !== KEYBOARD_MESH_INDEX && i !== MOUSE_MESH_INDEX) pc.union(new THREE.Box3().setFromObject(m))
    })
    const props = new DeskProps(
      [
        { mesh: meshes[KEYBOARD_MESH_INDEX], kind: 'keyboard' },
        { mesh: meshes[MOUSE_MESH_INDEX], kind: 'mouse' },
      ],
      pc,
      pc.getCenter(new THREE.Vector3()),
    )
    props.onGrab = () => playPickup()
    props.onLand = (p, speed) => playLand(p.kind, speed)
    props.onClack = (p, speed) => playLand(p.kind, Math.min(speed, 2) * 0.6)
    // left out too long: gone in a puff, back home in another (its cable too)
    props.onPoof = (p, at, phase) => {
      poofAt(at)
      poofAt(usb.poof(p.kind, phase))
      playPoof(phase)
    }
    const mouse = props.find(meshes[MOUSE_MESH_INDEX])

    const tex = new THREE.DataTexture(new Uint8Array([...BUTTON_COLOR, 255]), 1, 1)
    const { at, size, depth } = POWER_BUTTON
    const button = new THREE.Mesh(new THREE.BoxGeometry(size, size, depth), makePicoMaterial(tex))
    button.position.set(at.x, at.y, at.z - depth / 2) // sticking out of the panel
    root.add(button)
    // the hatch in the back of the monitor the brain comes out of
    const hatch = makeHatch(meshes[MONITOR_BACK_MESH_INDEX], material)
    root.add(hatch.group)
    const floppy = makeFloppy()
    root.add(floppy.group)
    // typing in the room presses its keys (only rocks it while it's sitting still)
    const keyboard = props.find(meshes[KEYBOARD_MESH_INDEX])
    const keys = makeKeyCaps(meshes[KEYBOARD_MESH_INDEX], () => keyboard?.state === 'rest')
    if (isDecember()) root.add(makeSantaHat())
    // the keyboard and mouse's USB cables, into the back of the case
    const usb = makeUsb({ keyboard: meshes[KEYBOARD_MESH_INDEX], mouse: meshes[MOUSE_MESH_INDEX] })
    root.add(usb.group)
    return { root, meshes, face, material, mouse, props, screenBox, button, hatch, floppy, keys, usb }
  }, [scene])

  // the happy face is for pointing at the PC itself, not for messing with the
  // keyboard and mouse (or carrying one over the PC)
  const [hovered, setHovered] = useState(false)
  // asleep from the start, so the loading screen fades onto a sleepy face; he
  // wakes up just after (the wake-up effect below)
  const [asleep, setAsleep] = useState(true)
  const [typing, setTyping] = useState(false) // his screen's a command line (typing in the room)
  const typingRef = useRef(false)
  typingRef.current = typing
  const [saver, setSaver] = useState(false) // the screensaver's on (left alone in the room)
  // shut down (the screen and lights go dark), and the loading face while he
  // turns back on from the power button
  const poweredOff = useStore((s) => s.poweredOff)
  const rebooting = useStore((s) => s.rebooting)
  const booting = useStore((s) => s.booting)
  const session = useStore((s) => s.session) // signed in to the desktop (see stepAway)
  const setBooting = (booting: boolean) => useStore.setState({ booting, leaning: booting })
  const bootStart = useRef(0) // when the boot log started (performance.now())
  const hoverAt = (obj: THREE.Object3D) => {
    if (!CAN_GRAB) return // touch: see holdStart
    if (CAN_GRAB && model.usb.find(obj)) return onHover('prop') // a plug: grab it
    const prop = CAN_GRAB && model.props.find(obj)
    // off: the power button (and the hatch on his back) are the only things on him that can be clicked
    const hatch = obj === model.meshes[MONITOR_BACK_MESH_INDEX] || obj === model.hatch.frame || obj === model.hatch.door || obj === model.hatch.hole
    const dead = !prop && obj !== model.button && !hatch && isOff(useStore.getState())
    onHover(prop ? 'prop' : dead ? null : 'pc')
    useStore.getState().setHoverDevice(prop ? prop.kind : null)
    setHovered(!prop && !model.props.holding)
  }
  const invalidate = useThree((s) => s.invalidate)

  // touch: a finger held still on the PC is the "hover" (happy face) until it lifts
  const touchHold = useRef({ timer: 0, held: false })
  const holdStart = (e: PressEvent) => {
    if (CAN_GRAB || e.pointerType !== 'touch' || mode !== 'room') return
    const h = touchHold.current
    clearTimeout(h.timer)
    h.held = false
    const x0 = e.clientX
    const y0 = e.clientY
    const stop = () => {
      clearTimeout(h.timer)
      setHovered(false)
      window.removeEventListener('pointermove', moved)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    const moved = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > TOUCH_SLOP) stop() // rotating the view
    }
    h.timer = window.setTimeout(() => {
      h.held = true
      setHovered(true)
    }, TOUCH_HOLD_MS)
    window.addEventListener('pointermove', moved)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  useEffect(() => {
    let expr: Expression | null = null // idle: cycles moods by itself
    // (the boot log stays up through the zoom into the sign-in, and under it
    // while it fades in)
    // still signed in: the desktop stays on his screen (typing at him in the room
    // still brings up his command line)
    if (session && !poweredOff) expr = typing && mode === 'room' ? 'prompt' : 'desktop'
    else if (mode === 'exiting' || poweredOff || (mode === 'desktop' && !booting)) expr = 'off'
    else if (booting) expr = 'boot'
    else if (mode === 'zooming') expr = 'surprised'
    else if (saver) expr = 'starfield'
    else if (typing) expr = 'prompt'
    else if (asleep) expr = 'asleep'
    else if (hovered) expr = 'happy'
    // turned off with the power button: the tube switches off (it just goes black
    // when the desktop takes over)
    if (expr === 'off' && poweredOff && mode === 'room') model.face.powerDown()
    // hovering on and off shouldn't cut a reaction short (getting hit, a fart, …)
    else model.face.set(expr, expr === null || expr === 'happy')
    // the canvas only renders on demand while the desktop is up
    invalidate()
    // leaving the desktop puts the keyboard and mouse back where they belong
    if (mode === 'exiting') model.props.reset()
  }, [mode, hovered, asleep, typing, saver, booting, poweredOff, session, model, invalidate])

  // the screensaver: the room left alone (no pointer, keys or wheel) for a while.
  // Anything at all and he wakes up with a start.
  const saverRef = useRef(false)
  saverRef.current = saver
  useEffect(() => {
    let last = performance.now()
    const input = () => {
      last = performance.now()
      if (!saverRef.current) return
      setSaver(false)
      model.face.react('surprised', 1.2)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
    events.forEach((ev) => window.addEventListener(ev, input, { passive: true }))
    const id = setInterval(() => {
      const s = useStore.getState()
      if (s.mode !== 'room' || s.poweredOff || s.booting) last = performance.now()
      else if (!saverRef.current && performance.now() - last > SAVER_AFTER_MS) setSaver(true)
    }, 1000)
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, input))
      clearInterval(id)
    }
  }, [model])

  // the Konami code (see os/konami): he dances along in the room too
  const disco = useStore((s) => s.disco)
  useEffect(() => {
    const left = disco - performance.now()
    if (left > 0) model.face.react('music', left / 1000)
  }, [disco, model])

  // petting: back and forth over the top of the monitor makes him purr
  const pet = useRef({ x: 0, travel: 0, turns: [] as number[], last: -Infinity })
  const petAt = (e: { object: THREE.Object3D; point: THREE.Vector3; clientX: number }) => {
    const p = pet.current
    const dx = e.clientX - p.x
    p.x = e.clientX
    const s = useStore.getState()
    const onTop = e.point.y > PET.above && model.meshes.includes(e.object as THREE.Mesh) && !model.props.find(e.object)
    if (!CAN_GRAB || !onTop || s.mode !== 'room' || s.poweredOff || s.booting || Math.abs(dx) > 200) {
      p.travel = 0
      return
    }
    // a turn: the pointer changed direction after a decent swipe
    if (p.travel && Math.sign(dx) !== Math.sign(p.travel) && Math.abs(p.travel) > PET.swipe) {
      const now = performance.now()
      p.turns = [...p.turns.filter((t) => now - t < PET.windowMs), now]
      p.travel = 0
      if (p.turns.length >= PET.turns && now - p.last > PET.everyMs) {
        p.last = now
        model.face.react('love', 2)
        playPurr()
      }
    }
    p.travel += dx
  }

  // stacking: the mouse put down on top of the keyboard (or the other way round)
  // gets a puzzled look
  const stacked = useRef<string | null>(null)

  // going into the OS: as the camera arrives, his face switches off like the tube
  // does, down to a dot just as the desktop appears (which switches on from a dot).
  // Straight from the boot log, the sign-in fades in over the log instead.
  useEffect(() => {
    // (still signed in, the desktop's already on: it just stays on)
    if (mode !== 'zooming' || useStore.getState().booting || useStore.getState().session) return
    const id = setTimeout(() => model.face.powerDown(), (ZOOM_SECONDS - CRT_OFF) * 1000 - 60)
    return () => clearTimeout(id)
  }, [mode, model])

  // a USB plug pulled out or put back: the chime, his reaction, and the device's gone (or back)
  useEffect(() => {
    model.usb.onChange = (kind, plugged) => {
      playUsb(plugged)
      useStore.setState((s) => ({ unplugged: { ...s.unplugged, [kind]: !plugged } }))
      if (!useStore.getState().poweredOff) model.face.react(plugged ? 'happy' : 'surprised', 1.6)
    }
    return () => {
      model.usb.onChange = undefined
    }
  }, [model])

  // spun around too fast: dizzy for a few seconds (its sound plays via onChange)
  const spins = useStore((s) => s.spins)
  useEffect(() => {
    if (spins) model.face.react('dizzy', 3)
  }, [spins, model])

  // front-panel lights: red power, green drive activity, blue blinks with the face
  const lights = useRef({ hddUntil: 0, hddNext: 0, hddOn: false, faceLeft: 0 })
  // the desk mouse follows the cursor: screen left/right and up/down map to sliding
  // it sideways and forward/back along the desk, relative to where the camera is
  const mouseMove = useRef({ right: new THREE.Vector3(), away: new THREE.Vector3(), goal: new THREE.Vector3(), pressed: false })
  useEffect(() => {
    const down = () => (mouseMove.current.pressed = true)
    const up = () => {
      mouseMove.current.pressed = false
      // let go of whatever's held, wherever the pointer is
      if (model.props.holding) {
        model.props.release()
        restoreCursor()
      }
      if (model.usb.holding()) {
        model.usb.release()
        grabState.active = false
        restoreCursor()
      }
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [model])

  // the boot screen in index.html waits for the scene: a couple of frames in,
  // the model is loaded and its shaders compiled, so it can go
  const framesDrawn = useRef(0)
  const corner = useRef(new THREE.Vector3())
  const raycaster = useRef(new THREE.Raycaster())
  const jolt = useRef(0) // seconds of shake left (fan easter egg)
  const clockRef = useRef(0)
  const floppyOut = useRef({ goal: 0, k: 0 }) // the disk: 0 in the drive .. 1 ejected
  const pressedUntil = useRef(0) // the power button is pushed in until then (clock seconds)
  const buttonAt = useRef(new THREE.Vector3())
  useFrame(({ clock, camera, pointer, size }, dt) => {
    clockRef.current = clock.elapsedTime
    if (++framesDrawn.current === 3) (window as { __bootDone?: () => void }).__bootDone?.()
    // a little shudder after the fan goes off
    if (jolt.current > 0) {
      jolt.current = Math.max(0, jolt.current - dt)
      const a = jolt.current * 0.05
      model.root.position.set((Math.random() - 0.5) * a, Math.random() * a * 0.5, (Math.random() - 0.5) * a)
    } else model.root.position.set(0, 0, 0)

    // Up close (the phone zoom fills the view with the glass), only part of the
    // screen is visible: find that part and fit the face into it.
    const box = model.screenBox
    if (box) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      let behind = false
      for (const [x, y] of [[box.min.x, box.min.y], [box.max.x, box.min.y], [box.min.x, box.max.y], [box.max.x, box.max.y]]) {
        const p = corner.current.set(x, y, box.min.z).project(camera)
        if (p.z > 1) behind = true
        x0 = Math.min(x0, p.x)
        x1 = Math.max(x1, p.x)
        y0 = Math.min(y0, p.y)
        y1 = Math.max(y1, p.y)
      }
      if (!behind) {
        // visible part of the screen, in NDC, then in face-canvas pixels
        const vx0 = Math.max(-1, x0), vx1 = Math.min(1, x1)
        const vy0 = Math.max(-1, y0), vy1 = Math.min(1, y1)
        const fit = Math.min(1, (vx1 - vx0) / (x1 - x0), (vy1 - vy0) / (y1 - y0))
        model.face.setView(
          fit < 1 ? fit * 0.9 : 1, // a little margin when it's cropped
          (((vx0 + vx1) / 2 - x0) / (x1 - x0)) * FACE_W,
          ((y1 - (vy0 + vy1) / 2) / (y1 - y0)) * FACE_H,
        )
      }
    }
    // eyes follow the keyboard/mouse while it's being carried or is falling
    const moving = model.props.props.find((p) => p.state === 'held') ?? model.props.props.find((p) => p.state === 'fall')
    if (moving && model.screenBox && mode === 'room') {
      const sx = (model.screenBox.min.x + model.screenBox.max.x) / 2
      const sy = (model.screenBox.min.y + model.screenBox.max.y) / 2
      const p = moving.mesh.position
      // the screen faces -z, so the viewer's right is -x; face px: right +x, down +y
      const right = sx - (p.x + moving.offset.x)
      const down = sy - (p.y + moving.offset.y)
      model.face.watch(THREE.MathUtils.clamp(right * 9, -10, 10), THREE.MathUtils.clamp(down * 6, -5, 5))
    }
    model.face.update(Math.min(dt, 0.1))
    const [kb, ms] = [model.props.find(model.meshes[KEYBOARD_MESH_INDEX]), model.mouse]
    const onTopOf = ms && kb && model.props.restingOn(ms) === kb ? 'mouse' : kb && ms && model.props.restingOn(kb) === ms ? 'keyboard' : null
    if (onTopOf !== stacked.current) {
      stacked.current = onTopOf
      if (onTopOf && mode === 'room' && !poweredOff) {
        model.face.react('confused', 2.5)
        model.face.glance(0, 5, 2.5) // down at the pile
      }
    }
    model.keys.update(dt)

    const f = floppyOut.current
    if (f.k !== f.goal) {
      f.k = Math.abs(f.goal - f.k) < 0.002 ? f.goal : f.k + (f.goal - f.k) * (1 - Math.exp(-dt * 9))
      model.floppy.setOut(f.k)
      if (f.goal !== f.k) lights.current.hddUntil = clock.elapsedTime + 0.1 // the drive light while it moves
    }

    const b = POWER_BUTTON
    model.button.position.z = b.at.z - b.depth / 2 + (clock.elapsedTime < pressedUntil.current ? b.travel : 0)
    // the arrow only points at it while he's off and it's in view (from the front),
    // and not while he's rebooting (he comes back on by himself)
    const p = buttonAt.current.set(b.at.x, b.at.y, b.at.z - b.depth).project(camera)
    powerButtonOnScreen.x = ((p.x + 1) / 2) * size.width
    powerButtonOnScreen.y = ((1 - p.y) / 2) * size.height
    powerButtonOnScreen.visible = poweredOff && !rebooting && !useStore.getState().brainOut && mode === 'room' && p.z < 1 && camera.position.z < b.at.z

    raycaster.current.setFromCamera(pointer, camera)
    model.props.update(Math.min(dt, 0.05), raycaster.current.ray)
    model.usb.update(Math.min(dt, 0.05), raycaster.current.ray)

    // (only while it's sitting still on the desk, around wherever it was dropped)
    // (unplugged, Hanzo doesn't know where the pointer is)
    if (model.mouse?.state === 'rest' && !useStore.getState().unplugged.mouse) {
      const m = mouseMove.current
      // camera's right and forward, flattened onto the desk
      camera.getWorldDirection(m.away).setY(0).normalize()
      m.right.crossVectors(m.away, THREE.Object3D.DEFAULT_UP).normalize()
      const follow = mode === 'room' ? 1 : 0 // rests in place once you sit at the screen
      m.goal
        .copy(model.mouse.anchor)
        .addScaledVector(m.right, pointer.x * MOUSE_RANGE.side * follow)
        .addScaledVector(m.away, pointer.y * MOUSE_RANGE.depth * follow)
      m.goal.y -= m.pressed && mode === 'room' ? 0.012 : 0 // clicks press it down a hair
      model.mouse.mesh.position.lerp(m.goal, 1 - Math.exp(-dt * 14))
    }

    const t = clock.elapsedTime
    const l = lights.current
    const busy = mode === 'zooming' || booting // starting up: everything goes
    // drive light: random bursts of flicker, constant while booting
    if (!busy && t > l.hddUntil && Math.random() < dt * 0.6) l.hddUntil = t + 0.3 + Math.random() * 0.7
    if (t > l.hddNext) {
      l.hddOn = (busy || t < l.hddUntil) && Math.random() < 0.6
      l.hddNext = t + 0.04 + Math.random() * 0.06
    }
    const blink = (hz: number) => (Math.floor(t * hz) % 2 === 0 ? 1 : 0.1)
    const red = busy ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2)) // standby breathing
    const green = l.hddOn ? 1 : 0.08
    l.faceLeft = Math.max(0, l.faceLeft - dt)
    const blue = busy ? blink(10) : l.faceLeft > 0 ? blink(12) : 0.08
    if (poweredOff) model.material.uniforms.leds.value.set(0, 0, 0)
    else model.material.uniforms.leds.value.set(red, green, blue)
    model.material.uniforms.powered.value = poweredOff ? 0 : 1
  })

  // getting hit with the keyboard or mouse: reacts by how hard (the keyboard hits
  // harder) and how often; keep at it and he gets angry, then glitches out
  const hits = useRef({ count: 0, last: -Infinity })
  useEffect(() => {
    model.props.onBump = (p, speed) => {
      playBump(speed)
      const now = clockRef.current
      const h = hits.current
      h.count = now - h.last < 4 ? h.count + 1 : 1
      h.last = now
      const force = speed * (p.kind === 'keyboard' ? 1.5 : 1)
      const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
      let expr: Expression
      if (h.count >= 5) expr = 'glitch'
      else if (h.count >= 3) expr = 'angry'
      else if (force > 12) expr = 'dizzy'
      else if (force > 3) expr = pick<Expression>(['sad', 'cry'])
      else expr = pick<Expression>(['surprised', 'confused', 'suspicious'])
      model.face.react(expr, expr === 'surprised' ? 1.2 : 2.4)
      if (force > 12) jolt.current = 0.25 // a hard hit rattles the whole PC
    }
    return () => {
      model.props.onBump = undefined
    }
  }, [model])

  // the wake-up and power-button sequences (cleared if they're interrupted)
  const timers = useRef<number[]>([])
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms))
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  const talkingUntil = useRef(0) // no expression bleeps while he's talking
  const inRoom = () => useStore.getState().mode === 'room'
  // once the loading screen is gone (or he's been turned back on), he wakes up:
  // still asleep for a moment, then his eyes open with a little yawn ("mmhmm?",
  // if the browser already allows sound; usually it waits for a tap), he blinks
  // awake and smiles.
  // ("hellooo" is for when the PC is clicked; clicking it before he's awake
  // wakes him right away.)
  const wake = () => {
    unlockAudio() // only starts if the browser already allows sound here
    // eyes open with the yawn, a couple of blinks to get going, then a smile
    later(1700, () => {
      if (inRoom() && speak('mmhmm?', 0.8)) talkingUntil.current = performance.now() + 700
      setAsleep(false)
    })
    later(2300, () => inRoom() && model.face.blink(2))
    later(3000, () => inRoom() && model.face.react('happy', 1.4))
  }
  // clicking the PC: the camera zooms into the screen and the desktop's sign-in
  // comes up. Straight from booting, the boot log stays on the
  // screen all the way in and the sign-in fades in over it (see Desktop), which
  // clears `booting`.
  const signIn = () => {
    clearTimers()
    if (!useStore.getState().booting) playSpinUp() // the 'oooo' while the face looks surprised and the camera zooms in
    speakSoon('hellooo!') // and says hi on the way in
    model.props.poofHome() // the keyboard and mouse go back where they belong
    setAsleep(false) // clicked before he finished waking up: he's up now
    setMode('zooming')
  }
  // turned on: the boot log scrolls by while the drive light goes, then straight
  // on to signing in (he's awake by then: the log ends with him waking up)
  const powerOn = () => {
    clearTimers()
    useStore.getState().setPoweredOff(false)
    model.props.poofHome() // a keyboard or mouse left lying around goes back where it belongs
    playSpinUp(1.6)
    setAsleep(true)
    setBooting(true)
    bootStart.current = performance.now()
    later(BOOT_MS, () => {
      if (inRoom()) return signIn() // (the log stays up: see signIn)
      setBooting(false)
      setAsleep(false)
    })
  }
  // turned off from the room: a sleepy goodnight, then the screen goes dark
  const powerOff = () => {
    clearTimers()
    setBooting(false)
    if (speak('nighty night!', 0.85)) talkingUntil.current = performance.now() + 900
    model.face.react('sleepy', 2)
    later(1100, () => useStore.getState().setPoweredOff(true))
  }
  const toggleFloppy = () => {
    const f = floppyOut.current
    f.goal = f.goal ? 0 : 1
    playClick()
    later(160, () => playClick(true))
    model.face.react(f.goal ? 'surprised' : 'wink', 1.2)
  }
  const bootFloppy = () => {
    floppyOut.current.goal = 0
    playClick()
    later(160, () => playClick(true))
    useStore.setState({ openOnSignIn: 'about' })
    later(450, signIn) // once it's slid in
  }
  // a click during the power-on's boot log (or the zoom in after it): the camera
  // backs out to the room, but the log still finishes on his screen, and then he
  // wakes up (eyes open with a yawn) instead of going on to the sign-in
  const cancelBoot = () => {
    if (!useStore.getState().leaning) return // backed out already
    clearTimers()
    useStore.setState({ leaning: false, openOnSignIn: null })
    if (useStore.getState().mode === 'zooming') setMode('room')
    const left = BOOT_MS - (performance.now() - bootStart.current)
    later(Math.max(600, left), () => {
      setBooting(false)
      wake()
    })
  }
  // (the typing listener below is set up once, so it calls the latest signIn)
  const signInRef = useRef(signIn)
  signInRef.current = signIn
  const pressPower = () => {
    pressedUntil.current = clockRef.current + 0.18
    playClick()
    later(140, () => playClick(true))
    if (useStore.getState().brainOut) return // no brain, no power: it just clicks
    if (useStore.getState().poweredOff) powerOn()
    else powerOff()
  }
  useEffect(() => clearTimers, [])
  useEffect(() => {
    brainHatch.current = model.hatch
    return () => {
      brainHatch.current = null
    }
  }, [model])
  // shut down to restart (`reboot` in the Konsole): back in the room, it comes right back on
  useEffect(() => {
    if (mode !== 'room' || !poweredOff || !rebooting) return
    const id = setTimeout(powerOn, 1200)
    return () => clearTimeout(id)
  }, [mode, poweredOff, rebooting])
  // the HTML arrow pointing at the button can be tapped too (the button is small on a phone)
  useEffect(() => {
    const onPress = () => useStore.getState().poweredOff && pressPower()
    window.addEventListener('press-power', onPress)
    return () => window.removeEventListener('press-power', onPress)
  }) // every render: pressPower closes over this render's state

  // typing in the room: Chiba clacks and its keys go down, the drive light
  // flickers, and his screen shows the line as it's typed. Enter: his face comes
  // back and answers it. Escape (or leaving it alone) drops it.
  useEffect(() => {
    let line = ''
    let idle = 0
    const show = (text: string) => {
      line = text
      model.face.typed = text
      setTyping(true)
      clearTimeout(idle)
      idle = window.setTimeout(() => done(), TYPING_IDLE_MS)
    }
    const done = () => {
      clearTimeout(idle)
      line = ''
      setTyping(false)
    }
    const answer = (text: string) => {
      const words = text.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean)
      if (!words.length) return
      if (words.length === 1 && SIGN_IN_COMMANDS.test(words[0])) return signInRef.current()
      const { expr, says } = chatReply(text) ?? { expr: 'confused' as const, says: 'huh?' }
      model.face.react(expr, expr === 'yes' ? 3 : 2.2)
      if (expr === 'yes') playFaceSound('yes') // (a fanfare under the shout)
      if (says && speak(says, expr === 'yes' ? 1.15 : 1)) talkingUntil.current = performance.now() + 900
    }
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      if (s.mode !== 'room' || s.poweredOff || s.booting) return
      if (s.unplugged.keyboard) return noKeyboard()
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return
      // Ctrl+C: like a shell, ^C and the line's dropped
      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c' && typingRef.current) {
        e.preventDefault()
        model.face.typed = line + '^C'
        clearTimeout(idle)
        idle = window.setTimeout(() => done(), 350)
        line = ''
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') return done()
      if (e.key !== 'Enter' && e.key !== 'Backspace' && e.key.length !== 1) return
      e.preventDefault() // (the space bar doesn't scroll the page, quote keys don't open quick find)
      press(e.key)
    }
    // Chiba's unplugged: keys do nothing (now and then he squints at it)
    let shrugged = 0
    const noKeyboard = () => {
      if (performance.now() - shrugged < 2500) return
      shrugged = performance.now()
      model.face.react('confused', 1.5)
      model.face.glance(0, 6, 1.5)
    }
    // one key: Chiba's key goes down with a clack, then the line changes (or Enter answers it)
    const press = (key: string, next?: string) => {
      unlockAudio()
      model.keys.press(key)
      lights.current.hddUntil = clockRef.current + 0.15
      if (key === 'Enter') {
        playKeyClack('enter')
        const text = line
        done()
        return answer(text)
      }
      playKeyClack(key === ' ' ? 'space' : key === 'Backspace' ? 'back' : 'key')
      show(next ?? (key === 'Backspace' ? line.slice(0, -1) : (line + key).slice(0, TYPED_LENGTH)))
    }
    window.addEventListener('keydown', onKey)
    // the phone's keyboard hands over the whole line: the key is whatever changed at its end
    roomChat.current = {
      setLine: (text) => {
        const s = useStore.getState()
        if (s.mode !== 'room' || s.poweredOff || s.booting || text === line) return
        if (s.unplugged.keyboard) return noKeyboard()
        text = text.slice(0, TYPED_LENGTH)
        press(text.length < line.length ? 'Backspace' : text.slice(-1), text)
      },
      enter: () => {
        const s = useStore.getState()
        if (s.mode === 'room' && !s.poweredOff && !s.booting) press('Enter')
      },
    }
    return () => {
      clearTimeout(idle)
      window.removeEventListener('keydown', onKey)
      roomChat.current = null
    }
  }, [model])

  useEffect(() => {
    // the face bleeps as it changes expression (the spin-up covers the zoom)
    model.face.onChange = (expr) => {
      lights.current.faceLeft = 0.5
      // (waking up, the tube's own sound covers it: see onCrt)
      if (expr !== 'wake' && useStore.getState().mode === 'room' && performance.now() > talkingUntil.current) playFaceSound(expr)
    }
    // the screen's tube switching on or off, in time with its flash (not while the
    // loading screen's still up: he's already there underneath it)
    model.face.onCrt = (kind) => {
      if (!(window as { __booted?: boolean }).__booted) return
      if (kind === 'on') playCrtOn()
      else playCrtOff()
    }
    const booted = window as { __booted?: boolean }
    if (booted.__booted) wake()
    else window.addEventListener('booted', wake, { once: true })
    // browsers only allow sound after an interaction: any first tap or drag in the room counts
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      model.face.onChange = undefined
      model.face.onCrt = undefined
      window.removeEventListener('booted', wake)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [model])

  useEffect(() => {
    const screen = model.meshes[SCREEN_MESH_INDEX]
    if (!screen) return
    model.root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(screen)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // the PC faces -z; measure at the panel's front face (it's recessed behind the
    // bezel) so the desktop covers only the black glass, not the bezel's inner walls
    center.z = box.min.z
    setScreen({ center, normal: new THREE.Vector3(0, 0, -1), width: size.x, height: size.y })
  }, [model, setScreen])

  return (
    <primitive
      object={model.root}
      onPointerOver={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
        e.stopPropagation()
        hoverAt(e.object)
      }}
      // moving between the PC and the keyboard/mouse doesn't re-fire "over"
      onPointerMove={(e: { object: THREE.Object3D; point: THREE.Vector3; clientX: number }) => {
        hoverAt(e.object)
        petAt(e)
      }}
      onPointerOut={() => {
        onHover(null)
        useStore.getState().setHoverDevice(null)
        setHovered(false)
      }}
      onPointerDown={(e: PressEvent) => {
        holdStart(e)
        // a USB plug at the back: tugged (and maybe pulled out)
        const plug = model.usb.find(e.object)
        if (plug && CAN_GRAB && mode === 'room' && e.button === 0) {
          e.stopPropagation()
          model.usb.grab(plug, e.point, e.camera.getWorldDirection(new THREE.Vector3()))
          grabState.active = true
          ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
          document.body.style.cursor = 'var(--cursor-grabbing)'
          return
        }
        const prop = model.props.find(e.object)
        if (!CAN_GRAB || mode !== 'room' || e.button !== 0 || !prop) return
        // pick up the keyboard or mouse
        e.stopPropagation()
        model.props.grab(prop, e.ray, e.camera.getWorldDirection(new THREE.Vector3()))
        ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
        document.body.style.cursor = 'var(--cursor-grabbing)'
      }}
      onClick={(e: ClickEvent) => {
        e.stopPropagation()
        // at the desktop: clicking the PC around the screen (its beige frame) goes
        // back to the room, still signed in (only logging off ends it)
        if (mode === 'desktop') return useStore.getState().stepAway()
        const bootZoom = mode === 'zooming' && useStore.getState().booting
        // a phone: tapping Chiba (the keyboard) is for talking to him (its own keyboard comes up)
        if (!CAN_GRAB && mode === 'room' && e.delta <= 6 && model.props.find(e.object)?.kind === 'keyboard') {
          const s = useStore.getState()
          if (!s.poweredOff && !s.booting && !touchHold.current.held) return openRoomKeyboard()
        }
        // a drag that ends over the PC is an orbit, not a click; the keyboard and
        // mouse are for picking up, not for turning it on (and while the camera's
        // zooming in after the boot log, a click cancels that)
        if ((mode !== 'room' && !bootZoom) || e.delta > 6 || (CAN_GRAB && model.props.find(e.object))) return
        // lifting the finger after a hold isn't a tap: don't turn it on
        if (touchHold.current.held) {
          touchHold.current.held = false
          return
        }
        unlockAudio()
        const hitMonitorBack = (e: ClickEvent) =>
          ((MONITOR_REAR_MESH_INDICES.some((i) => e.object === model.meshes[i]) || e.object === model.hatch.frame) && facing(e) > 0.5) || e.object === model.hatch.door || e.object === model.hatch.hole
        if (model.usb.find(e.object)) return // (plugs are pulled, not clicked)
        if (e.object === model.button || (!CAN_GRAB && e.object === model.meshes[CASE_MESH_INDEX] && hitPowerPanel(e))) return pressPower()
        // booting (or zooming in after it): a click backs out to the room, awake
        if (useStore.getState().booting) return cancelBoot()
        if (hitMonitorBack(e)) {
          const s = useStore.getState()
          // his brain's been pulled out (or the hatch is open by hand): the hatch
          // opens and shuts by hand, to put it back; plugged back in and hanging
          // out on its cable, a click puts it away
          if (s.brainOut || hatchOpenByHand() || brainHanging()) return toggleHatch()
          // it's out already: the open hatch (or the opening) shuts it away; the rest of
          // the back lets it finish (it doesn't start over)
          if (brainBusy.current) return e.object === model.hatch.door || e.object === model.hatch.hole ? closeHatch() : undefined
          s.showBrain() // (its sounds play from Brain; it pops out whether he's on or off)
          if (!isOff(s)) model.face.react('pondering', 4) // (the brain's up for about that long)
          return
        }
        // off: only the power button (and the hatch) do anything
        if (useStore.getState().poweredOff) return
        // the floppy drive: the slot ejects the disk (or takes it back), and
        // clicking the disk puts it in and boots into what's on it
        if (e.object === model.floppy.slot || e.object === model.floppy.slotTarget) return toggleFloppy()
        if (model.floppy.has(e.object)) return bootFloppy()
        if (hitFan(e)) {
          // the fan blows out along the face it's on
          const dir = (e.face?.normal ?? new THREE.Vector3(0, 0, 1)).clone().transformDirection(e.object.matrixWorld)
          useStore.getState().doFart([e.point.x, e.point.y, e.point.z], [dir.x, dir.y, dir.z])
          playFart()
          jolt.current = 0.35
          lights.current.hddUntil = clockRef.current + 1.2 // drive light goes wild
          model.face.react('blush', 2.6)
          return
        }
        signIn()
      }}
    />
  )
}

useGLTF.preload(URL)
