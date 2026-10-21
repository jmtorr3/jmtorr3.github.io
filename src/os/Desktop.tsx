import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { fitScreen, isCompact } from '../scene/screenFit'
import { useStore, TASKBAR_H, slumpyLocation } from '../store'
import { profile } from '../data/profile'
import { APPS } from './apps/registry'
import { Icon } from './Icon'
import { Window } from './Window'
import { Taskbar } from './Taskbar'
import { Snow } from './Snow'
import { FaceScreen } from './FaceScreen'
import { HOME, TRASH, lookup, openNotepad, removePath } from './vfs'
import { useSlumpy } from './slumpy'
import { useDesktopIcons, deskIcons, type DeskId } from './useDesktopIcons'
import { playPowerOn, playPowerOff, playClick, playKeyClack, useSound, speak } from './sound'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { LoginScreen } from './LoginScreen'

const COARSE = matchMedia('(pointer: coarse)').matches


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
  const [selected, setSelected] = useState<Set<DeskId>>(new Set())
  const [marquee, setMarquee] = useState<Box | null>(null)
  const iconRefs = useRef(new Map<DeskId, HTMLElement>())

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
    const base = additive ? new Set(selected) : new Set<DeskId>()
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

const SNOW_KEY = 'snow-off'
const readSnow = () => {
  try {
    return localStorage.getItem(SNOW_KEY) !== '1'
  } catch {
    return true
  }
}

// what's left on screen after `rm -rf /*` (see the panic effect in Desktop)
function KernelPanic() {
  const t = (n: number) => `[${(4.2049 + n * 0.00001).toFixed(6).padStart(12)}]`
  return (
    <pre className="kernel-panic">
      {[
        `${t(0)} Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000009`,
        `${t(1)} CPU: 0 PID: 1 Comm: ${profile.host} Not tainted 6.1.0-slumpy #1`,
        `${t(2)} Hardware name: ${profile.host} picoCAD PC, BIOS 1.0`,
        `${t(3)} Call Trace:`,
        `${t(4)}  <TASK>`,
        `${t(5)}  dump_stack_lvl+0x48/0x60`,
        `${t(6)}  panic+0x118/0x2f0`,
        `${t(7)}  do_exit.cold+0x15/0x15`,
        `${t(8)}  face_service_stop+0x1c/0x40 [slumpy]`,
        `${t(9)}  </TASK>`,
        `${t(10)} Kernel Offset: disabled`,
        `${t(11)} ---[ end Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000009 ]---`,
        '',
        'rebooting...',
      ].join('\n')}
    </pre>
  )
}

// the README and the Recycle Bin sit with the app icons, but they're a file
// (Notepad opens it) and a folder (Dolphin opens it)
const README_PATH = `${HOME}/Desktop/README.md`
const deskIcon = (id: DeskId) =>
  id === 'trash' ? { icon: 'trash' as const, label: 'Recycle Bin' } : id === 'readme' ? { icon: 'notepad' as const, label: 'README.md' } : APPS[id]
const openIcon = (id: DeskId) =>
  id === 'trash'
    ? useStore.getState().open('projects', { key: TRASH, title: 'Trash - Dolphin', props: { path: TRASH, at: Date.now() } })
    : id === 'readme'
      ? openNotepad(README_PATH)
      : useStore.getState().open(id)
const trashNode = () => {
  const n = lookup(TRASH)
  return n?.type === 'dir' ? n : null
}
const trashCount = () => Object.keys(trashNode()?.children ?? {}).length
// (for this visit: everything comes back on a reload)
const emptyTrash = () => Object.keys(trashNode()?.children ?? {}).forEach((name) => removePath(`${TRASH}/${name}`))

