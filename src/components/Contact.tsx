import './Contact.css'
import { contactLinks } from '../data/contact'

export default function Contact() {
  return (
    <section id="contact">
      <p className="section-label"><span className="nf">{'\uf0e0'} </span>Let's talk</p>
      <h2 className="section-title">Get in <span>Touch</span></h2>

      <div className="contact-wrapper">
        <p className="contact-intro">
          I'm currently looking for opportunities — feel free to reach out whether it's about
          a role, a project, or just to connect.
        </p>

        <div className="contact-links">
          {contactLinks.map(({ label, value, href, icon }) => (
            <a
              key={label}
              href={href}
              className="contact-item"
              {...(href.startsWith('mailto') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            >
              <span className="contact-icon nf">{icon}</span>
              <div>
                <span className="contact-label">{label}</span>
                <span className="contact-value">{value}</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      <footer className="footer">
        <span className="mono">© 2026 Jorge Manuel Torre</span>
      </footer>
    </section >
  )
}

