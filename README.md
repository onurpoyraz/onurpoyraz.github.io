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
│   ├── experience.js       # Builds the overlap map from the Experience + M.Sc. cards
│   ├── main.js             # Theme toggle, scroll-spy, reveal animations
│   └── publications.js     # Parses the inline BibTeX block, renders the list
├── assets/
│   ├── industry.pdf         # Industry CV — linked from the hero "Industry CV" button
│   ├── academic.pdf        # Academic CV — linked from the hero "Academic CV" button
│   ├── photo.jpg           # Profile photo shown in the hero
│   ├── og-card.png         # Link-preview image — generated, do not hand-edit
│   └── favicon.svg         # Browser tab icon
├── scripts/
│   ├── verify-credible-band.js  # Checks the hero band really is a 90% band
│   ├── og-card.html             # Source layout for the link-preview image
│   └── render-og-card.sh        # Renders that layout to assets/og-card.png
├── pyproject.toml          # Pins Python version for the dev server (uv)
├── uv.lock                 # uv lockfile — commit this for reproducibility
└── README.md               # You are here
```

## How to edit common things

All content edits happen in `index.html`. You do not need to touch the JS.

### Change your bio / About text
Edit the `<section id="about">` block in `index.html`.

### Add or change a job in Experience
Edit `<section id="experience">`. Each job is one `<li class="timeline-item">` block. Copy an existing one and update the dates, role, org, and work cards.

**Work cards, not bullets.** What a role produced is written as a grid of small boxes rather than a bullet list:

```html
<div class="work-grid">
  <article class="work-card">
    <h4>What the work was</h4>
    <p>One or two sentences. No more — the keywords carry the rest.</p>
    <div class="work-foot">
      <div class="work-tags"><span>Keyword</span><span>Keyword</span></div>
      <a class="work-cite" href="#pub-shortkey2025something"
         title="Full paper title — Venue, Year">Venue ’25</a>
    </div>
  </article>
</div>
```

The `work-cite` link is optional and only belongs on work that became something citable. It comes in two forms, and the arrow in front of it is what tells them apart:

- **A paper on this page** — `href="#pub-<bibtex key>"`, using the key of the entry in the Publications block below. Rendered with a `↓`. Clicking it clears any active publication filter, scrolls to that entry, and flashes it. Rename a BibTeX key and these links break silently, so grep for the old key before you do.
- **Something off-site** — add `class="work-cite is-external"` plus `target="_blank" rel="noopener"` and link straight out. Rendered with a `↗`. This is what the two advised M.Sc. theses under Aalto–Nokia use. Put the full title, venue and year in the `title` attribute; the visible label stays short.

```html
<a class="work-cite is-external" href="https://aaltodoc.aalto.fi/items/…"
   target="_blank" rel="noopener"
   title="Firstname Lastname, “Full title” — M.Sc. thesis, Aalto University, 2025.">F. Lastname, M.Sc. ’25</a>
```

A card can carry one `<p class="work-when">` under its heading, naming who the work was for and when — but **only** when the card covers part of its role rather than all of it. The M.Sc. entry is the case it exists for: two engagements, Borusan then BKM, one after the other inside one position. A card whose span is simply its role's span must not have one, or the header dates get repeated.

A role can also carry one `<p class="timeline-lede">` between the org line and the grid, for something true of the job that no single card can hold — Aalto–Nokia uses it to say he led that side and advised the theses. Keep it to one sentence and to one or two roles; the cards exist because this section had too much prose.

This is where the page's Projects section went. It described the same six pieces of work the Experience bullets described and the Publications list described a third time; the cards keep the part that was worth keeping — the keywords — and the citation replaces the third telling with a link.

Above the cards sits an **overlap map** — a shared time axis, one lane per entry, so work that ran at the same time (the Aalto–Nokia workstream inside the Ph.D., DeepC alongside the BKM engagement) reads as concurrent instead of as a sequence. `js/experience.js` builds it from the cards themselves, so a new job appears in it automatically as long as the `<li>` carries these attributes:

```html
<li class="timeline-item reveal"
    id="exp-something"        <!-- anchor the chart bar links to; must be unique -->
    data-start="2025-03"      <!-- YYYY-MM, inclusive -->
    data-end="2025-11"        <!-- YYYY-MM, inclusive; OMIT ENTIRELY if ongoing -->
    data-kind="industry"      <!-- research | industry — picks the bar and card colour -->
    data-short="Some Org">    <!-- short lane label; falls back to the org line -->
