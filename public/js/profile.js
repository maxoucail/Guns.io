/* ============================================================
   GUNS.IO — PROFILE.JS
   Public profile page interactions
   ============================================================ */

(function() {
  // Custom cursor
  const cursor = document.getElementById('customCursor');
  if (cursor) {
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = '1';
    });
  }

  // Track link clicks for stats
  document.querySelectorAll('.profile-link').forEach(link => {
    link.addEventListener('click', function() {
      const linkId = this.dataset.linkId;
      const username = document.body.dataset.profile;
      if (linkId && username && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/click/${username}`, JSON.stringify({
          linkId: linkId
        }));
      }
    });
  });

  // View tracking is handled server-side on page load
  const username = document.body.dataset.profile;

  // Animate elements on load
  window.addEventListener('load', () => {
    document.querySelectorAll('.profile-link, .profile-music-track, .profile-social-link').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 50 + i * 60);
    });
  });
})();
