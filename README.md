# portfolio

Personal portfolio website built with Vite + React.

## Stack

- **Vite 5** + **React 18**
- Custom **Monocraft** font (pixel/monospace) with Nerd Fonts patched variant for icons
- CSS custom properties for theming (NixOS-inspired dark navy + cyan palette)
- IntersectionObserver for scroll-triggered fade-in animations and active nav tracking
- Pixel-art snow effect with NixOS colorscheme

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build locally
```

## Project structure

```
src/
  components/
    Navbar.jsx        # sticky nav with active section tracking + mobile menu
    Hero.jsx          # intro with braille ASCII art
    About.jsx         # education + background
    Projects.jsx      # splits projects into featured (large card) + grid layout
    ProjectCard.jsx   # FeaturedCard + ProjectCard components with shared sub-components
    Skills.jsx        # skill groups with Nerd Font icons per skill
    Other.jsx         # other projects, data-driven from src/data/other.js
    Contact.jsx       # contact links, data-driven from src/data/contact.js
    FadeIn.jsx        # scroll-triggered fade-up wrapper
    Snow.jsx          # pixel-art snow particles
    SnowPile.jsx      # pixel-art snow pile at bottom of page
  data/
    projects.js       # all main project entries (title, bullets, tech, links, images)
    skills.js         # skill groups with per-skill Nerd Font icon codepoints
    about.js          # coursework list
    nav.js            # navbar link definitions
    hero.js           # role text, bio copy, current project pointer
    contact.js        # email / LinkedIn / GitHub entries
    other.js          # "other projects" entries (Garage32, future additions)
  index.css           # global theme variables, @font-face, scanline overlay
  App.jsx
public/
  fonts/              # Monocraft TTF + MonocraftNF.ttf (Nerd Fonts patched)
  avatar.jpg
  favicon.ico
  cursor.cur
  Jorge_Manuel_Torre_Resume.pdf
```

## Adding content

All site content lives in `src/data/` — no JSX editing required for updates:

- **New project** → add an entry to `src/data/projects.js`. Set `featured: true` to give it the large two-column card layout.
- **New skill** → add `{ name, icon }` to the relevant group in `src/data/skills.js`. `icon` is a Nerd Font unicode codepoint (e.g. `'\ue7ba'`).
- **New "other" project** → add an entry to `src/data/other.js`.
- **Contact links** → edit `src/data/contact.js`.

## Project layout

The Projects section uses two layouts driven by the `featured` flag in `src/data/projects.js`:

- **Featured card** — full-width, two-column (content left, image sticky right)
- **Grid cards** — 2-column grid of compact cards, 1-column on mobile

## Fonts

Uses [Monocraft](https://github.com/IdreesInc/Monocraft) for body/mono text and a Nerd Fonts patched variant (`MonocraftNF.ttf`) for iconography. The patched `.ttf` was extracted from the `.ttc` bundle using Python's `fonttools`:

```python
from fontTools.ttLib.ttCollection import TTCollection
ttc = TTCollection('Monocraft-nerd-fonts-patched.ttc')
ttc.fonts[0].save('MonocraftNF.ttf')
```
