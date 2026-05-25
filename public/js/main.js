/* ============================================================
   GUNS.IO — MAIN.JS
   Global site scripts
   ============================================================ */

(function() {
  // Load effects.js dynamically on pages that need it (profile pages)
  if (document.querySelector('.profile-page') && document.getElementById('effectsCanvas')) {
    const script = document.createElement('script');
    script.src = '/js/effects.js';
    document.body.appendChild(script);
  }

  // Toast notification system
  window.showToast = function(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'xmark-circle' : type === 'warning' ? 'triangle-exclamation' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    // Trigger reflow and show
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // Toast styles injection
  const toastStyles = document.createElement('style');
  toastStyles.textContent = `
    .toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      display: flex; align-items: center; gap: 10px;
      padding: 14px 20px; border-radius: 12px;
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text); font-size: 0.9rem; font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      transform: translateY(100px); opacity: 0;
      transition: transform 0.3s ease-out, opacity 0.3s ease-out;
      max-width: 400px;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast-success i { color: var(--success); }
    .toast-error i { color: var(--danger); }
    .toast-warning i { color: var(--warning); }
    .toast-info i { color: var(--primary); }
    @media (max-width: 480px) {
      .toast { left: 16px; right: 16px; bottom: 16px; max-width: none; }
    }
  `;
  document.head.appendChild(toastStyles);

  // Copy to clipboard utility
  window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
      window.showToast('Copié !', 'success');
    }).catch(() => {
      window.showToast('Erreur lors de la copie', 'error');
    });
  };

  // Auto-dismiss flash messages
  document.querySelectorAll('.flash-message').forEach(msg => {
    setTimeout(() => {
      msg.style.opacity = '0';
      msg.style.transform = 'translateY(-10px)';
      setTimeout(() => msg.remove(), 300);
    }, 5000);
  });
})();
