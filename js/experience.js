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

   Anywhere, not just Experience, because the M.Sc. degree is a lane
   too: the Borusan and BKM engagements were done inside it, and without
   its bar underneath them they read as unrelated jobs. It is the one
   Education entry carrying the attributes.

   A lane can also come from a single .work-card rather than a whole
   role, for a role that held several separate pieces of work: the
   consulting entry is one position but two engagements with a gap
   between them, and one bar across both would paper the gap over. Put
   the attributes on the cards and leave data-start off the role — the
   cards inherit its data-kind. Doing both would draw the role and its
   own children as three competing lanes, so a role that has dated cards
   is dropped from the chart itself.

   Two kinds, two colours: 'research' is the two degrees, 'industry' is
   every paid position and university-industry engagement. Lanes are
   ordered by when they ended, then longest first, which is what puts
   each degree directly above the work done inside it — the containment
   the chart exists to show.
   ============================================================ */

(function experienceChart() {
  const mount = document.getElementById('experience-chart');
  if (!mount) return;

  const items = [...document.querySelectorAll('main [data-start]')]
    // A role that delegates its bars to its cards must not also draw one
    // of its own; see the note above.
    .filter((el) => !el.querySelector('[data-start]'));
  if (!items.length) return;

  /* Time is measured in fractional years, which is all the precision a
     bar a few pixels wide can carry. `at` is the first instant of the
     period named: "2019-08" is the start of that month, a bare "2019"
     the start of that year. `after` is the first instant past it, which
     is what makes an end date inclusive — "2019-06" runs to the start
     of July, "2019" to the start of 2020. Both shapes are accepted
     because the month is the finer of the two, not the required one. */
  /* Validated by shape rather than by whether the arithmetic happens to
     produce a number: "2019-xx" and an empty attribute both divide out
     to something finite, and a silently misplaced bar is worse than a
     missing one. Anything that is not YYYY or YYYY-MM is NaN here, and
     the filter below reports it. A one-digit month is allowed through —
     rejecting "2019-5" would be pedantry, not a caught mistake. */
  const parse = (ym) => {
    const m = /^(\d{4})(?:-(0?[1-9]|1[0-2]))?$/.exec(String(ym).trim());
    return m ? { year: +m[1], month: m[2] ? +m[2] : null } : null;
  };
  const at = (ym) => {
    const p = parse(ym);
    return p ? p.year + (p.month ? (p.month - 1) / 12 : 0) : NaN;
  };
  const after = (ym) => {
    const p = parse(ym);
    return p ? at(ym) + (p.month ? 1 / 12 : 1) : NaN;
  };
  const today = (() => {
    const d = new Date();
    return d.getFullYear() + (d.getMonth() + d.getDate() / 31) / 12;
  })();

  /* Each of these reads the role's version first and the work card's
     second, because a role element contains its cards and would other-
     wise match their tags on the way past. closest() for the kind, so a
     card with no kind of its own inherits the role's. */
  const pick = (el, ...sels) => {
    for (const sel of sels) {
      const hit = el.querySelector(sel);
      if (hit) return hit.textContent.trim();
    }
    return '';
  };

  const dated = items.map((el) => {
    const ongoing = !el.dataset.end;
    const kind = el.closest('[data-kind]')?.dataset.kind;
    const role = pick(el, '.timeline-role', 'h4');
    return {
      id: el.id,
      kind: kind === 'industry' ? 'industry' : 'research',
      text: el.dataset.short || pick(el, '.timeline-org') || role,
      role,
      when: pick(el, '.timeline-date', '.work-when'),
      start: at(el.dataset.start),
      end: ongoing ? today : after(el.dataset.end),
      ongoing
    };
  });

  /* A typo in a date would otherwise place a bar at NaN%, which the
     browser drops silently — the lane renders as an empty row and the
     role just looks missing. Say so instead. */
  const rows = dated.filter((r) => {
    const ok = Number.isFinite(r.start) && Number.isFinite(r.end);
    if (!ok) console.warn(`experience chart: unparseable date on #${r.id}, lane skipped`);
    return ok;
  });
  if (!rows.length) return;

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
  // Hovering either half of a lane lights the other, which is how you
  // tell which card a bar belongs to without reading the dates twice.
  // The target is whatever carried the dates — a role, or one card.
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
