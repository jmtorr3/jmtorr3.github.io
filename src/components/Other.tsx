import './Other.css'
import { otherProjects } from '../data/other'

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

export default function Other() {
  return (
    <section id="other">
      <h2 className="section-title">Other <span>Projects</span></h2>

      {otherProjects.map((p) => (
        <div key={p.title} className="other-card">

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
              <span className="other-stat">{p.stat}</span>
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
      ))}
    </section>
  )
}
