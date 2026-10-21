import { useEffect, useRef } from 'react'
import { FACE_W, FACE_H } from '../scene/SlumpyFace'
import { useSlumpy, copyFaceLoop } from './slumpy'

// Slumpy's face on a little black screen (Start menu, About This Computer, login),
// or transparent with a dark outline (the wallpaper). It's the desktop's one shared
// Slumpy (see slumpy.ts). away: he's somewhere else right now (slumpyLocation),
// so the face fades out.
export function FaceScreen({
  className,
  transparent = false,
  away = false,
}: {
  className?: string
  transparent?: boolean
  away?: boolean
}) {
  const face = useSlumpy()
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => copyFaceLoop(face, canvas.current!, !transparent), [face, transparent])

  return (
    <div className={`face-screen ${className ?? ''} ${away ? 'away' : ''}`} aria-hidden>
      <canvas ref={canvas} width={FACE_W} height={FACE_H} />
    </div>
  )
}
