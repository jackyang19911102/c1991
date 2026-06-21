// C1991 — Common Logic

document.addEventListener('DOMContentLoaded', () => {
  // Highlight active nav link
  const path = location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && path.endsWith(href.replace(/\/$/, ''))) {
      link.classList.add('active');
    }
  });
});
