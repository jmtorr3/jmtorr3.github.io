import { useEffect, useState } from 'react'

// The taskbar tray's fullscreen toggle (beside the volume icon): the page's fullscreen.

// pixel corner brackets, pointing out (enter) or in (exit)
const ENTER = ['XXX..XXX', 'X......X', 'X......X', '........', '........', 'X......X', 'X......X', 'XXX..XXX']
const EXIT = ['..X..X..', '..X..X..', 'XXX..XXX', '........', '........', 'XXX..XXX', '..X..X..', '..X..X..']

function Pixels({ rows }: { rows: string[] }) {
  return (
    <svg width={14} height={14} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  )
}

export function FullscreenToggle() {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const check = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', check)
    return () => document.removeEventListener('fullscreenchange', check)
  }, [])

  if (!document.fullscreenEnabled) return null
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  return (
    <button className="tray-btn tray-fs" onClick={toggle} title={full ? 'Exit full screen' : 'Full screen'} aria-label={full ? 'Exit full screen' : 'Full screen'} aria-pressed={full}>
      <Pixels rows={full ? EXIT : ENTER} />
    </button>
  )
}
