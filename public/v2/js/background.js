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
