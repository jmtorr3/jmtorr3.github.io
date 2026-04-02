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
    Navbar.jsx      # sticky nav with active section tracking + mobile menu
    Hero.jsx        # intro with braille ASCII art
    About.jsx       # education + background
    Projects.jsx    # featured projects with images/GIFs
    Skills.jsx      # skill groups with Nerd Font icons
    Other.jsx       # other projects (Garage32 texture pack)
    Contact.jsx     # contact links
    FadeIn.jsx      # scroll-triggered fade-up wrapper
    Snow.jsx        # pixel-art snow particles
  index.css         # global theme variables + @font-face declarations
  App.jsx
public/
  fonts/            # Monocraft TTF + MonocraftNF.ttf (Nerd Fonts patched)
  avatar.jpg
  favicon.ico
  Jorge_Manuel_Torre_Resume.pdf
```

## Fonts

Uses [Monocraft](https://github.com/IdreesInc/Monocraft) for body/mono text and a Nerd Fonts patched variant (`MonocraftNF.ttf`) for iconography. The patched `.ttf` was extracted from the `.ttc` bundle using Python's `fonttools`:

```python
from fontTools.ttLib.ttCollection import TTCollection
ttc = TTCollection('Monocraft-nerd-fonts-patched.ttc')
ttc.fonts[0].save('MonocraftNF.ttf')
```
