import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { profile } from '../../data/profile'
import { projects, slugOf } from '../../data/projects'
import { useStore, slumpyLocation } from '../../store'
import { LAUNCHABLE, START_EXTRAS, type AppId } from './registry'
import { devices, DEVICE_KINDS } from '../../data/devices'
import { THEMES, useTheme } from '../theme'
import { CREATOR_HOME, HOME, PATH, exec, lookup, openPath, openProject, pretty, programAt, programs, resolve, which } from '../vfs'
import type { Expression } from '../../scene/SlumpyFace'
import { useSlumpy } from '../slumpy'
import { SlumpyCam, type SlumpyControl } from '../SlumpyCam'
import { addMenuItems } from '../appMenu'
import { playFaceSound } from '../sound'

// the filesystem (shared with Dolphin) lives in ../vfs

// greetings, questions and chatty sentences: people try talking to the terminal
const GREETING = /^(hi+|hello+|hey+|yo+|sup|hiya|howdy|hola|greetings|good (morning|afternoon|evening|night)|what'?s up|wassup)\b/i
const QUESTION = /^(who|what|when|where|why|how|which|can|could|would|will|should|is|are|am|do|does|did|tell me|explain|please)\b/i
const isChat = (line: string) => {
	const t = line.trim()
	return GREETING.test(t) || QUESTION.test(t) || t.endsWith('?') || t.split(/\s+/).length >= 4
}

// the shell's own commands; everything else is a program on the PATH (/usr/bin)
const BUILTINS = ['cd', 'exit', 'help', 'logout', 'open']

// $VARS echo expands
const ENV: Record<string, string> = { HOME, USER: profile.user, HOSTNAME: profile.host, SHELL: '/bin/bash', PATH: PATH.join(':') }

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
	if (words.length === 1) candidates = [...BUILTINS, ...programs()].sort().map((c) => c + ' ')
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
	shutdown: 'sleepy',
	poweroff: 'sleepy',
	reboot: 'dizzy',
	[profile.host]: 'love', // the computer is named after the host
	hi: 'happy',
	hello: 'happy',
}

function reactionFor(cmdline: string, out: string | null): Expression | null {
	const line = cmdline.trim().toLowerCase()
	if (!line) return null
	if ((line.includes(profile.host) || /love|<3/.test(line)) && !line.startsWith('sudo')) return 'love'
	if (out && /not found|No such|missing|Not a directory|Is a directory/.test(out)) return 'confused'
	const cmd = line.split(/\s+/)[0]
	// any other installed program is a happy surprise
	return REACTIONS[cmd] ?? (which(cmd) ? 'excited' : 'confused')
}


// a function, not a const: LAUNCHABLE isn't initialized yet when this module loads (circular import)
const help = () => `available commands:
  help              show this
  ls [dir]          list files
  cd <dir>          change directory
  cat <file>        print a file
  pwd, whoami, date, echo, clear
  open <app>        open a window: ${LAUNCHABLE.join(', ')}
  open <project>    open a project by folder name
  open <path>       open a file or folder, like double-clicking it
  notepad [file]    edit a text file (you can save in ~ and /tmp)
  dolphin [dir]     browse files; also konsole, okular, systemsettings...
  which <command>   where a program lives (ls /usr/bin for all of them)
  lsusb             list connected devices
  neofetch          system info
  ${profile.host.padEnd(18)}say hi to ${profile.host}
  (Tab completes commands, files and app names)
  logout            log off and step away from the desk
  poweroff, reboot  turn ${profile.host} off (or off and on again)
  shutdown [+min]   turn off later (-c cancels, -r restarts, "now" for now)`

// a `shutdown` waiting to happen (one per machine, like the real thing)
let scheduled: { timer: number; at: Date } | null = null

// what the shell prints as the machine goes down
const goingDown = (reboot: boolean) =>
	`\nBroadcast message from ${profile.user}@${profile.host} (pts/0) (${new Date().toString().slice(0, 24)}):\n\nThe system will ${reboot ? 'reboot' : 'power off'} now!`

// shutdown [-r|-h|-P|-c] [now|+minutes|hh:mm]
function shutdown(args: string[]): string {
	const reboot = args.includes('-r')
	if (args.includes('-c')) {
		if (!scheduled) return 'shutdown: no scheduled shutdown to cancel'
		clearTimeout(scheduled.timer)
		scheduled = null
		return ''
	}
	const when = args.find((a) => !a.startsWith('-')) ?? '+1'
	let mins: number
	if (when === 'now') mins = 0
	else if (/^\+?\d+$/.test(when)) mins = parseInt(when.replace('+', ''), 10)
	else if (/^\d{1,2}:\d{2}$/.test(when)) {
		const [h, m] = when.split(':').map(Number)
		const t = new Date()
		t.setHours(h, m, 0, 0)
		if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1)
		mins = (t.getTime() - Date.now()) / 60_000
	} else return `shutdown: invalid time value '${when}'`
	if (scheduled) clearTimeout(scheduled.timer)
	scheduled = null
	if (mins <= 0) {
		useStore.getState().shutDown(reboot)
		return goingDown(reboot)
	}
	const at = new Date(Date.now() + mins * 60_000)
	scheduled = {
		at,
		timer: window.setTimeout(() => {
			scheduled = null
			if (useStore.getState().mode === 'desktop') useStore.getState().shutDown(reboot)
		}, mins * 60_000),
	}
	return `${reboot ? 'Reboot' : 'Shutdown'} scheduled for ${at.toString().slice(0, 24)}, use 'shutdown -c' to cancel.`
}

interface Line {
	kind: 'in' | 'out'
	text: string
	cwd?: string
}

