import { about } from '../../content/about'
import { resume } from '../../content/resume'

const DOCS: Record<string, string> = { about, resume }

export function Notepad({ winId, props }: { winId: string; props?: Record<string, unknown> }) {
  const text = (props?.text as string | undefined) ?? DOCS[winId.split(':')[0]] ?? ''
  return (
    <div className="notepad">
      <div className="menubar">
        <span>File</span>
        <span>Edit</span>
        <span>Format</span>
        <span>Help</span>
      </div>
      <pre className="notepad-body">{text}</pre>
    </div>
  )
}
