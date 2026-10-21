import { useEffect, useRef, useState } from 'react'
import { profile } from '../../data/profile'
import { systemSpecs, systemTagline } from '../../data/system'
import { SlumpyFace } from '../../scene/SlumpyFace'

const BOOTED = performance.now() // "uptime" counts from page load

const fmtUptime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`
}

// KDE "About this System", for Slumpy: its face, its name, made-up specs
export function SystemInfo() {
  const screen = useRef<HTMLDivElement>(null)
  const [uptime, setUptime] = useState(0)

  useEffect(() => {
    const face = new SlumpyFace()
    screen.current?.appendChild(face.canvas)
    face.set(null)
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      face.update(Math.min((now - last) / 1000, 0.1))
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const id = setInterval(() => setUptime(performance.now() - BOOTED), 1000)
    setUptime(performance.now() - BOOTED)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
      face.canvas.remove()
      face.texture.dispose()
    }
  }, [])

  return (
    <div className="sysinfo">
      <div className="sysinfo-head">
        <div className="sysinfo-screen" ref={screen} aria-hidden />
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
