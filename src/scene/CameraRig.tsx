import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { fitScreen } from './screenFit'
import { grabState } from './deskProps'

// center of the PC model's bounding box: the camera orbits around (and looks at) this
const ROOM_TARGET = new THREE.Vector3(0.375, 0.84, 0.625)
const ROOM_POS = new THREE.Vector3(-1.4, 2.0, -3.1)
// the whole PC (monitor, case, keyboard, mouse); its on-screen outline gets centered
const MODEL_BOX = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(1.25, 1.6875, 1.5))
const CORNERS = [0, 1, 2, 3, 4, 5, 6, 7].map(
  (i) =>
    new THREE.Vector3(
      i & 1 ? MODEL_BOX.max.x : MODEL_BOX.min.x,
      i & 2 ? MODEL_BOX.max.y : MODEL_BOX.min.y,
      i & 4 ? MODEL_BOX.max.z : MODEL_BOX.min.z,
    ),
)
const DURATION = 1.4
// left behind or beside the monitor with nothing happening for this long, the
// camera drifts back around to the front so the face is in view again
const IDLE_RETURN_MS = 10_000
const RETURN_SPEED = 0.6 // radians per second, easing out near the front
// spinning about a full turn within a second makes the face dizzy
const DIZZY_SPIN = Math.PI * 2
const DIZZY_COOLDOWN = 4 // seconds before it can get dizzy again
// the PC's bounding box reaches ~1.5 from its middle; keep the room camera outside that
const MIN_ROOM_DISTANCE = 2.2
// how far up/down the user can orbit, as angles from straight up (radians)
const MIN_POLAR = 0.35
const MAX_POLAR = 1.45 // just above the desk

