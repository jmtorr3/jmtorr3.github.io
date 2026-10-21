import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { isCompact } from './scene/screenFit'

// Bottom-right corner: go fullscreen from a browser window, and exit again.
// The button fades away after a while (quickly in fullscreen, where it's in the
// way; longer in a window, so people notice it); hovering or tapping that
// corner brings it back.

const HIDE_AFTER_MS = { full: 2500, windowed: 8000 }
const HIDE_AFTER_LEAVING_MS = 1200

// pixel corner brackets, pointing out (enter) or in (exit)
const ENTER = ['XXX..XXX', 'X......X', 'X......X', '........', '........', 'X......X', 'X......X', 'XXX..XXX']
const EXIT = ['..X..X..', '..X..X..', 'XXX..XXX', '........', '........', 'XXX..XXX', '..X..X..', '..X..X..']

function Pixels({ rows }: { rows: string[] }) {
  return (
    <svg width={16} height={16} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  )
}

const supported = () => document.fullscreenEnabled ?? false

export function FullscreenButton() {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  const [shown, setShown] = useState(true)
  const timer = useRef(0)
  // on a phone's full-screen desktop, sit above the taskbar
  const aboveTaskbar = useStore((s) => s.mode === 'desktop') && isCompact(window.innerWidth, window.innerHeight)

  const hideSoon = (ms: number) => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShown(false), ms)
  }
  const reveal = () => {
    clearTimeout(timer.current)
    setShown(true)
  }

  useEffect(() => {
    hideSoon(HIDE_AFTER_MS.windowed)
    const onChange = () => {
      const isFull = !!document.fullscreenElement
      setFull(isFull)
      setShown(true)
      hideSoon(isFull ? HIDE_AFTER_MS.full : HIDE_AFTER_MS.windowed)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      clearTimeout(timer.current)
    }
  }, [])

  if (!supported()) return null

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  return (
    <div
      className={`fs-corner ${aboveTaskbar ? 'above-taskbar' : ''}`}
      // the corner itself is the hover zone that brings the button back
      onPointerEnter={reveal}
      onPointerLeave={() => hideSoon(HIDE_AFTER_LEAVING_MS)}
      onPointerDown={shown ? undefined : reveal}
    >
      <button
        className={`fs-btn ${shown ? '' : 'hidden'}`}
        onClick={toggle}
        title={full ? 'Exit full screen' : 'Full screen'}
        aria-label={full ? 'Exit full screen' : 'Full screen'}
      >
        <Pixels rows={full ? EXIT : ENTER} />
      </button>
    </div>
  )
}
