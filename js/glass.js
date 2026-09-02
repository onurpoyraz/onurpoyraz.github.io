/* ============================================================
   glass.js — the material layer

   Two jobs:
     1. Specular tracking. Every .glass element gets --mx/--my so its
        highlight follows the pointer, the way a real lens catches a
        light source as you move past it.
     2. The hero forecast. A live posterior: sample paths that agree
        on the left of the "now" line and fan into a widening credible
        band on the right. The band is the real thing — the model's
        mean +/- the measured half-width of its own marginal at LEVEL,
        with the paths drawn from that same model — because a page about
        calibration should not mislabel a picture. The backing store follows devicePixelRatio
        (capped at 2) so the strokes stay crisp on retina panels, and
        the paths are drawn as Catmull-Rom splines rather than a
        polyline so the curvature survives the higher resolution.

   Both no-op under prefers-reduced-motion: the canvas still draws,
   it just stops advancing.
   ============================================================ */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. Specular tracking ---------- */
  (function specular() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    let pending = false;
    let px = 0, py = 0;

    function paint() {
      pending = false;
      for (const el of document.querySelectorAll('.glass')) {
        const r = el.getBoundingClientRect();
        // Skip anything off screen — no point costing a layout read.
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        el.style.setProperty('--mx', ((px - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--my', ((py - r.top) / r.height) * 100 + '%');
      }
    }

    window.addEventListener('pointermove', (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!pending) {
        pending = true;
        requestAnimationFrame(paint);
      }
    }, { passive: true });
  })();

  /* ---------- 2. Hero forecast canvas ---------- */
  (function forecast() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const MAX_DPR = 2;             // beyond 2x the extra pixels are invisible
    /* --- verified:constants --- scripts/verify-credible-band.js reads
       everything between this marker and verified:end, then re-derives
       Z from it. Keep the markers in place. */
    const NOW = 0.42;              // x fraction where forecast begins
    const PATHS = 7;               // posterior sample paths
    const K = 12;                  // spectral components per path
    const SIG_OBS = 0.02;          // posterior sd over the observed stretch
    const SIG_FAR = 0.55;          // posterior sd at the forecast horizon

    /* The credible level the band advertises, and the half-width of the
       noise process's central interval at that level, in units of its sd.

       Z is measured, never assumed. The process is not Gaussian — a sum
       of K random-phase cosines is platykurtic (kurtosis 2.77 at K = 12),
       short in the tails and full in the shoulders — and the sign of the
       error against a normal flips with the level: at 95% the true
       interval is 0.86% narrower than 1.95996, at 90% it is 0.30% wider
       than 1.64485. Measured off this exact spectrum with 3e7 Monte Carlo
       samples: q(5%) = -1.64956, q(95%) = +1.64978.

       Changing LEVEL, K, FREQ or the weighting invalidates Z. Run
       scripts/verify-credible-band.js; it prints the value to paste here,
       and it also checks that the hero legend still names the right
       number. */
    const LEVEL = 0.90;
    const Z = 1.6498;
    /* --- verified:end --- */
    // w/h are CSS pixels; the context is scaled so all drawing below
    // can stay in CSS units regardless of the panel's pixel density.
    let w = 0, h = 0, t = 0, raf = null, segments = 96, band = null;

    /** Read the live theme colors so the canvas re-tints with the page.
     *
     *  WebKit hands back any trailing same-line comment as part of the
     *  value ("#2ee6c0;  /* mint *\/"), and addColorStop throws a
     *  SyntaxError on it, which kills the whole canvas. Strip anything
     *  after the colour and fall back to a literal if the token is
     *  missing or unparseable. */
    const FALLBACK = { c1: '#2ee6c0', c2: '#4c86ff', c3: '#ef4e9b', c4: '#ffb03a' };

    function readColor(styles, name) {
      const raw = styles.getPropertyValue(name);
      if (!raw) return FALLBACK[name.slice(2)];
      const clean = raw.split('/*')[0].replace(/;/g, '').trim();
      return /^(#|rgb|hsl|color\()/i.test(clean) ? clean : FALLBACK[name.slice(2)];
    }

    function palette() {
      const s = getComputedStyle(document.documentElement);
      return {
        c1: readColor(s, '--c1'),
        c2: readColor(s, '--c2'),
        c3: readColor(s, '--c3'),
        c4: readColor(s, '--c4')
      };
    }
    let pal = palette();

    /** The band gradient only depends on width and palette, so build it
     *  once per resize/theme change instead of once per frame. */
    function makeBand() {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, pal.c2);
      g.addColorStop(NOW, pal.c1);
      g.addColorStop(1, pal.c3);
      band = g;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Enough samples that the spline has real curvature to follow,
      // without paying for a control point every pixel.
      segments = Math.max(64, Math.min(256, Math.round(w / 10)));
      makeBand();
      draw();
    }

    /* ---- the model the picture is actually drawing ----
       Each sample path is  mean(x) + sigma(x) * noise(x),  where noise is
       a random-phase spectral process with mean 0 and variance exactly 1
       at every x. That makes the marginal at each x a known distribution,
       which is what lets the band be a real LEVEL interval (mean +/- Z *
       sigma) instead of a shape drawn around whichever paths happened to
       land furthest out. */

    /* --- verified:model --- */
    // Frequencies with squared-exponential weights: low frequencies carry
    // most of the power, so paths undulate rather than buzz. Normalising
    // to sum(W^2) = 2 is what pins Var[noise] to exactly 1, because each
    // cosine of a uniform phase contributes W^2 / 2.
    const FREQ = [], W = [];
    for (let k = 0; k < K; k++) FREQ.push(1.1 + (12 - 1.1) * k / (K - 1));
    {
      const raw = FREQ.map((f) => Math.exp(-(f * f) / 64));
      const norm = Math.sqrt(2 / raw.reduce((a, v) => a + v * v, 0));
      for (const v of raw) W.push(v * norm);
    }

    /** Deterministic hash -> [0, 1). Phases have to be decorrelated for
     *  the variance identity to hold, but they should not be re-rolled on
     *  every load: the hero draws the same posterior every time. */
    function rand01(n) {
      let x = (n + 0x9e3779b9) | 0;
      x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
      x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
      x ^= x >>> 15;
      return (x >>> 0) / 4294967296;
    }

    // Per-path phase offsets, and the rate each phase drifts with time.
    // Drifting the phases animates the paths without touching the
    // marginal law, so the band stays exact on every frame.
    const PHASE = [], DRIFT = [];
    for (let p = 0; p < PATHS; p++) {
      const ph = [], dr = [];
      for (let k = 0; k < K; k++) {
        ph.push(rand01(p * 101 + k * 17) * Math.PI * 2);
        dr.push((0.3 + rand01(p * 211 + k * 53 + 7) * 0.9) * (k % 2 ? -1 : 1));
      }
      PHASE.push(ph);
      DRIFT.push(dr);
    }

    /** The posterior mean: the trend the data supports, carried forward. */
    function mean(x, time) {
      return Math.sin(x * 2.4 + time * 0.5) * 0.34
           + Math.sin(x * 5.3 - time * 0.8) * 0.08;
    }

    /** Posterior sd: tight over the observed stretch, opening up across
     *  the forecast horizon. */
    function sigma(x) {
      const ahead = Math.max(0, (x - NOW) / (1 - NOW));
      return SIG_OBS + (SIG_FAR - SIG_OBS) * Math.pow(ahead, 1.5);
    }

    /** Standardised noise for one path: mean 0, variance 1, every x. */
    function noise(x, time, p) {
      const ph = PHASE[p], dr = DRIFT[p];
      let v = 0;
      for (let k = 0; k < K; k++) {
        v += W[k] * Math.cos(FREQ[k] * x + ph[k] + dr[k] * time);
      }
      return v;
    }

    /** Sample a curve of the canvas across the full width. */
    function curve(fn, time) {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const x = i / segments;
        pts.push([x * w, h * 0.5 + fn(x, time) * h * 0.3]);
      }
      return pts;
    }

    const samplePath = (p) => (x, time) => mean(x, time) + sigma(x) * noise(x, time, p);
    const bandEdge = (side) => (x, time) => mean(x, time) + side * Z * sigma(x);
    /* --- verified:end --- */

    /** Trace pts as a Catmull-Rom spline converted to cubic beziers.
     *  A polyline through the same points reads as faceted once the
     *  stroke is sharp; this keeps the curve smooth at any resolution.
     *  `reverse` walks the array backwards, which the band needs for
     *  its return edge. */
    function trace(pts, reverse) {
      const n = pts.length;
      const at = (i) => pts[reverse ? n - 1 - i : i];
      for (let i = 0; i < n - 1; i++) {
        const p0 = at(Math.max(0, i - 1));
        const p1 = at(i);
        const p2 = at(i + 1);
        const p3 = at(Math.min(n - 1, i + 2));
        ctx.bezierCurveTo(
          p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
          p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
          p2[0], p2[1]
        );
      }
    }

    function stroke(pts, color, width, alpha) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      trace(pts, false);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function draw() {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      // The credible band: mean +/- Z * sd, straight off the model.
      // Sample paths are drawn from that same model, so one point in ten
      // falls outside at LEVEL = 0.9 — a path grazing the edge is the
      // band being honest, not a bug.
      const hi = curve(bandEdge(+1), t);
      const lo = curve(bandEdge(-1), t);
      ctx.beginPath();
      ctx.moveTo(hi[0][0], hi[0][1]);
      trace(hi, false);
      ctx.lineTo(lo[lo.length - 1][0], lo[lo.length - 1][1]);
      trace(lo, true);
      ctx.closePath();
      if (!band) makeBand();
      ctx.fillStyle = band;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Posterior sample paths.
      for (let i = 0; i < PATHS; i++) {
        stroke(curve(samplePath(i), t), i % 2 ? pal.c1 : pal.c2, 1.5, 0.32);
      }

      // Posterior mean, drawn brighter — the number you would report.
      // This is the model's mean, not one of the draws.
      stroke(curve(mean, t), pal.c1, 3, 0.75);

      // The "now" boundary: everything left is observed, right is forecast.
      ctx.beginPath();
      ctx.setLineDash([4, 7]);
      ctx.moveTo(w * NOW, h * 0.3);
      ctx.lineTo(w * NOW, h * 0.7);
      ctx.strokeStyle = pal.c4;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    function tick() {
      t += 0.006;
      // One throwing frame must not take the whole animation down with it
      // (a bad colour token used to kill the canvas outright in WebKit).
      try {
        draw();
      } catch (e) {
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (raf || reduced.matches) return;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    // Only animate while the hero is actually on screen.
    const hero = canvas.closest('section');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });

    reduced.addEventListener('change', () => (reduced.matches ? stop() : start()));

    // Re-read the palette whenever the theme attribute flips.
    new MutationObserver(() => {
      pal = palette();
      makeBand();
      draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let rt;
    function scheduleResize() {
      clearTimeout(rt);
      rt = setTimeout(resize, 150);
    }
    window.addEventListener('resize', scheduleResize);

    // Moving the window to a panel with a different pixel density does
    // not fire resize, so watch the resolution query directly.
    (function watchDpr() {
      const mq = window.matchMedia(
        `(resolution: ${window.devicePixelRatio || 1}dppx)`
      );
      const onChange = () => {
        resize();
        watchDpr();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
    })();

    resize();
  })();
})();
