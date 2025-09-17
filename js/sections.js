// sections.js — 0..10
import {
  init,
  toHero, toOutline, toChoroplethSimple, toChoroplethMargin,
  showPointsStep4, forceSeparateStep5, bubblesByTotalAndMarginStep6, centerAllStep7,
  reorderXByMargin, reorderYByTotal, clusterByWinnerLabeled, hideClusterLabels
} from "./engineCali.js";

const steps = [
  () => { toHero(); },                         // 0
  () => { toOutline(); },                      // 1
  () => { toChoroplethSimple(); },             // 2
  () => { toChoroplethMargin(); },             // 3
  () => { showPointsStep4(); },                // 4
  () => { forceSeparateStep5(); },             // 5
  () => { bubblesByTotalAndMarginStep6(); },   // 6
  () => { centerAllStep7(); },                 // 7
  () => { reorderXByMargin(); },               // 8
  () => { reorderYByTotal(); },                // 9
  () => { clusterByWinnerLabeled(); }          // 10
];

function setupSections(){
  const els = Array.from(document.querySelectorAll(".step"));

  const setActive = (i) => {
    els.forEach((el, j) => el.classList.toggle("is-active", i===j));
    const fn = steps[i]; if (typeof fn === "function") fn();
    // si sales del 10, ocultamos etiquetas
    if (i !== 10) hideClusterLabels();
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6){
        const idx = els.indexOf(e.target);
        if (idx > -1) setActive(idx);
      }
    });
  }, { threshold: [0.6] });

  els.forEach(el => io.observe(el));

  // activa el step visible al cargar
  const checkInitial = () => {
    let bestIdx = 0, bestArea = 0;
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visible > bestArea){ bestArea = visible; bestIdx = i; }
    });
    setActive(bestIdx);
  };
  checkInitial();
}

document.addEventListener("DOMContentLoaded", async () => {
  await init();
  setupSections();
});
