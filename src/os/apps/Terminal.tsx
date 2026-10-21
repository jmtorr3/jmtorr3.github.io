import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
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
import { SlumpyFace, type Expression } from '../../scene/SlumpyFace'
import { SlumpyCam, type SlumpyControl } from '../SlumpyCam'
import { addMenuItems } from '../appMenu'
import { playFaceSound } from '../sound'

// tiny virtual filesystem built from src/data
type Node = { type: 'file'; text: string } | { type: 'dir'; children: Record<string, Node> }

const HOME = `/home/${profile.user}` // the visitor's (guest's) home: ~
const CREATOR_HOME = `/home/${profile.creator}` // where the content lives, and where the Konsole starts
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
			'readme.txt': file(
				`you're a guest on ${profile.host}. ${profile.creator}'s stuff is in ${CREATOR_HOME}:\n  cd ${CREATOR_HOME}`,
			),
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

// greetings, questions and chatty sentences: people try talking to the terminal
const GREETING = /^(hi+|hello+|hey+|yo+|sup|hiya|howdy|hola|greetings|good (morning|afternoon|evening|night)|what'?s up|wassup)\b/i
const QUESTION = /^(who|what|when|where|why|how|which|can|could|would|will|should|is|are|am|do|does|did|tell me|explain|please)\b/i
const isChat = (line: string) => {
	const t = line.trim()
	return GREETING.test(t) || QUESTION.test(t) || t.endsWith('?') || t.split(/\s+/).length >= 4
}

const COMMANDS = ['cat', 'cd', 'clear', 'date', 'echo', 'exit', 'help', 'logout', 'ls', profile.host, 'neofetch', 'open', 'pwd', 'sudo', 'whoami']

// longest start shared by every candidate
const commonPrefix = (xs: string[]) =>
	xs.reduce((a, b) => {
		let i = 0
		while (i < a.length && a[i] === b[i]) i++
		return a.slice(0, i)
	})

// Tab completion for the last word on the line: a command, a file or folder
// (folders only for cd), or an app/project after "open". Returns the completed
// line, or the options to list when it can't narrow down any further.
function complete(line: string, cwd: string): { line: string; options: string[] } {
	const words = line.split(' ')
	const word = words[words.length - 1]
	const head = line.slice(0, line.length - word.length)
	let dirPart = ''
	let base = word
	let candidates: string[]
	if (words.length === 1) candidates = COMMANDS.map((c) => c + ' ')
	else if (words[0] === 'open') candidates = [...LAUNCHABLE, ...projects.map(slugOf)].map((c) => c + ' ')
	else {
		const slash = word.lastIndexOf('/')
		dirPart = word.slice(0, slash + 1)
		base = word.slice(slash + 1)
		const node = lookup(dirPart ? resolve(cwd, dirPart) : cwd)
		if (!node || node.type !== 'dir') return { line, options: [] }
		candidates = Object.entries(node.children)
			.filter(([, n]) => words[0] !== 'cd' || n.type === 'dir')
			.map(([name, n]) => name + (n.type === 'dir' ? '/' : ' '))
	}
	const matches = candidates.filter((c) => c.startsWith(base))
	if (!matches.length) return { line, options: [] }
	const prefix = matches.length === 1 ? matches[0] : commonPrefix(matches)
	if (prefix.length > base.length) return { line: head + dirPart + prefix, options: [] }
	return { line, options: matches.length > 1 ? matches.map((m) => m.trimEnd()) : [] }
}

// the computer says hi when the Konsole opens (a different line each time)
const GREETINGS = [
	`hey. i'm ${profile.host}, the computer. type "help" to look around.`,
	`${profile.host} here. "help" lists what i can do.`,
	`oh, hi. this is ${profile.host}'s terminal. try "help".`,
]
const greeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]

// how Slumpy reacts to a command (unknown commands and errors get 'confused')
const REACTIONS: Record<string, Expression> = {
	help: 'thinking',
	ls: 'happy',
	cd: 'wink',
	cat: 'excited',
	open: 'excited',
	neofetch: 'cool',
	clear: 'wink',
	whoami: 'blush',
	pwd: 'happy',
	date: 'loading',
	echo: 'uwu',
	sudo: 'angry',
	rm: 'dizzy',
	exit: 'sad',
	logout: 'sad',
	shutdown: 'suspicious', // nice try
	poweroff: 'suspicious',
	[profile.host]: 'love', // the computer is named after the host
	hi: 'happy',
	hello: 'happy',
}

