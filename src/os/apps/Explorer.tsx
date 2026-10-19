import { useState } from 'react'
import { projects } from '../../content/projects'
import { useStore } from '../../store'
import { Icon } from '../Icon'

export function openProject(slug: string) {
  const p = projects.find((x) => x.slug === slug)
  if (!p) return false
  useStore.getState().open('project', { key: slug, title: `${p.name} - Project`, props: { slug } })
  return true
}

export function Explorer() {
  const [selected, setSelected] = useState<string | null>(null)
  const open = useStore((s) => s.open)
  const sel = projects.find((p) => p.slug === selected)

  return (
    <div className="explorer">
      <div className="toolbar">
        <button disabled>◀</button>
        <button disabled>▶</button>
        <div className="address">/home/you/Projects</div>
      </div>
      <div className="explorer-main">
        <aside className="places">
          <div className="places-title">Places</div>
          <button onClick={() => open('about')}>
            <Icon name="user" size={16} /> Home
          </button>
          <button className="active">
            <Icon name="folder" size={16} /> Projects
          </button>
          <button onClick={() => open('terminal')}>
            <Icon name="terminal" size={16} /> Terminal
          </button>
        </aside>
        <div className="files" onClick={() => setSelected(null)}>
          {projects.map((p) => (
            <button
              key={p.slug}
              className={`file ${selected === p.slug ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(p.slug)
              }}
              onDoubleClick={() => openProject(p.slug)}
            >
              <Icon name="folder" size={32} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="statusbar">
        {sel ? `${sel.name} — ${sel.summary}` : `${projects.length} folders`}
      </div>
    </div>
  )
}

export function ProjectViewer({ props }: { props?: Record<string, unknown> }) {
  const p = projects.find((x) => x.slug === props?.slug)
  if (!p) return <div className="pad">Project not found.</div>
  return (
    <div className="project pad">
      <h2>{p.name}</h2>
      <div className="meta">
        {p.year} · {p.tags.join(', ')}
      </div>
      <p>{p.body}</p>
      {p.url && (
        <a href={p.url} target="_blank" rel="noreferrer" className="btn">
          Visit ↗
        </a>
      )}
    </div>
  )
}
