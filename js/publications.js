/* ============================================================
   publications.js
   Reads the inline BibTeX block from the page, parses it, and
   renders it grouped by year.

   The BibTeX lives in index.html rather than in a fetched .bib
   file: fetch() cannot read a sibling file over file://, so the
   old setup only worked behind a web server. Reading it out of
   the DOM means the page also works opened straight from disk.

   The parser is intentionally minimal — it handles the subset of
   BibTeX we use (entry type, key, and {...}-delimited fields).
   If you add fancier BibTeX features (nested braces in values,
   @string, @preamble, etc.), extend parseBibtex accordingly.
   ============================================================ */

const BIB_ELEMENT = 'publications-bib';
const ME = 'Poyraz, Onur';

/** Parse a .bib string into an array of entry objects. */
function parseBibtex(src) {
  const entries = [];
  const re = /@(\w+)\s*\{\s*([^,]+),([\s\S]*?)\n[ \t]*\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const type = m[1].toLowerCase();
    const key = m[2].trim();
    const body = m[3];
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*,?/g;
    let f;
    while ((f = fieldRe.exec(body)) !== null) {
      fields[f[1].toLowerCase()] = f[2].replace(/\s+/g, ' ').trim();
    }
    entries.push({ type, key, fields });
  }
  return entries;
}

/** Format authors: "Last, First and Last, First" -> "F. Last, F. Last"
 *  Wraps the site owner's name in a <span class="me">.
 *
 *  BibTeX writes a truncated author list as "... and others". That is a
 *  marker, not a person, so it must not go through the initials path —
 *  it used to render literally, as "O. Poyraz, S. Heinonen, others".
 *  It becomes "et al.", attached without a comma the way a citation
 *  reads. */
function formatAuthors(authors) {
  if (!authors) return '';
  const parts = authors.split(/\s+and\s+/);
  const truncated = parts.length > 1 &&
    parts[parts.length - 1].trim().toLowerCase() === 'others';
  const names = (truncated ? parts.slice(0, -1) : parts).map(a => {
    const isMe = a.trim() === ME;
    let display;
    if (a.includes(',')) {
      const [last, first] = a.split(',').map(s => s.trim());
      const initials = first ? first.split(/\s+/).map(w => w[0] + '.').join(' ') : '';
      display = `${initials} ${last}`.trim();
    } else {
      display = a.trim();
    }
    return isMe ? `<span class="me">${display}</span>` : display;
  }).join(', ');
  return truncated ? `${names} et al.` : names;
}

/** Build a link button if a URL/DOI is present. */
function linkButton(label, href) {
  if (!href) return '';
  return `<a class="pub-link glass-interactive" href="${href}" target="_blank" rel="noopener">${label}</a>`;
}

/** Format a venue string from entry fields. */
function formatVenue(e) {
  const f = e.fields;
  if (e.type === 'article') {
    let v = f.journal || '';
    if (f.volume) v += `, ${f.volume}`;
    if (f.number) v += `(${f.number})`;
    if (f.pages) v += `, pp. ${f.pages}`;
    return v;
  }
  if (e.type === 'inproceedings') {
    let v = f.booktitle || '';
    if (f.pages) v += `, pp. ${f.pages}`;
    return v;
  }
  return f.journal || f.booktitle || '';
}

/** Reconstruct a clean BibTeX block for the toggle view. */
function bibtexBlock(e) {
  const fields = Object.entries(e.fields)
    .map(([k, v]) => `  ${k} = {${v}}`)
    .join(',\n');
  return `@${e.type}{${e.key},\n${fields}\n}`;
}

/** Render the publication list, grouped by year. */
function renderPublications(entries) {
  const container = document.getElementById('publications-list');
  if (!container) return;

  entries.sort((a, b) => (b.fields.year || 0) - (a.fields.year || 0));

  const byYear = {};
  for (const e of entries) {
    const y = e.fields.year || 'Unknown';
    (byYear[y] = byYear[y] || []).push(e);
  }

  const years = Object.keys(byYear).sort((a, b) => b - a);

  container.innerHTML = years.map(year => `
    <div class="pub-year-group">
      <div class="pub-year">${year}</div>
      ${byYear[year].map(e => {
        const doi = e.fields.doi ? `https://doi.org/${e.fields.doi}` : null;
        const url = e.fields.url || doi;
        return `
          <article class="publication" data-type="${e.type}">
            <h3 class="pub-title">${e.fields.title || ''}</h3>
            <p class="pub-authors">${formatAuthors(e.fields.author)}</p>
            <p class="pub-venue">${formatVenue(e)}</p>
            <div class="pub-links">
              ${linkButton('Link', url)}
              ${e.fields.doi ? linkButton('DOI', `https://doi.org/${e.fields.doi}`) : ''}
              <button class="pub-link glass-interactive" data-bibtex-toggle>BibTeX</button>
            </div>
            <pre class="pub-bibtex">${bibtexBlock(e)}</pre>
          </article>
        `;
      }).join('')}
    </div>
  `).join('');

  // BibTeX toggle handlers
  container.querySelectorAll('[data-bibtex-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.publication').querySelector('.pub-bibtex');
      block.classList.toggle('open');
    });
  });

  // Filters
  document.querySelectorAll('.pub-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pub-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      container.querySelectorAll('.publication').forEach(pub => {
        pub.style.display = (filter === 'all' || pub.dataset.type === filter) ? '' : 'none';
      });
    });
  });
}

const bib = document.getElementById(BIB_ELEMENT);
if (bib) {
  renderPublications(parseBibtex(bib.textContent));
} else {
  const el = document.getElementById('publications-list');
  if (el) el.innerHTML = `<p class="pub-error">Could not load publications — the #${BIB_ELEMENT} block is missing from the page.</p>`;
}
