import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import { useStore } from '../store'
import { unlockAudio } from '../os/sound'

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
    return { root, meshes }
  }, [scene])

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
      }}
      onPointerOut={() => onHover(false)}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        if (mode !== 'room') return
        unlockAudio()
        setMode('zooming')
      }}
    />
  )
}

useGLTF.preload(URL)
