import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { fitScreen } from './screenFit'

const ROOM_TARGET = new THREE.Vector3(0.45, 0.85, 0.2)
const ROOM_POS = new THREE.Vector3(-1.4, 2.0, -3.1)
const DURATION = 1.4

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

  const roomPose = (time: number) => {
    // slow idle drift plus a little pointer parallax
    sway.current.lerp(pointer, 0.05)
    const pos = ROOM_POS.clone()
    pos.x += Math.sin(time * 0.3) * 0.25 - sway.current.x * 0.5
    pos.y += Math.sin(time * 0.5) * 0.05 + sway.current.y * 0.3
    return { pos, target: ROOM_TARGET }
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

    let goal: { pos: THREE.Vector3; target: THREE.Vector3 }
    if (mode === 'room') goal = roomPose(state.clock.elapsedTime)
    else if (mode === 'exiting') goal = roomPose(state.clock.elapsedTime)
    else goal = screenPose()

    if (mode === 'zooming' || mode === 'exiting') {
      t.current = Math.min(1, t.current + delta / DURATION)
      const k = ease(t.current)
      camera.position.lerpVectors(from.current.pos, goal.pos, k)
      lookAt.current.lerpVectors(from.current.target, goal.target, k)
      if (t.current >= 1) setMode(mode === 'zooming' ? 'desktop' : 'room')
    } else {
      camera.position.lerp(goal.pos, mode === 'room' ? 0.08 : 1)
      lookAt.current.lerp(goal.target, mode === 'room' ? 0.08 : 1)
    }
    camera.lookAt(lookAt.current)
  })

  return null
}
