import { useEffect, useRef } from 'react'

// pixel snow from the old portfolio, sized to its parent instead of the window
const COLORS = ['#5277c3', '#7ebae4', '#4169b8', '#9ecfee', '#3a5aab']
const SIZES = [2, 2, 4, 4, 4, 6]
const PIXEL = 2

export function Snow({ count = 50 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let W = 0
    let H = 0
    const fit = () => {
      W = canvas.width = canvas.clientWidth
      H = canvas.height = canvas.clientHeight
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const mk = (scatter = false) => ({
      x: Math.random() * W,
      y: scatter ? Math.random() * H : -10,
      size: SIZES[Math.floor(Math.random() * SIZES.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: 0.4 + Math.random() * 0.9,
      drift: (Math.random() - 0.5) * 0.4,
      opacity: 0.3 + Math.random() * 0.45,
    })
    const flakes = Array.from({ length: count }, () => mk(true))

    let raf = 0
    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      for (const f of flakes) {
        f.x += f.drift
        f.y += f.speed
        if (f.x < -f.size) f.x = W
        if (f.x > W + f.size) f.x = 0
        if (f.y > H) Object.assign(f, mk())
        ctx.globalAlpha = f.opacity
        ctx.fillStyle = f.color
        ctx.fillRect(Math.round(f.x / PIXEL) * PIXEL, Math.round(f.y / PIXEL) * PIXEL, f.size, f.size)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [count])

  return <canvas ref={ref} className="snow" aria-hidden />
}
