import FadeIn from './FadeIn'
import './Projects.css'

const projects = [
  {
    title: 'Garage64',
    subtitle: 'Custom Entity Model Studio',
    date: 'Spring 2026',
    status: 'active',
    featured: true,
    tech: ['React', 'Three.js', 'Django', 'SQLite', 'Docker'],
    github: 'https://github.com/jmtorr3/Garage64',
    logo: 'https://raw.githubusercontent.com/jmtorr3/Garage64/main/assets/Logo.png',
    images: [
      { src: 'https://raw.githubusercontent.com/jmtorr3/Garage64/main/assets/cover.png', alt: 'Garage64 cover' },
    ],
    bullets: [
      'Full-stack web application serving as a complete suite for designing and exporting custom Minecraft car models (OptiFine CEM) and texture packs.',
      'Engineered a React + Three.js frontend for a real-time 3D workspace — users dynamically compose vehicles by swapping parts and applying custom paint textures.',
      'Developed a Django REST API to manage entity data and created a one-click export generating ready-to-use .jem and .jpm asset files.',
    ],
  },
  {
    title: 'ParkGrid',
    subtitle: 'Campus Parking Solution',
    date: 'Winter 2025',
    status: 'completed',
    tech: ['React', 'Django', 'PostgreSQL', 'Docker', 'Python', 'Django Channels', 'JWT'],
    github: 'https://github.com/jmtorr3/smart-parking',
    demo: 'https://drive.google.com/file/d/1i2iBi6BwchyWwZEsMr-X2uHa96rrrGug/view?usp=sharing',
    images: [
      { src: 'https://raw.githubusercontent.com/jmtorr3/smart-parking/main/dashboard.png', alt: 'Dashboard preview' },
      { src: 'https://raw.githubusercontent.com/jmtorr3/smart-parking/main/Database_Diagram.png', alt: 'ER Diagram' },
    ],
    bullets: [
      'Served as technical lead for a 5-person team, directing project milestones and owning the core full-stack application.',
      'Co-designed the relational database architecture and led the transition from prototype to a polished production version.',
      'Built a Python simulator generating high-frequency occupancy data to stress-test simultaneous sensor updates against PostgreSQL.',
    ],
  },
  {
    title: 'Nintendo DS Security Analysis',
    subtitle: 'Reverse Engineering Research',
    date: 'Winter 2024',
    status: 'completed',
    tech: ['Assembly', 'DeSmuME', 'Ghidra', 'Python'],
    github: null,
    bullets: [
      'Executed dynamic binary analysis on the Nintendo DS architecture using a virtualized lab environment from the Advanced Software Reverse Engineering curriculum.',
      'Reverse-engineered the proprietary Gen 5 Linear Congruential Generator (LCG) encryption protocol to decrypt 220-byte save file structures.',
      'Built a custom Python tool calculating dynamic block shuffling permutations via PID bitmask — enabling binary modification without checksum corruption.',
    ],
  },
  {
    title: 'Proxmox Home Lab',
    subtitle: 'Self-Hosted Infrastructure',
    date: '2021 – Present',
    status: 'ongoing',
    tech: ['Proxmox', 'NixOS', 'Debian', 'Docker', 'OPNsense'],
    github: null,
    bullets: [
      'Built and iterated on a home lab environment for hosting, experimenting, and learning systems concepts hands-on.',
      'Designed network topologies with OPNsense firewall configurations and secure jumpbox deployments for managing remote access.',
      'Configured reproducible NixOS development environments for Linux kernel programming, system-level testing, and self-hosted services.',
    ],
  },
]

export default function Projects() {
  return (
    <section id="projects">
      <p className="section-label"><span className="nf">{'\uf126'} </span>Work</p>
      <h2 className="section-title">Technical <span>Projects</span></h2>

      <div className="projects-list">
        {projects.map((p, i) => (
          <FadeIn key={p.title} delay={i * 80}>
          <div className="project-card">

            {/* Terminal chrome bar */}
            <div className="card-chrome">
              <span className="chrome-dot dot-red" />
              <span className="chrome-dot dot-yellow" />
              <span className="chrome-dot dot-green" />
              <div className="chrome-badges">
                {p.featured && <span className="badge-featured">featured</span>}
                <span className={`badge-status status-${p.status}`}>{p.status}</span>
              </div>
            </div>

            {/* Faded project number */}
            <span className="project-number" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>

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
              <div className="project-meta">
                <span className="project-date">{p.date}</span>
                {p.demo && (
                  <a
                    href={p.demo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="demo-link"
                  >
                    Demo ↗
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

            <ul className="project-bullets">
              {p.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>

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

            <div className="project-tech">
              {p.tech.map((t) => (
                <span key={t} className="tech-tag">{t}</span>
              ))}
            </div>
          </div>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}
