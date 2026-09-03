/* ============================================================
   experience.js — the overlap map above the Experience cards

   The cards are a list, so they read as if the roles happened one
   after another. Several of them ran at the same time, and some ran
   inside another: the Aalto–Nokia workstream sat within the Ph.D., the
   Borusan and BKM consultancy ran the length of the M.Sc., and DeepC
   overlapped the BKM half of it while being unrelated to any of it. A
   list cannot show any of that. This draws every entry against one
   shared time axis, a lane each, so what overlapped and what contained
   what is visible at a glance.

   The cards stay the source of truth: every bar is read off the
   data-start / data-end / data-kind / data-short attributes of a
   .timeline-item, anywhere in the page. Add a role to the list and it
   shows up here with no edit. A role with no data-end is ongoing and
   runs to today, so the chart never needs its end date filled in later.

   Anywhere, not just Experience, because the M.Sc. is a lane too: the
   Borusan and BKM engagements were done inside that degree, and without
   its bar underneath them they read as three unrelated jobs. It is the
   one Education entry carrying the attributes.

   Two kinds, two colours: 'research' is the two degrees, 'industry' is
   every paid position and university-industry engagement. Lanes are
   ordered by when they ended, then longest first, which is what puts
   each degree directly above the work done inside it — the containment
   the chart exists to show.
   ============================================================ */

(function experienceChart() {
  const mount = document.getElementById('experience-chart');
  if (!mount) return;

  const items = [...document.querySelectorAll('main .timeline-item[data-start]')];
  if (!items.length) return;

  /* Time is measured in fractional years, which is all the precision a
     bar a few pixels wide can carry. "2019-08" is the first instant of
     that month; an end month is inclusive, so it runs to the first
     instant of the next one. */
  const at = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return y + (m - 1) / 12;
  };
  const today = (() => {
    const d = new Date();
    return d.getFullYear() + (d.getMonth() + d.getDate() / 31) / 12;
  })();

  const rows = items.map((el) => {
    const ongoing = !el.dataset.end;
    return {
      id: el.id,
      kind: el.dataset.kind === 'industry' ? 'industry' : 'research',
      text: el.dataset.short || el.querySelector('.timeline-org').textContent.trim(),
      role: el.querySelector('.timeline-role').textContent.trim(),
      when: el.querySelector('.timeline-date').textContent.trim(),
      start: at(el.dataset.start),
      end: ongoing ? today : at(el.dataset.end) + 1 / 12,
      ongoing
    };
  });

  /* Latest finish first, and on a tie the longer bar first. Document
     order would do for Experience alone, but the M.Sc. arrives from a
     different list and has to be placed by its dates. The rule also
     earns its keep on its own: it lands each degree immediately above
     the roles that ran inside it, so the nesting reads down the page. */
  rows.sort((a, b) => (b.end - a.end) || (a.start - b.start));

  // Pad to whole years so the axis lands on tick marks. The right edge
  // stops at today rather than at the end of the current year — an
  // ongoing bar that stopped short of the edge would read as finished.
  const min = Math.floor(Math.min(...rows.map((r) => r.start)));
  const max = Math.max(today, ...rows.map((r) => r.end));
  const span = max - min;
  const pct = (v) => ((v - min) / span) * 100;

  /* One tick per year while they fit, then every other / every fifth.
     Measured against the track, not the viewport, because the label
     column and the section padding both eat into it. */
  function tickStep(trackPx) {
    const years = Math.ceil(span);
    for (const step of [1, 2, 5]) {
      if ((years / step) * 46 <= trackPx) return step;
    }
    return 5;
  }

  const el = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  };

  // ---- structure -------------------------------------------------
  mount.hidden = false;
  mount.innerHTML = '';

  const axis = el('div', 'exp-axis', mount);
  el('span', 'exp-axis-spacer', axis);
  const ticks = el('div', 'exp-ticks', axis);

  const body = el('div', 'exp-body', mount);
  const lines = el('div', 'exp-lines', body);
  lines.setAttribute('aria-hidden', 'true');
  const lanes = el('ol', 'exp-lanes', body);

  for (const r of rows) {
    const lane = el('li', 'exp-lane', lanes);
    lane.dataset.kind = r.kind;
    lane.dataset.target = r.id;

    const name = el('span', 'exp-name', lane);
    name.textContent = r.text;

    const track = el('span', 'exp-track', lane);
    const bar = el('a', 'exp-bar', track);
    bar.href = `#${r.id}`;
    bar.style.left = pct(r.start) + '%';
    bar.style.width = Math.max(0, pct(r.end) - pct(r.start)) + '%';
    if (r.ongoing) bar.classList.add('is-ongoing');
    bar.setAttribute('aria-label', `${r.role} — ${r.when}`);
    bar.title = `${r.role}\n${r.when}`;
  }

  const legend = el('figcaption', 'exp-legend', mount);
  for (const [cls, text] of [['lg-research', 'research'],
                             ['lg-industry', 'industry'],
                             ['lg-now', 'today']]) {
    el('span', cls, legend).textContent = text;
  }

  // ---- axis + gridlines, redrawn when the tick density changes ----
  let step = null;

  function drawAxis() {
    const track = mount.querySelector('.exp-track');
    if (!track) return;
    const next = tickStep(track.getBoundingClientRect().width);
    if (next === step) return;
    step = next;

    ticks.innerHTML = '';
    lines.innerHTML = '';
    const first = Math.ceil(min / step) * step;
    for (let y = first; y <= max; y += step) {
      const left = pct(y) + '%';
      const t = el('span', 'exp-tick', ticks);
      t.style.left = left;
      t.textContent = y;
      el('span', 'exp-line', lines).style.left = left;
    }

    // The forecast boundary from the hero, reused: everything left of
    // it is on the record, and the ongoing role runs up to it.
    const now = el('span', 'exp-now', lines);
    now.style.left = pct(today) + '%';
  }

  drawAxis();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(drawAxis, 150);
  });

  // ---- cross-highlighting ----------------------------------------
  // Hovering either half of a role lights the other, which is how you
  // tell which bar a card belongs to without reading the dates twice.
  const pair = (lane, on) => {
    lane.classList.toggle('is-lit', on);
    document.getElementById(lane.dataset.target)?.classList.toggle('is-lit', on);
  };

  for (const lane of lanes.children) {
    const card = document.getElementById(lane.dataset.target);
    lane.addEventListener('pointerenter', () => pair(lane, true));
    lane.addEventListener('pointerleave', () => pair(lane, false));
    lane.querySelector('.exp-bar').addEventListener('focus', () => pair(lane, true));
    lane.querySelector('.exp-bar').addEventListener('blur', () => pair(lane, false));
    if (card) {
      card.addEventListener('pointerenter', () => pair(lane, true));
      card.addEventListener('pointerleave', () => pair(lane, false));
    }
  }
})();
