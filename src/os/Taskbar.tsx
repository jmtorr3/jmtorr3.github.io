import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { APPS, LAUNCHABLE } from './apps/registry'
import { Icon } from './Icon'
import { profile } from '../content/about'

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

  const apps = LAUNCHABLE.filter((id) => APPS[id].title.toLowerCase().includes(query.toLowerCase()))

  const launch = (id: (typeof LAUNCHABLE)[number]) => {
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
              <Icon name="user" size={32} />
              <span>{profile.name}</span>
            </div>
            <input
              className="start-search"
              placeholder="Search…"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apps[0] && launch(apps[0])}
            />
            <div className="start-list">
              {apps.map((id) => (
                <button key={id} onClick={() => launch(id)}>
                  <Icon name={APPS[id].icon} size={24} />
                  {APPS[id].title.replace(/ - Notepad$/, '')}
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
        <Clock />
      </div>
    </div>
  )
}
