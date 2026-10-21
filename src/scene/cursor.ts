import { useStore } from '../store'
import { grabState } from './deskProps'

// The room's mouse cursor: a pointing hand over anything you can use (the PC,
// and the keyboard and mouse, which can be picked up), the open hand for
// dragging the view everywhere else, a fist while holding or dragging.

export type HoverKind = 'pc' | 'prop' | null

let hover: HoverKind = null

export function setHover(kind: HoverKind) {
  hover = kind
  restoreCursor()
}

// after a drag ends (or the mode changes): back to whatever's under the pointer
export function restoreCursor() {
  if (grabState.active) return
  document.body.style.cursor = useStore.getState().mode !== 'room' ? '' : hover ? 'var(--cursor-pointer)' : 'var(--cursor-grab)'
}
