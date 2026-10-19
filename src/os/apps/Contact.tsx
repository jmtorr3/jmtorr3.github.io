import { contact } from '../../content/contact'
import { Icon } from '../Icon'

export function Contact() {
  return (
    <div className="contact">
      <div className="contact-head">
        <Icon name="mail" size={48} />
        <div>
          <div className="label">Send me a message</div>
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </div>
      </div>
      <fieldset>
        <legend>Elsewhere</legend>
        {contact.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="link-row">
            {l.label}
          </a>
        ))}
      </fieldset>
    </div>
  )
}
