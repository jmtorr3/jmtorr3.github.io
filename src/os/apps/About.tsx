import { useEffect, useState } from 'react'
import { profile } from '../../data/profile'
import { education, coursework } from '../../data/about'
import { rich } from '../richText'
import { useStore } from '../../store'
import { addMenuItems, copyText, openUrl } from '../appMenu'

function useTyping(text: string, speed = 48) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = setInterval(() => setN((i) => (i >= text.length ? (clearInterval(id), i) : i + 1)), speed)
    return () => clearInterval(id)
  }, [text, speed])
  return { shown: text.slice(0, n), done: n >= text.length }
}

export function About() {
  const { shown, done } = useTyping(profile.role)
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <div
      className="about"
      onContextMenu={(e) =>
        addMenuItems(e, [
          { label: 'GitHub Profile', icon: 'globe', onClick: () => openUrl(profile.github) },
          { label: 'Projects', icon: 'folder', onClick: () => useStore.getState().open('projects') },
          { label: 'Skills', icon: 'chip', onClick: () => useStore.getState().open('skills') },
          { label: 'Resume', icon: 'text', onClick: () => useStore.getState().open('resume') },
          { separator: true },
          { label: 'Copy Name', icon: 'text', onClick: () => copyText(profile.name) },
        ])
      }
    >
      <section className="about-hero">
        <div className="avatar">
          <img src={profile.avatar} alt={profile.name} />
          {profile.avatarHover && <img src={profile.avatarHover} alt="" aria-hidden className="avatar-hover" />}
        </div>
        <div>
          {profile.status && (
            <div className="status-badge">
              <span className="status-dot" />
              {profile.status}
            </div>
          )}
          <p className="muted">{profile.greeting}</p>
          <h1 className="hero-name">{profile.name}</h1>
          <p className="hero-role">
            <span className="accent">{'>'}</span> {shown}
            <span className={`cursor ${done ? 'blink' : ''}`}>█</span>
          </p>
          <p className="muted">
            <span className="accent">$</span> based in <span className="accent">{profile.location}</span>
          </p>
        </div>
      </section>

      <p className="hero-bio">{rich(profile.bio)}</p>

      <div className="btn-row">
        <a className="btn primary" href={profile.github} target="_blank" rel="noreferrer">
          <span className="nf">{''}</span> GitHub
        </a>
      </div>

      <div className="card edu">
        <div className="edu-header">
          {logoFailed || !education.logo ? (
            <strong>{education.school}</strong>
          ) : (
            <img src={education.logo} alt={education.school} className="edu-logo" onError={() => setLogoFailed(true)} />
          )}
          <span className="muted">{education.date}</span>
        </div>
        <p className="edu-degree">{education.degree}</p>
        <div className="coursework">
          <p className="coursework-label">
            <span className="nf accent">{'\uf02d'}</span> Relevant Coursework
          </p>
          <ul className="course-tags">
            {coursework.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
