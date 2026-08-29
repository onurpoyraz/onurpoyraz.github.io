# onurpoyraz.github.io

Personal webpage — plain HTML, CSS, and JavaScript. No build step, no frameworks, no dependencies.

## Quick start

This repo uses [uv](https://docs.astral.sh/uv/) to pin the Python version used by the local dev server. Python itself has no runtime dependencies — only the standard-library HTTP server — but the pinned toolchain keeps the workflow reproducible.

```bash
# One-time: create the virtualenv and resolve (will install the pinned Python if missing)
uv sync

# Run the dev server
uv run python -m http.server 8000
# then visit http://localhost:8000
```

A server (rather than opening `index.html` directly via `file://`) is needed so the BibTeX file can be loaded by `fetch()`.

## Deployment (GitHub Pages)

1. Create a repo named exactly `onurpoyraz.github.io` on GitHub.
2. Push this directory to its `main` branch.
3. In the repo: **Settings → Pages → Source: Deploy from branch → Branch: main / (root) → Save**.
4. After a minute or two the site is live at `https://onurpoyraz.github.io`.

Every push to `main` redeploys automatically.

## File structure

```
.
├── index.html              # All page content lives here
├── css/
│   ├── themes.css          # Colors for light/dark mode (edit to re-theme)
│   └── style.css           # Layout, typography, components, animations
├── js/
│   ├── main.js             # Theme toggle, scroll-spy, reveal animations, mobile nav
│   └── publications.js     # Loads publications.bib, parses it, renders the list
├── assets/
│   ├── industry.pdf         # Industry CV — linked from the hero "Industry CV" button
│   ├── academic.pdf        # Academic CV — linked from the hero "Academic CV" button
│   ├── photo.jpg           # Profile photo shown in the hero
│   ├── publications.bib    # Source of truth for the Publications section
│   └── favicon.svg         # Browser tab icon
├── pyproject.toml          # Pins Python version for the dev server (uv)
├── uv.lock                 # uv lockfile — commit this for reproducibility
└── README.md               # You are here
```

## How to edit common things

All content edits happen in `index.html` or `assets/publications.bib`. You do not need to touch the JS.

### Change your bio / About text
Edit the `<section id="about">` block in `index.html`.

### Add or change a job in Experience
Edit `<section id="experience">`. Each job is one `<li class="timeline-item">` block. Copy an existing one and update the dates, role, org, and bullet points.

### Add or change an education entry
Same pattern as Experience, inside `<section id="education">`.

### Add a publication
Append a BibTeX entry to `assets/publications.bib`. Supported entry types are `@article` (rendered as "Journal") and `@inproceedings` (rendered as "Conference"). Common fields:

```
@article{shortkey2025something,
  title   = {The paper title},
  author  = {Poyraz, Onur and Lastname, Firstname},
  journal = {Journal Name},
  volume  = {10},
  number  = {2},
  pages   = {1--12},
  year    = {2025},
  doi     = {10.xxxx/yyyy},
  url     = {https://example.com}
}
```

Rendering notes:
- Your name (exactly `Poyraz, Onur`) is bolded/accent-colored automatically.
- If `doi` is set, a DOI link button appears.
- If `url` is set, a generic "Link" button appears. If both `url` and `doi` are set, the "Link" button uses `url`; the "DOI" button always uses `doi`.
- Each entry also has a "BibTeX" button that toggles an inline BibTeX view.
- Publications are grouped by `year`, newest first.

### Edit or add a project
Edit `<section id="projects">`. Each project is a `<article class="project-card">` with a title, description, and a list of `<span>` tags inside `<div class="project-tags">`.

### Change your name / tagline / photo
Edit `<section id="hero">` in `index.html`. Replace `assets/photo.jpg` to change the photo (same filename, or update the `<img src>` attribute).

### Change your CV
Two CVs are published: `assets/industry.pdf` (industry) and `assets/academic.pdf` (academic). Replace either file with a new one of the same name; both are linked from the hero.

### Change social / contact links
Hero section and Contact section in `index.html` both have link lists. Search for `github.com/onurpoyraz` to find them quickly.

### Change colors (theme)
Edit `css/themes.css`. The `:root` block defines light mode; the `[data-theme='dark']` block defines dark mode. The key variable is `--accent` — change it and the entire site re-tints. There is also a `prefers-color-scheme: dark` block that mirrors the dark-mode variables, so the dark theme applies before JS runs on users who prefer dark.

### Tune animations / layout
Layout, spacing, and animations are in `css/style.css`. Section boundaries inside that file are marked with banner comments (e.g. `/* HERO */`, `/* TIMELINE */`).

### Add a new section
1. Add a `<section id="yoursection">` block in `index.html`.
2. Add a matching `<li><a href="#yoursection" class="toc-link">Your Section</a></li>` to **both** the sidebar `<aside class="toc">` and the `<nav class="mobile-nav">`.
3. Wrap any elements you want to animate-in on scroll with `class="reveal"`.

No JS changes needed — scroll-spy picks up any `section[id]` automatically.

## Browser support

Modern evergreen browsers (Chrome, Safari, Firefox, Edge). Uses CSS variables, IntersectionObserver, and `fetch` — all widely supported since 2019+.

## Accessibility notes

- Color contrast meets WCAG AA in both themes.
- Reduced motion is respected: `@media (prefers-reduced-motion: reduce)` disables reveal animations and smooth scroll.
- Theme toggle and mobile menu have ARIA labels and `aria-expanded` states.

## License

Content (text, CV, photos) © Onur Poyraz. Code is free to reuse for your own personal site.