```

`data-kind="research"` (mint) is the two degrees; `data-kind="industry"` (cobalt) is every paid position and university–industry engagement. The same attribute also tints the card below — its spine, date, keyword chips and citation hover — so a cobalt bar leads down to a cobalt-keyed card. Lanes are ordered by when they ended, longest first on a tie, which is what lands each degree directly above the work done inside it.

**A lane can also come from a single work card**, for a role that held several separate pieces of work. The M.Sc. entry is one position but two engagements with a gap between them, and a single bar across both would paper the gap over — so the attributes go on the `<article class="work-card">` elements instead, which need an `id` of their own to be linked to:

```html
<article class="work-card" id="work-borusan"
         data-start="2017-02" data-end="2018-04" data-short="Borusan R&D">
```

Leave `data-start` off the `<li>` in that case and keep only its `data-kind`, which the cards inherit. Putting dates on both would draw a role and its own children as three competing lanes, so a role containing a dated card is dropped from the chart itself.

A role with no `data-end` is drawn as ongoing: its bar runs to today and fades out rather than stopping, and "today" is computed at page load, so nothing needs updating as time passes. A card without `data-start` is simply left out of the chart. The chart hides itself if the script does not run.

### Add or change an education entry
Same pattern as Experience, inside `<section id="education">`.

One education entry — the M.Sc. — also carries the chart attributes, because the Borusan and BKM engagements were done inside that degree and without its bar underneath them they read as unrelated jobs. The Ph.D. deliberately does **not**: its bar comes from the Ph.D. Researcher card in Experience, which is where that work is described. Add the attributes to an education entry only when it frames work shown elsewhere on the chart.

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
- Each entry is rendered with `id="pub-<bibtex key>"`, which is what the `work-cite` links in Experience point at.
- The BibTeX lives inline rather than in a fetched `.bib` file because browsers refuse to read a sibling file over `file://` — fetching it meant the Publications section stayed empty whenever the page was opened straight from disk.

### Change your name / tagline / photo
Edit `<section id="hero">` in `index.html`. Replace `assets/photo.jpg` to change the photo (same filename, or update the `<img src>` attribute).

### Change your CV
Two CVs are published: `assets/industry.pdf` (industry) and `assets/academic.pdf` (academic). Replace either file with a new one of the same name; both are linked from the hero.

### Change the link preview (Open Graph card)
Most people meet this site as a link — in a LinkedIn post, a Slack message, a DM — rather than by typing the address, so the preview card is seen more often than the page. `assets/og-card.png` is that card, and `index.html` points at it with an **absolute** URL (a relative one fails silently).

The card cannot be a screenshot of the hero taken on the fly: unfurl crawlers do not execute JavaScript, so they can never see a canvas. It is pre-rendered and committed:

```bash
./scripts/render-og-card.sh        # needs Chrome; CHROME=/path/to/chrome to override
```

`scripts/og-card.html` is the layout it shoots. It loads the real `css/themes.css` and the real `js/glass.js`, so the forecast on the card is the forecast the hero draws — re-run the script after changing the palette or the model and the card follows. The copy is deliberately shorter and much larger than the hero's: feeds render the card around 400px wide, where the site's tagline would be unreadable.

Two things to know when you change it:

