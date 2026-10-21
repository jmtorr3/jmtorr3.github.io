import { profile } from '../data/profile'
import { education, coursework } from '../data/about'
import { resumes } from '../data/resume'
import { contactLinks } from '../data/contact'
import { projects, slugOf, type Project } from '../data/projects'
import { skillGroups } from '../data/skills'
import { create } from 'zustand'
import { useStore } from '../store'
import { plain } from './richText'
import { APPS, LAUNCHABLE, type AppId } from './apps/registry'
import type { IconName } from './Icon'

// The machine's one filesystem, built from src/data. The Konsole (ls, cd, cat,
// open) and Dolphin both browse it, and every file knows what opening it does,
// so double-clicking in Dolphin and `open` in the Konsole agree.
//
//   /home/guest/            ~, the visitor
//     readme.txt
//     Desktop/              a .desktop launcher per desktop icon, same order
//   /home/jmtorr3/          the creator's stuff (where the Konsole starts)
//     about.txt  skills.txt  contact.txt
//     resume/*.pdf
//     projects/<project>/README.txt
//     other/<project>/README.txt
//
// The guest can write in their own home (Notepad saves, "New Text File"); the
// rest is read-only. Writes last until the page is reloaded.

// open: what opening it does when it belongs to an app (app: that app's name, for "Open in …")
export type VFile = { type: 'file'; text: string; icon: IconName; open?: () => void; app?: string }
export type VDir = { type: 'dir'; children: Record<string, VNode>; project?: Project }
export type VNode = VFile | VDir

export const HOME = `/home/${profile.user}` // ~
export const CREATOR_HOME = `/home/${profile.creator}`
export const PROJECTS_DIR = `${CREATOR_HOME}/projects`

const open = (app: AppId, props?: Record<string, unknown>) => useStore.getState().open(app, props && { props })

export const findProject = (slug: string) => projects.find((p) => slugOf(p) === slug)

export function openProject(slug: string) {
  const p = findProject(slug)
  if (!p) return false
  useStore.getState().open('project', { key: slug, title: p.title, props: { slug } })
  return true
}

const file = (text: string, icon: IconName = 'text', onOpen?: () => void, app?: string): VFile => ({ type: 'file', text, icon, open: onOpen, app })
const dir = (children: Record<string, VNode>, project?: Project): VDir => ({ type: 'dir', children, project })

const readme = (p: Project) =>
  [
    `${p.title} — ${p.subtitle}`,
    `${p.date}${p.stat ? ` · ${p.stat}` : ''}`,
    `[${p.tech.join(', ')}]`,
    '',
    ...p.bullets.map((b) => `* ${b}`),
    '',
    ...[p.github && `github: ${p.github}`, p.demo && `${(p.demoLabel ?? 'demo').toLowerCase()}: ${p.demo}`]
      .concat(p.links?.map((l) => `${l.label.toLowerCase()}: ${l.href}`) ?? [])
      .filter(Boolean),
  ].join('\n')

const projectDir = (folder: 'projects' | 'other') =>
  dir(
    Object.fromEntries(
      projects
        .filter((p) => (p.folder ?? 'projects') === folder)
        .map((p) => [slugOf(p), dir({ 'README.txt': file(readme(p), 'text', () => openProject(slugOf(p)), p.title) }, p)]),
    ),
  )

// what each desktop icon's launcher runs, KDE-style
const EXEC: Partial<Record<AppId, string>> = { projects: `dolphin ${PROJECTS_DIR}`, terminal: 'konsole', skills: 'systemsettings' }
const launcherName = (id: AppId) => APPS[id].label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.desktop'

