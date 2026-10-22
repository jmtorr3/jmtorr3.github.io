import { useEffect, useRef, useState } from 'react'
import { useStore, slumpyLocation } from '../store'
import { APPS, LAUNCHABLE, START_EXTRAS, type AppId } from './apps/registry'
import { Icon } from './Icon'
import { profile } from '../data/profile'
import { systemOS } from '../data/system'
import { FaceScreen } from './FaceScreen'
import { useSound, unlockAudio, speak } from './sound'
import { useSlumpy } from './slumpy'
import { toggleFit, useFit } from './fitScreen'
import { isCompact } from '../scene/screenFit'

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

// easter egg: poke the clock this many times this quickly and it glitches out
// (and Slumpy has had enough)
const POKES = 10
const POKE_MS = 4000
const GLITCH_MS = 2000
const SCRAMBLE = '0123456789:#%@$&?!'

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const slumpy = useSlumpy()
  const pokes = useRef<number[]>([])
  const [glitch, setGlitch] = useState(false)
  const [scrambled, setScrambled] = useState(time)
  useEffect(() => {
    if (!glitch) return
    const scramble = () => setScrambled([...time].map(() => SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]).join(''))
    scramble()
    const id = setInterval(scramble, 80)
    const done = setTimeout(() => setGlitch(false), GLITCH_MS)
    return () => {
      clearInterval(id)
      clearTimeout(done)
    }
  }, [glitch, time])
  const poke = () => {
    const t = performance.now()
    pokes.current = [...pokes.current.filter((p) => t - p < POKE_MS), t]
    if (pokes.current.length < POKES || glitch) return
    pokes.current = []
    setGlitch(true)
    slumpy.react('blush', 2.5)
    speak('stop poking me!')
  }
  return (
    <span className={`clock ${glitch ? 'glitch' : ''}`} onClick={poke}>
      {glitch ? scrambled : time}
    </span>
  )
}

export function Taskbar() {
  const windows = useStore((s) => s.windows)
  const focused = useStore((s) => s.focused)
  const { open, focus, minimize, logOff, shutDown } = useStore.getState()
  const [menu, setMenu] = useState(false)
  const slumpyHere = useStore((s) => slumpyLocation(s) === 'start')
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  // shared, so the wallpaper face can step aside while Slumpy is up here
  useEffect(() => {
    useStore.setState({ startOpen: menu })
    return () => useStore.setState({ startOpen: false })
  }, [menu])

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

  const fit = useFit((s) => s.fit)

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
            {/* the account is the computer's own */}
            <div className="start-head">
              <FaceScreen className="start-avatar" away={!slumpyHere} />
              <span>
                {profile.host}
                <span className="start-role">{systemOS}</span>
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
              {!isCompact(window.innerWidth, window.innerHeight) && (
                // (just an icon: the label didn't fit beside Log Off / Shut Down)
                <button
                  className={`start-fit ${fit ? 'on' : ''}`}
                  onClick={() => (toggleFit(), setMenu(false))}
                  title={fit ? 'Back in the monitor (Esc)' : 'Fit to screen: the desktop fills your whole monitor'}
                  aria-label={fit ? 'Back in the monitor' : 'Fit to screen'}
                  aria-pressed={fit}
                >
                  <Icon name="computer" size={20} />
                </button>
              )}
              {/* (only beside the Fit button: on phones Log Off / Shut Down share the footer equally) */}
              {!isCompact(window.innerWidth, window.innerHeight) && <span className="start-foot-gap" />}
              <button onClick={logOff}>
                <Icon name="logout" size={20} /> Log Off
              </button>
              <button onClick={() => shutDown()}>
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
