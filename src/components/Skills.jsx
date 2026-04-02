import FadeIn from './FadeIn'
import './Skills.css'

const skillGroups = [
  {
    category: 'Languages',
    icon: '\uf121',  // fa-code </>
    skills: ['C', 'C++', 'React', 'Python', 'Java', 'JavaScript', 'SQL', 'Assembly (ARM)'],
  },
  {
    category: 'Systems & Security',
    icon: '\uf023',  // fa-lock
    skills: [
      'Reverse Engineering',
      'Ghidra',
      'Linux Kernel',
    ],
  },
  {
    category: 'Infrastructure & Tooling',
    icon: '\uf085',  // fa-gears
    skills: ['Docker', 'Proxmox', 'NixOS', 'PostgreSQL', 'Git', 'CI/CD', 'LaTeX'],
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
              <div className="skill-group-header">
                <span className="skill-icon nf">{g.icon}</span>
                <span className="skill-category">{g.category}</span>
              </div>
              <div className="skill-tags">
                {g.skills.map((s) => (
                  <span key={s} className="skill-tag">{s}</span>
                ))}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

    </section>
  )
}
