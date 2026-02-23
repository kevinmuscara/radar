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
        radial-gradient(circle at 20% 15%, rgba(255, 244, 214, 0.72) 0%, rgba(255, 244, 214, 0) 34%),
        radial-gradient(circle at 82% 18%, rgba(255, 236, 190, 0.62) 0%, rgba(255, 236, 190, 0) 36%),
        linear-gradient(180deg, rgba(180, 209, 186, 0.5) 0%, rgba(148, 175, 145, 0.32) 44%, rgba(90, 112, 89, 0.18) 100%),
        linear-gradient(155deg, transparent 56%, rgba(74, 96, 73, 0.45) 57%),
        linear-gradient(25deg, transparent 54%, rgba(93, 121, 89, 0.43) 55%),
        linear-gradient(165deg, transparent 61%, rgba(58, 75, 59, 0.5) 62%),
        linear-gradient(10deg, transparent 63%, rgba(41, 59, 44, 0.48) 64%)
      `;
      container.style.backgroundSize = '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%';
      container.style.backgroundRepeat = 'no-repeat';
      container.style.opacity = '0.95';

      let drift = 0;
      function animateLotrBackground() {
        drift += 0.08;
        if (drift > 120) drift -= 120;

        container.style.backgroundPosition = `
          ${drift * 0.18}px ${drift * 0.05}px,
          ${-drift * 0.12}px ${drift * 0.04}px,
          0 0,
          ${-drift * 0.16}px 0,
          ${drift * 0.14}px 0,
          ${-drift * 0.11}px 0,
          ${drift * 0.09}px 0
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
