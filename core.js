/*
  core.js — combined site behaviors for the RGB → CMYK guide

  Includes:
    1) Theme toggle (button or switch) with OS-preference sync
    2) In-view animation trigger via IntersectionObserver
    3) Code "typewriter" line staggering helper
    4) Table of contents (TOC) builder + active-section highlighting + mobile toggle

  Usage:
    <script src="core.js" defer></script>
    
  Notes:
    • Safe to include site‑wide. Each feature no-ops if the required markup isn’t present.
    • Keep CSS hooks: .animate (initial), .in-view (when revealed), nav.toc, #tocToggle, #tocList
*/

(() => {
  // -----------------------------
  // Small utilities
  // -----------------------------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // -----------------------------
  // 1) THEME MODULE (unifies button + switch)
  // -----------------------------
  const Theme = (() => {
    const LS_KEY = 'theme';
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    // Apply theme to <html data-theme> and sync any controls.
    function apply(mode, { persist = true } = {}) {
      if (mode === 'dark' || mode === 'light') {
        root.setAttribute('data-theme', mode);
        if (persist) localStorage.setItem(LS_KEY, mode);
      } else {
        // `auto`/unset: remove explicit theme so OS preference is used
        root.removeAttribute('data-theme');
        if (persist) localStorage.removeItem(LS_KEY);
      }
      syncControls();
    }

    // Update visual state of any present controls.
    function syncControls() {
      const btn = $('#themeToggle');      // icon button (☀️ / 🌙)
      const sw  = $('#themeSwitch');      // checkbox-style switch
      const saved = localStorage.getItem(LS_KEY);
      const effective = saved || (media.matches ? 'dark' : 'light');

      if (btn) {
        btn.setAttribute('aria-pressed', String(effective === 'dark'));
        btn.textContent = (effective === 'dark') ? '☀️' : '🌙';
      }
      if (sw) {
        sw.checked = (effective === 'dark');
        sw.setAttribute('aria-checked', String(sw.checked));
      }
    }

    function init() {
      // Initialize from saved choice or system preference
      const saved = localStorage.getItem(LS_KEY);
      apply(saved || (media.matches ? 'dark' : 'light'), { persist: false });

      // Button toggles between light/dark
      const btn = $('#themeToggle');
      if (btn) btn.addEventListener('click', () => {
        const now = root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
        apply(now === 'dark' ? 'light' : 'dark');
      });

      // Switch maps checked → dark / unchecked → light
      const sw = $('#themeSwitch');
      if (sw) sw.addEventListener('change', (e) => apply(e.target.checked ? 'dark' : 'light'));

      // Follow OS changes only when the user hasn’t chosen explicitly
      media.addEventListener('change', (e) => {
        if (!localStorage.getItem(LS_KEY)) apply(e.matches ? 'dark' : 'light', { persist: false });
      });
    }

    return { init };
  })();

  // -----------------------------
  // 2) IN-VIEW ANIMATION TRIGGER
  //    Adds .in-view to elements with .animate when they enter the viewport.
  //    (Removes .animate when they leave to prevent animating again.)
  // -----------------------------
  const InViewAnimations = (() => {
    function init() {
      const animated = $$('.animate');
      if (!animated.length) return; // No-op if the feature isn’t used on the page

      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          } else {
            // Note: Change the "animate" class here to "in-view" to re-animate 
            // every time the element re-enters the viewport.
            entry.target.classList.remove('animate');
          }
        });
      });

      animated.forEach((el) => io.observe(el));
    }

    return { init };
  })();

  // -----------------------------
  // 3) CODE TYPEWRITER LINE STAGGER
  //    Looks for .code blocks that contain child elements with .code-type
  //    and staggers their CSS animations.
  // -----------------------------
  const CodeTypewriter = (() => {
    function init() {
      $$('.code').forEach((block) => {
        const lines = block.querySelectorAll('.code-type');
        lines.forEach((line, i) => {
          // ~0.35s stagger; 1s duration; step timing for typewriter feel
          line.style.animationDelay = `${i * 350}ms`;
          line.style.animationDuration = '1000ms';
          line.style.animationTimingFunction = 'steps(25, end)';
          line.style.animationFillMode = 'both';
        });
      });
    }

    return { init };
  })();

  // -----------------------------
  // 4) TABLE OF CONTENTS (TOC)
  //    - Auto-IDs for <section> <h2> (no clobbering existing IDs)
  //    - Build <nav class="toc"> with anchors
  //    - Highlight active section while scrolling
  //    - Mobile TOC toggle (#tocToggle + #tocList)
  // -----------------------------
  const TOC = (() => {
    function slugify(str) {
      return str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    }

    function ensureIds(headings) {
      headings.forEach((h) => {
        if (!h.id) {
          const base = slugify(h.textContent);
          let id = base, i = 2;
          while (document.getElementById(id)) id = `${base}-${i++}`;
          h.id = id;
        }
      });
    }

    function buildTOC(containers, headings) {
      containers.forEach((container) => {
        container.innerHTML = '';
        headings.forEach((h) => {
          const a = document.createElement('a');
          a.href = `#${h.id}`;
          a.textContent = h.textContent;
          a.className = `depth-${h.tagName === 'H2' ? '2' : '3'}`;
          container.appendChild(a);
        });
      });
    }

    function observeActive(headings) {
      const obs = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (!visible.length) return;
          const id = visible[0].target.id;
          $$('.toc a').forEach((l) => l.classList.remove('active'));
          $$(`.toc a[href="#${id}"]`).forEach((l) => l.classList.add('active'));
        },
        { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] }
      );
      headings.forEach((h) => obs.observe(h));
    }

    function init() {
      const main = $('main');
      if (!main) return; // No-op on pages without main content

      const headings = Array.from(main.querySelectorAll('section h2'));
      if (!headings.length) return;

      ensureIds(headings);
      buildTOC($$('nav.toc'), headings);
      observeActive(headings);

      // Mobile TOC toggle wiring
      const toggleBtn = $('#tocToggle');
      const mobileToc = $('#tocList');
      if (toggleBtn && mobileToc) {
        toggleBtn.addEventListener('click', () => {
          const open = mobileToc.getAttribute('data-open') === 'true';
          mobileToc.setAttribute('data-open', String(!open));
          toggleBtn.setAttribute('aria-expanded', String(!open));
        });
        mobileToc.addEventListener('click', (e) => {
          if (e.target.matches('a')) {
            mobileToc.setAttribute('data-open', 'false');
            toggleBtn.setAttribute('aria-expanded', 'false');
          }
        });
      }
    }

    return { init };
  })();

  // -----------------------------
  // Boot
  // -----------------------------
  // If this script is loaded with `defer`, DOM is already parsed.
  // Still, we guard with DOMContentLoaded in case it’s included without `defer`.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  function start() {
    Theme.init();
    InViewAnimations.init();
    CodeTypewriter.init();
    TOC.init();
  }
})();
