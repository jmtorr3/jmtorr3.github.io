import type { MenuItem } from './ContextMenu'

// Right-click menus inside windows. While a contextmenu event bubbles up, anything
// along the way can add items (the thing clicked first, then its surroundings);
// the Window collects them, adds its own window controls and shows the menu.

const added = new WeakMap<Event, MenuItem[]>()

export function addMenuItems(e: { nativeEvent: Event }, items: MenuItem[]) {
  if (!items.length) return
  const sofar = added.get(e.nativeEvent)
  added.set(e.nativeEvent, sofar ? [...sofar, { separator: true }, ...items] : items)
}

export const menuItemsFor = (e: Event) => added.get(e) ?? []

export const openUrl = (url: string) => window.open(url, '_blank', 'noopener')

export const copyText = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {})

// save a file from the site (the resume PDFs)
export const download = (url: string) => {
  const a = document.createElement('a')
  a.href = url
  a.download = url.split('/').pop() ?? ''
  a.click()
}
