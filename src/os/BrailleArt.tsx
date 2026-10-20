import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'

// Braille cell bits → dot position. Each U+2800–U+28FF char is a 2×4 dot grid:
// left column top→bottom = bits 0,1,2,6; right column = bits 3,4,5,7.
const DOTS: [bit: number, col: number, row: number][] = [
  [0, 0, 0], [1, 0, 1], [2, 0, 2], [6, 0, 3],
  [3, 1, 0], [4, 1, 1], [5, 1, 2], [7, 1, 3],
]

function decode(art: string) {
  const lines = art.split('\n')
  const dots: [number, number][] = []
  lines.forEach((line, y) => {
    Array.from(line).forEach((ch, x) => {
      const code = ch.codePointAt(0)! - 0x2800
      if (code <= 0 || code > 0xff) return
      for (const [bit, col, row] of DOTS) if (code & (1 << bit)) dots.push([x * 2 + col, y * 4 + row])
    })
  })
  const cols = Math.max(...lines.map((l) => Array.from(l).length)) * 2
  return { dots, cols, rows: lines.length * 4 }
}

// Draws braille art on a canvas so it looks the same whatever fonts the visitor has.
// Sized like the old <pre>: font-size clamp(5px, 2.6% of the parent's height, 14px),
// with a monospace cell of 0.6em × 1em holding 2×4 dots.
// Dots are drawn in the canvas's CSS `color`.
export function BrailleArt({ art, className }: { art: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const grid = useMemo(() => decode(art), [art])
  // the desktop UI is CSS-scaled, so render at that scale too or the dots go soft
  const scale = useStore((s) => s.desk.scale)

  useEffect(() => {
    const canvas = ref.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const draw = () => {
      const dpr = (window.devicePixelRatio || 1) * scale
      // also capped by width so it fits narrow (portrait phone) desktops
      const fitW = (parent.clientWidth * 0.7) / (grid.cols * 0.3)
      const font = Math.min(14, fitW, Math.max(5, parent.clientHeight * 0.026))
      // pitch in device pixels, snapped to whole pixels so every dot is crisp
      const px = Math.max(1, Math.round(font * 0.3 * dpr))
      const py = Math.max(1, Math.round(font * 0.25 * dpr))
      const size = Math.max(1, Math.round(Math.min(px, py) * 0.7))
      canvas.width = grid.cols * px
      canvas.height = grid.rows * py
      canvas.style.width = `${canvas.width / dpr}px`
      canvas.style.height = `${canvas.height / dpr}px`
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = getComputedStyle(canvas).color
      for (const [x, y] of grid.dots) ctx.fillRect(x * px, y * py, size, size)
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [grid, scale])

  return <canvas ref={ref} className={className} aria-hidden />
}
