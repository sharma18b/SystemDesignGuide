/**
 * Reading progress bar — thin line at top of viewport
 * Also handles content fade-in on markdown load
 */
(function () {
  // Create bar
  const bar = document.createElement('div');
  bar.id = 'reading-progress-bar';
  document.body.prepend(bar);

  function update() {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH > 0 ? (scrollTop / docH) * 100 : 0;
    bar.style.width = pct + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();
