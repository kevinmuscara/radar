// Disable automatic scroll restoration on refresh
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Force scroll to top immediately
window.scrollTo(0, 0);

// Prevent any scroll during page load
document.documentElement.style.scrollBehavior = 'auto';

requestAnimationFrame(() => {
  window.scrollTo(0, 0);
  document.body.classList.add('loaded');
  
  // Re-enable smooth scrolling after animation
  setTimeout(() => {
    document.documentElement.style.scrollBehavior = '';
  }, 1000);
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  const setupCard = document.getElementById('setupCard');
  const formPanel = document.getElementById('formPanel');

  const resetTransforms = () => {
    if (setupCard) setupCard.style.transform = '';
    if (formPanel) formPanel.style.transform = '';
  };

  window.addEventListener('mousemove', (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    if (setupCard) {
      setupCard.style.transform = `translate(${x * 5}px, ${y * 4}px)`;
    }

    if (formPanel) {
      formPanel.style.transform = `translate(${x * 3}px, ${y * 2}px)`;
    }
  }, { passive: true });

  window.addEventListener('mouseleave', resetTransforms);
  window.addEventListener('blur', resetTransforms);
}