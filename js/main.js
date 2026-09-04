/* ============================================================
   main.js
   - Theme toggle (persisted in localStorage)
   - Reveal-on-scroll
   - Scroll-spy: lights the active dot in both the rail and the dock,
     and names the current section in the dock label
   - Copy-to-clipboard for the contact address

   The material and the hero canvas live in glass.js.
   ============================================================ */

(function () {
  const root = document.documentElement;

  /* ---------- Theme ---------- */
  const toggleBtn = document.getElementById('theme-toggle');
  const osDark = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return root.getAttribute('data-theme') || (osDark.matches ? 'dark' : 'light');
  }

  /** Everything the browser draws for us rather than we for it: the
   *  chrome tint, and the scheme Safari uses for its own page-modal
   *  dialogs — the download permission prompt the CV buttons trigger,
   *  alert(), confirm().
   *
   *  Both are declared in the <head> against `prefers-color-scheme`,
   *  which is right until the toggle disagrees with the OS. From then
   *  on the OS is the wrong thing to key off, so: the ground colour
   *  actually in use goes into every theme-color tag, so whichever the
   *  browser reads gives the same answer; and the scheme goes inline on
   *  the root element, where Safari looks for it and where it outranks
   *  themes.css. The tint is read from the computed style rather than a
   *  hardcoded pair so it can never drift out of step with the palette. */
  const themeColorMetas = document.querySelectorAll('meta[name="theme-color"]');
  function syncBrowserChrome() {
    const ground = getComputedStyle(root).getPropertyValue('--ground').trim();
    if (ground) themeColorMetas.forEach(m => m.setAttribute('content', ground));
    root.style.colorScheme = currentTheme();
  }
  syncBrowserChrome();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      syncBrowserChrome();
      // Safari with cookies blocked throws here instead of failing
      // quietly. The theme has already been applied above, so losing
      // the write only costs the memory of it.
      try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
    });
  }

  // Following the OS means following it while the page is open too.
  // Only when nothing overrides it, though — an explicit choice stands.
  osDark.addEventListener('change', () => {
    if (!root.hasAttribute('data-theme')) syncBrowserChrome();
  });

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- Scroll-spy ---------- */
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  const dockLabel = document.getElementById('dock-label');

  function setActive(id) {
    navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
    if (dockLabel) {
      const match = document.querySelector(`.nav-dock a[href="#${id}"]`);
      if (match) dockLabel.textContent = match.getAttribute('aria-label');
    }
  }

  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => spy.observe(s));

  /* ---------- Copy to clipboard ---------- */

  /** Two paths on purpose. The Clipboard API is the right one but only
   *  exists in a secure context, so it is missing when the page is
   *  opened straight from disk; execCommand is deprecated and still the
   *  only thing that works there. If both fail — Safari can reject the
   *  write outright — the caller shows the address so it can at least
   *  be selected by hand. */
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) { /* fall through */ }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  for (const btn of document.querySelectorAll('[data-copy]')) {
    const chip = btn.closest('.mail-chip') || btn.parentElement;
    const flash = chip.querySelector('.mail-flash');
    let revert;

    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      const ok = await copyText(text);

      clearTimeout(revert);
      chip.classList.toggle('is-copied', ok);
      chip.classList.toggle('is-failed', !ok);
      if (flash) {
        // Naming the address is the point: the label only says "Email",
        // so a bare "copied" would leave you guessing what you got.
        flash.textContent = ok ? `copied — ${text}` : text;
      }

      // A failed copy leaves the address on screen for longer, since
      // selecting it by hand is slower than reading a confirmation.
      revert = setTimeout(() => {
        chip.classList.remove('is-copied', 'is-failed');
        if (flash) flash.textContent = '';
      }, ok ? 2200 : 8000);
    });
  }
})();
