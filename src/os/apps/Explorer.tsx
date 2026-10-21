import { useEffect, useState } from 'react'
import { projects, slugOf, type Project } from '../../data/projects'
import { useStore } from '../../store'
import { Icon } from '../Icon'
import { addMenuItems, copyText, openUrl } from '../appMenu'
import type { MenuItem } from '../ContextMenu'

// a project's outside links, for right-click menus
function projectLinks(p: Project): MenuItem[] {
  const items: MenuItem[] = []
  if (p.github) items.push({ label: 'Open on GitHub', icon: 'globe', onClick: () => openUrl(p.github!) })
  if (p.demo) items.push({ label: `Open ${p.demoLabel ?? 'Demo'}`, icon: 'globe', onClick: () => openUrl(p.demo!) })
  for (const l of p.links ?? []) items.push({ label: `Open ${l.label}`, icon: 'globe', onClick: () => openUrl(l.href) })
  const link = p.github ?? p.demo
  if (link) items.push({ label: 'Copy Link', icon: 'text', onClick: () => copyText(link) })
  return items
}

export function findProject(slug: string) {
  return projects.find((p) => slugOf(p) === slug)
}

export function openProject(slug: string) {
  const p = findProject(slug)
  if (!p) return false
  useStore.getState().open('project', { key: slug, title: p.title, props: { slug } })
  return true
}

export function openImage(slug: string, index: number) {
  const p = findProject(slug)
  if (!p?.images?.[index]) return
  useStore.getState().open('image', { key: slug, title: `${p.title} - Images`, props: { slug, index } })
}

const FOLDERS = [
  { id: 'projects', label: 'Projects' },
  { id: 'other', label: 'Other' },
] as const

