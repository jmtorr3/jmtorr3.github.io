import { useRef, useState } from 'react'
import FadeIn from './FadeIn'
import './Projects.css'
import { projects } from '../data/projects'
import { FeaturedCard, ProjectCard } from './ProjectCard'

const INITIAL_VISIBLE_PROJECTS = 3
const featured = projects.filter((p) => p.featured)
const grid = projects.filter((p) => !p.featured)

export default function Projects() {
  const [showAll, setShowAll] = useState(false)
  const expandRef = useRef<HTMLDivElement | null>(null)
  const visibleFeatured = showAll
    ? featured
    : featured.slice(0, INITIAL_VISIBLE_PROJECTS)
  const hiddenCount = featured.length - INITIAL_VISIBLE_PROJECTS
  const toggleProjects = () => {
    if (!showAll) {
      setShowAll(true)
      return
    }

    setShowAll(false)
    requestAnimationFrame(() => {
      expandRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <section id="projects">
      <p className="section-label"><span className="nf">{'\uf126'} </span>Work</p>
      <h2 className="section-title">Technical <span>Projects</span></h2>

      {visibleFeatured.map((p, i) => (
        <FadeIn key={p.title}>
          <FeaturedCard
            project={p}
            index={i}
            layout={i > 0 && i < INITIAL_VISIBLE_PROJECTS ? 'wrapping' : 'classic'}
          />
        </FadeIn>
      ))}

      {hiddenCount > 0 && (
        <div ref={expandRef} className="projects-expand">
          <p className="projects-count">
            Showing {visibleFeatured.length} of {featured.length} selected projects
          </p>
          <button
            type="button"
            className="projects-expand-btn"
            aria-expanded={showAll}
            onClick={toggleProjects}
          >
            <span aria-hidden="true">{showAll ? '−' : '+'}</span>
            {showAll ? 'Show fewer projects' : `Show ${hiddenCount} more projects`}
          </button>
        </div>
      )}

      <div className="projects-grid">
        {grid.map((p, i) => (
          <FadeIn key={p.title} delay={i * 80}>
            <ProjectCard project={p} index={featured.length + i} />
          </FadeIn>
        ))}
      </div>
    </section>
  )
}
