import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { fitScreen } from '../scene/screenFit'
import { useStore, TASKBAR_H } from '../store'
import { APPS, LAUNCHABLE, type AppId } from './apps/registry'
import { Icon } from './Icon'
import { Window } from './Window'
import { Taskbar } from './Taskbar'
import { Snow } from './Snow'
import { NIX_ASCII } from './nixAscii'
import { BrailleArt } from './BrailleArt'
import { useDesktopIcons } from './useDesktopIcons'
import { playPowerOn, playPowerOff, playClick } from './sound'

const COARSE = matchMedia('(pointer: coarse)').matches

// phones (either orientation) and portrait screens: the monitor's 5:4 opening would be
// a tiny box, so the desktop fills the visible viewport instead
const isCompact = (w: number, h: number) => w < 720 || h > w || Math.min(w, h) < 500

const readViewport = () => {
  const v = window.visualViewport
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    // the visible part of the page; it shrinks when the on-screen keyboard opens
    vv: v ? { left: v.offsetLeft, top: v.offsetTop, width: v.width, height: v.height } : null,
  }
}

// The desktop is laid out at a fixed-ish "logical" size and scaled to the rect,
// so fonts, icons and windows keep their proportions on any screen.
function uiScale(w: number, h: number, compact: boolean) {
  const s = compact ? Math.min(w / 700, h / 900) : h / 720
  // touch never goes below 1: inputs must stay >= 16px or mobile browsers zoom on focus
  const min = compact || COARSE ? 1 : 0.8
  return Math.round(Math.min(2.5, Math.max(min, s)) * 50) / 50
}

// sit exactly on the monitor's screen opening, so the desktop keeps the model's aspect ratio
function useScreenRect() {
  const screen = useStore((s) => s.screen)
  const setDesk = useStore((s) => s.setDesk)
  const [vp, setVp] = useState(readViewport)

  useEffect(() => {
    const onResize = () => setVp(readViewport())
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('scroll', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('scroll', onResize)
    }
  }, [])

  const compact = isCompact(vp.w, vp.h)
  const rect =
    compact || !screen
      ? (vp.vv ?? { left: 0, top: 0, width: vp.w, height: vp.h })
      : fitScreen(screen, vp.w, vp.h).rect
  const scale = uiScale(rect.width, rect.height, compact)
  const w = rect.width / scale
  const h = rect.height / scale

  useEffect(() => setDesk(w, h, scale), [w, h, scale, setDesk])
  return { rect, scale, w, h, compact }
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
  const { rect, scale, w, h, compact } = useScreenRect()
  const { selected, setSelected, marquee, iconRefs, startMarquee } = useMarquee()
  const icons = useDesktopIcons({ w, h, scale, selected, setSelected })

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
      className={`desktop ${poweringOff ? 'crt-off' : 'crt-on'} ${compact ? 'compact' : ''}`}
      style={rect}
      onPointerDownCapture={() => playClick()}
      onPointerUpCapture={() => playClick(true)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && poweringOff) {
          closeAll()
          setMode('exiting')
        }
      }}
    >
      {/* laid out at w×h desktop px, scaled up/down to fill the rect */}
      <div
        className="desk-ui"
        style={
          {
            width: w,
            height: h,
            transform: `scale(${scale})`,
            '--desk-h': `${h}px`,
            '--taskbar-h': `${TASKBAR_H}px`,
          } as CSSProperties
        }
      >
        <div className="wallpaper" onPointerDown={startMarquee}>
          <BrailleArt art={NIX_ASCII} className="wallpaper-logo" />
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
              className={`desk-icon ${selected.has(id) ? 'selected' : ''} ${icons.isDragging(id) ? 'dragging' : ''}`}
              style={icons.position(id)}
              {...icons.handlers(id)}
              onClick={(e) => {
                if (icons.consumeClick()) return
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
      </div>
      <div className="crt-overlay" />
    </div>
  )
}
