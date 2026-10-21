import { lookup, pretty, useVfs } from '../vfs'

// Konqueror: shows the web pages that are on this computer (an .html file opens
// here). It's offline, and the page can't run scripts: it's sandboxed and just
// drawn, marquees and all. <blink> gets its blink back.
const RETRO = '<style>blink{animation:blink 1s steps(1) infinite}@keyframes blink{50%{visibility:hidden}}</style>'

export function Browser({ props }: { props?: Record<string, unknown> }) {
  const path = props?.path as string | undefined
  useVfs((s) => s.version) // (a page saved from Notepad shows its changes)
  const node = path ? lookup(path) : null
  const html = node?.type === 'file' ? node.text : '<p style="font-family:sans-serif;color:#666">this computer is offline. open a page from Dolphin.</p>'
  return (
    <div className="browser">
      <div className="toolbar">
        <div className="address">
          <span className="nf accent">{''}</span> {path ? `file://${pretty(path)}` : 'about:blank'}
        </div>
      </div>
      <iframe className="browser-page" sandbox="" srcDoc={RETRO + html} title={path ?? 'about:blank'} />
    </div>
  )
}
