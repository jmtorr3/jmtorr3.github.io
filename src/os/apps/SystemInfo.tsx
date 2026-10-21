import { useEffect, useState } from 'react'
import { profile } from '../../data/profile'
import { systemSpecs, systemTagline } from '../../data/system'
import { FaceScreen } from '../FaceScreen'

const BOOTED = performance.now() // "uptime" counts from page load

const fmtUptime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`
}

// KDE "About this System", for Slumpy: its face, its name, made-up specs
export function SystemInfo() {
  const [uptime, setUptime] = useState(() => performance.now() - BOOTED)

  useEffect(() => {
    const id = setInterval(() => setUptime(performance.now() - BOOTED), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="sysinfo">
      <div className="sysinfo-head">
        <FaceScreen className="sysinfo-screen" />
        <div>
          <h2 className="sysinfo-name">{profile.host}</h2>
          <p className="muted">{systemTagline}</p>
        </div>
      </div>
      <dl className="sysinfo-specs">
        {systemSpecs.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
        <div>
          <dt>Uptime</dt>
          <dd>{fmtUptime(uptime)}</dd>
        </div>
      </dl>
    </div>
  )
}
