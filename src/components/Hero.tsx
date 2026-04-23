import { useState, useEffect } from 'react'
import './Hero.css'
import { roleText as ROLE_TEXT, heroBio, currentProject } from '../data/hero'

function useTyping(text, speed = 48) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let i = 0
    setDisplayed('')
    setDone(false)
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(id)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])

  return { displayed, done }
}

export default function Hero() {
  const { displayed, done } = useTyping(ROLE_TEXT)

  return (
    <section id="hero" className="hero">
      <div className="hero-content">
        <img
          src={`${import.meta.env.BASE_URL}avatar.jpg`}
          alt="Jorge Manuel Torre"
          className="hero-avatar"
          loading="lazy"
        />
        <div className="status-badge">
          <span className="status-dot" />
          Open to opportunities
        </div>
        <p className="hero-greeting">Hellooo, I'm</p>
        <h1 className="hero-name">Jorge Manuel Torre</h1>
        <p className="hero-role">
          <span className="mono accent">{'>'}</span> {displayed}
          <span className={`cursor${done ? ' cursor-blink' : ''}`}>█</span>
        </p>
        <p className="hero-working">
          <span className="mono accent">$</span> currently working on <a href={currentProject.href}>{currentProject.label}</a>
        </p>
        <p className="hero-bio">{heroBio}</p>
        <div className="hero-cta">
          <a href="#projects" className="btn btn-primary">View Projects</a>
          <a href="#contact" className="btn btn-ghost">Get in Touch</a>
          <a
            href={`${import.meta.env.BASE_URL}Jorge_Manuel_Torre_Resume.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            Resume <span className="nf">{'\uf35d'}</span>
          </a>
        </div>
      </div>
      <pre className="hero-ascii" aria-hidden="true">{`⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⢿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⣠⣤⣤⠀⠀⠀⠀⠀⣠⣴⣶⣾⣿⣿⣿⣿⣿⣶⣦⣄⡀⠀⠀⠀⠀⣠⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⡿⠀⠀⢀⣴⣿⣿⣿⣿⣿⡿⠿⠿⠿⣿⣿⣿⣿⣿⣶⣄⠀⠀⢻⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀
⠀⠀⠀⢀⣴⣿⣿⣿⡿⠋⠀⠀⣰⣿⣿⣿⡿⠟⠉⠀⠀⠀⠀⠀⠀⠉⠛⢿⣿⣿⣿⣦⡀⠀⠙⢿⣿⣿⣿⣧⡀⠀⠀⠀
⠀⢀⣴⣿⣿⣿⡿⠋⠀⠀⠀⣼⣿⣿⣿⠟⠀⠀⠀⢀⣀⣤⣤⣄⡀⠀⠀⠀⠙⣿⣿⣿⣷⠀⠀⠀⠙⢿⣿⣿⣿⣦⡀⠀
⢠⣾⣿⣿⡿⠋⠀⠀⠀⠀⢠⣿⣿⣿⠏⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣶⡀⠀⠀⠘⣿⣿⣿⡇⠀⠀⠀⠀⠙⢿⣿⣿⣿⣆
⣿⣿⣿⡟⠁⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⢻⣿⣿⣿⠀⠀⠀⠀⠀⠀⠹⣿⣿⣿
⢻⣿⣿⣷⡀⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⣸⣿⣿⣿⠀⠀⠀⠀⠀⢀⣼⣿⣿⡿
⠀⠻⣿⣿⣿⣦⡀⠀⠀⠀⠸⣿⣿⣿⡆⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀⢠⣿⣿⣿⡇⠀⠀⠀⠀⣠⣾⣿⣿⡟⠁
⠀⠀⠘⢿⣿⣿⣿⣦⡀⠀⠀⢻⣿⣿⣿⣆⠀⠀⠀⠈⠙⠛⠛⠛⠁⠀⠀⠀⣠⣿⣿⣿⡿⠀⠀⢀⣴⣿⣿⣿⡿⠋⠀⠀
⠀⢀⣀⣀⡙⠻⣿⣿⣿⣷⣄⠀⠻⣿⣿⣿⣷⣤⡀⠀⠀⠀⠀⠀⠀⢀⣠⣾⣿⣿⣿⡟⠁⢠⣴⣿⣿⣿⡿⢋⣠⣤⣀⠀
⢠⣿⣿⣿⣿⠀⠈⠛⠿⣿⡿⠀⠀⠘⠻⣿⣿⣿⣿⣷⡄⠀⠀⢀⣾⣿⣿⣿⣿⡿⠋⠀⠀⢻⣿⡿⠟⠉⠀⣾⣿⣿⣿⡇
⠈⠿⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⠿⠿⠿⠃
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣄⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⣀⣤⡄⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣦⣄⣀⣀⣴⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⣧⣀⢀⣠⣴⣾⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠁⠀⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠛⠿⠿⠛⠛⠉⠀⠀⠀⠀⠀⠀⠈⠛⠛⠿⠿⠟⠛⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`}</pre>
    </section>
  )
}