function build(): VDir {
  const desktop = Object.fromEntries(
    LAUNCHABLE.map((id) => [
      launcherName(id),
      file(
        ['[Desktop Entry]', 'Type=Application', `Name=${APPS[id].label}`, `Exec=${EXEC[id] ?? id}`, `Icon=${APPS[id].icon}`].join('\n'),
        APPS[id].icon,
        // the Projects launcher goes to the projects folder, even in a file
        // manager that's already open somewhere else (like double-clicking it from ~/Desktop)
        id === 'projects' ? () => open('projects', { path: PROJECTS_DIR, at: Date.now() }) : () => open(id),
        APPS[id].label,
      ),
    ]),
  )
  return dir({
    home: dir({
      [profile.user]: dir({
        'readme.txt': file(`you're a guest on ${profile.host}. ${profile.creator}'s stuff is in ${CREATOR_HOME}:\n  cd ${CREATOR_HOME}`),
        Desktop: dir(desktop),
      }),
      [profile.creator]: dir({
        'about.txt': file(
          [
            `${profile.name} — ${profile.role}`,
            `based in ${profile.location}`,
            '',
            plain(profile.bio),
            '',
            `${education.degree}, ${education.school} (${education.date})`,
            ...coursework.map((c) => `  - ${c}`),
          ].join('\n'),
          'user',
          () => open('about'),
          APPS.about.label,
        ),
        'skills.txt': file(
          skillGroups.map((g) => `${g.category}:\n  ${g.skills.map((s) => s.name).join(', ')}`).join('\n\n'),
          'chip',
          () => open('skills'),
          APPS.skills.label,
        ),
        'contact.txt': file(contactLinks.map((l) => `${l.label.padEnd(9)} ${l.value}`).join('\n'), 'mail', () => open('contact'), APPS.contact.label),
        resume: dir(
          Object.fromEntries(
            resumes.map((r) => [r.file.split('/').pop()!, file(`${r.title}\n${r.blurb}\n\nopen ${r.file}`, 'text', () => open('resume', { resume: r.id }), APPS.resume.label)]),
          ),
        ),
        projects: projectDir('projects'),
        other: projectDir('other'),
      }),
    }),
  })
}

// built on first use: the app registry it reads imports apps that import this
let root: VDir | null = null
const fs = () => (root ??= build())

export function resolve(cwd: string, path = ''): string {
  const raw = path.startsWith('~') ? HOME + path.slice(1) : path.startsWith('/') ? path : `${cwd}/${path}`
  const parts: string[] = []
  for (const seg of raw.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

export function lookup(path: string): VNode | null {
  let node: VNode = fs()
  for (const seg of path.split('/').filter(Boolean)) {
    if (node.type !== 'dir' || !node.children[seg]) return null
    node = node.children[seg]
  }
  return node
}

// ~ for the visitor's home, like the prompt shows it
export const pretty = (path: string) => (path === HOME || path.startsWith(HOME + '/') ? '~' + path.slice(HOME.length) : path)

export const isText = (path: string) => path.toLowerCase().endsWith('.txt')

// Open a path the way double-clicking it would: folders in Dolphin (a project's
// folder opens its page), .txt files in Notepad, other files with whatever they
// belong to (else Notepad too).
export function openPath(path: string): boolean {
  const node = lookup(path)
  if (!node) return false
  if (node.type === 'dir') {
    if (node.project) openProject(slugOf(node.project))
    else useStore.getState().open('projects', { key: path, props: { path } })
  } else if (node.open && !isText(path)) node.open()
  else openNotepad(path)
  return true
}

let untitled = 0
// a file in Notepad, or a new blank document
export function openNotepad(path?: string) {
  const key = path ?? `untitled-${++untitled}`
  useStore.getState().open('notepad', { key, title: `${path ? path.split('/').pop() : 'Untitled'} - Notepad`, props: { path } })
}

// ---- writing (the guest's own home only) ----

// bumped on every write, so file listings re-render
export const useVfs = create<{ version: number }>(() => ({ version: 0 }))

export const canWrite = (path: string) => path.startsWith(HOME + '/')

const parent = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/'

// save text to a file, creating it if needed; returns an error message, or null
export function writeFile(path: string, text: string): string | null {
  if (!canWrite(path)) return `${pretty(path)}: Permission denied`
  const dirNode = lookup(parent(path))
  if (dirNode?.type !== 'dir') return `${pretty(parent(path))}: No such directory`
  const name = path.slice(path.lastIndexOf('/') + 1)
  if (!name) return 'a file needs a name'
  const existing = dirNode.children[name]
  if (existing?.type === 'dir') return `${pretty(path)}: Is a directory`
  if (existing) existing.text = text
  else dirNode.children[name] = file(text)
  useVfs.setState((s) => ({ version: s.version + 1 }))
  return null
}

// "Untitled.txt", or "Untitled 2.txt" and so on if that's taken
export function freshName(dir: string, base = 'Untitled', ext = '.txt') {
  const d = lookup(dir)
  const taken = (n: string) => d?.type === 'dir' && n in d.children
  let name = base + ext
  for (let i = 2; taken(name); i++) name = `${base} ${i}${ext}`
  return name
}
