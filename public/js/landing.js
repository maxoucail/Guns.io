/* link2me — landing.js (v2 + v21 combined) */

(function() {
  'use strict';

  const isMobile = window.matchMedia('(max-width: 768px)').matches || ('ontouchstart' in window);

  // ── Gradient text color cycling ──
  const gradientWord = document.getElementById('gradientWord');
  if (gradientWord) {
    const colors = [
      'linear-gradient(135deg, #7c5cff 0%, #00d4ff 50%, #ff6cab 100%)',
      'linear-gradient(135deg, #00d4ff 0%, #ff6cab 50%, #7c5cff 100%)',
      'linear-gradient(135deg, #ff6cab 0%, #7c5cff 50%, #00d4ff 100%)',
      'linear-gradient(135deg, #a855f7 0%, #06b6d4 50%, #ec4899 100%)',
    ];
    let idx = 0;
    setInterval(function() {
      idx = (idx + 1) % colors.length;
      gradientWord.style.backgroundImage = colors[idx];
    }, 2500);
  }

  // ── Hamburger menu ──
  var navToggle  = document.getElementById('navToggle');
  var navMenu    = document.getElementById('navMenu');
  var navOverlay = document.getElementById('navOverlay');

  if (navToggle && navMenu) {
    function closeMenu() {
      navMenu.classList.remove('open');
      if (navOverlay) navOverlay.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      var spans = navToggle.querySelectorAll('span');
      if (spans[0]) spans[0].style.transform = '';
      if (spans[1]) spans[1].style.opacity   = '';
      if (spans[2]) spans[2].style.transform = '';
    }
    function openMenu() {
      navMenu.classList.add('open');
      if (navOverlay) navOverlay.classList.add('open');
      navToggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      var spans = navToggle.querySelectorAll('span');
      if (spans[0]) spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      if (spans[1]) spans[1].style.opacity   = '0';
      if (spans[2]) spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    }
    navToggle.addEventListener('click', function() {
      navMenu.classList.contains('open') ? closeMenu() : openMenu();
    });
    if (navOverlay) navOverlay.addEventListener('click', closeMenu);
    var links = navMenu.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', closeMenu);
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // ── Navbar scroll effect ──
  var navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      navbar.classList.toggle('scrolled', window.scrollY > 30);
    }, { passive: true });
  }

  // ── Intersection Observer — apparition des cartes ──
  var cardObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        cardObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  var animEls = document.querySelectorAll('.stat-card, .feature-card');
  for (var i = 0; i < animEls.length; i++) {
    animEls[i].style.transitionDelay = (i * 0.07) + 's';
    cardObserver.observe(animEls[i]);
  }

  // ── Cursor glow — desktop uniquement ──
  if (!isMobile) {
    var cursorGlow = document.createElement('div');
    cursorGlow.style.cssText = 'position:fixed;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(124,92,255,0.06),transparent 70%);pointer-events:none;z-index:0;transform:translate(-50%,-50%);will-change:left,top;left:-999px;top:-999px';
    document.body.appendChild(cursorGlow);

    var mouseX = 0, mouseY = 0, glowX = 0, glowY = 0, rafId = null;

    window.addEventListener('mousemove', function(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!rafId) rafId = requestAnimationFrame(animateGlow);
    }, { passive: true });

    function animateGlow() {
      rafId = null;
      var dx = mouseX - glowX;
      var dy = mouseY - glowY;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        glowX += dx * 0.08;
        glowY += dy * 0.08;
        cursorGlow.style.left = glowX + 'px';
        cursorGlow.style.top  = glowY + 'px';
        rafId = requestAnimationFrame(animateGlow);
      }
    }
  }

  // ── Particles canvas ──
  var canvas = document.getElementById('particleCanvas');
  if (canvas && !isMobile) {
    var ctx = canvas.getContext('2d');
    var particles = [];
    var w, h;

    function resize() {
      w = canvas.width = canvas.parentElement.offsetWidth;
      h = canvas.height = canvas.parentElement.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.5 + 0.2
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(124,92,255,' + p.alpha + ')';
        ctx.fill();

        // Connect nearby particles
        for (var j = i + 1; j < particles.length; j++) {
          var p2 = particles[j];
          var dx = p.x - p2.x;
          var dy = p.y - p2.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(124,92,255,' + (0.08 * (1 - dist / 120)) + ')';
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ── Snow canvas ──
  var snowCanvas = document.getElementById('snowCanvas');
  if (snowCanvas) {
    var sctx = snowCanvas.getContext('2d');
    var snowflakes = [];
    var sw, sh;

    function snowResize() {
      sw = snowCanvas.width = snowCanvas.parentElement.offsetWidth;
      sh = snowCanvas.height = snowCanvas.parentElement.offsetHeight;
    }
    snowResize();
    window.addEventListener('resize', snowResize);

    for (var i = 0; i < 25; i++) {
      snowflakes.push({
        x: Math.random() * (sw || 300),
        y: Math.random() * (sh || 400),
        r: Math.random() * 2 + 1,
        vy: Math.random() * 0.5 + 0.2,
        vx: (Math.random() - 0.5) * 0.3
      });
    }

    function snowDraw() {
      sctx.clearRect(0, 0, sw, sh);
      for (var i = 0; i < snowflakes.length; i++) {
        var sf = snowflakes[i];
        sf.y += sf.vy;
        sf.x += sf.vx;
        if (sf.y > sh) { sf.y = 0; sf.x = Math.random() * sw; }
        if (sf.x < 0) sf.x = sw;
        if (sf.x > sw) sf.x = 0;

        sctx.beginPath();
        sctx.arc(sf.x, sf.y, sf.r, 0, Math.PI * 2);
        sctx.fillStyle = 'rgba(255,255,255,' + (sf.r * 0.2) + ')';
        sctx.fill();
      }
      requestAnimationFrame(snowDraw);
    }
    snowDraw();
  }

  // ── Demo theme switcher ──
  var themeStyles = {
    neon:     { bg: '#0B1020', glow: 'rgba(124,92,255,.15)', tagBg: 'rgba(124,92,255,.12)', tagBorder: 'rgba(124,92,255,.25)', tagColor: '#7c5cff', label: 'Neon Pulse' },
    aurora:   { bg: '#071825', glow: 'rgba(6,182,212,.15)',  tagBg: 'rgba(6,182,212,.12)',  tagBorder: 'rgba(6,182,212,.25)',  tagColor: '#06b6d4', label: 'Aurora'    },
    midnight: { bg: '#06060f', glow: 'rgba(168,85,247,.15)', tagBg: 'rgba(168,85,247,.12)', tagBorder: 'rgba(168,85,247,.25)', tagColor: '#a855f7', label: 'Midnight'  },
    cyber:    { bg: '#070d10', glow: 'rgba(0,255,136,.12)',  tagBg: 'rgba(0,255,136,.10)',  tagBorder: 'rgba(0,255,136,.25)',  tagColor: '#00ff88', label: 'Cyber'     },
  };

  var themeBtns = document.querySelectorAll('.theme-btn');
  for (var i = 0; i < themeBtns.length; i++) {
    themeBtns[i].addEventListener('click', function() {
      var btns = document.querySelectorAll('.theme-btn');
      for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
      this.classList.add('active');

      var theme = themeStyles[this.dataset.theme];
      if (!theme) return;

      var content  = document.getElementById('demoMacContent');
      var glow     = content && content.querySelector('.profile-glow');
      var styleTag = document.getElementById('demoStyleTag');
      var label    = document.getElementById('demoStyleLabel');

      if (content)  content.style.background = theme.bg;
      if (glow)     glow.style.background    = 'radial-gradient(circle,' + theme.glow + ',transparent 70%)';
      if (styleTag) {
        styleTag.style.background  = theme.tagBg;
        styleTag.style.borderColor = theme.tagBorder;
        styleTag.style.color       = theme.tagColor;
      }
      if (label) label.textContent = theme.label;
    });
  }
})();
