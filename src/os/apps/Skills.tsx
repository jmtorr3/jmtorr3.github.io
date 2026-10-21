import { useState } from 'react'
import { skillGroups } from '../../data/skills'
import { addMenuItems, copyText } from '../appMenu'

// KDE System Settings layout: categories on the left, contents on the right
export function Skills() {
  const [active, setActive] = useState(0)
  const group = skillGroups[active]

  return (
    <div
      className="skills"
      onContextMenu={(e) =>
        addMenuItems(e, [
          ...skillGroups.map((g, i) => ({ label: g.category, checked: i === active, onClick: () => setActive(i) })),
          { separator: true },
          { label: `Copy ${group.category}`, icon: 'text', onClick: () => copyText(group.skills.map((s) => s.name).join(', ')) },
        ])
      }
    >
      <aside className="places">
        <div className="places-title">Categories</div>
        {skillGroups.map((g, i) => (
          <button key={g.category} className={i === active ? 'active' : ''} onClick={() => setActive(i)}>
            <span className="nf">{g.icon}</span> {g.category}
          </button>
        ))}
      </aside>
      <div className="skills-main">
        <h2 className="section-title">
          <span className="nf accent">{group.icon}</span> {group.category}
        </h2>
        <div className="skill-grid">
          {group.skills.map((s) => (
            <div key={s.name} className="skill">
              <span className="nf accent">{s.icon}</span>
              {s.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
