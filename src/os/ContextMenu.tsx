import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'

export type MenuItem =
  // hint: a keyboard shortcut shown on the right (menu bars)
  | { label: string; icon?: IconName; checked?: boolean; disabled?: boolean; hint?: string; onClick: () => void }
  | { separator: true }

// A right-click menu, placed at (x, y) in the desktop's own px and nudged back
// inside the desktop if it would hang off an edge. Closes on picking an item,
// clicking anywhere else, or Escape.
export function ContextMenu({
  x,
  y,
  items,
  bounds,
  onClose,
}: {
  x: number
  y: number
  items: MenuItem[]
  bounds: { w: number; h: number }
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState({ x, y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setAt({
      x: Math.max(0, Math.min(x, bounds.w - el.offsetWidth)),
      y: Math.max(0, Math.min(y, bounds.h - el.offsetHeight)),
    })
  }, [x, y, bounds.w, bounds.h])

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div className="ctx-menu" ref={ref} style={{ left: at.x, top: at.y }} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {items.map((item, i) =>
        'separator' in item ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onClick()
            }}
          >
            <span className="ctx-check">{item.checked ? '✓' : ''}</span>
            {item.icon ? <Icon name={item.icon} size={16} /> : <span className="ctx-blank" />}
            {item.label}
            {item.hint && <span className="ctx-hint">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  )
}
