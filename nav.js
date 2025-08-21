(function () {
  const main = document.querySelector('main');
  if (!main) return;
  const headings = Array.from(main.querySelectorAll('section h2'));

  const slugify = str => str.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  headings.forEach(h => {
    if (!h.id) {
      const base = slugify(h.textContent);
      let id = base, i = 2;
      while (document.getElementById(id)) id = `${base}-${i++}`;
      h.id = id;
    }
  });

  const tocs = document.querySelectorAll('nav.toc');
  const buildTOC = (container) => {
    container.innerHTML = '';
    headings.forEach(h => {
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      a.className = `depth-${h.tagName === 'H2' ? '2' : '3'}`;
      container.appendChild(a);
    });
  };
  tocs.forEach(buildTOC);

  const links = document.querySelectorAll('nav.toc a');
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length) {
      const id = visible[0].target.id;
      document.querySelectorAll('nav.toc a').forEach(l => l.classList.remove('active'));
      document.querySelectorAll(`nav.toc a[href="#${id}"]`).forEach(l => l.classList.add('active'));
    }
  }, { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] });

  headings.forEach(h => observer.observe(h));

  const toggleBtn = document.getElementById('tocToggle');
  const mobileToc = document.getElementById('tocList');
  if (toggleBtn && mobileToc) {
    toggleBtn.addEventListener('click', () => {
      const open = mobileToc.getAttribute('data-open') === 'true';
      mobileToc.setAttribute('data-open', String(!open));
      toggleBtn.setAttribute('aria-expanded', String(!open));
    });
    mobileToc.addEventListener('click', e => {
      if (e.target.matches('a')) {
        mobileToc.setAttribute('data-open', 'false');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();