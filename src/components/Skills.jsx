import FadeIn from './FadeIn'
import './Skills.css'

const skillGroups = [
  {
    category: 'Languages',
    icon: '\uf121',  // fa-code </>
    skills: [
      { name: 'C',              icon: '\ue61e' },
      { name: 'C++',            icon: '\ue61d' },
      { name: 'React',          icon: '\ue7ba' },
      { name: 'Python',         icon: '\ue73c' },
      { name: 'Java',           icon: '\ue738' },
      { name: 'JavaScript',     icon: '\ue781' },
      { name: 'SQL',            icon: '\uf1c0' },
      { name: 'Assembly (ARM)', icon: '\uf2db' },
    ],
  },
  {
    category: 'Systems & Security',
    icon: '\uf023',  // fa-lock
    skills: [
      { name: 'Reverse Engineering', icon: '\uf188' },
      { name: 'Ghidra',              icon: '\uf0c3' },
      { name: 'Linux Kernel',        icon: '\uf17c' },
    ],
  },
  {
    category: 'Infrastructure & Tooling',
    icon: '\uf085',  // fa-gears
    skills: [
      { name: 'Docker',     icon: '\ue7b0' },
      { name: 'Proxmox',    icon: '\uf233' },
      { name: 'NixOS',      icon: '\uf313' },
      { name: 'PostgreSQL', icon: '\ue76e' },
      { name: 'Git',        icon: '\ue702' },
      { name: 'CI/CD',      icon: '\uf013' },
      { name: 'LaTeX',      icon: '\uf02d' },
    ],
  },
]

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
