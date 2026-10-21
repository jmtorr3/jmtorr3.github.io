import { contactLinks } from '../../data/contact'
import { addMenuItems, copyText, openUrl } from '../appMenu'

export function Contact() {
  return (
    <div className="contact">
      <p className="section-title">
        Get in <span className="accent">Touch</span>
      </p>
      {contactLinks.map((l) => (
        <a
          key={l.href}
          className="card contact-row"
          href={l.href}
          target="_blank"
          rel="noreferrer"
          onContextMenu={(e) =>
            addMenuItems(e, [
              { label: `Open ${l.label}`, icon: 'globe', onClick: () => openUrl(l.href) },
              { label: `Copy ${l.label}`, icon: 'text', onClick: () => copyText(l.value) },
            ])
          }
        >
          <span className="nf accent contact-icon">{l.icon}</span>
          <span>
            <span className="muted small">{l.label}</span>
            <br />
            {l.value}
          </span>
        </a>
      ))}
    </div>
  )
}
