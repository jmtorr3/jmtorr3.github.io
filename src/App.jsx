import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Projects from './components/Projects'
import Skills from './components/Skills'
import Other from './components/Other'
import Contact from './components/Contact'
import FadeIn from './components/FadeIn'
import Snow from './components/Snow'
import SnowPile from './components/SnowPile'
import './App.css'

export default function App() {
  useEffect(() => {
    const sections = document.querySelectorAll('section[id]')
    let current = null
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            if (current) current.classList.remove('is-active')
            e.target.classList.add('is-active')
            current = e.target
          }
        })
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Snow />
      <Navbar />
      <main>
        <Hero />
        <FadeIn><About /></FadeIn>
        <FadeIn><Projects /></FadeIn>
        <FadeIn><Skills /></FadeIn>
        <FadeIn><Other /></FadeIn>
        <FadeIn><Contact /></FadeIn>
      </main>
      <SnowPile />
    </>
  )
}
