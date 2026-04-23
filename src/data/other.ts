const BASE = 'https://raw.githubusercontent.com/slumpy666/Garage32/main/.assets'

export const otherProjects = [
  {
    title: 'Garage32',
    subtitle: 'Minecraft CEM Texture Pack',
    role: 'Project Lead',
    stat: '500+ downloads',
    github: 'https://github.com/jmtorr3/Garage32',
    logo: `${BASE}/logos/Garage32.png`,
    description: 'A custom Minecraft texture pack that transforms boats into fully modeled cars using Custom Entity Models (CEM). Multiple car models across wood type variants — designed in collaboration with',
    collaborator: { name: 'Tim Kang', href: 'https://www.instagram.com/slug_7/' },
    previews: [
      { src: `${BASE}/gifs/TakumiAE86.gif`, alt: 'Takumi AE86' },
    ],
    screenshots: [
      { src: `${BASE}/screenshots/roster.png`, alt: 'Car roster' },
      { src: `${BASE}/screenshots/office.png`, alt: 'Office interior' },
      { src: `${BASE}/screenshots/mcd.png`,    alt: "McDonald's build" },
    ],
    tags: ['Minecraft', 'OptiFine CEM', 'Asset Design', 'Community'],
  },
]
