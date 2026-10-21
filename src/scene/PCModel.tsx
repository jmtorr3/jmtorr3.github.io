import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import { makeScreenMaterial } from './ScreenMaterial'
import { SlumpyFace, FACE_W, FACE_H, type Expression } from './SlumpyFace'
import { useStore } from '../store'
import { unlockAudio, playSpinUp, playFaceSound, playFart, playPickup, playLand, playBump, playPoof, playClick, speak, speakSoon } from '../os/sound'
import { DeskProps } from './deskProps'
import { poofAt } from './DustPuff'
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
    // left out too long: gone in a puff, back home in another
    props.onPoof = (_, at, phase) => {
      poofAt(at)
      playPoof(phase)
    }
    const mouse = props.find(meshes[MOUSE_MESH_INDEX])

    const tex = new THREE.DataTexture(new Uint8Array([...BUTTON_COLOR, 255]), 1, 1)
    const { at, size, depth } = POWER_BUTTON
    const button = new THREE.Mesh(new THREE.BoxGeometry(size, size, depth), makePicoMaterial(tex))
    button.position.set(at.x, at.y, at.z - depth / 2) // sticking out of the panel
    root.add(button)
    return { root, meshes, face, material, mouse, props, screenBox, button }
  }, [scene])

  // the happy face is for pointing at the PC itself, not for messing with the
  // keyboard and mouse (or carrying one over the PC)
  const [hovered, setHovered] = useState(false)
  // asleep from the start, so the loading screen fades onto a sleepy face; he
  // wakes up just after (the wake-up effect below)
  const [asleep, setAsleep] = useState(true)
  // shut down (the screen and lights go dark), and the loading face while he
  // turns back on from the power button
  const poweredOff = useStore((s) => s.poweredOff)
  const rebooting = useStore((s) => s.rebooting)
  const booting = useStore((s) => s.booting)
  const setBooting = (booting: boolean) => useStore.setState({ booting })
  const hoverAt = (obj: THREE.Object3D) => {
    if (!CAN_GRAB) return // touch: see holdStart
    const prop = CAN_GRAB && model.props.find(obj)
    // off: the power button is the only thing on him that can be clicked
    const dead = !prop && obj !== model.button && useStore.getState().poweredOff
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
    if (mode === 'desktop' || mode === 'exiting' || poweredOff) expr = 'off'
    else if (mode === 'zooming') expr = 'surprised'
    else if (booting) expr = 'boot'
    else if (asleep) expr = 'asleep'
    else if (hovered) expr = 'happy'
    // hovering on and off shouldn't cut a reaction short (getting hit, a fart, …)
    model.face.set(expr, expr === null || expr === 'happy')
    // the canvas only renders on demand while the desktop is up
    invalidate()
    // leaving the desktop puts the keyboard and mouse back where they belong
    if (mode === 'exiting') model.props.reset()
  }, [mode, hovered, asleep, booting, poweredOff, model, invalidate])

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

    const b = POWER_BUTTON
    model.button.position.z = b.at.z - b.depth / 2 + (clock.elapsedTime < pressedUntil.current ? b.travel : 0)
    // the arrow only points at it while he's off and it's in view (from the front)
    const p = buttonAt.current.set(b.at.x, b.at.y, b.at.z - b.depth).project(camera)
    powerButtonOnScreen.x = ((p.x + 1) / 2) * size.width
    powerButtonOnScreen.y = ((1 - p.y) / 2) * size.height
    powerButtonOnScreen.visible = poweredOff && mode === 'room' && p.z < 1 && camera.position.z < b.at.z

    raycaster.current.setFromCamera(pointer, camera)
    model.props.update(Math.min(dt, 0.05), raycaster.current.ray)

    // (only while it's sitting still on the desk, around wherever it was dropped)
    if (model.mouse?.state === 'rest') {
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
  // still sleepy for a moment, a little yawn ("mmhmm?", if the browser already
  // allows sound; usually it waits for a tap), then blinks awake and smiles.
  // ("hellooo" is for when the PC is clicked; clicking it before he's awake
  // wakes him right away.)
  const wake = () => {
    unlockAudio() // only starts if the browser already allows sound here
    later(700, () => {
      if (inRoom() && speak('mmhmm?', 0.8)) talkingUntil.current = performance.now() + 700
    })
    // eyes open, a couple of blinks to get going, then a smile
    later(1700, () => setAsleep(false))
    later(2300, () => inRoom() && model.face.blink(2))
    later(3000, () => inRoom() && model.face.react('happy', 1.4))
  }
  // turned on: the boot log scrolls by while the drive light goes, then he wakes up
  const powerOn = () => {
    clearTimers()
    useStore.getState().setPoweredOff(false)
    playSpinUp(1.6)
    setAsleep(true)
    setBooting(true)
    later(BOOT_MS, () => {
      setBooting(false)
      wake()
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
  const pressPower = () => {
    pressedUntil.current = clockRef.current + 0.18
    playClick()
    later(140, () => playClick(true))
    if (useStore.getState().poweredOff) powerOn()
    else powerOff()
  }
  useEffect(() => clearTimers, [])
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

  useEffect(() => {
    // the face bleeps as it changes expression (the spin-up covers the zoom)
    model.face.onChange = (expr) => {
      lights.current.faceLeft = 0.5
      if (useStore.getState().mode === 'room' && performance.now() > talkingUntil.current) playFaceSound(expr)
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
      onPointerMove={(e: { object: THREE.Object3D }) => hoverAt(e.object)}
      onPointerOut={() => {
        onHover(null)
        useStore.getState().setHoverDevice(null)
        setHovered(false)
      }}
      onPointerDown={(e: PressEvent) => {
        holdStart(e)
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
        // a drag that ends over the PC is an orbit, not a click; the keyboard and
        // mouse are for picking up, not for turning it on
        if (mode !== 'room' || e.delta > 6 || (CAN_GRAB && model.props.find(e.object))) return
        // lifting the finger after a hold isn't a tap: don't turn it on
        if (touchHold.current.held) {
          touchHold.current.held = false
          return
        }
        unlockAudio()
        if (e.object === model.button) return pressPower()
        if (useStore.getState().poweredOff) return // off: only the power button does anything
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
        playSpinUp() // the 'oooo' while the face looks surprised and the camera zooms in
        speakSoon('hellooo!') // and says hi on the way in
        model.props.poofHome() // the keyboard and mouse go back where they belong
        setAsleep(false) // clicked before he finished waking up: he's up now
        setMode('zooming')
      }}
    />
  )
}

useGLTF.preload(URL)
