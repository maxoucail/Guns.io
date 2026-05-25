/* ============================================================
   GUNS.IO — EDITOR.JS
   Profile editor interactions, live preview, music search
   ============================================================ */

(function() {
  // === Tab Switching ===
  const tabs = document.querySelectorAll('.editor-tab');
  const panels = document.querySelectorAll('.editor-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      panels.forEach(p => p.classList.remove('active'));
      const panel = document.querySelector(`[data-panel="${target}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // === Preview Device Toggle ===
  const deviceButtons = document.querySelectorAll('.preview-device-toggle button');
  const previewFrame = document.getElementById('previewFrame');
  
  deviceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      deviceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.device === 'mobile') {
        previewFrame.closest('.preview-frame').classList.add('mobile-view');
      } else {
        previewFrame.closest('.preview-frame').classList.remove('mobile-view');
      }
    });
  });

  // === Bio Character Count ===
  const bioInput = document.getElementById('bio');
  const bioCount = document.getElementById('bioCount');
  if (bioInput && bioCount) {
    bioCount.textContent = bioInput.value.length;
    bioInput.addEventListener('input', () => {
      bioCount.textContent = bioInput.value.length;
    });
  }

  // === Color Picker Sync ===
  const primaryColorInput = document.getElementById('primaryColor');
  const primaryColorText = document.getElementById('primaryColorText');
  if (primaryColorInput && primaryColorText) {
    primaryColorText.value = primaryColorInput.value;
    primaryColorInput.addEventListener('input', () => {
      primaryColorText.value = primaryColorInput.value;
      updateLivePreview();
    });
  }

  // === Range Slider ===
  const bgOpacityInput = document.getElementById('bgOpacity');
  if (bgOpacityInput) {
    const rangeValue = bgOpacityInput.nextElementSibling;
    bgOpacityInput.addEventListener('input', () => {
      if (rangeValue) rangeValue.textContent = bgOpacityInput.value + '%';
      updateLivePreview();
    });
  }

  // === Theme Selector ===
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
      this.closest('.theme-option').classList.add('selected');
      updateLivePreview();
    });
  });

  // === Effect Selector ===
  document.querySelectorAll('input[name="effect"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.effect-option').forEach(opt => opt.classList.remove('selected'));
      this.closest('.effect-option').classList.add('selected');
      updateLivePreview();
    });
  });

  // === Link Management ===
  const linksContainer = document.getElementById('linksContainer');
  const addLinkBtn = document.getElementById('addLink');
  let linkIndex = linksContainer?.children.length || 0;

  function createLinkItem(title = '', url = '', icon = '') {
    const index = linkIndex++;
    const div = document.createElement('div');
    div.className = 'link-item';
    div.dataset.index = index;
    div.innerHTML = `
      <div class="link-item-header">
        <span class="link-item-drag"><i class="fa-solid fa-grip-vertical"></i></span>
        <input type="text" name="custom_links[${index}][label]" value="${escapeHtml(title)}" placeholder="Titre du lien" class="link-title">
        <button type="button" class="link-item-remove">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <input type="url" name="custom_links[${index}][url]" value="${escapeHtml(url)}" placeholder="https://..." class="link-url">
      <select name="custom_links[${index}][icon]" class="link-icon-select">
        <option value="">Pas d'icône</option>
        <option value="fa-github" ${icon === 'fa-github' ? 'selected' : ''}>GitHub</option>
        <option value="fa-youtube" ${icon === 'fa-youtube' ? 'selected' : ''}>YouTube</option>
        <option value="fa-x-twitter" ${icon === 'fa-x-twitter' ? 'selected' : ''}>Twitter/X</option>
        <option value="fa-discord" ${icon === 'fa-discord' ? 'selected' : ''}>Discord</option>
        <option value="fa-instagram" ${icon === 'fa-instagram' ? 'selected' : ''}>Instagram</option>
        <option value="fa-twitch" ${icon === 'fa-twitch' ? 'selected' : ''}>Twitch</option>
        <option value="fa-tiktok" ${icon === 'fa-tiktok' ? 'selected' : ''}>TikTok</option>
        <option value="fa-spotify" ${icon === 'fa-spotify' ? 'selected' : ''}>Spotify</option>
        <option value="fa-globe" ${icon === 'fa-globe' ? 'selected' : ''}>Site web</option>
        <option value="fa-envelope" ${icon === 'fa-envelope' ? 'selected' : ''}>Email</option>
      </select>
    `;
    
    div.querySelector('.link-item-remove').addEventListener('click', () => {
      div.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
      div.style.opacity = '0';
      div.style.transform = 'scale(0.95)';
      setTimeout(() => div.remove(), 200);
      updateLivePreview();
    });
    
    return div;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const linkItem = createLinkItem();
      linksContainer.appendChild(linkItem);
      linkItem.querySelector('.link-title').focus();
      updateLivePreview();
    });
  }

  // Remove existing links
  document.querySelectorAll('.link-item-remove').forEach(btn => {
    btn.addEventListener('click', function() {
      const item = this.closest('.link-item');
      item.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
      item.style.opacity = '0';
      item.style.transform = 'scale(0.95)';
      setTimeout(() => item.remove(), 200);
      updateLivePreview();
    });
  });

  // === Music Search ===
  const musicSearch = document.getElementById('musicSearch');
  const musicSource = document.getElementById('musicSource');
  const musicResults = document.getElementById('musicResults');
  let musicSearchTimeout;

  if (musicSearch && musicResults) {
    musicSearch.addEventListener('input', function() {
      clearTimeout(musicSearchTimeout);
      const query = this.value.trim();
      
      if (query.length < 2) {
        musicResults.innerHTML = '';
        return;
      }

      musicResults.innerHTML = '<div class="loading-spinner"></div>';
      
      musicSearchTimeout = setTimeout(() => {
        fetch(`/api/music-search?q=${encodeURIComponent(query)}`)
          .then(res => res.json())
          .then(data => {
            if (data.results?.length) {
              musicResults.innerHTML = data.results.map((track, i) => `
                <div class="music-result-item" data-track='${JSON.stringify(track).replace(/'/g, "&#39;")}'>
                  <img src="${track.cover || ''}" alt="${track.title}" onerror="this.style.display='none'">
                  <div class="music-result-info">
                    <span class="music-result-title">${track.title}</span>
                    <span class="music-result-artist">${track.artist}</span>
                  </div>
                  <button class="music-result-add" data-index="${i}">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </div>
              `).join('');
              
              // Add click handlers
              musicResults.querySelectorAll('.music-result-add').forEach(btn => {
                btn.addEventListener('click', function(e) {
                  e.stopPropagation();
                  const trackEl = this.closest('.music-result-item');
                  try {
                    const track = JSON.parse(trackEl.dataset.track);
                    addMusicTrack(track);
                  } catch (err) {
                    console.error('Failed to parse track data', err);
                  }
                });
              });
              musicResults.querySelectorAll('.music-result-item').forEach(item => {
                item.addEventListener('click', function() {
                  try {
                    const track = JSON.parse(this.dataset.track);
                    addMusicTrack(track);
                  } catch (err) {
                    console.error('Failed to parse track data', err);
                  }
                });
              });
            } else {
              musicResults.innerHTML = '<p class="muted" style="padding:16px;text-align:center;font-size:0.85rem;">Aucun résultat trouvé</p>';
            }
          })
          .catch(() => {
            musicResults.innerHTML = '<p class="muted" style="padding:16px;text-align:center;font-size:0.85rem;">Erreur de recherche</p>';
          });
      }, 400);
    });
  }

  function addMusicTrack(track) {
    const playlist = document.querySelector('.music-playlist');
    if (!playlist) return;
    
    const trackEl = document.createElement('div');
    trackEl.className = 'music-track';
    trackEl.innerHTML = `
      <img src="${track.cover || ''}" alt="${track.title}" class="music-track-cover" onerror="this.style.display='none'">
      <div class="music-track-info">
        <span class="music-track-title">${track.title}</span>
        <span class="music-track-artist">${track.artist}</span>
      </div>
      <input type="hidden" name="music[]" value='${JSON.stringify(track).replace(/'/g, "&#39;")}'>
      <button type="button" class="btn btn-small btn-danger">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    
    trackEl.querySelector('button').addEventListener('click', () => {
      trackEl.style.transition = 'opacity 0.2s ease-out';
      trackEl.style.opacity = '0';
      setTimeout(() => trackEl.remove(), 200);
    });
    
    playlist.appendChild(trackEl);
    window.showToast?.('Musique ajoutée !', 'success');
  }

  // Remove existing music tracks
  document.querySelectorAll('.music-track .btn-danger').forEach(btn => {
    btn.addEventListener('click', function() {
      const track = this.closest('.music-track');
      track.style.transition = 'opacity 0.2s ease-out';
      track.style.opacity = '0';
      setTimeout(() => track.remove(), 200);
    });
  });

  // === Avatar Preview ===
  const avatarInput = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');
  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('change', function() {
      const file = this.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          avatarPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // === Live Preview Update ===
  let previewTimeout;
  function updateLivePreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
      const iframe = document.getElementById('previewFrame');
      if (!iframe) return;
      try {
        iframe.contentWindow?.location?.reload();
      } catch (e) {
        // Cross-origin, ignore
      }
    }, 500);
  }

  // Debounced input listeners for live preview
  const form = document.getElementById('editorForm');
  if (form) {
    form.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea, select')) {
        updateLivePreview();
      }
    });
  }

  // === Form Submit ===
  form?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveProfile');
    if (saveBtn) {
      saveBtn.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;margin:0 auto;"></div>';
      saveBtn.disabled = true;
    }
    
    try {
      // Build JSON payload from form
      const fd = new FormData(this);
      const payload = {};
      
      // Simple fields
      for (const [key, val] of fd.entries()) {
        if (key.startsWith('custom_links[') || key.startsWith('social_links[') || key.startsWith('music')) continue;
        if (payload[key] === undefined) {
          payload[key] = val;
        }
      }
      
      // Collect custom_links
      const customLinks = [];
      const linkMap = {};
      for (const [key, val] of fd.entries()) {
        const m = key.match(/^custom_links\[(\d+)\]\[(\w+)\]$/);
        if (m) {
          if (!linkMap[m[1]]) linkMap[m[1]] = {};
          linkMap[m[1]][m[2]] = val;
        }
      }
      for (const idx of Object.keys(linkMap).sort((a,b) => +a - +b)) {
        const l = linkMap[idx];
        if (l.label && l.url) customLinks.push(l);
      }
      payload.custom_links = customLinks;
      
      // Collect social_links from named fields
      const socialLinks = [];
      const socialInputs = form.querySelectorAll('[name^="social_links"]');
      socialInputs.forEach(s => {
        const platform = s.name.match(/social_links\[(\w+)\]/)?.[1];
        if (platform && s.value) {
          socialLinks.push({ platform, value: s.value });
        }
      });
      if (socialLinks.length) payload.social_links = socialLinks;
      
      // Collect music from hidden inputs
      const musicInputs = form.querySelectorAll('[name="music[]"]');
      if (musicInputs.length) {
        try {
          payload.music_track = JSON.parse(musicInputs[musicInputs.length - 1].value);
        } catch {}
      }
      
      // Booleans from checkboxes
      for (const el of form.elements) {
        if (el.type === 'checkbox' && el.name) {
          payload[el.name] = el.checked;
        }
      }
      
      // Convert numeric fields
      for (const k of ['overlayOpacity', 'fxIntensity', 'music_volume']) {
        if (k in payload) payload[k] = parseFloat(payload[k]) || 0;
      }
      
      const response = await fetch('/api/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        window.showToast?.('Profil sauvegardé !', 'success');
      } else {
        window.showToast?.(result.error || 'Erreur lors de la sauvegarde', 'error');
      }
    } catch (err) {
      window.showToast?.('Erreur réseau', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Sauvegarder les modifications';
        saveBtn.disabled = false;
      }
    }
  });

  // === Reset ===
  document.getElementById('resetProfile')?.addEventListener('click', () => {
    if (confirm('Réinitialiser toutes les modifications non sauvegardées ?')) {
      window.location.reload();
    }
  });

  // === Keyboard Shortcuts ===
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      form?.dispatchEvent(new Event('submit'));
    }
  });
})();
