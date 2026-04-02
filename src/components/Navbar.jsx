import { useState, useEffect } from 'react'
import './Navbar.css'

const links = [
  { label: 'About', href: '#about', id: 'about' },
  { label: 'Projects', href: '#projects', id: 'projects' },
  { label: 'Skills', href: '#skills', id: 'skills' },
  { label: 'Other', href: '#other', id: 'other' },
  { label: 'Contact', href: '#contact', id: 'contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px' }
    )
    links.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const close = () => setMenuOpen(false)

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}${menuOpen ? ' menu-open' : ''}`}>
      <a href="#hero" className="navbar-logo" onClick={close}>
        <span className="mono">jmt</span>
        <span className="accent">.</span>
      </a>

      <button
        className="hamburger"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <ul className={`navbar-links${menuOpen ? ' open' : ''}`}>
        {links.map(({ label, href, id }) => (
          <li key={href}>
            <a
              href={href}
              className={active === id ? 'active' : ''}
              onClick={close}
            >
              {label}
            </a>
          </li>
        ))}
        <li>
          <a
            href="/Jorge_Manuel_Torre_Resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-resume"
            onClick={close}
          >
            Resume
          </a>
        </li>
      </ul>
    </nav>
  )
}
