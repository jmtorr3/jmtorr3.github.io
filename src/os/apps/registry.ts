import type { ComponentType } from 'react'
import type { IconName } from '../Icon'
import { About } from './About'
import { Explorer, ProjectViewer, ImageViewer } from './Explorer'
import { Skills } from './Skills'
import { Resume } from './Resume'
import { Blog } from './Blog'
import { Terminal } from './Terminal'
import { Contact } from './Contact'
import { SystemInfo } from './SystemInfo'

export interface AppDef {
  title: string
  label: string // desktop icon / start menu name
  icon: IconName
  size: [number, number]
  component: ComponentType<{ winId: string; props?: Record<string, unknown> }>
}

export const APPS = {
  // from the computer's point of view: you're the one who made it
  about: { title: 'About My Creator', label: 'About My Creator', icon: 'user', size: [560, 520], component: About },
  projects: { title: 'Projects - Dolphin', label: 'Projects', icon: 'folder', size: [600, 400], component: Explorer },
  skills: { title: 'Skills - System Settings', label: 'Skills', icon: 'chip', size: [580, 380], component: Skills },
  resume: { title: 'Resume', label: 'Resume', icon: 'text', size: [760, 560], component: Resume },
  blog: { title: 'Blog', label: 'Blog', icon: 'globe', size: [520, 440], component: Blog },
  contact: { title: 'Contact', label: 'Contact', icon: 'mail', size: [380, 330], component: Contact },
  terminal: { title: 'Konsole', label: 'Konsole', icon: 'terminal', size: [620, 400], component: Terminal },
  project: { title: 'Project', label: 'Project', icon: 'folder', size: [580, 540], component: ProjectViewer },
  image: { title: 'Image Viewer', label: 'Image Viewer', icon: 'image', size: [640, 480], component: ImageViewer },
  system: { title: 'About This Computer', label: 'About This Computer', icon: 'computer', size: [480, 580], component: SystemInfo },
} satisfies Record<string, AppDef>

export type AppId = keyof typeof APPS

// what shows on the desktop and in the start menu, in order
export const LAUNCHABLE: AppId[] = ['about', 'projects', 'skills', 'resume', 'blog', 'contact', 'terminal']

// extra Start menu entries, below the apps (not on the desktop)
export const START_EXTRAS: AppId[] = ['system']