export function Explorer({ props }: { props?: Record<string, unknown> }) {
  const [folder, setFolder] = useState<'projects' | 'other'>((props?.folder as 'other') ?? 'projects')
  const [selected, setSelected] = useState<string | null>(null)
  const open = useStore((s) => s.open)
  const items = projects.filter((p) => (p.folder ?? 'projects') === folder)
  const sel = items.find((p) => slugOf(p) === selected)

  return (
    <div
      className="explorer"
      onContextMenu={(e) =>
        // a folder's own menu is enough when one was clicked
        !(e.target as Element).closest('.file') &&
        addMenuItems(e, [
          ...FOLDERS.map((f) => ({
            label: f.label,
            icon: 'folder' as const,
            checked: folder === f.id,
            onClick: () => {
              setFolder(f.id)
              setSelected(null)
            },
          })),
          { separator: true },
          { label: 'Open Konsole', icon: 'terminal', onClick: () => open('terminal') },
        ])
      }
    >
      <div className="toolbar">
        <div className="address">
          <span className="nf accent">{''}</span> ~/{folder}
        </div>
      </div>
      <div className="explorer-main">
        <aside className="places">
          <div className="places-title">Places</div>
          <button onClick={() => open('about')}>
            <Icon name="user" size={16} /> Home
          </button>
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              className={folder === f.id ? 'active' : ''}
              onClick={() => {
                setFolder(f.id)
                setSelected(null)
              }}
            >
              <Icon name="folder" size={16} /> {f.label}
            </button>
          ))}
          <button onClick={() => open('terminal')}>
            <Icon name="terminal" size={16} /> Terminal
          </button>
        </aside>
        <div className="files" onClick={() => setSelected(null)}>
          {items.map((p) => {
            const slug = slugOf(p)
            return (
              <button
                key={slug}
                className={`file ${selected === slug ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(slug)
                  if (matchMedia('(pointer: coarse)').matches) openProject(slug)
                }}
                onDoubleClick={() => openProject(slug)}
                onContextMenu={(e) => {
                  setSelected(slug)
                  addMenuItems(e, [{ label: 'Open', icon: 'folder', onClick: () => openProject(slug) }, ...projectLinks(p)])
                }}
              >
                <FolderIcon p={p} />
                <span>{p.title}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="statusbar">
        {sel ? `${sel.title} — ${sel.subtitle}` : `${items.length} items · ${matchMedia('(pointer: coarse)').matches ? 'tap' : 'double-click'} to open`}
      </div>
    </div>
  )
}

// a folder with the project's logo tucked into it
function FolderIcon({ p }: { p: Project }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="folder-icon">
      <Icon name="folder" size={40} />
      {p.logo && !failed && <img src={p.logo} alt="" onError={() => setFailed(true)} />}
    </span>
  )
}

function RotatingGifs({ gifs, intervalMs = 5000 }: { gifs: string[]; intervalMs?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (gifs.length <= 1) return
    const id = setInterval(() => setI((n) => (n + 1) % gifs.length), intervalMs)
    return () => clearInterval(id)
  }, [gifs.length, intervalMs])
  return <img src={gifs[i]} alt="" className="title-gif" aria-hidden />
}

export function ProjectViewer({ props }: { props?: Record<string, unknown> }) {
  const slug = props?.slug as string
  const p = findProject(slug)
  const [logoFailed, setLogoFailed] = useState(false)
  if (!p) return <div className="pad">Project not found.</div>

  return (
    <div
      className="project"
      onContextMenu={(e) =>
        !(e.target as Element).closest('.gallery') &&
        addMenuItems(e, [...projectLinks(p), { label: 'Show in Projects', icon: 'folder', onClick: () => useStore.getState().open('projects') }])
      }
    >
      <header className="project-head">
        {p.logo && <img src={p.logo} alt="" className="project-logo" />}
        <div className="project-titles">
          {p.titleLogo && !logoFailed ? (
            <img src={p.titleLogo} alt={p.title} className="title-logo" onError={() => setLogoFailed(true)} />
          ) : (
            <h2>{p.title}</h2>
          )}
          <div className="muted">{p.subtitle}</div>
        </div>
        {p.titleGifs && <RotatingGifs gifs={p.titleGifs} intervalMs={p.titleGifIntervalMs} />}
      </header>

      <div className="meta">
        <span className="accent">{p.date}</span>
        {p.stat && <span className="chip">{p.stat}</span>}
      </div>

      <div className="chips">
        {p.tech.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>

      <div className="btn-row">
        {p.github && (
          <a className="btn primary" href={p.github} target="_blank" rel="noreferrer">
            <span className="nf">{''}</span> GitHub
          </a>
        )}
        {p.demo && (
          <a className="btn" href={p.demo} target="_blank" rel="noreferrer">
            {p.demoLabel ?? 'Demo'} ↗
          </a>
        )}
        {p.links?.map((l) => (
          <a key={l.href} className="btn" href={l.href} target="_blank" rel="noreferrer">
            {l.label} ↗
          </a>
        ))}
      </div>

      {p.images && p.images.length > 0 && (
        <div className="gallery">
          {p.images.map((img, i) => (
            <button
              key={img.src}
              onClick={() => openImage(slug, i)}
              title={img.alt}
              onContextMenu={(e) =>
                addMenuItems(e, [
                  { label: 'View Image', icon: 'image', onClick: () => openImage(slug, i) },
                  { label: 'Open Image in New Tab', icon: 'globe', onClick: () => openUrl(img.src) },
                ])
              }
            >
              <img src={img.src} alt={img.alt} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <ul className="bullets">
        {p.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>

      {p.collaborators && (
        <p className="muted collab">
          with{' '}
          {p.collaborators.map((c, i) => (
            <span key={c.name}>
              {i > 0 && ', '}
              {c.href ? (
                <a href={c.href} target="_blank" rel="noreferrer">
                  {c.name}
                </a>
              ) : (
                c.name
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

export function ImageViewer({ props }: { props?: Record<string, unknown> }) {
  const p = findProject(props?.slug as string)
  const [i, setI] = useState((props?.index as number) ?? 0)
  // reopening the window on a different image updates props
  useEffect(() => setI((props?.index as number) ?? 0), [props?.index])
  const images = p?.images ?? []
  const img = images[i]
  if (!img) return <div className="pad">No image.</div>
  const step = (d: number) => setI((n) => (n + d + images.length) % images.length)

  return (
    <div
      className="image-viewer"
      onContextMenu={(e) =>
        addMenuItems(e, [
          { label: 'Previous', disabled: images.length < 2, onClick: () => step(-1) },
          { label: 'Next', disabled: images.length < 2, onClick: () => step(1) },
          { separator: true },
          { label: 'Open Image in New Tab', icon: 'globe', onClick: () => openUrl(img.src) },
          { label: 'Copy Image Link', icon: 'text', onClick: () => copyText(new URL(img.src, location.href).href) },
        ])
      }
    >
      <div className="image-stage">
        <img src={img.src} alt={img.alt} />
      </div>
      <div className="image-bar">
        <button className="btn" onClick={() => step(-1)} disabled={images.length < 2}>
          ◀
        </button>
        <span className="caption">
          {img.alt} <span className="muted">({i + 1}/{images.length})</span>
        </span>
        <button className="btn" onClick={() => step(1)} disabled={images.length < 2}>
          ▶
        </button>
      </div>
    </div>
  )
}
