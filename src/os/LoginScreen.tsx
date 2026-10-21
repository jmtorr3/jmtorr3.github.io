import { useEffect, useState } from 'react'
import { profile } from '../data/profile'
import { systemOS } from '../data/system'
import { FaceScreen } from './FaceScreen'
import { useStore, slumpyLocation } from '../store'
import { playKeyTick, playLoginChime } from './sound'

const DOTS = 6

// The welcome screen between the CRT turning on and the desktop: the guest
// account signs itself in, then it fades into the desktop. Click or press a key
// to skip.
export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [typed, setTyped] = useState(0)
  const slumpyHere = useStore((s) => slumpyLocation(s) === 'login')
  const [phase, setPhase] = useState<'typing' | 'welcome' | 'leaving'>('typing')

  useEffect(() => {
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    for (let i = 1; i <= DOTS; i++)
      at(450 + i * 110, () => {
        setTyped(i)
        playKeyTick()
      })
    at(450 + DOTS * 110 + 250, () => {
      setPhase('welcome')
      playLoginChime()
    })
    at(450 + DOTS * 110 + 1150, () => setPhase('leaving'))
    at(450 + DOTS * 110 + 1550, onDone)

    const skip = () => {
      timers.forEach(clearTimeout)
      setPhase('leaving')
      window.setTimeout(onDone, 300)
    }
    window.addEventListener('pointerdown', skip, { once: true })
    window.addEventListener('keydown', skip, { once: true })
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [onDone])

  return (
    <div className={`login ${phase}`} role="status" aria-label={`Signing in to ${profile.host}`}>
      <div className="login-tile">
        <FaceScreen className="login-avatar" away={!slumpyHere} />
        <div className="login-who">
          <span className="login-user">{profile.user}</span>
          {phase === 'typing' ? (
            <span className="login-password" aria-hidden>
              {'•'.repeat(typed)}
              <span className="login-caret">▏</span>
            </span>
          ) : (
            <span className="login-welcome">welcome</span>
          )}
        </div>
      </div>
      <div className="login-foot">
        {profile.host} · {systemOS}
      </div>
    </div>
  )
}
