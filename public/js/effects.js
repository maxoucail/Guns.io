/* ============================================================
   GUNS.IO — EFFECTS.JS
   Canvas-based visual effects for profile pages
   ============================================================ */

(function() {
  const canvas = document.getElementById('effectsCanvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const body = document.body;
  let effect = 'none';
  
  // Detect effect from body class
  const effectClasses = ['particles', 'stars', 'matrix', 'rain', 'snow', 'bubbles', 'fireflies', 'geometric', 'waves', 'galaxy', 'circuits', 'confetti', 'smoke', 'lightning', 'heartbeat', 'vortex', 'glitch'];
  for (const cls of effectClasses) {
    if (body.classList.contains('effect-' + cls)) {
      effect = cls;
      break;
    }
  }
  
  if (effect === 'none') {
    canvas.style.display = 'none';
    return;
  }
  
  let width, height;
  let particles = [];
  let animationId;
  
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  
  // ---- Particles (default fire-like) ----
  if (effect === 'particles') {
    const particleCount = 100;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: Math.random() * 3 + 1,
        alpha: Math.random(),
        color: Math.random() > 0.5 ? '233, 69, 96' : '123, 47, 247'
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = width; if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha * 0.4})`;
        ctx.fill();
      });
      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(233, 69, 96, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }
  }
  
  // ---- Stars ----
  else if (effect === 'stars') {
    const starCount = 200;
    for (let i = 0; i < starCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.twinkle += p.speed;
        const alpha = (Math.sin(p.twinkle) + 1) / 2 * 0.8 + 0.1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
        if (p.size > 1.2) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.2})`;
          ctx.fill();
        }
      });
    }
  }
  
  // ---- Matrix rain ----
  else if (effect === 'matrix') {
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops = Array(columns).fill(0);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃ';
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#0f0';
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
  }
  
  // ---- Rain ----
  else if (effect === 'rain') {
    const dropCount = 150;
    for (let i = 0; i < dropCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: Math.random() * 4 + 4,
        length: Math.random() * 15 + 5,
        alpha: Math.random() * 0.3 + 0.1
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.y += p.vy;
        if (p.y > height) { p.y = -p.length; p.x = Math.random() * width; }
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.length);
        ctx.strokeStyle = `rgba(174, 194, 224, ${p.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }
  
  // ---- Snow ----
  else if (effect === 'snow') {
    const flakeCount = 100;
    for (let i = 0; i < flakeCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: Math.random() * 0.5 + 0.3,
        vx: Math.random() * 0.3 - 0.15,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.3
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.y += p.vy; p.x += p.vx;
        if (p.y > height) { p.y = -5; p.x = Math.random() * width; }
        if (p.x < 0) p.x = width; if (p.x > width) p.x = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fill();
      });
    }
  }
  
  // ---- Bubbles ----
  else if (effect === 'bubbles') {
    const bubbleCount = 50;
    for (let i = 0; i < bubbleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: Math.random() * 0.6 + 0.2,
        size: Math.random() * 8 + 2,
        alpha: Math.random() * 0.2 + 0.05
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.y -= p.vy;
        if (p.y < -p.size * 2) { p.y = height + p.size; p.x = Math.random() * width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }
  
  // ---- Fireflies ----
  else if (effect === 'fireflies') {
    const fireflyCount = 30;
    for (let i = 0; i < fireflyCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 2,
        alpha: Math.random(),
        alphaSpeed: Math.random() * 0.03 + 0.01
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.alpha += p.alphaSpeed;
        if (p.alpha > 1 || p.alpha < 0.1) p.alphaSpeed *= -1;
        if (p.x < 0) p.x = width; if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        grd.addColorStop(0, `rgba(255, 220, 100, ${p.alpha})`);
        grd.addColorStop(1, 'rgba(255, 220, 100, 0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });
    }
  }
  
  // ---- Geometric ----
  else if (effect === 'geometric') {
    const geoCount = 15;
    for (let i = 0; i < geoCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 40 + 20,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.005,
        sides: Math.floor(Math.random() * 3) + 3,
        alpha: Math.random() * 0.08 + 0.02
      });
    }
    function drawPolygon(cx, cy, radius, sides, rotation) {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = rotation + (i * Math.PI * 2) / sides;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed;
        if (p.x < -50) p.x = width + 50; if (p.x > width + 50) p.x = -50;
        if (p.y < -50) p.y = height + 50; if (p.y > height + 50) p.y = -50;
        drawPolygon(p.x, p.y, p.size, p.sides, p.rotation);
        ctx.strokeStyle = `rgba(233, 69, 96, ${p.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }
  
  // ---- Waves ----
  else if (effect === 'waves') {
    let time = 0;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      time += 0.01;
      for (let wave = 0; wave < 3; wave++) {
        ctx.beginPath();
        for (let x = 0; x < width; x += 2) {
          const yOffset = Math.sin(x * 0.01 + time + wave) * 30 + Math.cos(x * 0.005 + time * 1.5 + wave) * 20;
          const y = height * (0.5 + wave * 0.15) + yOffset;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(233, 69, 96, ${0.08 - wave * 0.02})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  
  // ---- Galaxy ----
  else if (effect === 'galaxy') {
    const galaxyCount = 400;
    for (let i = 0; i < galaxyCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(width, height) * 0.3;
      particles.push({
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius * 0.6,
        cx: width / 2, cy: height / 2,
        angle: angle, radius: radius,
        speed: 0.0003 / (radius * 0.01 + 1),
        size: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.6 + 0.2
      });
    }
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);
      particles.forEach(p => {
        p.angle += p.speed;
        p.x = p.cx + Math.cos(p.angle) * p.radius;
        p.y = p.cy + Math.sin(p.angle) * p.radius * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fill();
      });
    }
  }
  
  // ---- Circuits ----
  else if (effect === 'circuits') {
    const circuitCount = 40;
    for (let i = 0; i < circuitCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.random() * 0.4 - 0.2,
        vy: Math.random() * 0.4 - 0.2,
        alpha: Math.random() * 0.3 + 0.05,
        length: Math.random() * 3 + 1
      });
    }
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.fillRect(0, 0, width, height);
      particles.forEach(p => {
        const dir = Math.random() > 0.5;
        ctx.strokeStyle = `rgba(0, 255, 136, ${p.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        if (dir) {
          ctx.lineTo(p.x + p.length * 10, p.y);
        } else {
          ctx.lineTo(p.x, p.y + p.length * 10);
        }
        ctx.stroke();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
        }
      });
    }
  }
  
  // ---- Confetti ----
  else if (effect === 'confetti') {
    const confettiCount = 80;
    const colors = ['#e94560', '#7b2ff7', '#00d4ff', '#ff6b35', '#00ff88', '#ffd700'];
    for (let i = 0; i < confettiCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        vy: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 2,
        size: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 4
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rotation += p.rotSpeed;
        if (p.y > height + 20) { p.y = -20; p.x = Math.random() * width; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
    }
  }
  
  // ---- Smoke ----
  else if (effect === 'smoke') {
    const smokeCount = 30;
    for (let i = 0; i < smokeCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: height + 50,
        vy: -(Math.random() * 0.3 + 0.1),
        vx: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 60 + 20,
        alpha: Math.random() * 0.06 + 0.02
      });
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.y += p.vy; p.x += p.vx;
        if (p.y < -p.size * 2) { p.y = height + 50; p.x = Math.random() * width; }
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grd.addColorStop(0, `rgba(200, 200, 200, ${p.alpha})`);
        grd.addColorStop(1, 'rgba(200, 200, 200, 0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });
    }
  }
  
  // ---- Lightning / Storm ----
  else if (effect === 'lightning') {
    let lightningTimer = 0;
    let lightningAlpha = 0;
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      ctx.fillRect(0, 0, width, height);
      
      lightningTimer--;
      if (lightningTimer <= 0 && Math.random() < 0.03) {
        lightningTimer = Math.random() * 20 + 5;
        lightningAlpha = Math.random() * 0.2 + 0.05;
      }
      
      if (lightningTimer > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningAlpha * (lightningTimer / 25)})`;
        ctx.fillRect(0, 0, width, height);
        lightningAlpha *= 0.9;
      }
    }
  }
  
  // ---- Heartbeat ----
  else if (effect === 'heartbeat') {
    let beatPhase = 0;
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      ctx.fillRect(0, 0, width, height);
      beatPhase += 0.02;
      const pulse = Math.abs(Math.sin(beatPhase));
      const alpha = pulse > 0.9 ? (pulse - 0.9) * 10 * 0.1 : 0;
      ctx.fillStyle = `rgba(233, 69, 96, ${alpha})`;
      ctx.fillRect(0, 0, width, height);
    }
  }
  
  // ---- Vortex ----
  else if (effect === 'vortex') {
    const vortexCount = 200;
    for (let i = 0; i < vortexCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(width, height) * 0.4;
      particles.push({
        angle: angle, radius: radius,
        speed: 0.01 + Math.random() * 0.02,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2
      });
    }
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);
      particles.forEach(p => {
        p.angle += p.speed;
        p.radius += 0.05;
        if (p.radius > Math.min(width, height) * 0.45) p.radius = 1;
        const x = width / 2 + Math.cos(p.angle) * p.radius;
        const y = height / 2 + Math.sin(p.angle) * p.radius;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(123, 47, 247, ${p.alpha})`;
        ctx.fill();
      });
    }
  }
  
  // ---- Glitch background ----
  else if (effect === 'glitch') {
    let glitchTimer = 0;
    function draw() {
      glitchTimer--;
      ctx.clearRect(0, 0, width, height);
      if (glitchTimer <= 0 && Math.random() < 0.1) {
        glitchTimer = Math.random() * 15 + 3;
        const offsetX = (Math.random() - 0.5) * 20;
        const sliceY = Math.random() * height;
        const sliceH = Math.random() * 40 + 5;
        ctx.fillStyle = `rgba(255, 0, 255, ${Math.random() * 0.05})`;
        ctx.fillRect(0, sliceY, width, sliceH);
        
        ctx.fillStyle = `rgba(0, 255, 255, ${Math.random() * 0.05})`;
        ctx.fillRect(offsetX, sliceY + sliceH, width, sliceH);
      }
    }
  }
  
  // Animation loop
  function animate() {
    draw();
    animationId = requestAnimationFrame(animate);
  }
  
  animate();
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (animationId) cancelAnimationFrame(animationId);
  });
})();
