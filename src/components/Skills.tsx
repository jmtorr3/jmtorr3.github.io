import FadeIn from './FadeIn'
import './Skills.css'
import { skillGroups } from '../data/skills'

export default function Skills() {
  return (
    <section id="skills">
      <h2 className="section-title">Skills &amp; <span>Tools</span></h2>

      <div className="skills-grid">
        {skillGroups.map((g, i) => (
          <FadeIn key={g.category} delay={i * 80}>
            <div className="skill-group">
              <div className="skill-icon-wrap">
                <span className="skill-icon">{g.icon}</span>
              </div>
              <span className="skill-category">{g.category}</span>
              <div className="skill-tags">
                {g.skills.map((s) => (
                  <span key={s.name} className="skill-tag">
                    <span className="nf">{s.icon}</span> {s.name}
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

    </section>
  )
}
