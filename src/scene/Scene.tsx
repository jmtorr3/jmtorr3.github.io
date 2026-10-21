import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PCModel, type HoverKind } from './PCModel'
import { setHover, restoreCursor } from './cursor'
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
  const off = useStore((s) => s.poweredOff)

  // the PC is clickable and the keyboard and mouse can be picked up (pointing
  // hand); anywhere else in the room can be dragged to orbit (open hand)
  useEffect(() => setHover(hovered), [hovered])
  useEffect(() => restoreCursor(), [mode])

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
      {/* off: only the power button lights him up (not the keyboard or mouse) */}
      <PicoPostFX hovered={(TOUCH || hovered !== null) && mode === 'room' && !(off && hovered === 'prop')} />
    </Canvas>
  )
}
