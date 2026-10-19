export interface Project {
  slug: string
  name: string
  year: number
  tags: string[]
  summary: string
  body: string
  url?: string
}

export const projects: Project[] = [
  {
    slug: 'retro-site',
    name: 'This Website',
    year: 2026,
    tags: ['react', 'three.js', 'glsl'],
    summary: 'A personal site disguised as an old computer.',
    body: 'React + three.js with a port of picoCAD\'s face shading and dither, rendered at 200px tall and scaled up. Click the PC and it boots into a little desktop.',
  },
  {
    slug: 'project-two',
    name: 'Project Two',
    year: 2025,
    tags: ['typescript'],
    summary: 'A short one-line description.',
    body: 'Longer description of the project goes here.',
    url: 'https://example.com',
  },
  {
    slug: 'project-three',
    name: 'Project Three',
    year: 2024,
    tags: ['game', 'lua'],
    summary: 'Another short description.',
    body: 'Longer description of the project goes here.',
  },
]
