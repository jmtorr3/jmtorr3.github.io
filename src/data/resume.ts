// Resume window. PDFs live in public/resume/. The first entry opens by default.
export const resumeIntro =
	'I keep three resumes tuned for different role types, especially in this job market ヽ༼ຈل͜ຈ༽ﾉ'

export const resumes = [
	{
		id: 'swe',
		title: 'SWE / Full-Stack',
		file: '/resume/Jorge_Manuel_Torre_Resume_SWE.pdf',
		blurb: 'Web apps, REST APIs, full-stack engineering. Leads with Garage64, personal-blog, and the CS capstone (CHUD).',
	},
	{
		id: 'systems',
		title: 'Systems / Low-Level',
		file: '/resume/Jorge_Manuel_Torre_Resume_Systems.pdf',
		blurb: 'Linux kernel programming, reverse engineering, infrastructure. Leads with kernel scheduler & syscall work, Pokémon Black RE, and the home lab.',
	},
	{
		id: 'ml',
		title: 'ML / AI',
		file: '/resume/Jorge_Manuel_Torre_Resume_ML.pdf',
		blurb: 'LLM safety, fine-tuning attacks, reinforcement learning. Leads with the CHUD capstone and Celeste-RL.',
	},
]
