import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { makePicoMaterial } from './PicoMaterial'
import { useStore } from '../store'

const URL = '/models/pc.gltf'
// Blockbench names every node "cube"; the monitor's screen panel is the 8th mesh
const SCREEN_MESH_INDEX = 7
const BEZEL_MESH_INDEX = 3 // bottom bar of the monitor frame

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
    // the PC faces -z; measure the opening at the bezel's front (the panel is
    // recessed behind it) so the desktop overlay hugs the bezel's inner edge
    const bezel = model.meshes[BEZEL_MESH_INDEX]
    center.z = bezel ? new THREE.Box3().setFromObject(bezel).min.z : box.min.z
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
        if (mode === 'room') setMode('zooming')
      }}
    />
  )
}

useGLTF.preload(URL)
