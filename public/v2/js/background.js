// Grid paper background pattern with animation
(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackground);
  } else {
    initBackground();
  }

  function initBackground() {
    const container = document.getElementById('wave-container');
    if (!container) return;

    const isLotrMode = document.body?.dataset?.lotrMode === 'true';

    if (isLotrMode) {
      container.style.backgroundImage = `
        radial-gradient(circle at 50% 78%, rgba(255, 96, 33, 0.38) 0%, rgba(255, 96, 33, 0) 36%),
        radial-gradient(circle at 63% 82%, rgba(255, 140, 52, 0.26) 0%, rgba(255, 140, 52, 0) 30%),
        radial-gradient(circle at 18% 14%, rgba(230, 84, 36, 0.2) 0%, rgba(230, 84, 36, 0) 28%),
        linear-gradient(180deg, rgba(44, 20, 14, 0.82) 0%, rgba(33, 15, 11, 0.9) 45%, rgba(20, 9, 7, 0.96) 100%),
        linear-gradient(150deg, transparent 58%, rgba(19, 11, 9, 0.88) 59%),
        linear-gradient(28deg, transparent 54%, rgba(31, 18, 13, 0.85) 55%),
        linear-gradient(169deg, transparent 64%, rgba(14, 8, 6, 0.9) 65%),
        repeating-linear-gradient(115deg, rgba(255, 169, 88, 0.1) 0 2px, rgba(255, 169, 88, 0) 2px 22px)
      `;
      container.style.backgroundSize = '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 280% 280%';
      container.style.backgroundRepeat = 'no-repeat';
      container.style.opacity = '1';
      container.style.filter = 'saturate(1.05) contrast(1.06)';

      let drift = 0;
      function animateLotrBackground() {
        drift += 0.14;
        if (drift > 220) drift -= 220;

        container.style.backgroundPosition = `
          ${drift * 0.12}px ${drift * 0.05}px,
          ${-drift * 0.09}px ${drift * 0.05}px,
          ${drift * 0.06}px ${drift * 0.02}px,
          0 0,
          ${-drift * 0.13}px 0,
          ${drift * 0.11}px 0,
          ${-drift * 0.1}px 0,
          ${drift * 0.45}px ${-drift * 0.18}px
        `;

        requestAnimationFrame(animateLotrBackground);
      }

      animateLotrBackground();
      return;
    }

    // Add grid paper background pattern
    container.style.backgroundImage = `
      linear-gradient(rgba(100, 149, 237, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100, 149, 237, 0.08) 1px, transparent 1px),
      linear-gradient(rgba(100, 149, 237, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100, 149, 237, 0.15) 1px, transparent 1px)
    `;
    container.style.backgroundSize = '20px 20px, 20px 20px, 100px 100px, 100px 100px';
    
    // Animate the background position
    let offsetX = 0;
    let offsetY = 0;
    
    function animateBackground() {
      // Slow diagonal movement
      offsetX += 0.35;
      offsetY += 0.22;
      
      // Keep values reasonable to avoid floating point issues
      if (offsetX > 100) offsetX -= 100;
      if (offsetY > 100) offsetY -= 100;
      
      container.style.backgroundPosition = `
        ${offsetX}px ${offsetY}px,
        ${offsetX}px ${offsetY}px,
        ${offsetX}px ${offsetY}px,
        ${offsetX}px ${offsetY}px
      `;
      
      requestAnimationFrame(animateBackground);
    }
    
    animateBackground();
  }
})();
