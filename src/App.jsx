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
