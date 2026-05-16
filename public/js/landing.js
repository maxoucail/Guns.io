(() => {
  // Petit effet : préview qui suit légèrement le curseur
  const win = document.querySelector('.preview-window');
  if (!win) return;
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 4;
    const y = (e.clientY / window.innerHeight - 0.5) * 4;
    win.style.transform = `perspective(2000px) rotateX(${6 - y}deg) rotateY(${x}deg)`;
  });
})();
