import { useEffect, useRef, useState } from 'react'

// Bottom-right of the room: leave. Closes the desktop app's window (and so the app),
// or the browser tab. Browsers only let a page close a tab a script opened, so
// when it's still here a moment later, say how to close it instead.

const TOUCH = matchMedia('(pointer: coarse)').matches
const MAC = /Mac|iPhone|iPad/.test(navigator.platform)

// a pixel door with an arrow out of it
const DOOR = ['XXXXX...', 'X...X...', 'X...X.X.', 'X.X.XXXX', 'X...X.X.', 'X...X...', 'X...X...', 'XXXXX...']

export function RoomExit() {
  const [stuck, setStuck] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const exit = () => {
    window.close()
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setStuck(true)
      timer.current = window.setTimeout(() => setStuck(false), 5000)
    }, 300)
  }
  return (
    <div className="room-exit">
      {stuck && (
        <div className="room-exit-note" role="status">
          {TOUCH ? 'your browser keeps this tab open: close it from your tabs' : `your browser keeps this tab open: close it with ${MAC ? '⌘W' : 'Ctrl+W'}`}
        </div>
      )}
      <button className="room-exit-btn" onClick={exit} title="Exit" aria-label="Exit">
        <svg width={14} height={14} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
          {DOOR.flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
        </svg>
        <span>exit</span>
      </button>
    </div>
  )
}
