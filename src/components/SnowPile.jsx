import { useEffect, useRef } from 'react'
import { pileQueue } from './pileQueue'

const PIXEL = 2
const MAX_HEIGHT = 140

export default function SnowPile() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let W = window.innerWidth
    canvas.width = W
    canvas.height = MAX_HEIGHT

    const gridCols = () => Math.ceil(W / PIXEL)
    let pile = new Float32Array(gridCols())

    const onResize = () => {
      W = window.innerWidth
      canvas.width = W
      canvas.height = MAX_HEIGHT
      pile = new Float32Array(gridCols())
    }
    window.addEventListener('resize', onResize)

    // Map viewport x → pile column
    const getCol = (x) => {
      const ratio = x / window.innerWidth
      return Math.max(0, Math.min(gridCols() - 1, Math.floor(ratio * gridCols())))
    }

    let raf

    const tick = () => {
      // Consume queue from falling flakes
      while (pileQueue.length > 0) {
        const { x, size } = pileQueue.shift()
        const c0 = getCol(x)
        const c1 = Math.min(gridCols() - 1, c0 + Math.ceil(size / PIXEL))
        for (let c = c0; c <= c1; c++) {
          pile[c] = Math.min(MAX_HEIGHT, pile[c] + size * 0.55)
        }
      }

      const gC = gridCols()
      ctx.clearRect(0, 0, W, MAX_HEIGHT)

      // Angle of repose — spread steep columns into neighbors
      for (let c = 1; c < gC - 1; c++) {
        const dl = pile[c] - pile[c - 1]
        if (dl > PIXEL) { const t = dl * 0.04; pile[c] -= t; pile[c - 1] += t }
        const dr = pile[c] - pile[c + 1]
        if (dr > PIXEL) { const t = dr * 0.04; pile[c] -= t; pile[c + 1] += t }
      }

      // Draw pile growing upward from canvas bottom
      for (let c = 0; c < gC; c++) {
        if (pile[c] < 1) continue
        const h = Math.ceil(pile[c] / PIXEL) * PIXEL
        const x = c * PIXEL

        // Bulk: dark nix blue
        ctx.globalAlpha = 0.6
        ctx.fillStyle = '#4169b8'
        ctx.fillRect(x, MAX_HEIGHT - h, PIXEL, h)

        // Surface highlight: pale nix blue
        ctx.globalAlpha = 0.8
        ctx.fillStyle = '#9ecfee'
        ctx.fillRect(x, MAX_HEIGHT - h, PIXEL, Math.min(PIXEL * 2, h))
      }

      raf = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: `${MAX_HEIGHT}px`,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  )
}