function reactionFor(cmdline: string, out: string | null): Expression | null {
	const line = cmdline.trim().toLowerCase()
	if (!line) return null
	if ((line.includes(profile.host) || /love|<3/.test(line)) && !line.startsWith('sudo')) return 'love'
	if (out && /not found|No such|missing|Not a directory|Is a directory/.test(out)) return 'confused'
	return REACTIONS[line.split(/\s+/)[0]] ?? 'confused'
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
  ${profile.host.padEnd(18)}say hi to ${profile.host}
  (Tab completes commands, files and app names)
  logout            log off and step away from the desk`

interface Line {
	kind: 'in' | 'out'
	text: string
	cwd?: string
}

export function Terminal({ winId }: { winId: string }) {
	const [cwd, setCwd] = useState(CREATOR_HOME)
	const [lines, setLines] = useState<Line[]>(() => [{ kind: 'out', text: greeting() }])
	const [input, setInput] = useState('')
	const [history, setHistory] = useState<string[]>([])
	const [hIdx, setHIdx] = useState(-1)
	const inputRef = useRef<HTMLInputElement>(null)
	const bodyRef = useRef<HTMLDivElement>(null)
	const focused = useStore((s) => s.focused === winId)
	const startOpen = useStore((s) => s.startOpen) // Slumpy's up in the Start menu then

	// Slumpy watches you type: eyes follow the text, reacts to each command,
	// dozes off when you stop for a while and startles awake when you start again
	const [face] = useState(() => new SlumpyFace({ idle: false, transparent: true }))
	const lastTyped = useRef(performance.now())
	// last actual keystroke or command (not when the window opened), for following
	const typedAt = useRef(-Infinity)
	const dozing = useRef(false)
	useEffect(() => {
		const id = setInterval(() => {
			if (!dozing.current && performance.now() - lastTyped.current > 25_000) {
				dozing.current = true
				face.react('sleepy', 1e9)
			}
		}, 1000)
		return () => clearInterval(id)
	}, [face])
	const onType = (value: string) => {
		lastTyped.current = performance.now()
		typedAt.current = lastTyped.current
		if (dozing.current) {
			dozing.current = false
			face.react('surprised', 0.9)
		}
		// look down at the line, following the end of the text
		face.glance(Math.max(-10, Math.min(10, -10 + value.length * 0.7)), 5)
		if (Math.random() < 0.15) face.poke()
	}
	// while you're typing (and just after), Slumpy floats over to hover above the cursor
	const konsoleRef = useRef<HTMLDivElement>(null)
	const follow = () => {
		const k = konsoleRef.current
		const inp = inputRef.current
		if (!k || !inp || performance.now() - typedAt.current > 2500) return null
		// rects are in screen px; the desktop is CSS-scaled, so convert back to layout px
		const kr = k.getBoundingClientRect()
		const ir = inp.getBoundingClientRect()
		const s = kr.width / k.offsetWidth || 1
		const charW = parseFloat(getComputedStyle(inp).fontSize) * 0.6
		const caretX = (ir.left - kr.left) / s + Math.min(inp.value.length * charW, inp.offsetWidth)
		// the face sprite is 110×88 with the face itself around its middle: hover above
		// the line, or just below it when the line is at the very top
		const lineTop = (ir.top - kr.top) / s
		const above = lineTop - 72
		return { x: caretX - 55, y: above >= 0 ? above : lineTop + inp.offsetHeight - 14 }
	}
	const react = (cmdline: string, out: string | null) => {
		lastTyped.current = performance.now()
		typedAt.current = lastTyped.current
		dozing.current = false
		const expr = reactionFor(cmdline, out)
		if (!expr) return
		face.react(expr, expr === 'loading' ? 3.2 : 2.2)
		playFaceSound(expr)
	}

	useEffect(() => {
		bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight)
	}, [lines])

	useEffect(() => {
		// preventScroll: don't let the browser pan the page to the input (mobile)
		if (focused) inputRef.current?.focus({ preventScroll: true })
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
			case 'neofetch': {
				const art = ['   ▄▄▄▄▄▄▄', '   █ ▀▀▀ █', '   █▄▄▄▄▄█', '    ▄▄█▄▄', '  ▄▀▀▀▀▀▀▀▄', '  ▀▀▀▀▀▀▀▀▀']
				const info = [
					`${profile.user}@${profile.host}`,
					'-------------',
					`Name: ${profile.name}`,
					`Role: ${profile.role}`,
					`Location: ${profile.location}`,
					'OS: slumpyOS 1.0',
					'Shader: picoCAD dither',
				]
				// side by side when it fits, otherwise the logo goes above the info (phones)
				const body = bodyRef.current
				const charW = body ? parseFloat(getComputedStyle(body).fontSize) * 0.6 : 8
				const cols = body ? Math.floor(body.clientWidth / charW) : 80
				const wide = 15 + Math.max(...info.map((l) => l.length)) <= cols
				if (!wide) return [...art, '', ...info].join('\n')
				return info.map((l, i) => (art[i] ?? '').padEnd(15) + l).join('\n')
			}
			case 'exit':
				useStore.getState().close(winId)
				return null
			case 'logout':
				useStore.getState().logOff()
				return `${profile.user} logged off. bye.`
			case 'shutdown':
			case 'poweroff':
				return `${profile.host} doesn't really turn off. try "logout".`
			case 'sudo':
				return `${profile.user} is not in the sudoers file. This incident will be reported.`
			case profile.host:
				return `(\u25d5\u203f\u25d5) hi! i'm ${profile.host}, this computer.`
			default:
				if (isChat(cmdline)) return `${cmd}: command not found: I'm not an LLM`
				return `${cmd}: command not found`
		}
	}

	// run a line as if it was typed and entered
	const submit = (line: string) => {
		const entry: Line = { kind: 'in', text: line, cwd }
		const out = run(line)
		react(line, out)
		if (out !== null) setLines((l) => [...l, entry, ...(out ? [{ kind: 'out' as const, text: out }] : [])])
		if (line.trim()) setHistory((h) => [line, ...h])
		setHIdx(-1)
		setInput('')
	}

	const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			submit(input)
		} else if (e.key === 'Tab') {
			e.preventDefault()
			const done = complete(input, cwd)
			if (done.line !== input) {
				setInput(done.line)
				onType(done.line)
			} else if (done.options.length) {
				// several matches and nothing more in common: list them, like bash
				setLines((l) => [...l, { kind: 'in', text: input, cwd }, { kind: 'out', text: done.options.join('  ') }])
			}
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

	const focusInput = () => inputRef.current?.focus({ preventScroll: true })
	const pet = () => {
		face.react('love', 1.4)
		playFaceSound('love')
		focusInput()
	}
	const slumpy = useRef<SlumpyControl>({})
	const NAME = profile.host[0].toUpperCase() + profile.host.slice(1)

	// right-click: Konsole-style items (the window adds its controls and shows the menu)
	const onMenu = (e: MouseEvent<HTMLDivElement>) => {
		const selection = window.getSelection()?.toString() ?? ''
		// where it was clicked, in the Konsole's layout px (the desktop is CSS-scaled)
		const k = konsoleRef.current!
		const kr = k.getBoundingClientRect()
		const s = kr.width / k.offsetWidth || 1
		const at = { x: (e.clientX - kr.left) / s, y: (e.clientY - kr.top) / s }
		addMenuItems(e, [
			{ label: 'Copy', icon: 'text', disabled: !selection, onClick: () => void navigator.clipboard?.writeText(selection) },
			{
				label: 'Paste',
				icon: 'text',
				onClick: () =>
					navigator.clipboard
						?.readText()
						.then((text) => {
							const v = input + text.replace(/\s*\n\s*/g, ' ')
							setInput(v)
							onType(v)
						})
						.catch(() => {}) // clipboard blocked
						.finally(focusInput),
			},
			{ label: 'Clear', icon: 'terminal', onClick: () => (setLines([]), focusInput()) },
			{ separator: true },
			{ label: 'Run neofetch', icon: 'computer', onClick: () => (submit('neofetch'), focusInput()) },
			{ label: 'Run help', icon: 'chip', onClick: () => (submit('help'), focusInput()) },
			{ separator: true },
			{ label: `Pet ${NAME}`, icon: 'user', onClick: pet },
			{ label: `Call ${NAME} Here`, icon: 'user', onClick: () => slumpy.current.comeTo?.(at.x, at.y) },
		])
	}

	return (
		<div className="konsole" ref={konsoleRef} onContextMenu={onMenu}>
			<div className="terminal" ref={bodyRef} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
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
						onChange={(e) => {
							setInput(e.target.value)
							onType(e.target.value)
						}}
						onKeyDown={onKey}
						spellCheck={false}
						autoComplete="off"
						autoCapitalize="off"
						aria-label="terminal input"
					/>
				</div>
			</div>
			{/* only here while the Konsole is focused (and the Start menu, which takes him, is closed) */}
			<SlumpyCam face={face} follow={follow} onClick={pet} control={slumpy} away={!focused || startOpen} />
		</div>
	)
}
