import { useEffect, useMemo, useState } from 'react'
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
    return { root, meshes, face }
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

  useFrame((_, dt) => model.face.update(Math.min(dt, 0.1)))

  useEffect(() => {
    // the face bleeps as it changes expression (the spin-up covers the zoom)
    model.face.onChange = (expr) => {
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
