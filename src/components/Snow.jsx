import { useEffect, useRef } from 'react'
import { pileQueue } from './pileQueue'

const COLORS = ['#5277c3', '#7ebae4', '#4169b8', '#9ecfee', '#3a5aab']
const SIZES = [2, 2, 4, 4, 4, 6]
const PIXEL = 2

export default function Snow({ count = 60 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const mkFlake = (scatter = false) => ({
      x: Math.random() * W,
      y: scatter ? Math.random() * H : -10,
      size: SIZES[Math.floor(Math.random() * SIZES.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: 0.7 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 0.5,
      opacity: 0.3 + Math.random() * 0.45,
    })

    const flakes = Array.from({ length: count }, () => mkFlake(true))

    const onResize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W
      canvas.height = H
    }
    window.addEventListener('resize', onResize)

    let raf

    const tick = () => {
      ctx.clearRect(0, 0, W, H)

      for (const f of flakes) {
        f.x += f.drift
        f.y += f.speed

        if (f.x < -f.size) f.x = W
        if (f.x > W + f.size) f.x = 0

        if (f.y + f.size >= H) {
          // Hand off to the pile at the page bottom
          pileQueue.push({ x: f.x, size: f.size })
          Object.assign(f, mkFlake(false))
        } else {
          ctx.globalAlpha = f.opacity
          ctx.fillStyle = f.color
          ctx.fillRect(
            Math.round(f.x / PIXEL) * PIXEL,
            Math.round(f.y / PIXEL) * PIXEL,
            f.size,
            f.size,
          )
        }
      }

      raf = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
