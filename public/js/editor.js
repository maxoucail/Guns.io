(() => {
  const profile = window.__INITIAL_PROFILE__ || {};
  const username = window.__USERNAME__;
  const previewFrame = document.getElementById('preview-frame');
  const saveState = document.getElementById('save-state');

  const SOCIAL_OPTIONS = [
    'discord','twitter','instagram','tiktok','youtube','twitch','spotify',
    'soundcloud','github','telegram','snapchat','kick','roblox','steam','email','website'
  ];

  // ---------- Save (debounced) ----------
  let saveTimer;
  const queueSave = (patch) => {
    Object.assign(pendingPatch, patch);
    clearTimeout(saveTimer);
    setSaveState('saving', 'Sauvegarde…');
    saveTimer = setTimeout(flushSave, 450);
  };

  const pendingPatch = {};
  const flushSave = async () => {
    const body = { ...pendingPatch };
    Object.keys(pendingPatch).forEach(k => delete pendingPatch[k]);
    try {
      const r = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error('save failed');
      setSaveState('ok', 'Synchronisé');
      refreshPreview();
    } catch (e) {
      setSaveState('error', 'Erreur de sauvegarde');
    }
  };

  const setSaveState = (cls, txt) => {
    saveState.className = 'save-state ' + (cls === 'ok' ? '' : cls);
    saveState.textContent = txt;
  };

  let refreshTimer;
  const refreshPreview = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (previewFrame) previewFrame.src = '/' + username + '?preview=1&t=' + Date.now();
    }, 350);
  };

  // ---------- Tabs ----------
  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
      const id = b.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === id));
    });
  });

  // ---------- Bio + splash + toggles ----------
  const bind = (id, key, opts = {}) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (opts.toNumber) v = +v;
      queueSave({ [key]: v });
      if (opts.after) opts.after(v);
    });
  };

  bind('f-bio', 'bio');
  bind('f-splash_text', 'splash_text');
  bind('f-splash_enabled', 'splash_enabled');
  bind('f-music_autoplay', 'music_autoplay');
  bind('f-accent_color', 'accent_color');
  bind('f-text_color', 'text_color');
  bind('f-font', 'font');
  bind('f-username_effect', 'username_effect');
  bind('f-cursor_effect', 'cursor_effect');
  bind('f-particles', 'particles');

  // Set initial select values
  const setSelectVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setSelectVal('f-username_effect', profile.username_effect);
  setSelectVal('f-cursor_effect', profile.cursor_effect);
  setSelectVal('f-particles', profile.particles);

  const volEl = document.getElementById('f-music_volume');
  const volVal = document.getElementById('vol-val');
  if (volEl) volEl.addEventListener('input', () => {
    volVal.textContent = volEl.value;
    queueSave({ music_volume: +volEl.value });
  });

  // ---------- Background ----------
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
      // Switch bg_value en cohérence
      let v = '';
      if (t === 'color') v = document.getElementById('bg-color').value;
      else if (t === 'gradient') v = profile.bg_type === 'gradient' ? profile.bg_value : 'linear-gradient(135deg,#7c5cff,#00d4ff)';
      else if (t === 'image') v = document.getElementById('bg-image-url').value;
      queueSave({ bg_type: t, bg_value: v });
    });
  });

  const colorInput = document.getElementById('bg-color');
  if (colorInput) colorInput.addEventListener('input', () => queueSave({ bg_type: 'color', bg_value: colorInput.value }));

  document.querySelectorAll('#grad-presets button').forEach(b => {
    if (profile.bg_value === b.dataset.val) b.classList.add('active');
    b.addEventListener('click', () => {
      document.querySelectorAll('#grad-presets button').forEach(x => x.classList.toggle('active', x === b));
      queueSave({ bg_type: 'gradient', bg_value: b.dataset.val });
    });
  });

  const bgImageUrl = document.getElementById('bg-image-url');
  if (bgImageUrl) {
    let bgTimer;
    bgImageUrl.addEventListener('input', () => {
      clearTimeout(bgTimer);
      bgTimer = setTimeout(() => queueSave({ bg_type: 'image', bg_value: bgImageUrl.value }), 400);
    });
  }

  // ---------- Uploads ----------
  document.querySelectorAll('[data-upload]').forEach(inp => {
    inp.addEventListener('change', () => {
      const file = inp.files?.[0];
      if (!file) return;
      const kind = inp.dataset.upload;

      if (kind === 'bg') {
        // Upload lourd avec barre de progression (XHR)
        uploadWithProgress(file, kind);
      } else {
        // Avatar / bannière — fetch simple
        uploadSimple(file, kind, inp);
      }
      inp.value = '';
    });
  });

  async function uploadSimple(file, kind, inp) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    setSaveState('saving', 'Upload…');
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'upload failed');
      const thumb = document.getElementById('thumb-' + kind);
      if (thumb) thumb.style.backgroundImage = `url('${j.url}?t=${Date.now()}')`;
      setSaveState('ok', 'Synchronisé');
      refreshPreview();
    } catch (e) {
      setSaveState('error', "Échec de l'upload");
    }
  }

  function uploadWithProgress(file, kind) {
    const progressBox = document.getElementById('bg-upload-progress');
    const fill = document.getElementById('bg-progress-fill');
    const pct  = document.getElementById('bg-progress-pct');
    const txt  = document.getElementById('bg-upload-txt');

    const MB = (file.size / 1048576).toFixed(1);
    txt.textContent = `${file.name} (${MB} Mo) — upload en cours…`;
    progressBox.style.display = 'flex';
    fill.style.width = '0%';
    pct.textContent = '0%';
    setSaveState('saving', 'Upload en cours…');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const p = Math.round(e.loaded / e.total * 100);
      fill.style.width = p + '%';
      pct.textContent = p + '%';
      // Au-delà de 100% upload = traitement serveur (push GitHub en cours)
      if (p === 100) {
        setSaveState('saving', 'Push GitHub…');
        pct.textContent = 'Traitement…';
      }
    });

    xhr.addEventListener('load', () => {
      progressBox.style.display = 'none';
      txt.textContent = 'Uploader image / gif / vidéo (max 98 Mo)';
      try {
        const j = JSON.parse(xhr.responseText);
        if (!j.ok) throw new Error(j.error || 'upload failed');
        const bgUrlInput = document.getElementById('bg-image-url');
        if (bgUrlInput) bgUrlInput.value = j.url;
        setSaveState('ok', 'Synchronisé');
        refreshPreview();
      } catch (e) {
        setSaveState('error', 'Échec upload : ' + (e.message || 'erreur serveur'));
      }
    });

    xhr.addEventListener('error', () => {
      progressBox.style.display = 'none';
      txt.textContent = 'Uploader image / gif / vidéo (max 98 Mo)';
      setSaveState('error', 'Erreur réseau');
    });

    xhr.send(fd);
  }

  // ---------- Music search ----------
  const musicQ = document.getElementById('music-q');
  const musicResults = document.getElementById('music-results');
  let musicTimer;
  let audioPreview = null;
  musicQ.addEventListener('input', () => {
    clearTimeout(musicTimer);
    musicTimer = setTimeout(async () => {
      const q = musicQ.value.trim();
      if (!q) { musicResults.innerHTML = ''; return; }
      const r = await fetch('/api/music?q=' + encodeURIComponent(q));
      const j = await r.json();
      renderMusicResults(j.results || []);
    }, 300);
  });

  function renderMusicResults(items) {
    musicResults.innerHTML = '';
    items.forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${t.cover || ''}" alt="" />
        <div class="info">
          <strong>${escapeHtml(t.title)}</strong>
          <span>${escapeHtml(t.artist)}</span>
        </div>
        <button class="play" title="Aperçu">▶</button>
      `;
      const playBtn = li.querySelector('.play');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audioPreview) { audioPreview.pause(); audioPreview = null; }
        audioPreview = new Audio(t.preview);
        audioPreview.volume = 0.6;
        audioPreview.play();
      });
      li.addEventListener('click', () => selectTrack(t));
      musicResults.appendChild(li);
    });
  }

  function selectTrack(t) {
    if (audioPreview) audioPreview.pause();
    queueSave({ music_track: { id: t.id, title: t.title, artist: t.artist, cover: t.cover, preview: t.preview } });
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
      queueSave({ music_track: null });
      renderMusicCurrent(null);
    });
  }
  const removeBtn = document.getElementById('music-remove');
  if (removeBtn) removeBtn.addEventListener('click', () => {
    queueSave({ music_track: null });
    renderMusicCurrent(null);
  });

  // ---------- Social links ----------
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
  function pushSocials() { queueSave({ social_links: socials }); }

  document.getElementById('add-social').addEventListener('click', () => {
    socials.push({ platform: 'twitter', value: '' });
    renderSocials();
  });
  renderSocials();

  // ---------- Custom links ----------
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
  function pushCustoms() { queueSave({ custom_links: customs }); }

  document.getElementById('add-custom').addEventListener('click', () => {
    customs.push({ label: '', url: '' });
    renderCustoms();
  });
  renderCustoms();

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
