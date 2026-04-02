import './Contact.css'

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
          <a
            href="mailto:jmt1006@vt.edu"
            className="contact-item"
          >
            <span className="contact-icon nf">{'\uf0e0'}</span>
            <div>
              <span className="contact-label">Email</span>
              <span className="contact-value">jmt1006@vt.edu</span>
            </div>
          </a>

          <a
            href="https://www.linkedin.com/in/jmt1006/"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-item"
          >
            <span className="contact-icon nf">{'\uf08c'}</span>
            <div>
              <span className="contact-label">LinkedIn</span>
              <span className="contact-value">linkedin.com/in/jmt1006</span>
            </div>
          </a>

          <a
            href="https://github.com/jmtorr3"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-item"
          >
            <span className="contact-icon nf">{'\uf09b'}</span>
            <div>
              <span className="contact-label">GitHub</span>
              <span className="contact-value">github.com/jmtorr3</span>
            </div>
          </a>
        </div>
      </div>

      <footer className="footer">
        <span className="mono">© 2026 Jorge Manuel Torre</span>
      </footer>
    </section>
  )
}

