import './About.css'

const coursework = [
  'Linux Kernel Programming',
  'Software Reverse Engineering',
  'Security of AI',
  'Computer Architecture',
  'Computer Systems',
  'Data Structures & Algorithms',
]

export default function About() {
  return (
    <section id="about">
      <p className="section-label">Background</p>
      <h2 className="section-title">About <span>Me</span></h2>

      <div className="about-grid">
        <div className="about-text">
          <p>
            I'm a Computer Science student at{' '}
            <strong>Virginia Tech</strong> graduating in May 2026, based in Ashburn, VA.
            I'm drawn to the intersection of systems programming and security — from reverse
            engineering proprietary encryption to building reproducible infrastructure with NixOS
            and Proxmox.
          </p>
          <p>
            When I'm not in class or poking at my home lab, I build full-stack web apps and
            lead community-driven projects.
          </p>
        </div>

        <div className="about-edu">
          <div className="edu-card">
            <div className="edu-header">
              <span className="edu-school">Virginia Tech</span>
              <span className="edu-date">May 2026</span>
            </div>
            <p className="edu-degree">B.S. Computer Science</p>
            <p className="edu-label">Relevant Coursework</p>
            <ul className="coursework-list">
              {coursework.map((c) => (
                <li key={c}>
                  <span className="dot" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
