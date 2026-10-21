import { profile } from '../data/profile'
import { education, coursework } from '../data/about'
import { resumes } from '../data/resume'
import { contactLinks } from '../data/contact'
import { projects, slugOf, type Project } from '../data/projects'
import { skillGroups } from '../data/skills'
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

export type VFile = { type: 'file'; text: string; icon: IconName; open?: () => void }
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

const file = (text: string, icon: IconName = 'text', onOpen?: () => void): VFile => ({ type: 'file', text, icon, open: onOpen })
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
        .map((p) => [slugOf(p), dir({ 'README.txt': file(readme(p), 'text', () => openProject(slugOf(p))) }, p)]),
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
        ),
        'skills.txt': file(
          skillGroups.map((g) => `${g.category}:\n  ${g.skills.map((s) => s.name).join(', ')}`).join('\n\n'),
          'chip',
          () => open('skills'),
        ),
        'contact.txt': file(contactLinks.map((l) => `${l.label.padEnd(9)} ${l.value}`).join('\n'), 'mail', () => open('contact')),
        resume: dir(
          Object.fromEntries(
            resumes.map((r) => [r.file.split('/').pop()!, file(`${r.title}\n${r.blurb}\n\nopen ${r.file}`, 'text', () => open('resume', { resume: r.id }))]),
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

// Open a path the way double-clicking it would: folders in Dolphin (a project's
// folder opens its page), files with whatever they belong to, else in KWrite.
export function openPath(path: string): boolean {
  const node = lookup(path)
  if (!node) return false
  if (node.type === 'dir') {
    if (node.project) openProject(slugOf(node.project))
    else useStore.getState().open('projects', { key: path, props: { path } })
  } else if (node.open) node.open()
  else useStore.getState().open('textview', { key: path, title: `${path.split('/').pop()} - KWrite`, props: { path } })
  return true
}
