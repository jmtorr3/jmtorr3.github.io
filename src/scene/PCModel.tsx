import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import { makeScreenMaterial } from './ScreenMaterial'
import { MochiFace, type Expression } from './MochiFace'
import { useStore } from '../store'
import { unlockAudio, playSpinUp, playFaceSound } from '../os/sound'

const URL = '/models/pc.gltf'
// Blockbench names every node "cube"; the monitor's screen panel is the 8th mesh
const SCREEN_MESH_INDEX = 7
const MOUSE_MESH_INDEX = 11 // the little mouse next to the keyboard
// how far the 3D mouse slides from its rest spot (world units) as the cursor crosses the screen
const MOUSE_RANGE = { side: 0.12, depth: 0.09 }

export function PCModel({ onHover }: { onHover: (h: boolean) => void }) {
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

    // the screen glows with the Mochi face (black while the desktop is up)
    const face = new MochiFace()
    const screen = meshes[SCREEN_MESH_INDEX]
    if (screen) {
      root.updateMatrixWorld(true)
      screen.material = makeScreenMaterial(face.texture, new THREE.Box3().setFromObject(screen))
    }
    const mouse = meshes[MOUSE_MESH_INDEX]
    return { root, meshes, face, material, mouse, mouseRest: mouse?.position.clone() }
  }, [scene])

  const [hovered, setHovered] = useState(false)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    let expr: Expression | null = null // idle: cycles moods by itself
    if (mode === 'desktop' || mode === 'exiting') expr = 'off'
    else if (mode === 'zooming') expr = 'surprised'
    else if (hovered) expr = 'happy'
    model.face.set(expr)
    // the canvas only renders on demand while the desktop is up
    invalidate()
  }, [mode, hovered, model, invalidate])

  // front-panel lights: red power, green drive activity, blue blinks with the face
  const lights = useRef({ hddUntil: 0, hddNext: 0, hddOn: false, faceLeft: 0 })
  // the desk mouse follows the cursor: screen left/right and up/down map to sliding
  // it sideways and forward/back along the desk, relative to where the camera is
  const mouseMove = useRef({ right: new THREE.Vector3(), away: new THREE.Vector3(), goal: new THREE.Vector3(), pressed: false })
  useEffect(() => {
    const down = () => (mouseMove.current.pressed = true)
    const up = () => (mouseMove.current.pressed = false)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  useFrame(({ clock, camera, pointer }, dt) => {
    model.face.update(Math.min(dt, 0.1))

    if (model.mouse && model.mouseRest) {
      const m = mouseMove.current
      // camera's right and forward, flattened onto the desk
      camera.getWorldDirection(m.away).setY(0).normalize()
      m.right.crossVectors(m.away, THREE.Object3D.DEFAULT_UP).normalize()
      const follow = mode === 'room' ? 1 : 0 // rests in place once you sit at the screen
      m.goal
        .copy(model.mouseRest)
        .addScaledVector(m.right, pointer.x * MOUSE_RANGE.side * follow)
        .addScaledVector(m.away, pointer.y * MOUSE_RANGE.depth * follow)
      m.goal.y -= m.pressed && mode === 'room' ? 0.012 : 0 // clicks press it down a hair
      model.mouse.position.lerp(m.goal, 1 - Math.exp(-dt * 14))
    }

    const t = clock.elapsedTime
    const l = lights.current
    const busy = mode === 'zooming' // booting: everything goes
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
    model.material.uniforms.leds.value.set(red, green, blue)
  })

  useEffect(() => {
    // the face bleeps as it changes expression (the spin-up covers the zoom)
    model.face.onChange = (expr) => {
      lights.current.faceLeft = 0.5
      if (useStore.getState().mode === 'room') playFaceSound(expr)
    }
    // browsers only allow sound after an interaction: any first tap or drag in the room counts
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      model.face.onChange = undefined
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
      onPointerOver={(e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onHover(true)
        setHovered(true)
      }}
      onPointerOut={() => {
        onHover(false)
        setHovered(false)
      }}
      onClick={(e: { stopPropagation: () => void; delta: number }) => {
        e.stopPropagation()
        // a drag that ends over the PC is an orbit, not a click
        if (mode !== 'room' || e.delta > 6) return
        unlockAudio()
        playSpinUp() // the 'oooo' while the face looks surprised and the camera zooms in
        setMode('zooming')
      }}
    />
  )
}

useGLTF.preload(URL)
