import { useEffect, useState } from 'react'
import { fitScreen } from '../scene/screenFit'
import { useStore } from '../store'
import { APPS, LAUNCHABLE, type AppId } from './apps/registry'
import { Icon } from './Icon'
import { Window } from './Window'
import { Taskbar } from './Taskbar'

const ICON_LABELS: Partial<Record<AppId, string>> = {
  about: 'About Me',
  resume: 'Resume',
}

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

export function Desktop() {
  const windows = useStore((s) => s.windows)
  const poweringOff = useStore((s) => s.poweringOff)
  const { open, closeAll, setMode } = useStore.getState()
  const [selected, setSelected] = useState<AppId | null>(null)
  const rect = useScreenRect()

  return (
    <div
      className={`desktop ${poweringOff ? 'crt-off' : 'crt-on'}`}
      style={rect}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && poweringOff) {
          closeAll()
          setMode('exiting')
        }
      }}
    >
      <div className="wallpaper" onPointerDown={() => setSelected(null)} />

      <div className="icons">
        {LAUNCHABLE.map((id) => (
          <button
            key={id}
            className={`desk-icon ${selected === id ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setSelected(id)
              // single tap opens on touch screens
              if (matchMedia('(pointer: coarse)').matches) open(id)
            }}
            onDoubleClick={() => open(id)}
            onKeyDown={(e) => e.key === 'Enter' && open(id)}
          >
            <Icon name={APPS[id].icon} size={40} />
            <span>{ICON_LABELS[id] ?? APPS[id].title}</span>
          </button>
        ))}
      </div>

      {windows.map((w) => (
        <Window key={w.id} win={w} />
      ))}

      <Taskbar />
      <div className="crt-overlay" />
    </div>
  )
}
