import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { profile } from '../../data/profile'
import { education, coursework } from '../../data/about'
import { resumes } from '../../data/resume'
import { contactLinks } from '../../data/contact'
import { projects, slugOf, type Project } from '../../data/projects'
import { skillGroups } from '../../data/skills'
import { useStore } from '../../store'
import { plain } from '../richText'
import { LAUNCHABLE, type AppId } from './registry'
import { openProject } from './Explorer'

// tiny virtual filesystem built from src/data
type Node = { type: 'file'; text: string } | { type: 'dir'; children: Record<string, Node> }

const HOME = `/home/${profile.user}`
const file = (text: string): Node => ({ type: 'file', text })
const dir = (children: Record<string, Node>): Node => ({ type: 'dir', children })

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
        .map((p) => [slugOf(p), dir({ 'README.txt': file(readme(p)) })]),
    ),
  )

const FS: Node = dir({
  home: dir({
    [profile.user]: dir({
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
      ),
      'skills.txt': file(skillGroups.map((g) => `${g.category}:\n  ${g.skills.map((s) => s.name).join(', ')}`).join('\n\n')),
      'contact.txt': file(contactLinks.map((l) => `${l.label.padEnd(9)} ${l.value}`).join('\n')),
      resume: dir(Object.fromEntries(resumes.map((r) => [r.file.split('/').pop()!, file(`${r.title}\n${r.blurb}\n\nopen ${r.file}`)]))),
      projects: projectDir('projects'),
      other: projectDir('other'),
    }),
  }),
})

function resolve(cwd: string, path = ''): string {
  const raw = path.startsWith('~') ? HOME + path.slice(1) : path.startsWith('/') ? path : `${cwd}/${path}`
  const parts: string[] = []
  for (const seg of raw.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

function lookup(path: string): Node | null {
  let node: Node = FS
  for (const seg of path.split('/').filter(Boolean)) {
    if (node.type !== 'dir' || !node.children[seg]) return null
    node = node.children[seg]
  }
  return node
}

const pretty = (path: string) => (path.startsWith(HOME) ? '~' + path.slice(HOME.length) : path)

// a function, not a const: LAUNCHABLE isn't initialized yet when this module loads (circular import)
const help = () => `available commands:
  help              show this
  ls [dir]          list files
  cd <dir>          change directory
  cat <file>        print a file
  pwd, whoami, date, echo, clear
  open <app>        open a window: ${LAUNCHABLE.join(', ')}
  open <project>    open a project by folder name
  neofetch          system info
  shutdown          power off and step away from the desk`

interface Line {
  kind: 'in' | 'out'
  text: string
  cwd?: string
}

export function Terminal({ winId }: { winId: string }) {
  const [cwd, setCwd] = useState(HOME)
  const [lines, setLines] = useState<Line[]>([
    { kind: 'out', text: `Welcome to ${profile.host}, ${profile.name}'s machine. Type "help" to get started.` },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const focused = useStore((s) => s.focused === winId)

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight)
  }, [lines])

  useEffect(() => {
    if (focused) inputRef.current?.focus()
  }, [focused])

  const run = (cmdline: string): string | null => {
    const [cmd, ...args] = cmdline.trim().split(/\s+/)
    const arg = args[0]
    switch (cmd) {
      case undefined:
      case '':
        return ''
      case 'help':
        return help()
      case 'pwd':
        return cwd
      case 'whoami':
        return profile.user
      case 'date':
        return new Date().toString()
      case 'echo':
        return args.join(' ')
      case 'clear':
        setLines([])
        return null
      case 'ls': {
        const node = lookup(resolve(cwd, arg))
        if (!node) return `ls: cannot access '${arg}': No such file or directory`
        if (node.type === 'file') return arg ?? ''
        return Object.entries(node.children)
          .map(([name, n]) => (n.type === 'dir' ? `${name}/` : name))
          .join('  ')
      }
      case 'cd': {
        const target = resolve(cwd, arg ?? '~')
        const node = lookup(target)
        if (!node) return `cd: ${arg}: No such file or directory`
        if (node.type !== 'dir') return `cd: ${arg}: Not a directory`
        setCwd(target)
        return ''
      }
      case 'cat': {
        if (!arg) return 'cat: missing file operand'
        const node = lookup(resolve(cwd, arg))
        if (!node) return `cat: ${arg}: No such file or directory`
        if (node.type === 'dir') return `cat: ${arg}: Is a directory`
        return node.text
      }
      case 'open': {
        if (!arg) return 'open: what should I open?'
        if ((LAUNCHABLE as string[]).includes(arg)) {
          useStore.getState().open(arg as AppId)
          return `opening ${arg}...`
        }
        if (openProject(arg)) return `opening ${arg}...`
        return `open: ${arg}: not found. try "ls ~/projects"`
      }
      case 'neofetch':
        return [
          `   ▄▄▄▄▄▄▄     ${profile.user}@${profile.host}`,
          `   █ ▀▀▀ █     -------------`,
          `   █▄▄▄▄▄█     Name: ${profile.name}`,
          `    ▄▄█▄▄      Role: ${profile.role}`,
          `  ▄▀▀▀▀▀▀▀▄    Location: ${profile.location}`,
          `  ▀▀▀▀▀▀▀▀▀    OS: picoOS 1.0 (React + three.js)`,
          `               Shader: picoCAD dither`,
        ].join('\n')
      case 'exit':
        useStore.getState().close(winId)
        return null
      case 'shutdown':
      case 'poweroff':
        useStore.getState().shutdown()
        return 'Broadcast message: the system is going down NOW!'
      case 'sudo':
        return `${profile.user} is not in the sudoers file. This incident will be reported.`
      default:
        return `${cmd}: command not found`
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const entry: Line = { kind: 'in', text: input, cwd }
      const out = run(input)
      if (out !== null) setLines((l) => [...l, entry, ...(out ? [{ kind: 'out' as const, text: out }] : [])])
      if (input.trim()) setHistory((h) => [input, ...h])
      setHIdx(-1)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const i = Math.min(hIdx + 1, history.length - 1)
      if (i >= 0) {
        setHIdx(i)
        setInput(history[i])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const i = hIdx - 1
      setHIdx(Math.max(i, -1))
      setInput(i >= 0 ? history[i] : '')
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  const prompt = (dir: string) => (
    <span className="prompt">
      <span className="p-user">
        {profile.user}@{profile.host}
      </span>
      :<span className="p-dir">{pretty(dir)}</span>$&nbsp;
    </span>
  )

  return (
    <div className="terminal" ref={bodyRef} onClick={() => inputRef.current?.focus()}>
      {lines.map((l, i) =>
        l.kind === 'in' ? (
          <div key={i}>
            {prompt(l.cwd!)}
            {l.text}
          </div>
        ) : (
          <pre key={i}>{l.text}</pre>
        ),
      )}
      <div className="input-line">
        {prompt(cwd)}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label="terminal input"
        />
      </div>
    </div>
  )
}
