/* ============================================================
   glass.js — the material layer

   Two jobs:
     1. Specular tracking. Every .glass element gets --mx/--my so its
        highlight follows the pointer, the way a real lens catches a
        light source as you move past it.
     2. The hero forecast. A live posterior: sample paths that agree
        on the left of the "now" line and fan into a widening credible
        band on the right. The backing store follows devicePixelRatio
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
    const NOW = 0.42;              // x fraction where forecast begins
    const PATHS = 7;               // posterior sample paths
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

    /** A smooth pseudo-GP path: a few incommensurate sines so it never
     *  visibly repeats. Before the "now" line every path collapses onto
     *  the same observed history; after it, the spread opens up. */
    function value(x, seed, time) {
      const wiggle =
        Math.sin(x * 3.1 + time * 0.7 + seed * 2.3) * 0.5 +
        Math.sin(x * 6.7 - time * 0.45 + seed * 5.1) * 0.28 +
        Math.sin(x * 1.6 + time * 0.31 + seed * 1.1) * 0.34;
      // Uncertainty is near-zero on the observed side and grows steeply
      // across the forecast horizon.
      const ahead = Math.max(0, (x - NOW) / (1 - NOW));
      const spread = 0.03 + Math.pow(ahead, 1.5) * 1.0;
      const observed = Math.sin(x * 2.4 + time * 0.5) * 0.34
                     + Math.sin(x * 5.3 - time * 0.8) * 0.08;
      return observed + wiggle * spread;
    }

    function pathPoints(seed, time) {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const x = i / segments;
        pts.push([x * w, h * 0.5 + value(x, seed, time) * h * 0.3]);
      }
      return pts;
    }

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

      // Credible band: the envelope of the extreme sample paths.
      const hi = pathPoints(-3.2, t);
      const lo = pathPoints(3.2, t);
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
        const seed = (i - (PATHS - 1) / 2) * 0.95;
        const pts = pathPoints(seed, t);
        stroke(pts, i % 2 ? pal.c1 : pal.c2, 1.5, 0.32);
      }

      // Posterior mean, drawn brighter — the number you would report.
      stroke(pathPoints(0, t), pal.c1, 3, 0.75);

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
