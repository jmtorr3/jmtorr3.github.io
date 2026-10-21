import { useEffect, useState } from 'react'
import { resumes, resumeIntro } from '../../data/resume'
import { addMenuItems, download, openUrl } from '../appMenu'

// props.resume picks a version (opening one of the PDFs in Dolphin or the Konsole)
export function Resume({ props }: { props?: Record<string, unknown> }) {
  const [active, setActive] = useState((props?.resume as string) ?? resumes[0].id)
  useEffect(() => {
    if (props?.resume) setActive(props.resume as string)
  }, [props?.resume])
  const r = resumes.find((x) => x.id === active) ?? resumes[0]

  return (
    <div
      className="resume"
      onContextMenu={(e) =>
        addMenuItems(e, [
          ...resumes.map((x) => ({ label: x.title, checked: x.id === active, onClick: () => setActive(x.id) })),
          { separator: true },
          { label: 'Open PDF in New Tab', icon: 'globe', onClick: () => openUrl(r.file) },
          { label: 'Download PDF', icon: 'text', onClick: () => download(r.file) },
        ])
      }
    >
      <aside className="resume-list">
        <p className="muted small">{resumeIntro}</p>
        {resumes.map((x, i) => (
          <button key={x.id} className={`card pick ${x.id === active ? 'active' : ''}`} onClick={() => setActive(x.id)}>
            <span className="accent small">
              {String.fromCharCode(65 + i)}
              {i === 0 && ' · default'}
            </span>
            <strong>{x.title}</strong>
            <span className="muted small">{x.blurb}</span>
          </button>
        ))}
        <a className="btn primary" href={r.file} target="_blank" rel="noreferrer">
          open PDF ↗
        </a>
      </aside>
      <iframe className="pdf" src={`${r.file}#view=FitH&navpanes=0`} title={`${r.title} resume`} />
    </div>
  )
}
