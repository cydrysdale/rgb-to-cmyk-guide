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

(function(){
  const sw = document.getElementById('themeSwitch');
  if(!sw) return;

  function apply(mode, persist=true){
    if(mode === 'dark'){
      document.documentElement.setAttribute('data-theme','dark');
      sw.checked = true;
      sw.setAttribute('aria-checked','true');
      if(persist) localStorage.setItem('theme','dark');
    }else if(mode === 'light'){
      document.documentElement.setAttribute('data-theme','light');
      sw.checked = false;
      sw.setAttribute('aria-checked','false');
      if(persist) localStorage.setItem('theme','light');
    }else{
      document.documentElement.removeAttribute('data-theme');
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      sw.checked = sysDark;
      sw.setAttribute('aria-checked', String(sysDark));
      if(persist) localStorage.removeItem('theme');
    }
  }

  // Initialize from saved choice or system
  const saved = localStorage.getItem('theme');
  apply(saved ? saved : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), false);

  // Click/keyboard toggle
  sw.addEventListener('change', e => apply(e.target.checked ? 'dark' : 'light'));

  // Follow OS only if user hasn’t set a preference
  const mm = window.matchMedia('(prefers-color-scheme: dark)');
  mm.addEventListener('change', e => {
    if(!localStorage.getItem('theme')) apply(e.matches ? 'dark' : 'light', false);
  });
})();
