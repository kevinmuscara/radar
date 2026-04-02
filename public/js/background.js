(function () {
  "use strict";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBackground);
  } else {
    initBackground();
  }

  function initBackground() {
    const container = document.getElementById("wave-container");
    if (!container) return;

    const isLotrMode = document.body?.dataset?.lotrMode === "true";

    if (isLotrMode) {
      container.style.backgroundImage = `
        radial-gradient(circle at 18% 8%, rgba(170, 127, 82, 0.44) 0%, rgba(170, 127, 82, 0) 34%),
        radial-gradient(circle at 86% 14%, rgba(122, 85, 54, 0.34) 0%, rgba(122, 85, 54, 0) 38%),
        radial-gradient(circle at 50% 100%, rgba(59, 40, 25, 0.34) 0%, rgba(59, 40, 25, 0) 46%),
        repeating-linear-gradient(12deg, rgba(83, 62, 35, 0.16) 0 1px, transparent 1px 16px),
        repeating-linear-gradient(-14deg, rgba(102, 75, 46, 0.15) 0 1px, transparent 1px 17px),
        linear-gradient(180deg, rgba(170, 133, 93, 0.38) 0%, rgba(116, 86, 58, 0.28) 52%, rgba(73, 53, 35, 0.26) 100%)
      `;
      container.style.backgroundSize =
        "100% 100%, 100% 100%, 100% 100%, 180% 180%, 170% 170%, 100% 100%";
      container.style.backgroundRepeat = "no-repeat";
      container.style.opacity = "0.92";

      let drift = 0;
      function animateLotrBackground() {
        drift += 0.05;
        if (drift > 180) drift -= 180;

        container.style.backgroundPosition = `
          ${drift * 0.1}px ${drift * 0.03}px,
          ${-drift * 0.07}px ${drift * 0.02}px,
          0 ${-drift * 0.04}px,
          ${-drift * 0.12}px ${drift * 0.08}px,
          ${drift * 0.09}px ${-drift * 0.06}px,
          0 0
        `;

        requestAnimationFrame(animateLotrBackground);
      }

      animateLotrBackground();
      return;
    }

    container.style.backgroundImage = `
      linear-gradient(rgba(100, 149, 237, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100, 149, 237, 0.08) 1px, transparent 1px),
      linear-gradient(rgba(100, 149, 237, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100, 149, 237, 0.15) 1px, transparent 1px)
    `;
    container.style.backgroundSize =
      "20px 20px, 20px 20px, 100px 100px, 100px 100px";

    let offsetX = 0;
    let offsetY = 0;

    function animateBackground() {
      offsetX += 0.35;
      offsetY += 0.22;

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