- **The image carries its own dark background on purpose.** LinkedIn composites cards on white; a transparent or edge-less image reads as a hole in the feed.
- **Previews are cached for about a week.** After deploying a new card, force a refetch with [LinkedIn's Post Inspector](https://www.linkedin.com/post-inspector/) or [Facebook's Sharing Debugger](https://developers.facebook.com/tools/debug/), or rename the file. Slack caches too.

If the site ever moves to its own domain, update `og:url`, `og:image` and `<link rel="canonical">` together — otherwise it keeps advertising the old host.

### Change social / contact links
Hero section and Contact section in `index.html` both have link lists. Search for `github.com/onurpoyraz` to find them quickly.

### Change colors (theme)
Edit `css/themes.css`. The `:root` block defines light mode; the `[data-theme='dark']` block defines dark mode; a `prefers-color-scheme: dark` block mirrors the dark values so the theme is right before JS runs.

- `--accent` re-tints links, active states, and buttons. `--accent-alt` does the same for anything keyed to the *industry* half of Experience.
- `--c1`…`--c4` are the four mixture-component colors. They drive the hero forecast canvas and the ambient mesh, so changing them changes the whole background. `--accent` and `--accent-alt` are the text-safe forms of `--c1` and `--c2`: the raw components are only ever used for graphics, which nobody has to read.
- The `--glass-*` tokens control the material: fill opacity, rim brightness, blur radius, saturation, and shadow.

### The glass material
Add `class="glass"` to any element to make it glass, plus `glass-capsule` for a pill shape and `glass-interactive` for the hover lift. The rule the design follows: **glass is the control layer, content is the ground** — things you click are glass, things you read sit on a plain frosted slab so the text stays crisp.

### The Experience overlap map
`js/experience.js` reads the cards and draws the lanes; the styles are the `.exp-*` rules in `css/style.css`. Bar colours come from `--c1` (research) and `--c2` (industry), the dashed "today" marker from `--c4` — the same tokens the hero canvas uses, so re-theming moves both together. `--exp-ink` in `css/themes.css` sets how solid the bars are; the light theme needs more of it than the dark one to hold contrast against a pale slab. Hovering a lane lights its card and vice versa — and each card carries its lane's colour, through `--item-accent` on `.timeline-item`, so the pairing holds without the pointer.

### The hero animation
`js/glass.js` draws it. `NOW` sets where the forecast boundary sits, `PATHS` how many posterior samples are drawn, and `MAX_DPR` caps the backing-store resolution (the canvas follows `devicePixelRatio` up to that cap, so the strokes stay sharp on retina panels without paying for pixels nobody can see). It pauses when the hero scrolls away, when the tab is hidden, and when the visitor prefers reduced motion.

The legend under it claims a **90% credible band**, and the band really is one. Each sample path is `mean(x) + sigma(x) * noise(x)`, where `noise` is a random-phase spectral process — `K` cosines whose weights are normalised so that `sum(W^2) = 2`, which makes its variance exactly 1 at every `x`. Because the marginal is then a known distribution, the band can be drawn as `mean ± Z * sigma` rather than as a shape wrapped around whichever paths happened to land furthest out, and the paths are draws from that same distribution — so about one point in ten falls outside the band, as it should.

Two constants set the band: `LEVEL = 0.90` is the credible level the legend advertises, and `Z = 1.6498` is the half-width of the process's central interval at that level, in units of its sd.

**`Z` is measured, never assumed.** The process is not Gaussian: a sum of 12 random-phase cosines is platykurtic (kurtosis ≈ 2.77) — short in the tails, full in the shoulders — and the sign of the error against a normal flips with the level. At 95% the true interval is 0.86% *narrower* than 1.95996; at 90% it is 0.30% *wider* than 1.64485. There is no safe rule of thumb here, which is the whole reason the constant is checked.

`SIG_OBS` and `SIG_FAR` set how tight the posterior is over the observed stretch and how wide it opens at the horizon; they scale the fan, not its correctness.

### Changing the credible level, or the process

`Z` goes stale the moment `LEVEL`, `K`, `FREQ` or the weighting changes, so it is checked rather than trusted:

```bash
node scripts/verify-credible-band.js      # ~6s, needs node, no packages
```

It reads the model out of `js/glass.js` (the blocks between the `verified:` markers) and runs *that* code rather than a copy, so the check cannot drift away from the drawing. It re-derives `Z` by Monte Carlo, measures what fraction of sample paths actually land inside the band as drawn, confirms the "posterior mean" line is the model's mean rather than one more draw, and checks that the hero legend in `index.html` names the same level the model is drawing — a correct band under a wrong label is still a lie. It exits non-zero and prints the value to paste if anything is off.

So to move to, say, an 80% band: set `LEVEL = 0.80` in `js/glass.js`, change the legend text in `index.html` to match, run the script, and paste the half-width it prints into `Z`. Run it once more; it should be silent.

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
