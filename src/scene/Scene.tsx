import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PCModel } from './PCModel'
import { PicoPostFX } from './PicoPostFX'
import { CameraRig } from './CameraRig'
import { useStore } from '../store'
import { FOV } from './screenFit'

export function Scene() {
  const [hovered, setHovered] = useState(false)
  const mode = useStore((s) => s.mode)

  useEffect(() => {
    document.body.style.cursor = hovered && mode === 'room' ? 'pointer' : ''
  }, [hovered, mode])

  return (
    <Canvas
      className="scene"
      dpr={1}
      gl={{ antialias: false }}
      flat
      linear
      camera={{ fov: FOV, near: 0.05, far: 50, position: [-1.4, 2, -3.1] }}
      // the bezel around the desktop is static, so only re-render on resize
      frameloop={mode === 'desktop' ? 'demand' : 'always'}
    >
      <Suspense fallback={null}>
        <PCModel onHover={setHovered} />
      </Suspense>
      <CameraRig />
      <PicoPostFX hovered={hovered && mode === 'room'} />
    </Canvas>
  )
}
