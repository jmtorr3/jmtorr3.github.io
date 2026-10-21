import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TASKBAR_H } from '../store'
import { LAUNCHABLE, type AppId } from './apps/registry'

// Desktop icons sit on a grid and can be dragged (one, or the whole selection) to
// another cell. Where they were dropped is remembered in this browser.

// the apps, then Slumpy's README and the Recycle Bin (a file and a folder, not apps)
export type DeskId = AppId | 'readme' | 'trash'
// (a function: LAUNCHABLE isn't initialized yet when this module loads, circular import)
export const deskIcons = (): DeskId[] => [...LAUNCHABLE, 'readme', 'trash']

export const CELL_W = 88
export const CELL_H = 84
const PAD = 8
const KEY = 'icon-cells'

type Cell = { col: number; row: number }
type Cells = Partial<Record<DeskId, Cell>>

const load = (): Cells => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

const save = (cells: Cells) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cells))
  } catch {
    // storage blocked; the layout just won't persist
  }
}

const key = (c: Cell) => `${c.col},${c.row}`

// Every icon gets its own cell: the one it was dropped in if that still fits on
// screen, otherwise the next free one, top to bottom then left to right.
function layout(saved: Cells, cols: number, rows: number) {
  const taken = new Set<string>()
  const out = {} as Record<DeskId, Cell>
  for (const id of deskIcons()) {
    const c = saved[id]
    if (c && c.col < cols && c.row < rows && !taken.has(key(c))) {
      out[id] = c
      taken.add(key(c))
    }
  }
  let n = 0
  for (const id of deskIcons()) {
    if (out[id]) continue
    const at = () => ({ col: Math.floor(n / rows), row: n % rows })
    while (taken.has(key(at()))) n++
    out[id] = at()
    taken.add(key(out[id]))
  }
  return out
}

type Drag = { ids: DeskId[]; dx: number; dy: number }

export function useDesktopIcons(opts: {
  w: number
  h: number
  scale: number
  selected: Set<DeskId>
  setSelected: (s: Set<DeskId>) => void
}) {
  const { w, h, scale, selected, setSelected } = opts
  const cols = Math.max(1, Math.floor((w - PAD) / CELL_W))
  const rows = Math.max(1, Math.floor((h - TASKBAR_H - PAD) / CELL_H))

  const [saved, setSaved] = useState(load)
  const cells = useMemo(() => layout(saved, cols, rows), [saved, cols, rows])
  const [drag, setDrag] = useState<Drag | null>(null)
  const start = useRef<{ id: DeskId; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)

  // drop the dragged icons on the nearest free cells to where they were let go
  const drop = ({ ids, dx, dy }: Drag) => {
    const placed: Cells = { ...cells }
    const taken = new Set(deskIcons().filter((id) => !ids.includes(id)).map((id) => key(cells[id])))
    for (const id of ids) {
      const want = { col: cells[id].col + dx / CELL_W, row: cells[id].row + dy / CELL_H }
      let best: Cell | null = null
      let bestD = Infinity
      for (let col = 0; col < cols; col++)
        for (let row = 0; row < rows; row++) {
          const d = (col - want.col) ** 2 + (row - want.row) ** 2
          if (d < bestD && !taken.has(key({ col, row }))) {
            best = { col, row }
            bestD = d
          }
        }
      if (!best) continue
      placed[id] = best
      taken.add(key(best))
    }
    setSaved(placed)
    save(placed)
  }

  const handlers = (id: DeskId) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      suppressClick.current = false
      if (e.button !== 0) return
      start.current = { id, x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = start.current
      if (!s) return
      // pointer movement is in screen px; the desktop is CSS-scaled
      const dx = (e.clientX - s.x) / scale
      const dy = (e.clientY - s.y) / scale
      if (!drag && Math.hypot(dx, dy) < 5) return
      let ids = drag?.ids
      if (!ids) {
        // dragging a selected icon moves the whole selection, like XP
        ids = selected.has(s.id) ? deskIcons().filter((x) => selected.has(x)) : [s.id]
        if (!selected.has(s.id)) setSelected(new Set([s.id]))
      }
      setDrag({ ids, dx, dy })
    },
    onPointerUp: () => {
      if (drag) {
        drop(drag)
        suppressClick.current = true // the click that follows a drag isn't a click
      }
      setDrag(null)
      start.current = null
    },
    onPointerCancel: () => {
      setDrag(null)
      start.current = null
    },
  })

  return {
    position: (id: DeskId) => {
      const c = cells[id]
      const moving = drag?.ids.includes(id)
      return {
        left: PAD + c.col * CELL_W + (moving ? drag!.dx : 0),
        top: PAD + c.row * CELL_H + (moving ? drag!.dy : 0),
      }
    },
    isDragging: (id: DeskId) => !!drag?.ids.includes(id),
    // put every icon back in the default grid (desktop right-click > Arrange Icons)
    arrange: () => {
      setSaved({})
      try {
        localStorage.removeItem(KEY)
      } catch {
        // storage blocked; nothing saved anyway
      }
    },
    handlers,
    // true (once) when the click event is just the end of a drag
    consumeClick: () => {
      const s = suppressClick.current
      suppressClick.current = false
      return s
    },
  }
}
