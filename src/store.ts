import { create } from 'zustand'
import type { DeviceKind } from './data/devices'
import type { MenuItem } from './os/ContextMenu'
import * as THREE from 'three'
import { APPS, type AppId } from './os/apps/registry'

// touch screens get a taller taskbar so its buttons are easy to hit; Window and the
// start menu read the same value (in desktop units, before the UI scale)
export const TASKBAR_H = matchMedia('(pointer: coarse)').matches ? 48 : 40

export type Mode = 'room' | 'zooming' | 'desktop' | 'exiting'

export interface Win {
  id: string
  app: AppId
  title: string
  props?: Record<string, unknown>
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
}

export interface ScreenInfo {
  center: THREE.Vector3
  normal: THREE.Vector3 // points out of the screen, toward the viewer
  width: number
  height: number
}

interface State {
  mode: Mode
  poweringOff: boolean
  // Slumpy is shut down: the screen and lights stay dark in the room until the
  // power button on the case is pressed (only for this visit: a reload turns him on)
  poweredOff: boolean
  rebooting: boolean // shut down to come straight back on
  booting: boolean // turned on from the power button: the boot log is scrolling by (the camera leans in to read it)
  // bumped when the user spins the PC around too fast (the face gets dizzy)
  spins: number
  // the right-click menu (any app can open one; the Desktop draws it), at a screen point
  menu: { clientX: number; clientY: number; items: MenuItem[] } | null
  startOpen: boolean // the Start menu (its header shows Slumpy)
  signingIn: boolean // the welcome screen after power-on (shows Slumpy)
  // easter egg: someone clicked the fan on the back; where, and which way it blows
  fart: { n: number; at: [number, number, number]; dir: [number, number, number] } | null
  hoverDevice: DeviceKind | null // the keyboard or mouse under the pointer in the room (the hint names it)
  screen: ScreenInfo | null
  // desktop size in its own layout px; the Desktop is drawn at `scale`× that on screen
  desk: { w: number; h: number; scale: number }
  windows: Win[]
  focused: string | null
  topZ: number
  setMode: (m: Mode) => void
  logOff: () => void // end the desktop session (Slumpy itself stays on)
  shutDown: (reboot?: boolean) => void // log off and turn Slumpy off too
  setPoweredOff: (off: boolean) => void // the power button, in the room
  spunTooFast: () => void
  doFart: (at: [number, number, number], dir: [number, number, number]) => void
  setHoverDevice: (d: DeviceKind | null) => void
  showMenu: (clientX: number, clientY: number, items: MenuItem[]) => void
  hideMenu: () => void
  setScreen: (s: ScreenInfo) => void
  setDesk: (w: number, h: number, scale: number) => void
  open: (app: AppId, opts?: { title?: string; props?: Record<string, unknown>; key?: string }) => void
  close: (id: string) => void
  retitle: (id: string, title: string) => void
  focus: (id: string) => void
  minimize: (id: string) => void
  toggleMax: (id: string) => void
  move: (id: string, x: number, y: number) => void
  resize: (id: string, w: number, h: number) => void
  closeAll: () => void
}

let spawn = 0

export const useStore = create<State>((set, get) => ({
  mode: 'room',
  poweringOff: false,
  poweredOff: false,
  rebooting: false,
  booting: false,
  spins: 0,
  fart: null,
  hoverDevice: null,
  menu: null,
  startOpen: false,
  signingIn: false,
  screen: null,
  desk: { w: window.innerWidth, h: window.innerHeight, scale: 1 },
  windows: [],
  focused: null,
  topZ: 10,

  // (leaving the desktop always ends a boot, in case its fade-in never finished)
  setMode: (mode) => set((s) => ({ mode, poweringOff: false, booting: mode === 'exiting' ? false : s.booting })),
  // Desktop plays the CRT-off animation, then switches mode to 'exiting'
  logOff: () => set({ poweringOff: true }),
  shutDown: (reboot = false) => set({ poweringOff: true, poweredOff: true, rebooting: reboot }),
  setPoweredOff: (poweredOff) => set({ poweredOff, rebooting: false }),
  spunTooFast: () => set((s) => ({ spins: s.spins + 1 })),
  showMenu: (clientX, clientY, items) => set({ menu: { clientX, clientY, items } }),
  hideMenu: () => set({ menu: null }),
  doFart: (at, dir) => set((s) => ({ fart: { n: (s.fart?.n ?? 0) + 1, at, dir } })),
  setHoverDevice: (hoverDevice) => get().hoverDevice !== hoverDevice && set({ hoverDevice }),
  setScreen: (screen) => set({ screen }),
  setDesk: (w, h, scale) => set({ desk: { w, h, scale } }),

  open: (app, opts = {}) => {
    const def = APPS[app]
    // reuse a window when the same app/key is already open
    const id = `${app}:${opts.key ?? 'main'}`
    const existing = get().windows.find((w) => w.id === id)
    if (existing) {
      set((s) => ({
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, minimized: false, props: opts.props ?? w.props, title: opts.title ?? w.title } : w,
        ),
      }))
      get().focus(id)
      return
    }
    const vw = get().desk.w
    const vh = get().desk.h - TASKBAR_H
    const w = Math.min(def.size[0], vw - 16)
    const h = Math.min(def.size[1], vh - 16)
    const offset = (spawn++ % 6) * 28
    const z = get().topZ + 1
    const win: Win = {
      id,
      app,
      title: opts.title ?? def.title,
      props: opts.props,
      x: Math.max(8, Math.min(vw - w - 8, 80 + offset)),
      y: Math.max(8, Math.min(vh - h - 8, 40 + offset)),
      w,
      h,
      z,
      minimized: false,
      // phones (portrait or landscape) get full-screen windows
      maximized: vw < 640 || vh < 440,
    }
    set((s) => ({ windows: [...s.windows, win], focused: id, topZ: z }))
  },

  retitle: (id, title) => set((s) => ({ windows: s.windows.map((w) => (w.id === id && w.title !== title ? { ...w, title } : w)) })),
  close: (id) =>
    set((s) => ({
      windows: s.windows.filter((w) => w.id !== id),
      focused: s.focused === id ? null : s.focused,
    })),

  focus: (id) => {
    const z = get().topZ + 1
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
      focused: id,
      topZ: z,
    }))
  },

  minimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
      focused: s.focused === id ? null : s.focused,
    })),

  toggleMax: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)),
    })),

  move: (id, x, y) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),

  resize: (id, w, h) =>
    set((s) => ({ windows: s.windows.map((win) => (win.id === id ? { ...win, w, h } : win)) })),

  closeAll: () => set({ windows: [], focused: null }),
}))

// There's only one Slumpy. Everything that can show him asks where he is right
// now, and only that place shows his face (the rest step aside).
// 'window': floating over whichever other app window is focused (see Window.tsx)
export type SlumpyPlace = 'login' | 'start' | 'konsole' | 'system' | 'window' | 'wallpaper'

export function slumpyLocation(s: State): SlumpyPlace {
  if (s.signingIn) return 'login'
  if (s.startOpen) return 'start'
  const focused = s.windows.find((w) => w.id === s.focused && !w.minimized)
  if (focused?.app === 'terminal') return 'konsole'
  if (focused?.app === 'system') return 'system'
  if (focused) return 'window'
  // About This Computer still on screen behind other windows keeps him
  if (s.windows.some((w) => w.app === 'system' && !w.minimized)) return 'system'
  return 'wallpaper'
}
