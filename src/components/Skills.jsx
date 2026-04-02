import './Skills.css'

const skillGroups = [
  {
    category: 'Languages',
    icon: '{ }',
    skills: ['C', 'C++', 'Python', 'Java', 'JavaScript', 'SQL', 'Assembly (ARM)'],
  },
  {
    category: 'Systems & Security',
    icon: '🔒',
    skills: [
      'Reverse Engineering',
      'Ghidra',
      'Linux Kernel',
      'Cryptography (LCG)',
      'ACID Transactions',
      'Concurrency',
    ],
  },
  {
    category: 'Infrastructure & Tooling',
    icon: '⚙',
    skills: ['Docker', 'Proxmox', 'NixOS', 'PostgreSQL', 'Git', 'CI/CD', 'LaTeX'],
  },
]

export default function Skills() {
  return (
    <section id="skills">
      <p className="section-label">Capabilities</p>
      <h2 className="section-title">Skills &amp; <span>Tools</span></h2>

      <div className="skills-grid">
        {skillGroups.map((g) => (
          <div key={g.category} className="skill-group">
            <div className="skill-group-header">
              <span className="skill-icon">{g.icon}</span>
              <span className="skill-category">{g.category}</span>
            </div>
            <div className="skill-tags">
              {g.skills.map((s) => (
                <span key={s} className="skill-tag">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="community-block">
        <div className="community-header">
          <span className="section-label">Leadership</span>
        </div>
        <div className="community-card">
          <div className="community-title">Garage32 — Community Project Lead</div>
          <p className="community-desc">
            Managed development and distribution of a graphical asset pack for a gaming community,
            reaching <strong>500+ downloads</strong> and sustained positive reception.
          </p>
        </div>
      </div>
    </section>
  )
}
