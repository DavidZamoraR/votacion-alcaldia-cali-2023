// sections.js — Paso 3: añade estados de burbujas y reordenamientos
import {
  init, toOutline, toChoropleth,
  showPoints, hidePoints,
  toBubbles, hideBubbles,
  reorderByMargin, reorderByTotal, clusterByWinner
} from "./engineCali.js";

const steps = [
  // 0) Choropleth por ganador
  () => { hidePoints(); hideBubbles(); toChoropleth(); },

  // 1) Solo contornos
  () => { hidePoints(false); hideBubbles(); toOutline(); },

  // 2) Contornos + puntos (puestos)
  () => { toOutline(); hideBubbles(); showPoints(); },

  // 3) Burbujas: tamaño = total votos
  () => { hidePoints(); toBubbles(); },

  // 4) Reordenar por margen
  () => { reorderByMargin(); },

  // 5) Reordenar por total
  () => { reorderByTotal(); },

  // 6) Agrupar por ganador
  () => { clusterByWinner(); },

  // 7) (Opcional) volver al mapa coloreado
  () => { hidePoints(); hideBubbles(); toChoropleth(); }
];

function setupSections(){
  const els = Array.from(document.querySelectorAll(".step"));
  const setActive = (i) => {
    els.forEach((el, j) => el.classList.toggle("is-active", i===j));
    const fn = steps[i];
    if (typeof fn === "function") fn();
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
