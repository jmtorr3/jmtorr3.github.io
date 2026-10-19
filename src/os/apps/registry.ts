import type { ComponentType } from 'react'
import type { IconName } from '../Icon'
import { Notepad } from './Notepad'
import { Explorer, ProjectViewer } from './Explorer'
import { Terminal } from './Terminal'
import { Contact } from './Contact'

export interface AppDef {
  title: string
  icon: IconName
  size: [number, number]
  component: ComponentType<{ winId: string; props?: Record<string, unknown> }>
}

export const APPS = {
  about: { title: 'about.txt - Notepad', icon: 'user', size: [460, 360], component: Notepad },
  resume: { title: 'resume.txt - Notepad', icon: 'text', size: [520, 440], component: Notepad },
  contact: { title: 'Contact', icon: 'mail', size: [360, 260], component: Contact },
  projects: { title: 'Projects', icon: 'folder', size: [560, 380], component: Explorer },
  project: { title: 'Project', icon: 'text', size: [440, 320], component: ProjectViewer },
  terminal: { title: 'Konsole', icon: 'terminal', size: [600, 380], component: Terminal },
} satisfies Record<string, AppDef>

export type AppId = keyof typeof APPS

// what shows on the desktop and in the start menu
export const LAUNCHABLE: AppId[] = ['about', 'projects', 'resume', 'contact', 'terminal']
