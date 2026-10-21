import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PCModel, type HoverKind } from './PCModel'
import { grabState } from './deskProps'
import { DustPuff } from './DustPuff'
import { PicoPostFX } from './PicoPostFX'
import { CameraRig } from './CameraRig'
import { useStore } from '../store'
import { FOV } from './screenFit'

// touch screens have no hover, so the rainbow "you can tap this" outline stays on
const TOUCH = matchMedia('(pointer: coarse)').matches

export function Scene() {
  const [hovered, setHovered] = useState<HoverKind>(null)
  const mode = useStore((s) => s.mode)

  useEffect(() => {
    // the PC is clickable, the keyboard and mouse can be picked up, and anywhere
    // else in the room can be dragged to orbit (holding something keeps the fist)
    if (grabState.active) return
    document.body.style.cursor = mode === 'room' ? (hovered === 'pc' ? 'var(--cursor-pointer)' : 'var(--cursor-grab)') : ''
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
        <DustPuff />
      </Suspense>
      <CameraRig />
      <PicoPostFX hovered={(TOUCH || hovered !== null) && mode === 'room'} />
    </Canvas>
  )
}
