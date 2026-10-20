import { contactLinks } from '../../data/contact'

export function Contact() {
  return (
    <div className="contact">
      <p className="section-title">
        Get in <span className="accent">Touch</span>
      </p>
      {contactLinks.map((l) => (
        <a key={l.href} className="card contact-row" href={l.href} target="_blank" rel="noreferrer">
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
