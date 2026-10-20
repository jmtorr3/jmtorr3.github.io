import { create } from 'zustand'
import * as THREE from 'three'
import { APPS, type AppId } from './os/apps/registry'

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
  screen: ScreenInfo | null
  desk: { w: number; h: number } // desktop size in CSS px (the monitor's screen area)
  windows: Win[]
  focused: string | null
  topZ: number
  setMode: (m: Mode) => void
  shutdown: () => void
  setScreen: (s: ScreenInfo) => void
  setDesk: (w: number, h: number) => void
  open: (app: AppId, opts?: { title?: string; props?: Record<string, unknown>; key?: string }) => void
  close: (id: string) => void
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
  screen: null,
  desk: { w: window.innerWidth, h: window.innerHeight },
  windows: [],
  focused: null,
  topZ: 10,

  setMode: (mode) => set({ mode, poweringOff: false }),
  // Desktop plays the CRT-off animation, then switches mode to 'exiting'
  shutdown: () => set({ poweringOff: true }),
  setScreen: (screen) => set({ screen }),
  setDesk: (w, h) => set({ desk: { w, h } }),

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
    const vh = get().desk.h - 40 // taskbar
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
      maximized: vw < 640,
    }
    set((s) => ({ windows: [...s.windows, win], focused: id, topZ: z }))
  },

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
