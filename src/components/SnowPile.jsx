import { useEffect, useRef } from 'react'
import { pileQueue } from './pileQueue'

const PIXEL = 2
const MAX_HEIGHT = 140
const B = 4 // snowman block size in px

// Color palette
const H = '#0f1923'  // hat
const W = '#c8dce8'  // body (pale blue-white)
const E = '#0f1923'  // eyes / buttons
const S = '#4aafd4'  // scarf (accent)
const N = '#e07840'  // nose (orange)
const _ = null       // transparent

const SNOWMAN = [
  // Hat
  [_,_,H,H,H,H,H,_,_],
  [_,_,H,H,H,H,H,_,_],
  [_,H,H,H,H,H,H,H,_],
  // Head
  [_,_,_,W,W,W,_,_,_],
  [_,_,W,W,W,W,W,_,_],
  [_,W,W,W,W,W,W,W,_],
  [_,W,E,W,N,W,E,W,_],  // eyes + nose
  [_,W,W,W,W,W,W,W,_],
  [_,_,W,W,W,W,W,_,_],
  [_,_,_,W,W,W,_,_,_],
  // Scarf
  [_,_,S,S,S,S,S,_,_],
  // Body
  [_,_,_,W,W,W,_,_,_],
  [_,_,W,W,W,W,W,_,_],
  [_,W,W,W,W,W,W,W,_],
  [W,W,W,W,W,W,W,W,W],
  [W,W,E,W,E,W,E,W,W],  // buttons
  [W,W,W,W,W,W,W,W,W],
  [_,W,W,W,W,W,W,W,_],
  [_,_,W,W,W,W,W,_,_],
  [_,_,_,W,W,W,_,_,_],
]

const SM_COLS = SNOWMAN[0].length  // 9
const SM_ROWS = SNOWMAN.length     // 20
const SM_W = SM_COLS * B           // 36px
const SM_H = SM_ROWS * B           // 80px

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

    const getCol = (x) => {
      const ratio = x / window.innerWidth
      return Math.max(0, Math.min(gridCols() - 1, Math.floor(ratio * gridCols())))
    }

    const drawSnowman = (sx, sy, blink) => {
      ctx.globalAlpha = 1
      for (let row = 0; row < SM_ROWS; row++) {
        for (let col = 0; col < SM_COLS; col++) {
          let color = SNOWMAN[row][col]
          if (color === null) continue
          // Blink: replace eyes with body color
          if (blink && row === 6 && (col === 2 || col === 6)) color = W
          ctx.fillStyle = color
          ctx.fillRect(sx + col * B, sy + row * B, B, B)
        }
      }
    }

    let frame = 0
    let raf

    const tick = () => {
      frame++

      // Consume flake queue
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

      // Angle of repose — spread steep columns
      for (let c = 1; c < gC - 1; c++) {
        const dl = pile[c] - pile[c - 1]
        if (dl > PIXEL) { const t = dl * 0.04; pile[c] -= t; pile[c - 1] += t }
        const dr = pile[c] - pile[c + 1]
        if (dr > PIXEL) { const t = dr * 0.04; pile[c] -= t; pile[c + 1] += t }
      }

      // Draw pile
      for (let c = 0; c < gC; c++) {
        if (pile[c] < 1) continue
        const h = Math.ceil(pile[c] / PIXEL) * PIXEL
        const x = c * PIXEL

        ctx.globalAlpha = 0.6
        ctx.fillStyle = '#4169b8'
        ctx.fillRect(x, MAX_HEIGHT - h, PIXEL, h)

        ctx.globalAlpha = 0.8
        ctx.fillStyle = '#9ecfee'
        ctx.fillRect(x, MAX_HEIGHT - h, PIXEL, Math.min(PIXEL * 2, h))
      }

      // Draw snowman centered on canvas, sitting at the bottom
      const sx = Math.floor((W - SM_W) / 2)
      const sy = MAX_HEIGHT - SM_H
      const blink = frame % 200 < 8  // blink briefly every ~3.3s at 60fps
      drawSnowman(sx, sy, blink)

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
