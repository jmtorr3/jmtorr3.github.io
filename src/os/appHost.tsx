import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { APPS } from './apps/registry'

// Apps outlive the desktop. Stepping back into the room (still signed in) unmounts
// the Desktop, but not what's running in its windows: every open window's app is
// rendered here, always, into its own container (a portal), and the Window frame
// slots that container in while it's on screen. In the room the containers wait in
// a hidden parking spot, so the Konsole keeps its scrollback and Notepad its unsaved
// text. Closing a window (or logging off, which closes them all) is what ends an app.
//
// React events bubble along the React tree, which for an app is this host, not
// its Window: so the Window listens for pointerdown/contextmenu on its own element.

const slots = new Map<string, HTMLDivElement>()

// An app can stop its window closing (unsaved work): the guard returns false and
// deals with it (asks, then closes the window itself). The window's × and Close go
// through requestClose; logging off and shutting down close everything regardless.
const guards = new Map<string, () => boolean>()
export function guardClose(winId: string, guard: () => boolean) {
  guards.set(winId, guard)
  return () => {
    if (guards.get(winId) === guard) guards.delete(winId)
  }
}
export function requestClose(winId: string) {
  if (guards.get(winId)?.() === false) return
  useStore.getState().close(winId)
}
let parking: HTMLDivElement | null = null

const park = () => {
  if (!parking) {
    parking = document.createElement('div')
    parking.className = 'app-parking'
    parking.setAttribute('aria-hidden', 'true')
    document.body.append(parking)
  }
  return parking
}

// the container an app renders into (made on first use, parked until a Window takes it)
export function appSlot(winId: string): HTMLDivElement {
  let el = slots.get(winId)
  if (!el) {
    el = document.createElement('div')
    el.className = 'app-slot'
    park().append(el)
    slots.set(winId, el)
  }
  return el
}

// a Window leaving the screen (the desktop unmounting) hands its app back
export function parkSlot(winId: string) {
  const el = slots.get(winId)
  if (el) park().append(el)
}

export function AppHost() {
  const windows = useStore((s) => s.windows)
  // forget containers of windows that are gone (their apps unmount with the portal)
  for (const [id, el] of slots)
    if (!windows.some((w) => w.id === id)) {
      slots.delete(id)
      queueMicrotask(() => el.remove())
    }
  return (
    <>
      {windows.map((w) => {
        const App = APPS[w.app].component
        return createPortal(<App winId={w.id} props={w.props} />, appSlot(w.id), w.id)
      })}
    </>
  )
}
