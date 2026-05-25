/* ============================================================
   GUNS.IO — LANDING.JS
   Interactive landing page scripts
   ============================================================ */

(function() {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Animate elements on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all cards and sections
  document.querySelectorAll('.feature-card, .review-card, .faq-item, .demo-frame, .section-header').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
  });

  // Hero particles (subtle)
  const heroParticlesEl = document.getElementById('heroParticles');
  if (heroParticlesEl) {
    const canvas = document.createElement('canvas');
    heroParticlesEl.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
      w = canvas.width = heroParticlesEl.offsetWidth;
      h = canvas.height = heroParticlesEl.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.4 + 0.1
      });
    }

    function animate() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(233, 69, 96, ${p.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // Parallax-like scroll effect for hero
  const heroGlow1 = document.querySelector('.hero-glow-1');
  const heroGlow2 = document.querySelector('.hero-glow-2');
  if (heroGlow1 || heroGlow2) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      if (heroGlow1) heroGlow1.style.transform = `translateY(${scrollY * 0.3}px)`;
      if (heroGlow2) heroGlow2.style.transform = `translateY(${-scrollY * 0.2}px)`;
    });
  }

  // FAQ accordion open one at a time
  document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('toggle', function() {
      if (this.open) {
        document.querySelectorAll('.faq-item').forEach(other => {
          if (other !== this) other.open = false;
        });
      }
    });
  });
})();
