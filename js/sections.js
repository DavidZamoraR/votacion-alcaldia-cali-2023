// sections.js — Paso 3 (puestos): burbujas + reordenamientos
import {
  init, toOutline, toChoropleth,
  showPoints, hidePoints,
  toBubbles, hideBubbles,
  reorderByMargin, reorderByTotal, clusterByWinner,
  clusterByTerritorio      // <--- nuevo
} from "./engineCali.js";

const steps = [
  // 0) Choropleth por ganador (comunas)
  () => { hidePoints(); hideBubbles(); toChoropleth(); },

  // 1) Solo contornos
  () => { hidePoints(false); hideBubbles(); toOutline(); },

  // 2) Contornos + puntos (puestos)
  () => { toOutline(); hideBubbles(); showPoints(); },

  // 3) Burbujas por puesto (tamaño = total votos)
  () => { hidePoints(); toBubbles(); },

  // 4) Reordenar por margen
  () => { reorderByMargin(); },

  // 5) Reordenar por total
  () => { reorderByTotal(); },

  // 6) Agrupar por ganador
  () => { clusterByWinner(); },
  
  () => { clusterByTerritorio(); }, 

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
