(() => {
  const P = window.__PROFILE__ || {};
  const splash = document.getElementById('splash');
  const profile = document.getElementById('profile');
  const audio = document.getElementById('audio');
  const toggle = document.getElementById('player-toggle');
  const icPlay = document.getElementById('ic-play');
  const icPause = document.getElementById('ic-pause');
  const cover = document.querySelector('.player-cover');

  const previewMode = new URLSearchParams(location.search).get('preview') === '1';

  const enter = () => {
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 700);
    }
    if (profile) profile.removeAttribute('hidden');
    if (P.autoplay && audio) tryPlay();
  };

  if (splash && !previewMode) {
    splash.addEventListener('click', enter, { once: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') enter(); }, { once: true });
  } else if (splash && previewMode) {
    splash.remove();
    if (profile) profile.removeAttribute('hidden');
  }

  if (audio) {
    audio.volume = Math.max(0, Math.min(1, (P.volume || 30) / 100));
    audio.loop = true;
  }

  const tryPlay = () => {
    if (!audio) return;
    audio.play().then(() => {
      icPlay.style.display = 'none';
      icPause.style.display = '';
      if (cover) cover.classList.add('spin');
    }).catch(() => {});
  };

  if (toggle) {
    toggle.addEventListener('click', () => {
      if (audio.paused) tryPlay();
      else {
        audio.pause();
        icPause.style.display = 'none';
        icPlay.style.display = '';
        if (cover) cover.classList.remove('spin');
      }
    });
  }

  const fx = document.querySelector('.cursor-fx');
  const cls = document.body.classList;
  if (fx && (cls.contains('fx-cursor-trail') || cls.contains('fx-cursor-glow'))) {
    const lag = cls.contains('fx-cursor-glow') ? 0.18 : 0.1;
    let mx = -300, my = -300, cx = -300, cy = -300;
    document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
    (function tick() {
      cx += (mx - cx) * lag;
      cy += (my - cy) * lag;
      fx.style.transform = `translate(${cx}px,${cy}px)`;
      requestAnimationFrame(tick);
    })();
  }
})();