export function Terminal({ winId, props }: { winId: string; props?: Record<string, unknown> }) {
	// "Open Konsole Here" passes a folder to start in
	const [cwd, setCwd] = useState(() => (props?.cwd as string) ?? CREATOR_HOME)
	useEffect(() => {
		if (props?.cwd) setCwd(props.cwd as string)
	}, [props?.cwd])
	const [lines, setLines] = useState<Line[]>(() => [{ kind: 'out', text: greeting() }])
	const [input, setInput] = useState('')
	const [history, setHistory] = useState<string[]>([])
	const [hIdx, setHIdx] = useState(-1)
	const inputRef = useRef<HTMLInputElement>(null)
	const bodyRef = useRef<HTMLDivElement>(null)
	const focused = useStore((s) => s.focused === winId)
	const slumpyHere = useStore((s) => slumpyLocation(s) === 'konsole')

	// Slumpy watches you type: eyes follow the text, reacts to each command,
	// dozes off when you stop for a while and startles awake when you start again
	const face = useSlumpy() // the desktop's one Slumpy (same mood wherever he is)
	const lastTyped = useRef(performance.now())
	// last actual keystroke or command (not when the window opened), for following
	const typedAt = useRef(-Infinity)
	const dozing = useRef(false)
	// (only while he's actually in here: it's the same Slumpy as on the wallpaper)
	useEffect(() => {
		let here = false
		const wake = () => {
			if (!dozing.current) return
			dozing.current = false
			face.react('neutral', 0)
		}
		const id = setInterval(() => {
			const now = slumpyLocation(useStore.getState()) === 'konsole'
			if (now && !here) lastTyped.current = performance.now() // just arrived: start the clock
			if (!now) wake() // left while asleep: don't stay asleep somewhere else
			here = now
			if (here && !dozing.current && performance.now() - lastTyped.current > 25_000) {
				dozing.current = true
				face.react('sleepy', 1e9)
			}
		}, 1000)
		return () => {
			clearInterval(id)
			wake()
		}
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
		let [cmd, ...args] = cmdline.trim().split(/\s+/)
		// a path to a program runs it (/usr/bin/ls, ./dolphin); any other path doesn't
		if (cmd?.includes('/')) {
			const path = resolve(cwd, cmd)
			const node = lookup(path)
			if (!node) return `bash: ${cmd}: No such file or directory`
			if (node.type === 'dir') return `bash: ${cmd}: Is a directory`
			const name = programAt(path)
			if (!name) return `bash: ${cmd}: Permission denied`
			cmd = name
		}
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
				return args.join(' ').replace(/\$(\w+)/g, (_, v: string) => ENV[v] ?? '')
			case 'which':
				return args
					.map(which)
					.filter(Boolean)
					.join('\n')
			case 'clear':
				setLines([])
				return null
			case 'ls': {
				const node = lookup(resolve(cwd, arg))
				if (!node) return `ls: cannot access '${arg}': No such file or directory`
				if (node.type === 'file') return arg ?? ''
				if (node.locked) return `ls: cannot open directory '${arg ?? '.'}': Permission denied`
				// alphabetical, like real ls (and Dolphin)
				return Object.entries(node.children)
					.sort(([a], [b]) => a.localeCompare(b))
					// like ls -F: folders/, links@, programs*
					.map(([name, n]) => (n.type === 'dir' ? `${name}${n.link ? '@' : '/'}` : n.bin ? `${name}*` : name))
					.join('  ')
			}
			case 'cd': {
				const target = resolve(cwd, arg ?? '~')
				const node = lookup(target)
				if (!node) return `cd: ${arg}: No such file or directory`
				if (node.type !== 'dir') return `cd: ${arg}: Not a directory`
				if (node.locked) return `cd: ${arg}: Permission denied`
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
				if (([...LAUNCHABLE, ...START_EXTRAS] as string[]).includes(arg)) {
					useStore.getState().open(arg as AppId)
					return `opening ${arg}...`
				}
				if (openProject(arg)) return `opening ${arg}...`
				// any file or folder, same as double-clicking it in Dolphin
				if (openPath(resolve(cwd, arg))) return `opening ${arg}...`
				return `open: ${arg}: not found. try "ls"`
			}
			case 'lsusb':
				// Chiba and Hanzo, plugged into the root hub
				return [
					'Bus 001 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub',
					...DEVICE_KINDS.map((k, i) => `Bus 001 Device 00${i + 2}: ID ${devices[k].usbId} ${devices[k].name} ${devices[k].type}`),
				].join('\n')
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
					`Theme: ${THEMES.find((t) => t.id === useTheme.getState().theme)?.label}`,
					`Keyboard: ${devices.keyboard.name}`,
					`Mouse: ${devices.mouse.name}`,
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
				return shutdown(args)
			case 'poweroff':
			case 'halt':
				useStore.getState().shutDown()
				return goingDown(false)
			case 'reboot':
				useStore.getState().shutDown(true)
				return goingDown(true)
			case 'sudo':
				return `${profile.user} is not in the sudoers file. This incident will be reported.`
			case profile.host:
				return `(\u25d5\u203f\u25d5) hi! i'm ${profile.host}, this computer.`
			default: {
				// an installed app (dolphin, konsole, notepad...)
				const out = exec(cmd, args, cwd)
				if (out !== null) return out
				if (isChat(cmdline)) return `${cmd}: command not found: I'm not an LLM`
				return `${cmd}: command not found`
			}
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
			{/* only here while slumpyLocation() says so (the Konsole is focused, nothing else has him) */}
			<SlumpyCam face={face} follow={follow} onClick={pet} control={slumpy} away={!slumpyHere} />
		</div>
	)
}
