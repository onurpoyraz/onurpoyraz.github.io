/* ============================================================
   main.js
   - Theme toggle (persisted in localStorage)
   - Reveal-on-scroll
   - Scroll-spy: lights the active dot in both the rail and the dock,
     and names the current section in the dock label

   The material and the hero canvas live in glass.js.
   ============================================================ */

(function () {
  const root = document.documentElement;

  /* ---------- Theme ---------- */
  const toggleBtn = document.getElementById('theme-toggle');
  function currentTheme() {
    return root.getAttribute('data-theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

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
})();
