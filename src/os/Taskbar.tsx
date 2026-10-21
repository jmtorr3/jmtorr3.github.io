import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { APPS, LAUNCHABLE, START_EXTRAS, type AppId } from './apps/registry'
import { Icon } from './Icon'
import { profile } from '../data/profile'
import { useSound, unlockAudio } from './sound'

// on touch screens, focusing the search box would pop up the on-screen keyboard
const TOUCH = matchMedia('(pointer: coarse)').matches

function SoundToggle() {
  const { muted, toggle } = useSound()
  return (
    <button
      className="tray-btn nf"
      onClick={() => {
        unlockAudio()
        toggle()
      }}
      title={muted ? 'Sound off' : 'Sound on'}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
    >
      {muted ? '\uf026' : '\uf028'}
    </button>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return <span className="clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
}

export function Taskbar() {
  const windows = useStore((s) => s.windows)
  const focused = useStore((s) => s.focused)
  const { open, focus, minimize, shutdown } = useStore.getState()
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  const matches = (id: AppId) => APPS[id].label.toLowerCase().includes(query.toLowerCase())
  const apps = LAUNCHABLE.filter(matches)
  const extras = START_EXTRAS.filter(matches)

  const launch = (id: AppId) => {
    open(id)
    setMenu(false)
    setQuery('')
  }

  return (
    <div className="taskbar">
      <div ref={menuRef} className="start-wrap">
        <button className={`start ${menu ? 'pressed' : ''}`} onClick={() => setMenu((m) => !m)}>
          <Icon name="computer" size={18} />
          start
        </button>
        {menu && (
          <div className="start-menu">
            <div className="start-head">
              <img src={profile.avatar} alt="" className="start-avatar" />
              <span>
                {profile.name}
                <span className="start-role">{profile.role}</span>
              </span>
            </div>
            <input
              className="start-search"
              placeholder="Search…"
              autoFocus={!TOUCH}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (apps[0] ?? extras[0]) && launch(apps[0] ?? extras[0])}
            />
            <div className="start-list">
              {apps.map((id) => (
                <button key={id} onClick={() => launch(id)}>
                  <Icon name={APPS[id].icon} size={24} />
                  {APPS[id].label}
                </button>
              ))}
              {extras.length > 0 && apps.length > 0 && <div className="start-sep" />}
              {extras.map((id) => (
                <button key={id} onClick={() => launch(id)}>
                  <Icon name={APPS[id].icon} size={24} />
                  {APPS[id].label}
                </button>
              ))}
            </div>
            <div className="start-foot">
              <button onClick={shutdown}>
                <Icon name="power" size={20} /> Shut Down
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="tasks">
        {windows.map((w) => {
          const active = focused === w.id && !w.minimized
          return (
            <button
              key={w.id}
              className={`task ${active ? 'active' : ''}`}
              onClick={() => (active ? minimize(w.id) : (open(w.app, { key: w.id.split(':')[1] }), focus(w.id)))}
              title={w.title}
            >
              <Icon name={APPS[w.app].icon} size={16} />
              <span>{w.title}</span>
            </button>
          )
        })}
      </div>

      <div className="tray">
        <SoundToggle />
        <Clock />
      </div>
    </div>
  )
}
