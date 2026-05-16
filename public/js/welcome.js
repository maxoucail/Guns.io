(() => {
  const input = document.getElementById('username');
  const preview = document.getElementById('preview-pseudo');
  const status = document.getElementById('claim-status');
  if (!input) return;

  let t;
  const check = async (v) => {
    if (!v) { status.className = 'claim-status'; status.textContent = ''; return; }
    try {
      const r = await fetch('/api/username?u=' + encodeURIComponent(v));
      const j = await r.json();
      if (j.ok) { status.className = 'claim-status ok'; status.textContent = 'Disponible !'; }
      else {
        status.className = 'claim-status err';
        status.textContent = ({
          too_short: 'Trop court (min 3 caractères)',
          too_long: 'Trop long (max 20)',
          invalid_chars: 'Lettres, chiffres, _ ou . uniquement',
          taken: 'Déjà pris',
          reserved: 'Réservé',
          invalid: 'Invalide'
        })[j.reason] || 'Indisponible';
      }
    } catch { }
  };

  input.addEventListener('input', (e) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    e.target.value = v;
    preview.textContent = v || 'pseudo';
    clearTimeout(t);
    t = setTimeout(() => check(v), 250);
  });
})();
