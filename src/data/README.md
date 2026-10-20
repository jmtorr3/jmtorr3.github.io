# Site content

Everything you see on the virtual desktop comes from these files. Edit, save, and the dev server hot-reloads.

| File | Controls |
|---|---|
| `profile.ts` | Name, role (typed out in About Me), location, "open to work" badge, bio, avatar, terminal `user@host` |
| `about.ts` | About Me education card and coursework |
| `projects.ts` | Projects window + `~/projects` in the terminal. `folder: 'other'` puts one in the Other folder |
| `skills.ts` | Skills window categories. `icon` = Nerd Font codepoint (https://www.nerdfonts.com/cheat-sheet) |
| `resume.ts` | The resume variants; PDFs go in `public/resume/` |
| `contact.ts` | Contact window links |
| `blog.ts` | Blog window; set `VITE_BLOG_API_URL` in `.env` to list posts |

Images referenced as `/SOMETHING/file.png` live in `public/SOMETHING/file.png`.

Colors and font: `src/styles/theme.css`.
Which apps exist, their window titles, desktop labels and default sizes: `src/os/apps/registry.ts`.
