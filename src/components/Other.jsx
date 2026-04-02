import './Other.css'

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

const BASE = 'https://raw.githubusercontent.com/slumpy666/Garage32/main/.assets'

const screenshots = [
  { src: `${BASE}/screenshots/roster.png`, alt: 'Car roster' },
  { src: `${BASE}/screenshots/office.png`, alt: 'Office interior' },
  { src: `${BASE}/screenshots/mcd.png`,    alt: "McDonald's build" },
]

const previews = [
  { src: `${BASE}/gifs/TakumiAE86.gif`, label: 'Takumi AE86' },
]

export default function Other() {
  return (
    <section id="other">
      <h2 className="section-title">Other <span>Projects</span></h2>

      <div className="other-card">

        {/* Header */}
        <div className="other-header">
          <div className="other-header-left">
            <img
              src={`${BASE}/logos/Garage32.png`}
              alt="Garage32 logo"
              className="garage-logo"
              loading="lazy"
            />
            <div>
              <h3 className="other-title">Garage32</h3>
              <p className="other-subtitle">Minecraft CEM Texture Pack</p>
            </div>
          </div>
          <div className="other-meta">
            <span className="other-role">Project Lead</span>
            <span className="other-stat">500+ downloads</span>
            <a
              href="https://github.com/jmtorr3/Garage32"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
              aria-label="Garage32 on GitHub"
            >
              <GitHubIcon />
            </a>
          </div>
        </div>

        <p className="other-desc">
          A custom Minecraft texture pack that transforms boats into fully modeled cars using
          Custom Entity Models (CEM). Multiple car models across wood type variants — designed
          in collaboration with{' '}
          <a href="https://www.instagram.com/slug_7/" target="_blank" rel="noopener noreferrer">
            Tim Kang
          </a>.
        </p>

        <div className="media-grid">
          <img
            src={previews[0].src}
            alt={previews[0].label}
            loading="lazy"
            className="media-gif"
          />
          <div className="media-screenshots">
            {screenshots.map((s) => (
              <img key={s.alt} src={s.src} alt={s.alt} loading="lazy" className="screenshot-img" />
            ))}
          </div>
        </div>

        <div className="other-tags">
          {['Minecraft', 'OptiFine CEM', 'Asset Design', 'Community'].map((t) => (
            <span key={t} className="tech-tag">{t}</span>
          ))}
        </div>

      </div>
    </section>
  )
}
