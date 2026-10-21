import { useEffect, useState } from 'react'
import { SlumpyFace } from '../scene/SlumpyFace'

// The desktop's one Slumpy: a single face, with one mood and one set of
// reactions, that every place he can appear (wallpaper, Konsole, Start menu,
// About This Computer, login) draws a copy of. Since it's the same face, his
// expression carries over when he moves from one to another.

let face: SlumpyFace | null = null
let users = 0
let raf = 0
let last = 0

const tick = (now: number) => {
  face?.update(Math.min((now - last) / 1000, 0.1))
  last = now
  raf = requestAnimationFrame(tick)
}

// (for things outside React, like the Konami code)
export function getFace() {
  if (!face) {
    face = new SlumpyFace({ transparent: true }) // copies onto black screens look the same
    face.set(null) // wake up
  }
  return face
}

// The shared face; it animates while anything on screen is using it.
export function useSlumpy() {
  const [f] = useState(getFace)
  useEffect(() => {
    if (users++ === 0) {
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
    return () => {
      if (--users === 0) cancelAnimationFrame(raf)
    }
  }, [])
  return f
}

// Draw the shared face into a display canvas every frame. black: on a dark
// screen (its outline then disappears into the black, like the monitor).
export function copyFaceLoop(face: SlumpyFace, canvas: HTMLCanvasElement, black: boolean) {
  const ctx = canvas.getContext('2d')!
  let id = 0
  const draw = () => {
    if (black) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(face.canvas, 0, 0)
    id = requestAnimationFrame(draw)
  }
  id = requestAnimationFrame(draw)
  return () => cancelAnimationFrame(id)
}
