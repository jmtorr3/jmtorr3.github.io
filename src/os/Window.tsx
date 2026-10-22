import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useStore, TASKBAR_H, slumpyLocation, type Win } from '../store'
import { SlumpyCam } from './SlumpyCam'
import { useSlumpy } from './slumpy'
import { APPS } from './apps/registry'
import { Icon } from './Icon'
import { menuItemsFor } from './appMenu'
import type { MenuItem } from './ContextMenu'
import { appSlot, parkSlot, requestClose } from './appHost'

const MIN_W = 220
const MIN_H = 140
// apps that already show Slumpy their own way (the Konsole's sprite, About This Computer's screen)
const OWN_SLUMPY = new Set(['terminal', 'system'])

// Slumpy floating over the focused window, like in the Konsole. Mounted the
// first time he visits, then kept (hidden while he's elsewhere), so he's still
// where he was when the window gets focus again.
function WindowSlumpy({ winId }: { winId: string }) {
  const here = useStore((s) => s.focused === winId && slumpyLocation(s) === 'window')
  const [visited, setVisited] = useState(here)
  useEffect(() => {
    if (here) setVisited(true)
  }, [here])
  const face = useSlumpy()
  if (!visited) return null
  return <SlumpyCam face={face} onClick={() => face.react('happy', 1.2)} away={!here} />
}

export function Window({ win }: { win: Win }) {
  const { minimize, toggleMax, move, resize } = useStore.getState()
  const focused = useStore((s) => s.focused === win.id)
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; w: number; h: number; mode: 'move' | 'resize' } | null>(null)
  const def = APPS[win.app]
  const frame = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)

  // the app itself runs in appHost (it outlives the desktop): take its container
  // while this window's on screen, hand it back when the desktop goes away
  useLayoutEffect(() => {
    const el = body.current!
    el.append(appSlot(win.id))
    return () => {
      if (appSlot(win.id).parentElement === el) parkSlot(win.id)
    }
  }, [win.id])

  // focus and the right-click menu, on the element itself: the app's React events
  // bubble to appHost, not to this component
  useEffect(() => {
    const el = frame.current!
    const down = () => useStore.getState().focused !== win.id && useStore.getState().focus(win.id)
    // on the page, after React (which listens lower down) has run the app's handlers:
    // they add their items (appMenu), or stop the event to have no menu at all
    const menu = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) return
      e.preventDefault()
      const s = useStore.getState()
      s.focus(win.id)
      const w = s.windows.find((x) => x.id === win.id)
      const controls: MenuItem[] = [
        { label: 'Minimize', onClick: () => useStore.getState().minimize(win.id) },
        { label: w?.maximized ? 'Restore' : 'Maximize', onClick: () => useStore.getState().toggleMax(win.id) },
        { label: 'Close', onClick: () => requestClose(win.id) },
      ]
      const app = menuItemsFor(e)
      s.showMenu(e.clientX, e.clientY, app.length ? [...app, { separator: true }, ...controls] : controls)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('contextmenu', menu)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('contextmenu', menu)
    }
  }, [win.id])

  const start = (mode: 'move' | 'resize') => (e: RPointerEvent) => {
    if (win.maximized || e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h }
  }

  const onMove = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    const { w: vw, h: deskH, scale } = useStore.getState().desk
    const vh = deskH - TASKBAR_H
    // pointer moves in screen px; the desktop is laid out at 1/scale of that
    const dx = (e.clientX - d.sx) / scale
    const dy = (e.clientY - d.sy) / scale
    if (d.mode === 'move') {
      // keep at least part of the title bar reachable
      const x = Math.min(vw - 60, Math.max(60 - win.w, d.x + dx))
      const y = Math.min(vh - 28, Math.max(0, d.y + dy))
      move(win.id, x, y)
    } else {
      const w = Math.max(MIN_W, Math.min(vw - win.x, d.w + dx))
      const h = Math.max(MIN_H, Math.min(vh - win.y, d.h + dy))
      resize(win.id, w, h)
    }
  }

  const end = () => (drag.current = null)

  const style = win.maximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - ${TASKBAR_H}px)`, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }

  return (
    <div
      ref={frame}
      className={`window ${focused ? 'focused' : ''} ${win.maximized ? 'maximized' : ''}`}
      style={{ ...style, display: win.minimized ? 'none' : undefined }}
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
          <button aria-label="Close" className="close" onClick={() => requestClose(win.id)}>
            ×
          </button>
        </div>
      </div>
      <div className="window-main">
        <div className="window-body" ref={body} />
        {!OWN_SLUMPY.has(win.app) && <WindowSlumpy winId={win.id} />}
      </div>
      {!win.maximized && (
        <div className="resize-handle" onPointerDown={start('resize')} onPointerMove={onMove} onPointerUp={end} />
      )}
    </div>
  )
}
