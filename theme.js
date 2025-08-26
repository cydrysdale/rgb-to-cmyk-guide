(function(){
  const btn = document.getElementById('themeToggle');
  if(!btn) return;

  const apply = (t) => {
    if (t) {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
      btn.setAttribute('aria-pressed', String(t === 'dark'));
      btn.textContent = (t === 'dark') ? '☀️' : '🌙';
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = '🌙';
    }
  };

  // initialize from saved choice or system preference
  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  apply(saved || (systemDark ? 'dark' : 'light'));

  // toggle on click
  btn.addEventListener('click', () => {
    const now = document.documentElement.getAttribute('data-theme') || 'light';
    apply(now === 'dark' ? 'light' : 'dark');
  });

  // if you want to react to OS changes only when user hasn't chosen manually:
  const mm = window.matchMedia('(prefers-color-scheme: dark)');
  mm.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) apply(e.matches ? 'dark' : 'light');
  });
})();