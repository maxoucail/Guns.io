(() => {
  const P = window.__PROFILE__ || {};
  const splash = document.getElementById('splash');
  const profileEl = document.getElementById('profile');
  const audio = document.getElementById('audio');
  const yt = document.getElementById('yt-iframe');
  const toggle = document.getElementById('player-toggle');
  const icPlay = document.getElementById('ic-play');
  const icPause = document.getElementById('ic-pause');
  const cover = document.querySelector('.player-cover');

  const previewMode = new URLSearchParams(location.search).get('preview') === '1';

  const activateYt = () => {
    if (!yt || yt.src) return;
    let src = yt.dataset.src || '';
    if (previewMode) src = src.replace('&autoplay=1', '');
    yt.src = src;
  };

  const enter = () => {
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 700);
    }
    if (profileEl) profileEl.removeAttribute('hidden');
    if (P.autoplay && audio) tryPlay();
    activateYt();
  };

  if (splash && !previewMode) {
    splash.addEventListener('click', enter, { once: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') enter(); }, { once: true });
  } else {
    if (splash) splash.remove();
    if (profileEl) profileEl.removeAttribute('hidden');
    activateYt();
  }

  if (audio) {
    audio.volume = Math.max(0, Math.min(1, (P.volume || 30) / 100));
    audio.loop = true;
  }

  const tryPlay = () => {
    if (!audio) return;
    audio.play().then(() => {
      if (icPlay) icPlay.style.display = 'none';
      if (icPause) icPause.style.display = '';
      if (cover) cover.classList.add('spin');
    }).catch(() => {});
  };

  if (toggle) {
    toggle.addEventListener('click', () => {
      if (audio.paused) tryPlay();
      else {
        audio.pause();
        if (icPause) icPause.style.display = 'none';
        if (icPlay) icPlay.style.display = '';
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