export function Desktop() {
  const windows = useStore((s) => s.windows)
  const poweringOff = useStore((s) => s.poweringOff)
  const { open, closeAll, setMode } = useStore.getState()
  // straight from the power button's boot log: the sign-in fades in over the log
  // instead of the CRT switching on again (it's already on)
  // (the log stays on the 3D screen underneath until the fade is done)
  const [fromBoot] = useState(() => useStore.getState().booting)
  const { rect, scale, w, h, compact } = useScreenRect()
  const { selected, setSelected, marquee, iconRefs, startMarquee } = useMarquee()
  const icons = useDesktopIcons({ w, h, scale, selected, setSelected })
  const sound = useSound()

  // right-click menu, at a point in desktop px
  const deskRef = useRef<HTMLDivElement>(null)
  const menu = useStore((s) => s.menu)
  const closeMenu = useStore((s) => s.hideMenu)
  const [snow, setSnow] = useState(readSnow)
  const [refreshes, setRefreshes] = useState(0)
  const slumpyHere = useStore((s) => slumpyLocation(s) === 'wallpaper')

  // the tab reads like the OS while you're on it: guest@slumpy, plus the
  // focused app; back to the page's own title (index.html) on log off
  const focusedApp = useStore((s) => s.windows.find((w) => w.id === s.focused && !w.minimized)?.app)
  useEffect(() => {
    const base = document.title
    return () => {
      document.title = base
    }
  }, [])
  useEffect(() => {
    const who = `${profile.user}@${profile.host}`
    document.title = focusedApp ? `${who}: ${APPS[focusedApp].label}` : who
  }, [focusedApp])
  // the welcome screen plays every time the PC turns on
  const [signedIn, setSignedIn] = useState(false)
  const finishLogin = useCallback(() => setSignedIn(true), [])
  useEffect(() => {
    useStore.setState({ signingIn: !signedIn })
    return () => useStore.setState({ signingIn: false })
  }, [signedIn])
  // signed in: Slumpy lands on the wallpaper and blinks a few times, getting his bearings
  const slumpy = useSlumpy()
  useEffect(() => {
    if (!signedIn) return
    const id = setTimeout(() => slumpy.blink(3), 450)
    // booted from the floppy: straight into what's on it
    const app = useStore.getState().openOnSignIn
    if (app) {
      useStore.setState({ openOnSignIn: null })
      open(app)
    }
    return () => clearTimeout(id)
  }, [signedIn, slumpy, open])

  const toggleSnow = () => {
    setSnow(!snow)
    try {
      localStorage.setItem(SNOW_KEY, snow ? '1' : '0')
    } catch {
      // storage blocked; the setting just won't persist
    }
  }

  const openMenu = (e: ReactMouseEvent, items: MenuItem[]) => {
    e.preventDefault()
    useStore.getState().showMenu(e.clientX, e.clientY, items)
  }
  // the menu is drawn in desktop px: convert from the screen point
  const deskRect = deskRef.current?.getBoundingClientRect()
  const menuAt = menu && deskRect ? { x: (menu.clientX - deskRect.left) / scale, y: (menu.clientY - deskRect.top) / scale } : null

  const desktopMenu: MenuItem[] = [
    { label: 'Open Konsole Here', icon: 'terminal', onClick: () => open('terminal', { props: { cwd: `${HOME}/Desktop` } }) },
    { separator: true },
    { label: 'Arrange Icons', icon: 'folder', onClick: icons.arrange },
    { label: 'Refresh', icon: 'computer', onClick: () => setRefreshes((n) => n + 1) },
    { separator: true },
    { label: 'Snow', icon: 'image', checked: snow, onClick: toggleSnow },
    { label: 'Sound', icon: 'chip', checked: !sound.muted, onClick: sound.toggle },
    { separator: true },
    { label: 'System Settings', icon: 'settings', onClick: () => open('settings') },
    { label: 'About This Computer', icon: 'computer', onClick: () => open('system') },
    { label: 'Log Off', icon: 'logout', onClick: () => useStore.getState().logOff() },
    { label: 'Shut Down', icon: 'power', onClick: () => useStore.getState().shutDown() },
  ]

  const iconMenu = (id: DeskId): MenuItem[] => {
    const many = selected.has(id) && selected.size > 1
    const targets = many ? deskIcons().filter((x) => selected.has(x)) : [id]
    const items: MenuItem[] = [
      { label: many ? `Open ${targets.length} Items` : 'Open', icon: deskIcon(id).icon, onClick: () => targets.forEach(openIcon) },
    ]
    if (id === 'trash' && !many) items.push({ label: 'Empty Recycle Bin', icon: 'trash', disabled: !trashCount(), onClick: emptyTrash })
    return items
  }

  // ref guard: StrictMode runs mount effects twice in dev
  const booted = useRef(false)
  useEffect(() => {
    if (!booted.current && !fromBoot) playPowerOn()
    booted.current = true
  }, [])
  // typing anywhere on the desktop clacks away on Chiba (the room's keyboard)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return // shortcuts, not typing
      const k = e.key
      if (k === ' ') playKeyClack('space')
      else if (k === 'Enter') playKeyClack('enter')
      else if (k === 'Backspace' || k === 'Delete') playKeyClack('back')
      // printable keys and Tab; phone keyboards often just say "Unidentified"
      else if (k.length === 1 || k === 'Tab' || k === 'Unidentified') playKeyClack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // `rm -rf /*` in the Konsole: the kernel panics, then he reboots (through the
  // boot log, back to the sign-in; nothing was really deleted)
  const panic = useStore((s) => s.panic)
  useEffect(() => {
    if (!panic) return
    slumpy.react('glitch', 6)
    const id = setTimeout(() => useStore.getState().shutDown(true), 4200)
    return () => clearTimeout(id)
  }, [panic, slumpy])

  useEffect(() => {
    if (!poweringOff) return
    playPowerOff()
    // waves goodbye on the way out (or says goodnight, if he's being shut down)
    const { poweredOff, rebooting } = useStore.getState()
    if (rebooting) speak('be right back!')
    else if (poweredOff) speak('nighty night!', 0.85)
    else speak('bye bye!')
    slumpy.react(poweredOff && !rebooting ? 'sleepy' : 'happy', 1.5)
  }, [poweringOff, slumpy])

  return (
    <div
      className={`desktop ${poweringOff ? 'crt-off' : fromBoot ? 'boot-in' : 'crt-on'} ${compact ? 'compact' : ''}`}
      style={rect}
      onPointerDownCapture={() => playClick()}
      onPointerUpCapture={() => playClick(true)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && fromBoot && !poweringOff) useStore.setState({ booting: false, leaning: false })
        if (e.target === e.currentTarget && poweringOff) {
          closeAll()
          setMode('exiting')
        }
      }}
    >
      {/* laid out at w×h desktop px, scaled up/down to fill the rect */}
      <div
        className="desk-ui"
        ref={deskRef}
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
        <div
          className="wallpaper"
          onPointerDown={(e) => {
            // clicking the desktop takes focus away from windows (and brings Slumpy back out here)
            useStore.setState({ focused: null })
            startMarquee(e)
          }}
          onContextMenu={(e) => openMenu(e, desktopMenu)}
        >
          <FaceScreen transparent className="wallpaper-face" away={!slumpyHere} />
          {snow && <Snow />}
        </div>

        {/* keyed so Refresh re-mounts it, replaying its flicker-in */}
        <div className={`icons ${refreshes ? 'refresh' : ''}`} key={refreshes}>
          {deskIcons().map((id) => (
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
                if (matchMedia('(pointer: coarse)').matches) openIcon(id)
              }}
              onDoubleClick={() => openIcon(id)}
              onContextMenu={(e) => {
                e.stopPropagation()
                if (!selected.has(id)) setSelected(new Set([id]))
                openMenu(e, iconMenu(id))
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (selected.size > 1) selected.forEach(openIcon)
                else openIcon(id)
              }}
            >
              <Icon name={deskIcon(id).icon} size={40} />
              <span>{deskIcon(id).label}</span>
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

        {menu && menuAt && (
          <ContextMenu {...menuAt} items={menu.items} bounds={{ w, h: h - TASKBAR_H }} onClose={closeMenu} />
        )}

        <Taskbar />
        {!signedIn && <LoginScreen onDone={finishLogin} />}
        {panic && <KernelPanic />}
      </div>
      <div className="crt-overlay" />
    </div>
  )
}
