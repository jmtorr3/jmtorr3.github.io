import './Contact.css'

export default function Contact() {
  return (
    <section id="contact">
      <p className="section-label">Let's talk</p>
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
            <span className="contact-icon">
              <EmailIcon />
            </span>
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
            <span className="contact-icon">
              <LinkedInIcon />
            </span>
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
            <span className="contact-icon">
              <GitHubIcon />
            </span>
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

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}
