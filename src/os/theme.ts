import { create } from 'zustand'

// Desktop color themes. Each id matches a [data-theme] block in styles/theme.css
// (nix is :root itself); the swatch colors are for the picker in System Settings.
export const THEMES = [
  { id: 'nix', label: 'Nix Night', swatch: ['#0d1520', '#4aafd4', '#ddeaf5'] },
  { id: 'amber', label: 'Amber CRT', swatch: ['#140d05', '#ffb000', '#ffe9c2'] },
  { id: 'phosphor', label: 'Green Phosphor', swatch: ['#04120a', '#39ff7a', '#ccffd9'] },
  { id: 'sakura', label: 'Sakura', swatch: ['#1b1220', '#ff8fc8', '#fbe6f2'] },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const KEY = 'theme'
const read = (): ThemeId => {
  try {
    const t = localStorage.getItem(KEY)
    return THEMES.some((x) => x.id === t) ? (t as ThemeId) : 'nix'
  } catch {
    return 'nix'
  }
}

const apply = (id: ThemeId) => {
  if (id === 'nix') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = id
}

export const useTheme = create<{ theme: ThemeId; setTheme: (id: ThemeId) => void }>((set) => ({
  theme: read(),
  setTheme: (theme) => {
    apply(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // storage blocked; the theme just won't persist
    }
    set({ theme })
  },
}))

apply(useTheme.getState().theme) // as soon as this loads, before the first paint
