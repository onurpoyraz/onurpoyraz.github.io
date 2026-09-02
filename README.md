# onurpoyraz.github.io

Personal webpage — plain HTML, CSS, and JavaScript. No build step, no frameworks, no dependencies.

## Quick start

Open `index.html` in a browser. That is the whole workflow — the page fetches nothing at runtime, so it renders identically from disk and from a server.

To preview it over HTTP anyway (closer to how GitHub Pages serves it), this repo uses [uv](https://docs.astral.sh/uv/) to pin the Python version for a local dev server. Python has no runtime dependencies here — only the standard-library HTTP server — the pinned toolchain just keeps the workflow reproducible.

```bash
# One-time: create the virtualenv and resolve (will install the pinned Python if missing)
uv sync

# Run the dev server
uv run python -m http.server 8000
# then visit http://localhost:8000
```

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
│   ├── themes.css          # Palette + glass material tokens (edit to re-theme)
│   └── style.css           # Layout, typography, components, animations
├── js/
│   ├── glass.js            # Glass specular tracking + the hero forecast canvas
│   ├── experience.js       # Builds the overlap map from the Experience cards
│   ├── main.js             # Theme toggle, scroll-spy, reveal animations
│   └── publications.js     # Parses the inline BibTeX block, renders the list
├── assets/
│   ├── industry.pdf         # Industry CV — linked from the hero "Industry CV" button
│   ├── academic.pdf        # Academic CV — linked from the hero "Academic CV" button
│   ├── photo.jpg           # Profile photo shown in the hero
│   └── favicon.svg         # Browser tab icon
├── scripts/
│   └── verify-credible-band.js  # Checks the hero band really is a 95% band
├── pyproject.toml          # Pins Python version for the dev server (uv)
├── uv.lock                 # uv lockfile — commit this for reproducibility
└── README.md               # You are here
```

## How to edit common things

All content edits happen in `index.html`. You do not need to touch the JS.

### Change your bio / About text
Edit the `<section id="about">` block in `index.html`.

### Add or change a job in Experience
Edit `<section id="experience">`. Each job is one `<li class="timeline-item">` block. Copy an existing one and update the dates, role, org, and bullet points.

Above the cards sits an **overlap map** — a shared time axis with one lane per role, so concurrent work (the Aalto–Nokia workstream inside the Ph.D., the BKM engagement alongside DeepC) reads as concurrent instead of as a sequence. `js/experience.js` builds it from the cards themselves, so a new job appears in it automatically as long as the `<li>` carries these attributes:

```html
<li class="timeline-item reveal"
    id="exp-something"        <!-- anchor the chart bar links to; must be unique -->
    data-start="2025-03"      <!-- YYYY-MM, inclusive -->
    data-end="2025-11"        <!-- YYYY-MM, inclusive; OMIT ENTIRELY if ongoing -->
    data-kind="industry"      <!-- industry | research — picks the bar colour -->
    data-short="Some Org">    <!-- short lane label; falls back to the org line -->
```

A role with no `data-end` is drawn as ongoing: its bar runs to today and fades out rather than stopping, and "today" is computed at page load, so nothing needs updating as time passes. A card without `data-start` is simply left out of the chart. The chart hides itself if the script does not run.

### Add or change an education entry
Same pattern as Experience, inside `<section id="education">`.

### Add a publication
Append a BibTeX entry to the `<script type="application/x-bibtex" id="publications-bib">` block at the bottom of `<section id="publications">` in `index.html`. It holds plain BibTeX, so entries can be pasted straight in from a `.bib` file or a publisher's "cite" button. Supported entry types are `@article` (rendered as "Journal") and `@inproceedings` (rendered as "Conference"). Common fields:

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
- The BibTeX lives inline rather than in a fetched `.bib` file because browsers refuse to read a sibling file over `file://` — fetching it meant the Publications section stayed empty whenever the page was opened straight from disk.

### Edit or add a project
Edit `<section id="projects">`. Each project is a `<article class="project-card">` with a title, description, and a list of `<span>` tags inside `<div class="project-tags">`.

### Change your name / tagline / photo
Edit `<section id="hero">` in `index.html`. Replace `assets/photo.jpg` to change the photo (same filename, or update the `<img src>` attribute).

### Change your CV
Two CVs are published: `assets/industry.pdf` (industry) and `assets/academic.pdf` (academic). Replace either file with a new one of the same name; both are linked from the hero.

### Change social / contact links
Hero section and Contact section in `index.html` both have link lists. Search for `github.com/onurpoyraz` to find them quickly.

### Change colors (theme)
Edit `css/themes.css`. The `:root` block defines light mode; the `[data-theme='dark']` block defines dark mode; a `prefers-color-scheme: dark` block mirrors the dark values so the theme is right before JS runs.

- `--accent` re-tints links, active states, and buttons.
- `--c1`…`--c4` are the four mixture-component colors. They drive the hero forecast canvas and the ambient mesh, so changing them changes the whole background.
- The `--glass-*` tokens control the material: fill opacity, rim brightness, blur radius, saturation, and shadow.

### The glass material
Add `class="glass"` to any element to make it glass, plus `glass-capsule` for a pill shape and `glass-interactive` for the hover lift. The rule the design follows: **glass is the control layer, content is the ground** — things you click are glass, things you read sit on a plain frosted slab so the text stays crisp.

### The Experience overlap map
`js/experience.js` reads the cards and draws the lanes; the styles are the `.exp-*` rules in `css/style.css`. Bar colours come from `--c1` (research) and `--c2` (industry), the dashed "today" marker from `--c4` — the same tokens the hero canvas uses, so re-theming moves both together. `--exp-ink` in `css/themes.css` sets how solid the bars are; the light theme needs more of it than the dark one to hold contrast against a pale slab. Hovering a lane lights its card and vice versa.

### The hero animation
`js/glass.js` draws it. `NOW` sets where the forecast boundary sits, `PATHS` how many posterior samples are drawn, and `MAX_DPR` caps the backing-store resolution (the canvas follows `devicePixelRatio` up to that cap, so the strokes stay sharp on retina panels without paying for pixels nobody can see). It pauses when the hero scrolls away, when the tab is hidden, and when the visitor prefers reduced motion.

The legend under it claims a **95% credible band**, and the band really is one. Each sample path is `mean(x) + sigma(x) * noise(x)`, where `noise` is a random-phase spectral process — `K` cosines whose weights are normalised so that `sum(W^2) = 2`, which makes its variance exactly 1 at every `x`. Because the marginal is then a known distribution, the band can be drawn as `mean ± Z95 * sigma` rather than as a shape wrapped around whichever paths happened to land furthest out, and the paths are draws from that same distribution — so about one point in twenty falls outside the band, as it should.

`Z95 = 1.9432` is **not** the Gaussian 1.95996: a sum of 12 random-phase cosines is slightly platykurtic (kurtosis ≈ 2.77), so its central 95% interval is about 0.9% narrower than a normal's. `SIG_OBS` and `SIG_FAR` set how tight the posterior is over the observed stretch and how wide it opens at the horizon; they control the size of the fan, not its correctness.

If you change `K`, `FREQ` or the weighting, `Z95` goes stale — so it is checked rather than trusted:

```bash
node scripts/verify-credible-band.js      # ~5s, needs node, no packages
```

It reads the model out of `js/glass.js` (the blocks between the `verified:` markers) and runs *that* code rather than a copy, so the check cannot drift away from the drawing. It re-derives `Z95` by Monte Carlo, measures what fraction of sample paths actually land inside the band as drawn, and confirms the "posterior mean" line is the model's mean rather than one more draw. It exits non-zero and prints the correct `Z95` if anything is off.

### Tune animations / layout
Layout, spacing, and animations are in `css/style.css`. Section boundaries inside that file are marked with banner comments (e.g. `/* HERO */`, `/* TIMELINE */`).

### Add a new section
1. Add a `<section id="yoursection">` block in `index.html`.
2. Add a matching `<li><a href="#yoursection" class="nav-link"><span>Your Section</span></a></li>` to the `<nav class="nav-rail">`, and `<li><a href="#yoursection" class="nav-link" aria-label="Your Section"></a></li>` to the `<nav class="nav-dock">`.
3. Wrap any elements you want to animate-in on scroll with `class="reveal"`.

No JS changes needed — scroll-spy picks up any `section[id]` automatically.

## Browser support

Modern evergreen browsers (Chrome, Safari, Firefox, Edge). Uses CSS variables, IntersectionObserver, and MutationObserver — all widely supported since 2019+.

## Accessibility notes

- Color contrast meets WCAG AA in both themes.
- Reduced motion is respected: `@media (prefers-reduced-motion: reduce)` disables reveal animations and smooth scroll.
- Theme toggle and mobile menu have ARIA labels and `aria-expanded` states.

## License

Content (text, CV, photos) © Onur Poyraz. Code is free to reuse for your own personal site.
