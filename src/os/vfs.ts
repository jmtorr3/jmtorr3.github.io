import { profile } from '../data/profile'
import { education, coursework } from '../data/about'
import { resumes } from '../data/resume'
import { contactLinks } from '../data/contact'
import { projects, slugOf, type Project } from '../data/projects'
import { skillGroups } from '../data/skills'
import { README } from '../data/readme'
import { earlySketch } from './sketch'
import { devices } from '../data/devices'
import { create } from 'zustand'
import { useStore } from '../store'
import { plain } from './richText'
import { APPS, LAUNCHABLE, type AppId } from './apps/registry'
import type { IconName } from './Icon'

// The machine's one filesystem, built from src/data. The Konsole (ls, cd, cat,
// open) and Dolphin both browse it, and every file knows what opening it does,
// so double-clicking in Dolphin and `open` in the Konsole agree.
//
// Laid out like a real Linux box:
//
//   /bin -> usr/bin, /sbin -> usr/sbin
//   /boot/                  the kernel
//   /dev/                   null, zero, random, tty
//   /etc/                   hostname, hosts, os-release, passwd, shells, motd
//   /home/guest/            ~, the visitor
//     readme.txt
//     Desktop/              a .desktop launcher per desktop icon, same order
//   /home/jmtorr3/          the creator's stuff (where the Konsole starts)
//     about.txt  skills.txt  contact.txt
//     resume/*.pdf
//     projects/<project>/README.txt
//     other/<project>/README.txt
//   /root/                  locked
//   /tmp/                   anyone can write here
//   /usr/bin/               every installed program: the apps, and the Konsole's commands
//   /usr/sbin/              shutdown, poweroff, reboot, halt
//   /var/log/boot.log
//
// The guest can write in their own home and /tmp (Notepad saves, "New Text
// File"); the rest is read-only. Writes last until the page is reloaded.

// open: what opening it does when it belongs to an app (app: that app's name, for "Open in …")
// bin: it's a program (in /usr/bin or /usr/sbin), run by its name
// src: an image file's picture (what the Image Viewer shows; text is its "bytes")
export type VFile = { type: 'file'; text: string; icon: IconName; open?: () => void; app?: string; bin?: boolean; src?: string }
// link: a symlink's target (/bin -> usr/bin); locked: the guest can't look inside
export type VDir = { type: 'dir'; children: Record<string, VNode>; project?: Project; link?: string; locked?: boolean }
export type VNode = VFile | VDir

export const HOME = `/home/${profile.user}` // ~
export const CREATOR_HOME = `/home/${profile.creator}`
export const PROJECTS_DIR = `${CREATOR_HOME}/projects`
// the Recycle Bin (where KDE keeps it: a hidden folder in your home)
export const TRASH = `${HOME}/.local/share/Trash/files`

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

// an image file: what cat shows is the start of a PNG; opening it shows the picture
const image = (name: string, src: string): VFile => ({
  ...file(`\ufffdPNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\u0000\u0000\u0000\ufffd\u0000\u0000\u0000x\b\u0006\u0000\u0000\u0000${name}\ufffd\ufffd`, 'image'),
  src,
})

