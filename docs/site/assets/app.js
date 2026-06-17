// Hark Docs — client interactions. Vanilla, no dependencies. The initial theme
// is set by a tiny inline snippet in <head> (anti-flash); this wires the rest.
(function () {
  var KEY = 'hark-docs-theme';
  var root = document.documentElement;

  // ── Theme toggle ──────────────────────────────────────────────────────
  var themeBtn = document.querySelector('.theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }

  // ── Mobile nav drawer ─────────────────────────────────────────────────
  var menuBtn = document.querySelector('.menu-btn');
  var scrim = document.querySelector('.scrim');
  function closeNav() {
    document.body.classList.remove('nav-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  }
  if (scrim) scrim.addEventListener('click', closeNav);
  document.querySelectorAll('.nav a').forEach(function (a) {
    a.addEventListener('click', closeNav);
  });

  // ── Sidebar filter ────────────────────────────────────────────────────
  var search = document.querySelector('.search');
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      document.querySelectorAll('.nav-group').forEach(function (grp) {
        var any = false;
        grp.querySelectorAll('a').forEach(function (a) {
          var hit = a.textContent.toLowerCase().indexOf(q) !== -1;
          a.classList.toggle('hidden', !hit);
          if (hit) any = true;
        });
        grp.style.display = any ? '' : 'none';
      });
    });
  }

  // ── Copy-to-clipboard on code blocks ──────────────────────────────────
  document.querySelectorAll('.doc pre').forEach(function (pre) {
    var code = pre.querySelector('code');
    if (!code) return;
    var b = document.createElement('button');
    b.className = 'copy-btn';
    b.type = 'button';
    b.textContent = 'Copy';
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(code.innerText).then(function () {
        b.textContent = 'Copied';
        b.classList.add('copied');
        setTimeout(function () {
          b.textContent = 'Copy';
          b.classList.remove('copied');
        }, 1400);
      });
    });
    pre.appendChild(b);
  });

  // ── TOC scroll-spy ────────────────────────────────────────────────────
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (tocLinks.length) {
    var targets = tocLinks.map(function (a) {
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      return document.getElementById(id);
    });
    var spy = function () {
      var pos = window.scrollY + 100;
      var idx = 0;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && targets[i].offsetTop <= pos) idx = i;
      }
      tocLinks.forEach(function (a, i) {
        a.classList.toggle('active', i === idx);
      });
    };
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }
})();
