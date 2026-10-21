import { lookup, pretty } from '../vfs'

// KWrite, read-only: plain text files that don't belong to an app
export function TextView({ props }: { props?: Record<string, unknown> }) {
  const path = props?.path as string
  const node = lookup(path)
  return (
    <div className="textview">
      <div className="toolbar">
        <div className="address">{pretty(path)}</div>
      </div>
      <pre className="textview-body">{node?.type === 'file' ? node.text : `${path}: no such file`}</pre>
    </div>
  )
}
