import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { fitScreen } from './screenFit'

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
// how far up/down the user can orbit, as angles from straight up (radians)
const MIN_POLAR = 0.35
const MAX_POLAR = 1.45 // just above the desk

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const pointer = useThree((s) => s.pointer)
  const size = useThree((s) => s.size)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)

  const t = useRef(0)
  const lastMode = useRef(mode)
  const from = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() })
  const lookAt = useRef(ROOM_TARGET.clone())
  const sway = useRef(new THREE.Vector2())
  const shift = useRef(new THREE.Vector2()) // where the PC's outline sits, in NDC
  const shiftReady = useRef(false)
  const gl = useThree((s) => s.gl)
  // drag (mouse or finger) to orbit the PC; velocity keeps it gliding after release
  const orbit = useRef({ yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false, x: 0, y: 0, at: 0 })

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
      document.body.style.cursor = 'grabbing'
    }
    const up = (e: PointerEvent) => {
      if (!o.dragging) return
      o.dragging = false
      // held still before letting go: no glide
      if (e.timeStamp - o.at > 80) o.vYaw = o.vPitch = 0
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      document.body.style.cursor = 'grab'
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
      o.yaw += o.vYaw * delta
      o.pitch += o.vPitch * delta
      const damp = Math.pow(0.04, delta)
      o.vYaw *= damp
      o.vPitch *= damp
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
    if (mode !== lastMode.current) {
      lastMode.current = mode
      t.current = 0
      from.current.pos.copy(camera.position)
      from.current.target.copy(lookAt.current)
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
      camera.position.lerpVectors(from.current.pos, goal.pos, k)
      lookAt.current.lerpVectors(from.current.target, goal.target, k)
      centering = mode === 'zooming' ? 1 - k : k
      if (t.current >= 1) setMode(mode === 'zooming' ? 'desktop' : 'room')
    } else {
      camera.position.lerp(goal.pos, mode === 'room' ? 0.08 : 1)
      lookAt.current.lerp(goal.target, mode === 'room' ? 0.08 : 1)
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
