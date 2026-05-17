(() => {
  const profile = window.__INITIAL_PROFILE__ || {};
  const username = window.__USERNAME__;
  const userAvatar = window.__USER_AVATAR__;
  const previewFrame = document.getElementById('preview-frame');
  const saveBar = document.getElementById('save-bar');

  const SOCIAL_OPTIONS = [
    'discord','twitter','instagram','tiktok','youtube','twitch','spotify',
    'soundcloud','github','telegram','snapchat','kick','roblox','steam','email','website'
  ];

  let dirtyPatch = {};
  let isDirty = false;

  const markDirty = (patch) => {
    Object.assign(dirtyPatch, patch);
    isDirty = true;
    saveBar.classList.add('visible');
  };

  const flushSave = async () => {
    const body = { ...dirtyPatch };
    try {
      const r = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok || r.redirected) {
        location.href = '/login';
        return;
      }
      const j = await r.json();
      if (!j.ok) throw new Error('server error');
      dirtyPatch = {};
      isDirty = false;
      saveBar.classList.remove('visible');
      refreshPreview();
    } catch {
      alert('Erreur de sauvegarde. Réessaie.');
    }
  };

  document.getElementById('save-confirm').addEventListener('click', flushSave);
  document.getElementById('save-abort').addEventListener('click', () => {
    dirtyPatch = {};
    isDirty = false;
    saveBar.classList.remove('visible');
    location.reload();
  });

  window.addEventListener('beforeunload', (e) => {
    if (isDirty) { e.preventDefault(); e.returnValue = ''; }
  });

  let refreshTimer;
  const refreshPreview = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (previewFrame) previewFrame.src = '/' + username + '?preview=1&t=' + Date.now();
    }, 350);
  };

  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
      const id = b.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === id));
    });
  });

  const bind = (id, key, opts = {}) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (opts.toNumber) v = +v;
      markDirty({ [key]: v });
      if (opts.after) opts.after(v);
    });
  };

  bind('f-bio', 'bio');
  bind('f-bio_widget', 'bio_widget');
  bind('f-splash_text', 'splash_text');
  bind('f-splash_enabled', 'splash_enabled');
  bind('f-music_autoplay', 'music_autoplay');
  bind('f-accent_color', 'accent_color');
  bind('f-text_color', 'text_color');
  bind('f-font', 'font');
  bind('f-username_effect', 'username_effect');
  bind('f-cursor_effect', 'cursor_effect');
  bind('f-particles', 'particles');

  const setSelectVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setSelectVal('f-username_effect', profile.username_effect);
  setSelectVal('f-cursor_effect', profile.cursor_effect);
  setSelectVal('f-particles', profile.particles);

  const volEl = document.getElementById('f-music_volume');
  const volVal = document.getElementById('vol-val');
  if (volEl) volEl.addEventListener('input', () => {
    volVal.textContent = volEl.value;
    markDirty({ music_volume: +volEl.value });
  });

  const bgSeg = document.querySelector('[data-seg="bg_type"]');
  const setSegActive = (type) => {
    bgSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.val === type));
    document.querySelectorAll('.bg-options > div').forEach(d => d.classList.toggle('active', d.dataset.bg === type));
  };
  setSegActive(profile.bg_type || 'gradient');
  bgSeg.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const t = b.dataset.val;
      setSegActive(t);
      let v = '';
      if (t === 'color') v = document.getElementById('bg-color').value;
      else if (t === 'gradient') v = buildGradient();
      else if (t === 'image') v = document.getElementById('bg-image-url').value;
      markDirty({ bg_type: t, bg_value: v });
    });
  });

  const colorInput = document.getElementById('bg-color');
  if (colorInput) colorInput.addEventListener('input', () => markDirty({ bg_type: 'color', bg_value: colorInput.value }));

  const gradC1 = document.getElementById('grad-c1');
  const gradC2 = document.getElementById('grad-c2');
  const gradDir = document.getElementById('grad-dir');
  const buildGradient = () => {
    const c1 = gradC1?.value || '#7c5cff';
    const c2 = gradC2?.value || '#00d4ff';
    const d = gradDir?.value || '135deg';
    return `linear-gradient(${d},${c1},${c2})`;
  };
  const onGradChange = () => {
    document.querySelectorAll('#grad-presets button').forEach(x => x.classList.remove('active'));
    markDirty({ bg_type: 'gradient', bg_value: buildGradient() });
  };
  if (gradC1) gradC1.addEventListener('input', onGradChange);
  if (gradC2) gradC2.addEventListener('input', onGradChange);
  if (gradDir) gradDir.addEventListener('change', onGradChange);

  document.querySelectorAll('#grad-presets button').forEach(b => {
    if (profile.bg_value === b.dataset.val) b.classList.add('active');
    b.addEventListener('click', () => {
      document.querySelectorAll('#grad-presets button').forEach(x => x.classList.toggle('active', x === b));
      markDirty({ bg_type: 'gradient', bg_value: b.dataset.val });
    });
  });

  const bgImageUrl = document.getElementById('bg-image-url');
  if (bgImageUrl) {
    let bgTimer;
    bgImageUrl.addEventListener('input', () => {
      clearTimeout(bgTimer);
      bgTimer = setTimeout(() => markDirty({ bg_type: 'image', bg_value: bgImageUrl.value }), 400);
    });
  }

  document.querySelectorAll('[data-upload]').forEach(inp => {
    inp.addEventListener('change', () => {
      const file = inp.files?.[0];
      if (!file) return;
      const kind = inp.dataset.upload;
      if (kind === 'bg') uploadWithProgress(file, kind);
      else uploadSimple(file, kind);
      inp.value = '';
    });
  });

  async function uploadSimple(file, kind) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'upload failed');
      const thumb = document.getElementById('thumb-' + kind);
      if (thumb) thumb.style.backgroundImage = `url('${j.url}?t=${Date.now()}')`;
      refreshPreview();
    } catch (e) {
      alert("Échec de l'upload : " + (e.message || 'erreur'));
    }
  }

  function uploadWithProgress(file, kind) {
    const progressBox = document.getElementById('bg-upload-progress');
    const fill = document.getElementById('bg-progress-fill');
    const pct  = document.getElementById('bg-progress-pct');
    const txt  = document.getElementById('bg-upload-txt');
    txt.textContent = `${file.name} — upload…`;
    progressBox.style.display = 'flex';
    fill.style.width = '0%'; pct.textContent = '0%';
    const fd = new FormData();
    fd.append('file', file); fd.append('kind', kind);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const p = Math.round(e.loaded / e.total * 100);
      fill.style.width = p + '%';
      pct.textContent = p === 100 ? 'Traitement…' : p + '%';
    });
    xhr.addEventListener('load', () => {
      progressBox.style.display = 'none';
      txt.textContent = 'Uploader image / gif / vidéo (max 98 Mo)';
      try {
        const j = JSON.parse(xhr.responseText);
        if (!j.ok) throw new Error(j.error || 'upload failed');
        if (bgImageUrl) bgImageUrl.value = j.url;
        markDirty({ bg_type: 'image', bg_value: j.url });
        refreshPreview();
      } catch (e) {
        alert('Échec upload : ' + (e.message || 'erreur serveur'));
      }
    });
    xhr.addEventListener('error', () => {
      progressBox.style.display = 'none';
      txt.textContent = 'Uploader image / gif / vidéo (max 98 Mo)';
      alert('Erreur réseau');
    });
    xhr.send(fd);
  }

  const avatarFromProviderBtn = document.getElementById('avatar-from-provider');
  if (avatarFromProviderBtn && userAvatar) {
    avatarFromProviderBtn.addEventListener('click', () => {
      const thumb = document.getElementById('thumb-avatar');
      if (thumb) thumb.style.backgroundImage = `url('${userAvatar}')`;
      markDirty({ avatar: userAvatar });
    });
  }
  const avatarClear = document.getElementById('avatar-clear');
  if (avatarClear) {
    avatarClear.addEventListener('click', () => {
      const thumb = document.getElementById('thumb-avatar');
      if (thumb) thumb.style.backgroundImage = '';
      markDirty({ avatar: null });
    });
  }
  const bannerFromProviderBtn = document.getElementById('banner-from-provider');
  if (bannerFromProviderBtn && userAvatar) {
    bannerFromProviderBtn.addEventListener('click', () => {
      const thumb = document.getElementById('thumb-banner');
      if (thumb) thumb.style.backgroundImage = `url('${userAvatar}')`;
      markDirty({ banner: userAvatar });
    });
  }
  const bannerClear = document.getElementById('banner-clear');
  if (bannerClear) {
    bannerClear.addEventListener('click', () => {
      const thumb = document.getElementById('thumb-banner');
      if (thumb) thumb.style.backgroundImage = '';
      markDirty({ banner: null });
    });
  }

  const musicQ = document.getElementById('music-q');
  const musicResults = document.getElementById('music-results');
  let musicTimer;
  let audioPreview = null;
  musicQ.addEventListener('input', () => {
    clearTimeout(musicTimer);
    musicTimer = setTimeout(async () => {
      const q = musicQ.value.trim();
      if (!q) { musicResults.innerHTML = ''; return; }
      try {
        const r = await fetch('/api/music?q=' + encodeURIComponent(q));
        const j = await r.json();
        renderMusicResults(j.results || []);
      } catch {}
    }, 300);
  });

  function renderMusicResults(items) {
    musicResults.innerHTML = '';
    items.forEach(t => {
      const li = document.createElement('li');
      const badge = t.source === 'youtube'
        ? '<span style="font-size:0.65rem;background:#f00;color:#fff;padding:1px 5px;border-radius:4px;margin-left:4px">YT</span>'
        : '';
      li.innerHTML = `
        <img src="${t.cover || ''}" alt="" />
        <div class="info">
          <strong>${escapeHtml(t.title)}${badge}</strong>
          <span>${escapeHtml(t.artist)}</span>
        </div>
        <button class="play" title="Aperçu">▶</button>
      `;
      const playBtn = li.querySelector('.play');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (t.source === 'youtube') {
          window.open('https://www.youtube.com/watch?v=' + t.id.replace('yt_', ''), '_blank', 'noopener');
          return;
        }
        if (audioPreview) { audioPreview.pause(); audioPreview = null; }
        audioPreview = new Audio(t.preview);
        audioPreview.volume = 0.6;
        audioPreview.play().catch(() => {});
      });
      li.addEventListener('click', () => selectTrack(t));
      musicResults.appendChild(li);
    });
  }

  function selectTrack(t) {
    if (audioPreview) audioPreview.pause();
    markDirty({ music_track: { id: t.id, title: t.title, artist: t.artist, cover: t.cover, preview: t.preview } });
    renderMusicCurrent(t);
    musicResults.innerHTML = '';
    musicQ.value = '';
  }

  function renderMusicCurrent(t) {
    const box = document.getElementById('music-current');
    if (!t) { box.innerHTML = '<em class="muted">Aucune musique</em>'; return; }
    box.innerHTML = `
      <img src="${t.cover || ''}" alt="" />
      <div>
        <strong>${escapeHtml(t.title)}</strong>
        <span>${escapeHtml(t.artist)}</span>
      </div>
      <button class="icon-btn" id="music-remove" title="Retirer">×</button>
    `;
    box.querySelector('#music-remove').addEventListener('click', () => {
      markDirty({ music_track: null });
      renderMusicCurrent(null);
    });
  }
  const removeBtn = document.getElementById('music-remove');
  if (removeBtn) removeBtn.addEventListener('click', () => {
    markDirty({ music_track: null });
    renderMusicCurrent(null);
  });

  const socialGrid = document.getElementById('social-grid');
  let socials = Array.isArray(profile.social_links) ? [...profile.social_links] : [];

  function renderSocials() {
    socialGrid.innerHTML = '';
    socials.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'social-row';
      row.innerHTML = `
        <select data-i="${i}" class="sel">
          ${SOCIAL_OPTIONS.map(o => `<option value="${o}" ${s.platform===o?'selected':''}>${o}</option>`).join('')}
        </select>
        <input type="text" placeholder="pseudo ou URL" value="${escapeHtml(s.value || '')}" data-i="${i}" class="val" />
        <button class="remove" data-i="${i}">×</button>
      `;
      socialGrid.appendChild(row);
    });
    socialGrid.querySelectorAll('.sel').forEach(el =>
      el.addEventListener('change', () => { socials[+el.dataset.i].platform = el.value; pushSocials(); })
    );
    socialGrid.querySelectorAll('.val').forEach(el =>
      el.addEventListener('input', () => { socials[+el.dataset.i].value = el.value; pushSocials(); })
    );
    socialGrid.querySelectorAll('.remove').forEach(el =>
      el.addEventListener('click', () => { socials.splice(+el.dataset.i, 1); renderSocials(); pushSocials(); })
    );
  }
  function pushSocials() { markDirty({ social_links: socials }); }

  document.getElementById('add-social').addEventListener('click', () => {
    socials.push({ platform: 'twitter', value: '' });
    renderSocials();
  });
  renderSocials();

  const customList = document.getElementById('custom-list');
  let customs = Array.isArray(profile.custom_links) ? [...profile.custom_links] : [];

  function renderCustoms() {
    customList.innerHTML = '';
    customs.forEach((c, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <input type="text" class="label" placeholder="Titre" maxlength="60" value="${escapeHtml(c.label || '')}" data-i="${i}" />
        <input type="url"  class="url"   placeholder="https://..." value="${escapeHtml(c.url || '')}" data-i="${i}" />
        <button class="remove" data-i="${i}">×</button>
      `;
      customList.appendChild(li);
    });
    customList.querySelectorAll('.label').forEach(el =>
      el.addEventListener('input', () => { customs[+el.dataset.i].label = el.value; pushCustoms(); })
    );
    customList.querySelectorAll('.url').forEach(el =>
      el.addEventListener('input', () => { customs[+el.dataset.i].url = el.value; pushCustoms(); })
    );
    customList.querySelectorAll('.remove').forEach(el =>
      el.addEventListener('click', () => { customs.splice(+el.dataset.i, 1); renderCustoms(); pushCustoms(); })
    );
  }
  function pushCustoms() { markDirty({ custom_links: customs }); }

  document.getElementById('add-custom').addEventListener('click', () => {
    customs.push({ label: '', url: '' });
    renderCustoms();
  });
  renderCustoms();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
