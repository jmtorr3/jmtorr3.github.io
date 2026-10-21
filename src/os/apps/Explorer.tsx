import { useEffect, useState } from 'react'
import { slugOf, type Project } from '../../data/projects'
import { profile } from '../../data/profile'
import { useStore } from '../../store'
import { Icon, type IconName } from '../Icon'
import { addMenuItems, copyText, openUrl } from '../appMenu'
import type { MenuItem } from '../ContextMenu'
import { CREATOR_HOME, HOME, PROJECTS_DIR, findProject, lookup, openPath, openProject, pretty, type VNode } from '../vfs'

export { findProject, openProject }

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

export function openImage(slug: string, index: number) {
  const p = findProject(slug)
  if (!p?.images?.[index]) return
  useStore.getState().open('image', { key: slug, title: `${p.title} - Images`, props: { slug, index } })
}

const PLACES: { label: string; icon: IconName; path: string }[] = [
  { label: 'Home', icon: 'user', path: HOME },
  { label: 'Desktop', icon: 'computer', path: `${HOME}/Desktop` },
  { label: profile.creator, icon: 'folder', path: CREATOR_HOME },
  { label: 'Projects', icon: 'folder', path: PROJECTS_DIR },
  { label: 'Other', icon: 'folder', path: `${CREATOR_HOME}/other` },
]

const TOUCH = matchMedia('(pointer: coarse)').matches

// file names wrap before the extension first ("konsole" / ".desktop"), then
// wherever they have to (see .file span)
const breakable = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? (
    <>
      {name.slice(0, dot)}
      <wbr />
      {name.slice(dot)}
    </>
  ) : (
    name
  )
}
const join = (dir: string, name: string) => (dir === '/' ? `/${name}` : `${dir}/${name}`)
const parent = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/'

// Dolphin: browses the machine's filesystem (the same one the Konsole sees).
// Folders open in place, except a project's folder, which opens its page;
// files open with whatever they belong to (see vfs.openPath).
export function Explorer({ props }: { props?: Record<string, unknown> }) {
  const [path, setPath] = useState((props?.path as string) ?? PROJECTS_DIR)
  const [back, setBack] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const open = useStore((s) => s.open)

  const go = (to: string) => {
    setPath((from) => {
      if (from !== to) setBack((b) => [...b, from])
      return to
    })
    setSelected(null)
  }
  // opening a folder from elsewhere (the Konsole, another window, a launcher)
  // navigates here; `at` makes the same folder count again when it's re-opened
  useEffect(() => {
    if (props?.path) go(props.path as string)
  }, [props?.path, props?.at])

  const goBack = () => {
    const prev = back[back.length - 1]
    if (!prev) return
    setBack(back.slice(0, -1))
    setPath(prev)
    setSelected(null)
  }

  const node = lookup(path)
  // folders first, then files, alphabetical
  const entries = node?.type === 'dir' ? Object.entries(node.children).sort(([a, x], [b, y]) => (x.type === y.type ? a.localeCompare(b) : x.type === 'dir' ? -1 : 1)) : []
  const activate = (name: string, n: VNode) => (n.type === 'dir' && !n.project ? go(join(path, name)) : openPath(join(path, name)))
  const sel = entries.find(([name]) => name === selected)?.[1]

  const itemMenu = (name: string, n: VNode): MenuItem[] => {
    const full = join(path, name)
    if (n.type === 'dir' && n.project)
      return [
        { label: 'Open', icon: 'folder', onClick: () => openProject(slugOf(n.project!)) },
        { label: 'Open Folder', icon: 'folder', onClick: () => go(full) },
        ...projectLinks(n.project),
      ]
    if (n.type === 'dir') return [{ label: 'Open', icon: 'folder', onClick: () => go(full) }]
    const items: MenuItem[] = [{ label: 'Open', icon: n.icon, onClick: () => openPath(full) }]
    if (n.open) items.push({ label: 'Open in KWrite', icon: 'text', onClick: () => open('textview', { key: full, title: `${name} - KWrite`, props: { path: full } }) })
    return items
  }

  return (
    <div
      className="explorer"
      onContextMenu={(e) =>
        // an item's own menu is enough when one was clicked
        !(e.target as Element).closest('.file') &&
        addMenuItems(e, [
          { label: 'Back', disabled: !back.length, onClick: goBack },
          { label: 'Up', disabled: path === '/', onClick: () => go(parent(path)) },
          { separator: true },
          { label: 'Open Konsole Here', icon: 'terminal', onClick: () => open('terminal', { props: { cwd: path } }) },
        ])
      }
    >
      <div className="toolbar">
        <button className="btn nav" onClick={goBack} disabled={!back.length} aria-label="Back">
          ◀
        </button>
        <button className="btn nav" onClick={() => go(parent(path))} disabled={path === '/'} aria-label="Up">
          ▲
        </button>
        <div className="address">
          <span className="nf accent">{'\uf07c'}</span> {pretty(path)}
        </div>
      </div>
      <div className="explorer-main">
        <aside className="places">
          <div className="places-title">Places</div>
          {PLACES.map((pl) => (
            <button key={pl.path} className={path === pl.path ? 'active' : ''} onClick={() => go(pl.path)}>
              <Icon name={pl.icon} size={16} /> {pl.label}
            </button>
          ))}
          <button onClick={() => open('terminal', { props: { cwd: path } })}>
            <Icon name="terminal" size={16} /> Konsole
          </button>
        </aside>
        <div className="files" onClick={() => setSelected(null)}>
          {entries.map(([name, n]) => (
            <button
              key={name}
              className={`file ${selected === name ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(name)
                if (TOUCH) activate(name, n)
              }}
              onDoubleClick={() => activate(name, n)}
              onContextMenu={(e) => {
                setSelected(name)
                addMenuItems(e, itemMenu(name, n))
              }}
            >
              {n.type === 'dir' ? <FolderIcon p={n.project} /> : <Icon name={n.icon} size={40} />}
              <span title={name}>{breakable(name)}</span>
            </button>
          ))}
          {node?.type !== 'dir' && <p className="muted">{pretty(path)}: no such folder</p>}
        </div>
      </div>
      <div className="statusbar">
        {sel?.type === 'dir' && sel.project
          ? `${sel.project.title} — ${sel.project.subtitle}`
          : selected
            ? selected
            : `${entries.length} items · ${TOUCH ? 'tap' : 'double-click'} to open`}
      </div>
    </div>
  )
}

// a folder, with the project's logo tucked into it if it's a project
function FolderIcon({ p }: { p?: Project }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="folder-icon">
      <Icon name="folder" size={40} />
      {p?.logo && !failed && <img src={p.logo} alt="" onError={() => setFailed(true)} />}
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
