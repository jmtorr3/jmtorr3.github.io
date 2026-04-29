import { useState, useEffect } from 'react'
import './Navbar.css'
import { navLinks as links } from '../data/nav'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const [active, setActive] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let lastY = window.scrollY
    let lastT = performance.now()
    const onScroll = () => {
      const now = performance.now()
      const y = window.scrollY
      const dt = Math.max(now - lastT, 1)
      const speed = Math.abs(y - lastY) / dt
      lastY = y
      lastT = now
      setScrolled(y > 40)
      if (speed > 1.2) {
        setScrolling(true)
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => setScrolling(false), 180)
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (idleTimer) clearTimeout(idleTimer)
    }
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

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const close = () => setMenuOpen(false)

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}${menuOpen ? ' menu-open' : ''}${scrolling ? ' scrolling' : ''}`}>
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
            href={`${import.meta.env.BASE_URL}resume.html`}
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
