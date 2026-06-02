import { useState, useEffect } from 'react'
import './Hero.css'
import { roleText as ROLE_TEXT, heroBio, currentLocation } from '../data/hero'

function GitHubIcon() {
	return (
		<svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
		</svg>
	)
}

function useTyping(text, speed = 48) {
	const [displayed, setDisplayed] = useState('')
	const [done, setDone] = useState(false)

	useEffect(() => {
		let i = 0
		setDisplayed('')
		setDone(false)
		const id = setInterval(() => {
			i++
			setDisplayed(text.slice(0, i))
			if (i >= text.length) {
				clearInterval(id)
				setDone(true)
			}
		}, speed)
		return () => clearInterval(id)
	}, [text, speed])

	return { displayed, done }
}

export default function Hero() {
	const { displayed, done } = useTyping(ROLE_TEXT)

	return (
		<section id="hero" className="hero">
			<div className="hero-content">
				<div className="hero-avatar-wrap">
					<img
						src={`${import.meta.env.BASE_URL}avatar.jpg`}
						alt="Jorge Manuel Torre"
						className="hero-avatar hero-avatar-default"
						loading="lazy"
					/>
					<img
						src={`${import.meta.env.BASE_URL}slumpy.png`}
						alt=""
						aria-hidden="true"
						className="hero-avatar hero-avatar-hover"
						loading="lazy"
					/>
				</div>
				<div className="status-badge">
					<span className="status-dot" />
					Open to full-time
				</div>
				<p className="hero-greeting">Hellooo, I'm</p>
				<h1 className="hero-name">Jorge Manuel Torre</h1>
				<p className="hero-role">
					<span className="mono accent">{'>'}</span> {displayed}
					<span className={`cursor${done ? ' cursor-blink' : ''}`}>█</span>
				</p>
				<p className="hero-working">
					<span className="mono accent">$</span> based in <a>{currentLocation.label}</a>
				</p>
				<p className="hero-bio">{heroBio}</p>
				<div className="hero-cta">
					<a
						href="https://github.com/jmtorr3"
						target="_blank"
						rel="noopener noreferrer"
						className="btn btn-primary"
					>
						<GitHubIcon />
						GitHub
					</a>
					<a href="#contact" className="btn btn-ghost">Get in Touch</a>
					<a
						href={`${import.meta.env.BASE_URL}resume.html`}
						className="btn btn-ghost"
					>
						Resume
					</a>
				</div>
			</div>
			<pre className="hero-ascii" aria-hidden="true">{`⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⢿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⣠⣤⣤⠀⠀⠀⠀⠀⣠⣴⣶⣾⣿⣿⣿⣿⣿⣶⣦⣄⡀⠀⠀⠀⠀⣠⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⡿⠀⠀⢀⣴⣿⣿⣿⣿⣿⡿⠿⠿⠿⣿⣿⣿⣿⣿⣶⣄⠀⠀⢻⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀
⠀⠀⠀⢀⣴⣿⣿⣿⡿⠋⠀⠀⣰⣿⣿⣿⡿⠟⠉⠀⠀⠀⠀⠀⠀⠉⠛⢿⣿⣿⣿⣦⡀⠀⠙⢿⣿⣿⣿⣧⡀⠀⠀⠀
⠀⢀⣴⣿⣿⣿⡿⠋⠀⠀⠀⣼⣿⣿⣿⠟⠀⠀⠀⢀⣀⣤⣤⣄⡀⠀⠀⠀⠙⣿⣿⣿⣷⠀⠀⠀⠙⢿⣿⣿⣿⣦⡀⠀
⢠⣾⣿⣿⡿⠋⠀⠀⠀⠀⢠⣿⣿⣿⠏⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣶⡀⠀⠀⠘⣿⣿⣿⡇⠀⠀⠀⠀⠙⢿⣿⣿⣿⣆
⣿⣿⣿⡟⠁⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⢻⣿⣿⣿⠀⠀⠀⠀⠀⠀⠹⣿⣿⣿
⢻⣿⣿⣷⡀⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⣸⣿⣿⣿⠀⠀⠀⠀⠀⢀⣼⣿⣿⡿
⠀⠻⣿⣿⣿⣦⡀⠀⠀⠀⠸⣿⣿⣿⡆⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀⢠⣿⣿⣿⡇⠀⠀⠀⠀⣠⣾⣿⣿⡟⠁
⠀⠀⠘⢿⣿⣿⣿⣦⡀⠀⠀⢻⣿⣿⣿⣆⠀⠀⠀⠈⠙⠛⠛⠛⠁⠀⠀⠀⣠⣿⣿⣿⡿⠀⠀⢀⣴⣿⣿⣿⡿⠋⠀⠀
⠀⢀⣀⣀⡙⠻⣿⣿⣿⣷⣄⠀⠻⣿⣿⣿⣷⣤⡀⠀⠀⠀⠀⠀⠀⢀⣠⣾⣿⣿⣿⡟⠁⢠⣴⣿⣿⣿⡿⢋⣠⣤⣀⠀
⢠⣿⣿⣿⣿⠀⠈⠛⠿⣿⡿⠀⠀⠘⠻⣿⣿⣿⣿⣷⡄⠀⠀⢀⣾⣿⣿⣿⣿⡿⠋⠀⠀⢻⣿⡿⠟⠉⠀⣾⣿⣿⣿⡇
⠈⠿⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⠿⠿⠿⠃
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣄⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⣀⣤⡄⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣦⣄⣀⣀⣴⣿⣿⣿⡇⠀⠀⢸⣿⣿⣿⣧⣀⢀⣠⣴⣾⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠁⠀⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠛⠿⠿⠛⠛⠉⠀⠀⠀⠀⠀⠀⠈⠛⠛⠿⠿⠟⠛⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`}</pre>
		</section>
	)
}
