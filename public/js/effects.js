/* Particules canvas + sparkle cursor. Lightweight, pas de dep. */
(() => {
  const P = window.__PROFILE__ || {};
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    w = canvas.width  = window.innerWidth  * dpr;
    h = canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  };
  resize();
  window.addEventListener('resize', resize);

  const accent = P.accent || '#7c5cff';
  const kind = P.particles || 'none';

  const count = kind === 'matrix' ? 60 : kind === 'snow' ? 80 : kind === 'bubbles' ? 35 : kind === 'stars' ? 110 : 0;
  if (!count) return;

  const particles = [];
  for (let i = 0; i < count; i++) particles.push(spawn(true));

  function spawn(initial) {
    const base = {
      x: Math.random() * w,
      y: initial ? Math.random() * h : -10
    };
    if (kind === 'stars')   return { ...base, r: Math.random()*1.6*dpr + 0.4*dpr, vx: 0, vy: (Math.random()*0.3+0.1)*dpr, a: Math.random()*0.7+0.2, twinkle: Math.random()*Math.PI*2 };
    if (kind === 'snow')    return { ...base, r: Math.random()*2.5*dpr + 0.8*dpr, vx: (Math.random()-0.5)*0.4*dpr, vy: (Math.random()*0.7+0.3)*dpr, a: Math.random()*0.6+0.3 };
    if (kind === 'bubbles') return { ...base, y: initial ? Math.random()*h : h + 10, r: Math.random()*8*dpr + 4*dpr, vx: (Math.random()-0.5)*0.4*dpr, vy: -(Math.random()*0.6+0.4)*dpr, a: Math.random()*0.35+0.1 };
    if (kind === 'matrix')  return { x: Math.floor(Math.random()*(w/(14*dpr)))*14*dpr, y: initial?Math.random()*h:-20, vy: (Math.random()*2+1)*dpr, ch: Math.random().toString(36).slice(2,3).toUpperCase(), a: Math.random()*0.7+0.3 };
    return base;
  }

  function loop() {
    ctx.clearRect(0, 0, w, h);

    if (kind === 'stars') {
      for (const p of particles) {
        p.y += p.vy;
        p.twinkle += 0.04;
        if (p.y > h) Object.assign(p, spawn(false));
        ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin(p.twinkle));
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.y > h) { p.y = -10; p.x = Math.random()*w; }
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
    } else if (kind === 'bubbles') {
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -20) { p.y = h + 10; p.x = Math.random()*w; }
        ctx.globalAlpha = p.a;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.stroke();
      }
    } else if (kind === 'matrix') {
      ctx.font = `${12*dpr}px JetBrains Mono, monospace`;
      ctx.fillStyle = accent;
      for (const p of particles) {
        p.y += p.vy;
        if (p.y > h + 20) { p.y = -20; p.x = Math.floor(Math.random()*(w/(14*dpr)))*14*dpr; p.ch = Math.random().toString(36).slice(2,3).toUpperCase(); }
        ctx.globalAlpha = p.a;
        ctx.fillText(p.ch, p.x, p.y);
      }
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Sparkle cursor effect (DOM-based)
  if (document.body.classList.contains('fx-cursor-sparkle')) {
    document.addEventListener('mousemove', (e) => {
      if (Math.random() > 0.4) return;
      const s = document.createElement('span');
      s.style.cssText = `
        position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
        width: 6px; height: 6px; margin: -3px;
        background: ${accent}; border-radius: 50%;
        pointer-events: none; z-index: 9998;
        box-shadow: 0 0 12px ${accent};
        transition: transform .8s ease, opacity .8s ease;
        opacity: 1;
      `;
      document.body.appendChild(s);
      requestAnimationFrame(() => {
        s.style.transform = `translate(${(Math.random()-0.5)*40}px, ${(Math.random()-0.5)*40}px) scale(0.2)`;
        s.style.opacity = '0';
      });
      setTimeout(() => s.remove(), 800);
    });
  }
})();
