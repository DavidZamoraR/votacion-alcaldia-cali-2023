// sections.js — activación “por centro de viewport” (1 solo step activo)
// Usa engineCali.js para ejecutar las transiciones de cada paso.

import {
  init,
  toHero, toOutline, toChoroplethSimple, toChoroplethMargin,
  showPointsStep4, forceSeparateStep5, bubblesByTotalAndMarginStep6, centerAllStep7,
  reorderXByMargin, reorderYByTotal, clusterByWinnerLabeled, hideClusterLabels
} from "./engineCali.js";

// Orden de escenas (0..10)
const stepsFns = [
  () => toHero(),                         // 0
  () => toOutline(),                      // 1
  () => toChoroplethSimple(),             // 2
  () => toChoroplethMargin(),             // 3
  () => showPointsStep4(),                // 4
  () => forceSeparateStep5(),             // 5
  () => bubblesByTotalAndMarginStep6(),   // 6
  () => centerAllStep7(),                 // 7
  () => reorderXByMargin(),               // 8
  () => reorderYByTotal(),                // 9
  () => clusterByWinnerLabeled()          // 10
];

let stepEls = [];
let active = -1;
let ticking = false;

function setActive(i){
  if (i === active) return;
  stepEls.forEach((el, j) => el.classList.toggle("is-active", i === j));
  active = i;

  const fn = stepsFns[i];
  if (typeof fn === "function") fn();

  // Si salimos del 10 quitamos etiquetas
  if (i !== 10) hideClusterLabels();
}

function checkAndActivate(){
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const center = vh / 2;
  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < stepEls.length; i++){
    const r = stepEls[i].getBoundingClientRect();
    const cy = (r.top + r.bottom) / 2;
    const dist = Math.abs(cy - center);
    if (dist < bestDist){
      bestDist = dist;
      bestIdx = i;
    }
  }
  setActive(bestIdx);
}

function onScroll(){
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    checkAndActivate();
  });
}

function onResize(){
  requestAnimationFrame(checkAndActivate);
}

document.addEventListener("DOMContentLoaded", async () => {
  await init();

  // Cachear steps
  stepEls = Array.from(document.querySelectorAll("#sections .step"));

  // Listeners (unificados desktop/móvil)
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // Activación inicial (elige el más centrado al cargar)
  checkAndActivate();
});
