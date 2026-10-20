import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { fitScreen } from '../scene/screenFit'
import { useStore } from '../store'
import { APPS, LAUNCHABLE, type AppId } from './apps/registry'
import { Icon } from './Icon'
import { Window } from './Window'
import { Taskbar } from './Taskbar'
import { Snow } from './Snow'
import { NIX_ASCII } from './nixAscii'
import { playPowerOn, playPowerOff, playClick } from './sound'

// sit exactly on the monitor's screen opening, so the desktop keeps the model's aspect ratio
function useScreenRect() {
  const screen = useStore((s) => s.screen)
  const setDesk = useStore((s) => s.setDesk)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const rect = screen
    ? fitScreen(screen, vp.w, vp.h).rect
    : { left: 0, top: 0, width: vp.w, height: vp.h }

  useEffect(() => setDesk(rect.width, rect.height), [rect.width, rect.height, setDesk])
  return rect
}

type Box = { x0: number; y0: number; x1: number; y1: number }

// rubber-band selection: drag on the wallpaper to select every icon the box touches
function useMarquee() {
  const [selected, setSelected] = useState<Set<AppId>>(new Set())
  const [marquee, setMarquee] = useState<Box | null>(null)
  const iconRefs = useRef(new Map<AppId, HTMLElement>())

  const startMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const area = e.currentTarget
    const origin = area.getBoundingClientRect()
    // the desktop is CSS-scaled during the CRT animation; keep coords in its own units
    const scale = origin.width / area.offsetWidth || 1
    const at = (ev: { clientX: number; clientY: number }) => ({
      x: (ev.clientX - origin.left) / scale,
      y: (ev.clientY - origin.top) / scale,
    })
    const additive = e.ctrlKey || e.metaKey
    const base = additive ? new Set(selected) : new Set<AppId>()
    const p = at(e)
    let box: Box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
    setSelected(base)
    setMarquee(box)
    area.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent) => {
      const q = at(ev)
      box = { ...box, x1: q.x, y1: q.y }
      setMarquee(box)
      const l = Math.min(box.x0, box.x1), r = Math.max(box.x0, box.x1)
      const t = Math.min(box.y0, box.y1), b = Math.max(box.y0, box.y1)
      const next = new Set(base)
      iconRefs.current.forEach((el, id) => {
        const ir = el.getBoundingClientRect()
        const il = (ir.left - origin.left) / scale, it = (ir.top - origin.top) / scale
        const hit = il < r && il + ir.width / scale > l && it < b && it + ir.height / scale > t
        if (hit) next.add(id)
      })
      setSelected(next)
    }
    const end = () => {
      setMarquee(null)
      area.removeEventListener('pointermove', move)
      area.removeEventListener('pointerup', end)
      area.removeEventListener('pointercancel', end)
    }
    area.addEventListener('pointermove', move)
    area.addEventListener('pointerup', end)
    area.addEventListener('pointercancel', end)
  }

  return { selected, setSelected, marquee, iconRefs, startMarquee }
}

export function Desktop() {
  const windows = useStore((s) => s.windows)
  const poweringOff = useStore((s) => s.poweringOff)
  const { open, closeAll, setMode } = useStore.getState()
  const rect = useScreenRect()
  const { selected, setSelected, marquee, iconRefs, startMarquee } = useMarquee()

  // ref guard: StrictMode runs mount effects twice in dev
  const booted = useRef(false)
  useEffect(() => {
    if (!booted.current) playPowerOn()
    booted.current = true
  }, [])
  useEffect(() => {
    if (poweringOff) playPowerOff()
  }, [poweringOff])

  return (
    <div
      className={`desktop ${poweringOff ? 'crt-off' : 'crt-on'}`}
      style={{ ...rect, '--desk-h': `${rect.height}px` } as CSSProperties}
      onPointerDownCapture={() => playClick()}
      onPointerUpCapture={() => playClick(true)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && poweringOff) {
          closeAll()
          setMode('exiting')
        }
      }}
    >
      <div className="wallpaper" onPointerDown={startMarquee}>
        <pre className="wallpaper-logo" aria-hidden>
          {NIX_ASCII}
        </pre>
        <Snow />
      </div>

      <div className="icons">
        {LAUNCHABLE.map((id) => (
          <button
            key={id}
            ref={(el) => {
              if (el) iconRefs.current.set(id, el)
              else iconRefs.current.delete(id)
            }}
            className={`desk-icon ${selected.has(id) ? 'selected' : ''}`}
            onClick={(e) => {
              // ctrl/cmd-click toggles, plain click selects just this one
              if (e.ctrlKey || e.metaKey) {
                const next = new Set(selected)
                if (!next.delete(id)) next.add(id)
                setSelected(next)
              } else setSelected(new Set([id]))
              // single tap opens on touch screens
              if (matchMedia('(pointer: coarse)').matches) open(id)
            }}
            onDoubleClick={() => open(id)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              if (selected.size > 1) selected.forEach((s) => open(s))
              else open(id)
            }}
          >
            <Icon name={APPS[id].icon} size={40} />
            <span>{APPS[id].label}</span>
          </button>
        ))}
      </div>

      {marquee && (
        <div
          className="marquee"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}

      {windows.map((w) => (
        <Window key={w.id} win={w} />
      ))}

      <Taskbar />
      <div className="crt-overlay" />
    </div>
  )
}
