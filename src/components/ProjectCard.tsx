import './Projects.css'

export type Project = {
  title: string
  subtitle: string
  date: string
  featured?: boolean
  tech: string[]
  github?: string | null
  demo?: string
  demoLabel?: string
  logo?: string
  images?: { src: string; alt: string }[]
  bullets: string[]
  collaborators?: { name: string; href: string }[]
}

type CardProps = { project: Project; index: number }

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function CardChrome({ p }: { p: Project }) {
  return (
    <div className="card-chrome">
      {p.featured && <span className="badge-featured">featured</span>}
    </div>
  )
}

function CardLinks({ p }: { p: Project }) {
  return (
    <div className="project-meta">
      <span className="project-date">{p.date}</span>
      {p.demo && (
        <a href={p.demo} target="_blank" rel="noopener noreferrer" className="demo-link">
          {p.demoLabel ?? 'Demo'} ↗
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
  )
}

function CardBullets({ bullets }: { bullets: string[] }) {
  return (
    <ul className="project-bullets">
      {bullets.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  )
}

function CardCollaborators({ collaborators }: { collaborators?: { name: string; href: string }[] }) {
  if (!collaborators?.length) return null
  return (
    <p className="project-collaborators">
      with{' '}
      {collaborators.map((c, i) => (
        <span key={c.href}>
          <a href={c.href} target="_blank" rel="noopener noreferrer">{c.name}</a>
          {i < collaborators.length - 1 ? ', ' : ''}
        </span>
      ))}
    </p>
  )
}

function CardTech({ tech }: { tech: string[] }) {
  return (
    <div className="project-tech">
      {tech.map((t) => <span key={t} className="tech-tag">{t}</span>)}
    </div>
  )
}

export function FeaturedCard({ project: p, index }: CardProps) {
  return (
    <div className="project-card project-card--featured">
      <span className="project-number" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>

      <CardChrome p={p} />

      <div className="featured-main">
        <div className="featured-left">
          <div className="project-header-left" style={{ marginBottom: '0.75rem' }}>
            {p.logo && (
              <img src={p.logo} alt={`${p.title} logo`} className="project-logo" loading="lazy" />
            )}
            <div>
              <h3 className="project-title">{p.title}</h3>
              <p className="project-subtitle">{p.subtitle}</p>
            </div>
          </div>
          <CardLinks p={p} />
          <CardBullets bullets={p.bullets} />
          <CardCollaborators collaborators={p.collaborators} />
          <CardTech tech={p.tech} />
        </div>

        {p.images && (
          <div className="featured-right">
            {p.images.map((img) => (
              <img
                key={img.alt}
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="project-img"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ProjectCard({ project: p, index }: CardProps) {
  return (
    <div className="project-card">
      <span className="project-number" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>

      <CardChrome p={p} />

      <div className="project-header">
        <div className="project-header-left">
          {p.logo && (
            <img src={p.logo} alt={`${p.title} logo`} className="project-logo" loading="lazy" />
          )}
          <div>
            <h3 className="project-title">{p.title}</h3>
            <p className="project-subtitle">{p.subtitle}</p>
          </div>
        </div>
        <CardLinks p={p} />
      </div>

      <CardBullets bullets={p.bullets} />
      <CardCollaborators collaborators={p.collaborators} />

      {p.images && (
        <div className="project-images">
          {p.images.map((img) => (
            <img
              key={img.alt}
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="project-img"
            />
          ))}
        </div>
      )}

      <CardTech tech={p.tech} />
    </div>
  )
}
