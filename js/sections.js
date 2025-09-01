// sections.js — Steps 0..7 según tu guion
import {
  init, toHero, toOutline, toChoroplethSimple, toChoroplethMargin,
  showPointsStep4, forceSeparateStep5, bubblesByTotalAndMarginStep6, centerAllStep7
} from "./engineCali.js";

const steps = [
  () => { toHero(); },                 // 0) Intro con fotos
  () => { toOutline(); },              // 1) Mapa contornos
  () => { toChoroplethSimple(); },     // 2) Choropleth ganador
  () => { toChoroplethMargin(); },     // 3) Choropleth con margen
  () => { showPointsStep4(); },        // 4) Puntos por puesto (color ganador)
  () => { forceSeparateStep5(); },     // 5) Fuerza de colisión
  () => { bubblesByTotalAndMarginStep6(); }, // 6) Radio por total + color por margen
  () => { centerAllStep7(); }          // 7) Todos al centro
];

function setupSections(){
  const els = Array.from(document.querySelectorAll(".step"));

  const setActive = (i) => {
    els.forEach((el, j) => el.classList.toggle("is-active", i===j));
    const fn = steps[i]; if (typeof fn === "function") fn();
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
}

document.addEventListener("DOMContentLoaded", async () => {
  await init();
  setupSections();
});
