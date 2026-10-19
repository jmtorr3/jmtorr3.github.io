import { useRef, type PointerEvent as RPointerEvent } from 'react'
import { useStore, type Win } from '../store'
import { APPS } from './apps/registry'
import { Icon } from './Icon'

const MIN_W = 220
const MIN_H = 140
const TASKBAR_H = 40

export function Window({ win }: { win: Win }) {
  const { focus, close, minimize, toggleMax, move, resize } = useStore.getState()
  const focused = useStore((s) => s.focused === win.id)
  const drag = useRef<{ dx: number; dy: number; w: number; h: number; mode: 'move' | 'resize' } | null>(null)
  const def = APPS[win.app]
  const App = def.component

  const start = (mode: 'move' | 'resize') => (e: RPointerEvent) => {
    if (win.maximized || e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current =
      mode === 'move'
        ? { mode, dx: e.clientX - win.x, dy: e.clientY - win.y, w: win.w, h: win.h }
        : { mode, dx: e.clientX, dy: e.clientY, w: win.w, h: win.h }
  }

  const onMove = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    const { w: vw, h: deskH } = useStore.getState().desk
    const vh = deskH - TASKBAR_H
    if (d.mode === 'move') {
      // keep at least part of the title bar reachable
      const x = Math.min(vw - 60, Math.max(60 - win.w, e.clientX - d.dx))
      const y = Math.min(vh - 28, Math.max(0, e.clientY - d.dy))
      move(win.id, x, y)
    } else {
      const w = Math.max(MIN_W, Math.min(vw - win.x, d.w + e.clientX - d.dx))
      const h = Math.max(MIN_H, Math.min(vh - win.y, d.h + e.clientY - d.dy))
      resize(win.id, w, h)
    }
  }

  const end = () => (drag.current = null)

  const style = win.maximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - ${TASKBAR_H}px)`, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }

  return (
    <div
      className={`window ${focused ? 'focused' : ''} ${win.maximized ? 'maximized' : ''}`}
      style={{ ...style, display: win.minimized ? 'none' : undefined }}
      onPointerDown={() => !focused && focus(win.id)}
      role="dialog"
      aria-label={win.title}
    >
      <div
        className="titlebar"
        onPointerDown={start('move')}
        onPointerMove={onMove}
        onPointerUp={end}
        onDoubleClick={() => toggleMax(win.id)}
      >
        <Icon name={def.icon} size={16} />
        <span className="title">{win.title}</span>
        <div className="controls" onPointerDown={(e) => e.stopPropagation()}>
          <button aria-label="Minimize" onClick={() => minimize(win.id)}>
            _
          </button>
          <button aria-label="Maximize" onClick={() => toggleMax(win.id)}>
            {win.maximized ? '❐' : '□'}
          </button>
          <button aria-label="Close" className="close" onClick={() => close(win.id)}>
            ×
          </button>
        </div>
      </div>
      <div className="window-body">
        <App winId={win.id} props={win.props} />
      </div>
      {!win.maximized && (
        <div className="resize-handle" onPointerDown={start('resize')} onPointerMove={onMove} onPointerUp={end} />
      )}
    </div>
  )
}