// Travel between two camera spots along an arc around the PC rather than a straight
// line, so zooming in from behind swings around the side instead of going through it.
const _a = new THREE.Spherical()
const _b = new THREE.Spherical()
const _v = new THREE.Vector3()
function arcBetween(from: THREE.Vector3, to: THREE.Vector3, k: number) {
  _a.setFromVector3(_v.copy(from).sub(ROOM_TARGET))
  _b.setFromVector3(_v.copy(to).sub(ROOM_TARGET))
  let turn = _b.theta - _a.theta
  turn = Math.atan2(Math.sin(turn), Math.cos(turn)) // shortest way around
  _a.set(
    THREE.MathUtils.lerp(_a.radius, _b.radius, k),
    THREE.MathUtils.lerp(_a.phi, _b.phi, k),
    _a.theta + turn * k,
  )
  return _v.setFromSpherical(_a).add(ROOM_TARGET)
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// The zoom/exit move. Like arcBetween, but the turn around the PC starts at the
// speed the camera was already circling at (spin, rad/s) and bends smoothly to a
// stop at the screen, so zooming in mid-spin carries on instead of halting and
// snapping back. It keeps going the way it was spinning unless that's nearly a
// full lap; then it eases on a little and curves back.
function zoomArc(from: THREE.Vector3, to: THREE.Vector3, t: number, spin: number) {
  _a.setFromVector3(_v.copy(from).sub(ROOM_TARGET))
  _b.setFromVector3(_v.copy(to).sub(ROOM_TARGET))
  let turn = _b.theta - _a.theta
  turn = Math.atan2(Math.sin(turn), Math.cos(turn))
  if (Math.abs(spin) > 1 && Math.sign(turn) !== Math.sign(spin)) {
    const other = turn + Math.sign(spin) * Math.PI * 2
    if (Math.abs(other) < Math.PI * 1.6) turn = other
  }
  // cubic Hermite: from rest-or-moving to rest
  const h = t * t * (3 - 2 * t) // 0 -> 1, flat at both ends
  const g = t * (1 - t) * (1 - t) // starts with slope 1, ends flat, 0 at both ends
  const k = ease(t)
  _a.set(
    THREE.MathUtils.lerp(_a.radius, _b.radius, k),
    THREE.MathUtils.lerp(_a.phi, _b.phi, k),
    _a.theta + turn * h + THREE.MathUtils.clamp(spin, -6, 6) * DURATION * g,
  )
  return _v.setFromSpherical(_a).add(ROOM_TARGET)
}
const MAX_SPIN = 10 // radians per second; keeps the camera from lagging half a turn behind

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const pointer = useThree((s) => s.pointer)
  const size = useThree((s) => s.size)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)

  const t = useRef(0)
  const lastMode = useRef(mode)
  const from = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), spin: 0 })
  const circling = useRef({ theta: 0, speed: 0 })
  const lookAt = useRef(ROOM_TARGET.clone())
  const sway = useRef(new THREE.Vector2())
  const shift = useRef(new THREE.Vector2()) // where the PC's outline sits, in NDC
  const shiftReady = useRef(false)
  const gl = useThree((s) => s.gl)
  // drag (mouse or finger) to orbit the PC; velocity keeps it gliding after release
  const orbit = useRef({ yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false, x: 0, y: 0, at: 0, lastInput: 0, returning: false })
  // recent turning (fades out over about a second) and when it last got dizzy
  const spin = useRef({ amount: 0, lastYaw: 0, dizzyAt: -Infinity })

  // any input counts as "not idle" and stops a return in progress
  useEffect(() => {
    const o = orbit.current
    o.lastInput = performance.now()
    const active = () => {
      o.lastInput = performance.now()
      o.returning = false
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
    events.forEach((ev) => window.addEventListener(ev, active, { passive: true }))
    return () => events.forEach((ev) => window.removeEventListener(ev, active))
  }, [])

  // can the camera see the screen (and the face on it)? false from behind or edge-on
  const faceVisible = () => {
    const screen = useStore.getState().screen
    if (!screen) return true
    return _v.copy(camera.position).sub(screen.center).normalize().dot(screen.normal) > 0.35
  }

  useEffect(() => {
    const el = gl.domElement
    const o = orbit.current
    const down = (e: PointerEvent) => {
      if (useStore.getState().mode !== 'room' || e.button !== 0) return
      Object.assign(o, { dragging: true, x: e.clientX, y: e.clientY, at: e.timeStamp, vYaw: 0, vPitch: 0 })
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!o.dragging) return
      // the press picked up the keyboard or mouse instead: don't orbit
      if (grabState.active) {
        o.dragging = false
        return
      }
      // a full drag across the screen turns about one and a half times around
      const k = (Math.PI * 3) / Math.max(400, window.innerWidth)
      const dYaw = -(e.clientX - o.x) * k
      const dPitch = -(e.clientY - o.y) * k
      o.yaw += dYaw
      o.pitch += dPitch
      // velocity in radians per second, for the glide after release
      const dt = Math.max(1, e.timeStamp - o.at) / 1000
      o.vYaw = dYaw / dt
      o.vPitch = dPitch / dt
      o.x = e.clientX
      o.y = e.clientY
      o.at = e.timeStamp
      document.body.style.cursor = 'var(--cursor-grabbing)'
    }
    const up = (e: PointerEvent) => {
      if (!o.dragging) return
      o.dragging = false
      // held still before letting go: no glide
      if (e.timeStamp - o.at > 80) o.vYaw = o.vPitch = 0
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      document.body.style.cursor = 'var(--cursor-grab)'
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [gl])

  const roomPose = (time: number, delta: number) => {
    const o = orbit.current
    if (!o.dragging) {
      // glide to a stop
      o.vYaw = THREE.MathUtils.clamp(o.vYaw, -MAX_SPIN, MAX_SPIN)
      o.yaw += o.vYaw * delta
      o.pitch += o.vPitch * delta
      const damp = Math.pow(0.04, delta)
      o.vYaw *= damp
      o.vPitch *= damp
    }

    // how fast has it been spun lately?
    const sp = spin.current
    sp.amount = sp.amount * Math.exp(-delta) + Math.abs(o.yaw - sp.lastYaw)
    sp.lastYaw = o.yaw
    if (sp.amount > DIZZY_SPIN && time - sp.dizzyAt > DIZZY_COOLDOWN) {
      sp.dizzyAt = time
      sp.amount = 0
      useStore.getState().spunTooFast()
    }

    if (!o.dragging && !o.returning && performance.now() - o.lastInput > IDLE_RETURN_MS && !faceVisible()) {
      o.returning = true
      o.yaw = Math.atan2(Math.sin(o.yaw), Math.cos(o.yaw)) // the short way back, not unwinding full turns
      sp.lastYaw = o.yaw // that jump isn't a spin
      o.vYaw = o.vPitch = 0
    }
    if (o.returning) {
      // slow and steady, easing out as it reaches the front view
      const step = (v: number) => Math.sign(v) * Math.min(Math.abs(v), Math.min(RETURN_SPEED, Math.abs(v)) * delta)
      o.yaw -= step(o.yaw)
      o.pitch -= step(o.pitch)
      if (Math.abs(o.yaw) < 0.005 && Math.abs(o.pitch) < 0.005) o.returning = false
    }

    // slow idle drift plus a little pointer parallax (not while dragging)
    if (!o.dragging) sway.current.lerp(pointer, 0.05)
    const offset = ROOM_POS.clone().sub(ROOM_TARGET)
    const sph = new THREE.Spherical().setFromVector3(offset)
    // tall (phone) screens see less side to side, so back up until the PC fits
    sph.radius *= Math.max(1, 0.95 / (size.width / size.height))
    sph.theta += o.yaw + Math.sin(time * 0.3) * 0.06 - sway.current.x * 0.12
    const polar = THREE.MathUtils.clamp(sph.phi + o.pitch, MIN_POLAR, MAX_POLAR)
    o.pitch = polar - sph.phi // stop at the limits instead of storing overshoot
    sph.phi = THREE.MathUtils.clamp(polar + Math.sin(time * 0.5) * 0.015 - sway.current.y * 0.06, MIN_POLAR, MAX_POLAR)
    return { pos: ROOM_TARGET.clone().add(new THREE.Vector3().setFromSpherical(sph)), target: ROOM_TARGET }
  }

  const screenPose = () => {
    const screen = useStore.getState().screen
    if (!screen) return { pos: ROOM_POS, target: ROOM_TARGET }
    const { distance } = fitScreen(screen, size.width, size.height)
    return {
      pos: screen.center.clone().addScaledVector(screen.normal, distance),
      target: screen.center,
    }
  }

  useFrame((state, delta) => {
    // how fast the camera is circling the PC right now (radians per second)
    _a.setFromVector3(_v.copy(camera.position).sub(ROOM_TARGET))
    const turned = Math.atan2(Math.sin(_a.theta - circling.current.theta), Math.cos(_a.theta - circling.current.theta))
    circling.current.theta = _a.theta
    if (delta > 0) circling.current.speed += (turned / delta - circling.current.speed) * 0.3

    if (mode !== lastMode.current) {
      lastMode.current = mode
      t.current = 0
      from.current.pos.copy(camera.position)
      from.current.target.copy(lookAt.current)
      // zooming in while it's still spinning: carry that motion into the move
      from.current.spin = circling.current.speed
    }

    // how much of the centering shift applies: none on the desktop, where the
    // overlay must line up with the real screen, so it fades out during the zoom
    let centering = mode === 'room' ? 1 : 0

    let goal: { pos: THREE.Vector3; target: THREE.Vector3 }
    if (mode === 'room' || mode === 'exiting') goal = roomPose(state.clock.elapsedTime, delta)
    else goal = screenPose()

    if (mode === 'zooming' || mode === 'exiting') {
      t.current = Math.min(1, t.current + delta / DURATION)
      const k = ease(t.current)
      camera.position.copy(zoomArc(from.current.pos, goal.pos, t.current, from.current.spin))
      lookAt.current.lerpVectors(from.current.target, goal.target, k)
      centering = mode === 'zooming' ? 1 - k : k
      if (t.current >= 1) setMode(mode === 'zooming' ? 'desktop' : 'room')
    } else {
      if (mode === 'room') {
        // ease toward the goal around the PC, not in a straight line through it
        // (a fast spin puts the goal on the far side); same feel at any frame rate
        const k = 1 - Math.exp(-delta * 10)
        camera.position.copy(arcBetween(camera.position, goal.pos, k))
        // and never closer to the PC's middle than its outer edge plus a margin
        const d = camera.position.distanceTo(ROOM_TARGET)
        if (d < MIN_ROOM_DISTANCE) camera.position.sub(ROOM_TARGET).multiplyScalar(MIN_ROOM_DISTANCE / d).add(ROOM_TARGET)
        lookAt.current.lerp(goal.target, k)
      } else {
        camera.position.copy(goal.pos)
        lookAt.current.copy(goal.target)
      }
    }
    camera.lookAt(lookAt.current)
    centerModel(centering, delta)
  })

  // Perspective makes the near parts (keyboard, mouse) look bigger, so aiming at
  // the model's middle still leaves it off-center. Measure where its box lands on
  // screen and slide the view so the outline sits in the middle.
  const v = useRef(new THREE.Vector3())
  const centerModel = (amount: number, delta: number) => {
    camera.clearViewOffset()
    if (amount <= 0.001) return
    camera.updateMatrixWorld()
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const c of CORNERS) {
      const p = v.current.copy(c).project(camera)
      if (p.z > 1) return // a corner behind the camera (close to the screen): skip
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    // snap on the first frame, then follow smoothly as the camera moves
    if (!shiftReady.current) shift.current.copy(center)
    else shift.current.lerp(center, 1 - Math.exp(-delta * 6))
    shiftReady.current = true
    const { width: w, height: h } = size
    camera.setViewOffset(w, h, (shift.current.x * amount * w) / 2, (-shift.current.y * amount * h) / 2, w, h)
  }

  return null
}
