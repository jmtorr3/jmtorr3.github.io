import FadeIn from './FadeIn'
import './Projects.css'
import { projects } from '../data/projects'
import { FeaturedCard, ProjectCard } from './ProjectCard'

const featured = projects.filter((p) => p.featured)
const grid = projects.filter((p) => !p.featured)

export default function Projects() {
  return (
    <section id="projects">
      <p className="section-label"><span className="nf">{'\uf126'} </span>Work</p>
      <h2 className="section-title">Technical <span>Projects</span></h2>

      {featured.map((p, i) => (
        <FadeIn key={p.title}>
          <FeaturedCard project={p} index={i} />
        </FadeIn>
      ))}

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
