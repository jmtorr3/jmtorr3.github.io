import { useEffect, useState } from 'react'
import './Other.css'
import { otherProjects } from '../data/other'

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function ModrinthIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.467 18.029c2.328-3.434 2.252-7.987-.297-11.288l-.99 1.296c1.92 2.703 2.075 6.293.298 9.157zm-1.583-1.114c1.625-2.787 1.4-6.336-.747-8.929l-1.012 1.296c1.564 1.998 1.81 4.794.66 7.06zM4.4 17.92c2.398 3.21 6.49 4.554 10.226 3.39l-.486-1.553c-3.05.886-6.41-.12-8.405-2.62zm12.77 4.105c-3.65 1.954-8.116 1.413-11.218-1.394l1.06-1.187c2.526 2.265 6.143 2.689 9.084 1.122zM2.553 12c.207 4.36 3.348 8.05 7.642 8.95l.319-1.6c-3.566-.751-6.16-3.83-6.317-7.466zM2.4 8.013l1.473.616c1.405-3.385 4.737-5.59 8.394-5.567l.027-1.626c-4.34-.045-8.292 2.586-9.894 6.577zm-1.487-.51c1.778-4.4 6.07-7.319 10.94-7.279L11.84 2.5c-4.103-.027-7.704 2.42-9.231 6.094zm.027 8.974c-.768-1.745-1.07-3.668-.866-5.566L1.69 11.122c-.18 1.626.094 3.281.785 4.787zM7.5 6.193l-.99-1.282c-1.105.85-1.997 1.929-2.617 3.155l1.473.616c.531-1.014 1.252-1.91 2.134-2.49zM12 4.94c-2.4 0-4.6 1.106-6.04 3.005l1.32 1.04c1.107-1.501 2.847-2.367 4.72-2.367 2.62 0 4.96 1.65 5.89 4.16l1.546-.557c-1.187-3.211-4.23-5.281-7.436-5.281zM12 9.31c-1.482 0-2.793.875-3.439 2.256l1.428.673c.379-.81 1.144-1.32 2.011-1.32.732 0 1.39.367 1.787.99l1.387-.846c-.638-1.112-1.852-1.753-3.174-1.753zm-2.063 5.281c.396.621 1.054.96 1.787.96.732 0 1.39-.339 1.787-.96l1.387.846c-.638 1.111-1.852 1.752-3.174 1.752s-2.536-.64-3.174-1.752Z" />
    </svg>
  )
}

function useModrinthDownloads(slug?: string) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch(`https://api.modrinth.com/v2/project/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (!cancelled && typeof data?.downloads === 'number') setCount(data.downloads)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug])
  return count
}

export default function Other() {
  return (
    <section id="other">
      <h2 className="section-title">Other <span>Projects</span></h2>

      {otherProjects.map((p) => (
        <OtherCard key={p.title} p={p} />
      ))}
    </section>
  )
}

function OtherCard({ p }: { p: typeof otherProjects[number] }) {
  const liveDownloads = useModrinthDownloads(p.modrinthSlug)
  const statText = liveDownloads != null
    ? `${liveDownloads.toLocaleString()} downloads`
    : p.stat

  return (
    <div className="other-card">

          <div className="other-header">
            <div className="other-header-left">
              <img src={p.logo} alt={`${p.title} logo`} className="garage-logo" loading="lazy" />
              <div>
                <h3 className="other-title">{p.title}</h3>
                <p className="other-subtitle">{p.subtitle}</p>
              </div>
            </div>
            <div className="other-meta">
              <span className="other-role">{p.role}</span>
              <span className="other-stat">{statText}</span>
              {p.modrinth && (
                <a
                  href={p.modrinth}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="github-link"
                  aria-label={`${p.title} on Modrinth`}
                >
                  <ModrinthIcon />
                </a>
              )}
              {p.github && (
                <a
                  href={p.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="github-link"
                  aria-label={`${p.title} on GitHub`}
                >
                  <GitHubIcon />
                </a>
              )}
            </div>
          </div>

          <p className="other-desc">
            {p.description}{' '}
            <a href={p.collaborator.href} target="_blank" rel="noopener noreferrer">
              {p.collaborator.name}
            </a>.
          </p>

          <div className="media-grid">
            <img src={p.previews[0].src} alt={p.previews[0].alt} loading="lazy" className="media-gif" />
            <div className="media-screenshots">
              {p.screenshots.map((s) => (
                <img key={s.alt} src={s.src} alt={s.alt} loading="lazy" className="screenshot-img" />
              ))}
            </div>
          </div>

          <div className="other-tags">
            {p.tags.map((t) => (
              <span key={t} className="tech-tag">{t}</span>
            ))}
          </div>

        </div>
  )
}
