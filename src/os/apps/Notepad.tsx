import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '../../store'
import { HOME, canWrite, lookup, pretty, resolve, writeFile } from '../vfs'
import { addMenuItems } from '../appMenu'

const nameOf = (path: string | undefined) => (path ? path.slice(path.lastIndexOf('/') + 1) : 'Untitled')

// Notepad: opens and edits the machine's text files (vfs). Saving works in the
// guest's home (~); everything else is read-only, so Save there asks for a name
// to save a copy under in ~ instead.
export function Notepad({ winId, props }: { winId: string; props?: Record<string, unknown> }) {
  const [path, setPath] = useState(props?.path as string | undefined)
  const initial = () => {
    const n = path ? lookup(path) : null
    return n?.type === 'file' ? n.text : ''
  }
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(text)
  const [wrap, setWrap] = useState(true)
  const [caret, setCaret] = useState({ line: 1, col: 1 })
  const [saveAs, setSaveAs] = useState<string | null>(null) // the name being typed, while saving as
  const [note, setNote] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  const dirty = text !== saved

  // title: "*name - Notepad" while there are unsaved changes
  useEffect(() => {
    useStore.getState().retitle(winId, `${dirty ? '*' : ''}${nameOf(path)} - Notepad`)
  }, [winId, path, dirty])

  const save = () => {
    if (!path || !canWrite(path)) {
      setSaveAs(nameOf(path))
      setNote(path ? `${pretty(path)} is read-only. Save a copy in ~` : '')
      return
    }
    const err = writeFile(path, text)
    if (err) return setNote(err)
    setSaved(text)
    setNote(`Saved ${pretty(path)}`)
  }

  const finishSaveAs = () => {
    const name = saveAs?.trim()
    if (!name) return
    const to = resolve(HOME, name)
    const err = writeFile(to, text)
    if (err) return setNote(err)
    setPath(to)
    setSaved(text)
    setSaveAs(null)
    setNote(`Saved ${pretty(to)}`)
    area.current?.focus()
  }

  const newDoc = () => {
    setPath(undefined)
    setText('')
    setSaved('')
    setNote('')
    area.current?.focus()
  }

  const updateCaret = () => {
    const a = area.current
    if (!a) return
    const before = a.value.slice(0, a.selectionStart)
    const lines = before.split('\n')
    setCaret({ line: lines.length, col: lines[lines.length - 1].length + 1 })
  }

  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      if (e.shiftKey) setSaveAs(nameOf(path))
      else save()
    }
  }

  const items = [
    { label: 'New', onClick: newDoc },
    { label: 'Save', onClick: save },
    { label: 'Save As…', onClick: () => setSaveAs(nameOf(path)) },
  ]

  return (
    <div
      className="notepad"
      onKeyDown={onKey}
      onContextMenu={(e) =>
        addMenuItems(e, [
          { label: 'New', icon: 'text', onClick: newDoc },
          { label: 'Save', icon: 'text', onClick: save },
          { label: 'Save As…', icon: 'text', onClick: () => setSaveAs(nameOf(path)) },
          { separator: true },
          { label: 'Word Wrap', checked: wrap, onClick: () => setWrap(!wrap) },
        ])
      }
    >
      <div className="notepad-menu">
        {items.map((it) => (
          <button key={it.label} onClick={it.onClick}>
            {it.label}
          </button>
        ))}
        <button className={wrap ? 'on' : ''} onClick={() => setWrap(!wrap)}>
          Word Wrap
        </button>
      </div>
      {saveAs !== null && (
        <form
          className="notepad-saveas"
          onSubmit={(e) => {
            e.preventDefault()
            finishSaveAs()
          }}
        >
          <span className="muted">Save in ~/</span>
          <input autoFocus value={saveAs} onChange={(e) => setSaveAs(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setSaveAs(null)} />
          <button className="btn primary" type="submit">
            Save
          </button>
          <button className="btn" type="button" onClick={() => setSaveAs(null)}>
            Cancel
          </button>
        </form>
      )}
      <textarea
        ref={area}
        className={`notepad-text ${wrap ? '' : 'nowrap'}`}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          setNote('')
          updateCaret()
        }}
        onSelect={updateCaret}
        onClick={updateCaret}
        onKeyUp={updateCaret}
      />
      <div className="statusbar notepad-status">
        <span>{note || (path ? pretty(path) + (canWrite(path) ? '' : ' (read-only)') : 'new document')}</span>
        <span>
          Ln {caret.line}, Col {caret.col}
        </span>
      </div>
    </div>
  )
}