// a project's screenshots, as files: named after the picture's own file (or numbered)
const imageFiles = (p: Project) =>
  Object.fromEntries(
    (p.images ?? []).map((im, i) => {
      const base = im.src.split(/[?#]/)[0].split('/').pop() || `${i + 1}`
      const name = /\.(png|jpe?g|gif|webp|svg)$/i.test(base) ? base : `${base}.png`
      return [`${String(i + 1).padStart(2, '0')}-${name}`, image(name, im.src)]
    }),
  )

const projectDir = (folder: 'projects' | 'other') =>
  dir(
    Object.fromEntries(
      projects
        .filter((p) => (p.folder ?? 'projects') === folder)
        .map((p) => [
          slugOf(p),
          dir({ 'README.txt': file(readme(p), 'text', () => openProject(slugOf(p)), p.title), ...(p.images?.length ? { images: dir(imageFiles(p)) } : {}) }, p),
        ]),
    ),
  )

// ---- programs ----

// The installed apps, by the name you'd run them by. run gets the arguments and
// the working directory, and returns what it prints. The desktop launchers run
// these too (their Exec= line), so a launcher and typing it in the Konsole agree.
type Program = { app: AppId; run?: (args: string[], cwd: string) => string }
let konsoles = 0
const PROGRAMS: Record<string, Program> = {
  about: { app: 'about' },
  blog: { app: 'blog' },
  contact: { app: 'contact' },
  // a folder (the Projects launcher passes the projects folder, so it gets there
  // even in a Dolphin that's already open somewhere else)
  dolphin: {
    app: 'projects',
    run: ([a], cwd) => {
      if (!a) return open('projects'), ''
      const path = resolve(cwd, a)
      const node = lookup(path)
      if (node?.type !== 'dir') return `dolphin: ${a}: No such directory`
      open('projects', { path, at: Date.now() })
      return ''
    },
  },
  // the image viewer: a picture (it steps through the rest in its folder)
  gwenview: {
    app: 'image',
    run: ([a], cwd) => {
      if (!a) return 'gwenview: no image given'
      const path = resolve(cwd, a)
      const node = lookup(path)
      if (node?.type !== 'file' || !node.src) return `gwenview: ${a}: not an image`
      openImageFile(path)
      return ''
    },
  },
  kinfocenter: { app: 'system' },
  // the web browser: local pages (file://) only, this computer's offline
  konqueror: {
    app: 'browser',
    run: ([a], cwd) => {
      if (!a) return open('browser'), ''
      const path = resolve(cwd, a.replace(/^file:\/\//, ''))
      if (lookup(path)?.type !== 'file') return /^https?:/.test(a) ? `konqueror: ${a}: this computer's offline` : `konqueror: ${a}: No such file`
      openPage(path)
      return ''
    },
  },
  // a new window each time, starting where you are
  konsole: { app: 'terminal', run: (_, cwd) => (useStore.getState().open('terminal', { key: `k${++konsoles}`, props: { cwd } }), '') },
  notepad: {
    app: 'notepad',
    run: ([a], cwd) => {
      if (!a) return openNotepad(), ''
      const path = resolve(cwd, a)
      const node = lookup(path)
      if (node?.type === 'dir') return `notepad: ${a}: Is a directory`
      // a new file opens empty; it's created when it's saved
      if (node) openNotepad(path)
      else useStore.getState().open('notepad', { key: path, title: `${a.split('/').pop()} - Notepad`, props: { path } })
      return ''
    },
  },
  // KDE's document viewer: the resumes
  okular: {
    app: 'resume',
    run: ([a], cwd) => {
      if (!a) return open('resume'), ''
      const node = lookup(resolve(cwd, a))
      if (node?.type !== 'file' || node.app !== APPS.resume.label) return `okular: could not open ${a}`
      node.open?.()
      return ''
    },
  },
  // a module name picks the page: `systemsettings skills`
  systemsettings: { app: 'settings', run: ([a]) => (open(a === 'skills' ? 'skills' : 'settings'), '') },
}

// the Konsole's own commands that are programs on a real system too (cd, help,
// exit and the like are shell builtins, so they're not in /usr/bin)
export const TOOLS = ['cat', 'clear', 'cowsay', 'date', 'echo', 'fortune', 'login', 'ls', 'lsusb', 'man', 'neofetch', 'pwd', 'rm', 'sl', profile.host, 'startx', 'sudo', 'vi', 'vim', 'whoami', 'which']
export const ADMIN_TOOLS = ['halt', 'poweroff', 'reboot', 'shutdown']

export const PATH = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']

// where a command lives, like `which`
export function which(name: string): string | null {
  for (const d of PATH) {
    const n = lookup(`${d}/${name}`)
    if (n?.type === 'file' && n.bin) return `${d}/${name}`
  }
  return null
}

// every program on the PATH, for tab completion
export const programs = () => [...new Set(PATH.flatMap((d) => Object.keys((lookup(d) as VDir | null)?.children ?? {})))]

// the program a path points at (like /usr/bin/ls or ./dolphin), or null
export function programAt(path: string): string | null {
  const n = lookup(path)
  return n?.type === 'file' && n.bin ? path.slice(path.lastIndexOf('/') + 1) : null
}

// Run an installed app; null when it isn't one (the Konsole runs the rest itself)
export function exec(name: string, args: string[] = [], cwd = HOME): string | null {
  const p = PROGRAMS[name]
  if (!p) return null
  if (p.run) return p.run(args, cwd)
  open(p.app)
  return ''
}

// what cat shows for a program: the start of an ELF binary
const elf = (name: string) =>
  `\u007fELF\u0002\u0001\u0001\u0000\u0003\u0000>\u0000\u0001\u0000\u0000\u0000\ufffd\ufffd@\u0000\u0000\u0000\n` +
  `/lib64/ld-linux-x86-64.so.2\u0000GNU\u0000\ufffd\ufffd\u0004\u0000libc.so.6\u0000${name}\u0000GLIBC_2.34\u0000\ufffd\ufffdH\ufffd\ufffd\ufffd\n` +
  `__libc_start_main\u0000__cxa_finalize\u0000.shstrtab\u0000.text\u0000.data\u0000.bss\u0000\ufffd`
const program = (name: string, icon: IconName, onOpen?: () => void, app?: string): VFile => ({ ...file(elf(name), icon, onOpen, app), bin: true })

// what each desktop icon's launcher runs, KDE-style
const binOf = (id: AppId) => Object.keys(PROGRAMS).find((n) => PROGRAMS[n].app === id) ?? id
const EXEC: Partial<Record<AppId, string>> = { projects: `dolphin ${PROJECTS_DIR}`, skills: 'systemsettings skills' }
const execLine = (id: AppId) => EXEC[id] ?? binOf(id)
const launcherName = (id: AppId) => APPS[id].label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.desktop'

// runs a launcher's Exec= line
const runLine = (line: string) => {
  const [name, ...args] = line.split(' ')
  exec(name, args)
}

const etc = () =>
  dir({
    hostname: file(profile.host, 'settings'),
    hosts: file(`127.0.0.1\tlocalhost\n127.0.1.1\t${profile.host}\n::1\t\tlocalhost ip6-localhost ip6-loopback`, 'settings'),
    motd: file(`welcome to ${profile.host}. be nice to him.`, 'settings'),
    'os-release': file(
      ['NAME="slumpyOS"', 'VERSION="1.0"', 'ID=slumpyos', 'PRETTY_NAME="slumpyOS 1.0"', `HOME_URL="${profile.github}"`].join('\n'),
      'settings',
    ),
    passwd: file(
      [
        'root:x:0:0:root:/root:/bin/bash',
        `${profile.creator}:x:1000:1000:${profile.name}:${CREATOR_HOME}:/bin/bash`,
        `${profile.user}:x:1001:1001:Guest:${HOME}:/bin/bash`,
      ].join('\n'),
      'settings',
    ),
    shells: file('/bin/sh\n/bin/bash', 'settings'),
  })

function build(): VDir {
  const desktop = Object.fromEntries(
    LAUNCHABLE.map((id) => [
      launcherName(id),
      file(
        ['[Desktop Entry]', 'Type=Application', `Name=${APPS[id].label}`, `Exec=${execLine(id)}`, `Icon=${APPS[id].icon}`].join('\n'),
        APPS[id].icon,
        () => runLine(execLine(id)),
        APPS[id].label,
      ),
    ]),
  )
  const usrBin = dir(
    Object.fromEntries([
      ...Object.entries(PROGRAMS).map(([name, p]) => [name, program(name, APPS[p.app].icon, () => exec(name), APPS[p.app].label)]),
      ...TOOLS.map((name) => [name, program(name, 'terminal')]),
      ['bash', program('bash', 'terminal')],
      ['sh', program('sh', 'terminal')],
    ]),
  )
  const usrSbin = dir(Object.fromEntries(ADMIN_TOOLS.map((name) => [name, program(name, 'terminal')])))
  return dir({
    bin: { ...usrBin, link: 'usr/bin' },
    boot: dir({ 'vmlinuz-6.1.0-slumpy': file(elf('linux'), 'chip') }),
    dev: dir({
      null: file('', 'chip'),
      random: file('\ufffd\u0012\ufffdq\ufffd\ufffd\u0007\ufffdZ\ufffd\u001b\ufffd', 'chip'),
      tty: file('', 'chip'),
      zero: file('', 'chip'),
    }),
    etc: etc(),
    home: dir({
      [profile.user]: dir({
        'readme.txt': file(`you're a guest on ${profile.host}. ${profile.creator}'s stuff is in ${CREATOR_HOME}:\n  cd ${CREATOR_HOME}`),
        Desktop: dir({ ...desktop, 'README.md': file(README) }), // (the desktop's README icon)
        // easter egg: only `ls -a` shows it
        '.secret': file(
          [
            'a riddle, from me to you:',
            '',
            '  i have a face but no head,',
            '  yet open me up from behind',
            '  and you will find what i think with.',
            '',
            `(${profile.host}'s monitor has a back, you know)`,
          ].join('\n'),
        ),
        // easter egg: what's in the Recycle Bin
        '.local': dir({
          share: dir({
            Trash: dir({
              files: dir({
                'old_portfolio_final_FINAL2.html': file(
                  [
                    '<body bgcolor="#000080" text="#ffff00" link="#00ffff">',
                    '<marquee><font size="6" face="Comic Sans MS">WELCOME 2 MY WEBSITE!!!</font></marquee>',
                    '<center>',
                    '<p><blink><font color="#ff0000">*** UNDER CONSTRUCTION ***</font></blink></p>',
                    '<p>hi im jorge and this is my HOMEPAGE. it has a COMPUTER on it (soon)</p>',
                    '<p><img src="under_construction.gif" alt="[under construction gif]"></p>',
                    '<table border="3" cellpadding="6"><tr><td>you are visitor #</td><td><tt>000042</tt></td></tr></table>',
                    '<p><a href="#">sign my guestbook</a> | <a href="#">webring &gt;&gt;</a></p>',
                    '<hr><font size="1">best viewed in 800x600. made with notepad</font>',
                    '</center>',
                    '<!-- TODO: make it not look like this -->',
                    '</body>',
                  ].join('\n'),
                  'globe',
                ),
                'bugs.txt': file('1. the computer has a face\n2. the computer has feelings about it\n\nstatus: wontfix (it\'s a feature)'),
                'todo_2019.txt': file('[ ] learn rust\n[ ] finish the portfolio\n[x] procrastinate\n[ ] give the PC a brain'),
                'slumpy_v0.png': image('slumpy_v0.png', earlySketch()), // (we don't talk about it)
              }),
            }),
          }),
        }),
      }),
      [profile.creator]: dir({
        // Slumpy saying hi to whoever finds it (the Konsole starts here)
        'README.md': file(README),
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
    root: { ...dir({}), locked: true },
    sbin: { ...usrSbin, link: 'usr/sbin' },
    tmp: dir({}),
    usr: dir({ bin: usrBin, local: dir({ bin: dir({}) }), sbin: usrSbin }),
    var: dir({
      log: dir({
        'boot.log': file(
          [
            '[  OK  ] Mounted /home.',
            '[  OK  ] Started Picocad dither renderer.',
            '[  OK  ] Started Slumpy face service.',
            `[  OK  ] Found devices: ${devices.keyboard.name}, ${devices.mouse.name}.`,
            '[  OK  ] Reached target Graphical Interface.',
            `[  OK  ] Started Session 1 of user ${profile.user}.`,
          ].join('\n'),
        ),
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

export const isText = (path: string) => /\.(txt|md)$/i.test(path)

// Open a path the way double-clicking it would: folders in Dolphin (a project's
// folder opens its page), .txt files in Notepad, other files with whatever they
// belong to (else Notepad too).
export const isImage = (path: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path)
export const isPage = (path: string) => /\.html?$/i.test(path)

// a picture in the Image Viewer (one viewer per folder: it steps through the folder's pictures)
export function openImageFile(path: string) {
  const folder = path.slice(0, path.lastIndexOf('/'))
  useStore.getState().open('image', { key: `file:${folder}`, title: `${path.split('/').pop()} - Image Viewer`, props: { path } })
}

// a web page in Konqueror
export function openPage(path: string) {
  useStore.getState().open('browser', { key: path, title: `${path.split('/').pop()} - Konqueror`, props: { path } })
}

// Open a path the way double-clicking it would: by what kind of file it is
//   folders          Dolphin (a project's folder opens its page)
//   .txt .md         Notepad
//   pictures         the Image Viewer
//   .html            Konqueror
//   programs, .pdf, launchers, the rest: whatever they belong to (else Notepad)
export function openPath(path: string): boolean {
  const node = lookup(path)
  if (!node) return false
  if (node.type === 'dir') {
    if (node.project) openProject(slugOf(node.project))
    else useStore.getState().open('projects', { key: path, props: { path } })
  } else if (isText(path)) openNotepad(path)
  else if (isImage(path) && node.src) openImageFile(path)
  else if (isPage(path)) openPage(path)
  else if (node.open) node.open()
  else openNotepad(path)
  return true
}

let untitled = 0
// a file in Notepad, or a new blank document
export function openNotepad(path?: string) {
  const key = path ?? `untitled-${++untitled}`
  useStore.getState().open('notepad', { key, title: `${path ? path.split('/').pop() : 'Untitled'} - Notepad`, props: { path } })
}

// ---- writing (the guest's own home and /tmp only) ----

// bumped on every write, so file listings re-render
export const useVfs = create<{ version: number }>(() => ({ version: 0 }))

export const canWrite = (path: string) => path.startsWith(HOME + '/') || path.startsWith('/tmp/')

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

// delete a file or folder (with everything in it); an error message, or null
export function removePath(path: string): string | null {
  if (!canWrite(path)) return 'Permission denied'
  const dirNode = lookup(parent(path))
  const name = path.slice(path.lastIndexOf('/') + 1)
  if (dirNode?.type !== 'dir' || !dirNode.children[name]) return 'No such file or directory'
  delete dirNode.children[name]
  useVfs.setState((s) => ({ version: s.version + 1 }))
  return null
}

// every file's path under a folder, depth first (for a pretend `rm -rf /`)
export function walk(path = '/'): string[] {
  const node = lookup(path)
  if (node?.type !== 'dir' || node.link || node.locked) return node?.type === 'file' ? [path] : []
  return Object.keys(node.children)
    .sort()
    .flatMap((name) => walk(path === '/' ? `/${name}` : `${path}/${name}`))
}

// "Untitled.txt", or "Untitled 2.txt" and so on if that's taken
export function freshName(dir: string, base = 'Untitled', ext = '.txt') {
  const d = lookup(dir)
  const taken = (n: string) => d?.type === 'dir' && n in d.children
  let name = base + ext
  for (let i = 2; taken(name); i++) name = `${base} ${i}${ext}`
  return name
}
