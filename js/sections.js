// sections.js — 0..10 (sin IntersectionObserver; robusto por centro de viewport)
import {
  init,
  toHero, toOutline, toChoroplethSimple, toChoroplethMargin,
  showPointsStep4, forceSeparateStep5, bubblesByTotalAndMarginStep6, centerAllStep7,
  reorderXByMargin, reorderYByTotal, clusterByWinnerLabeled, hideClusterLabels
} from "./engineCali.js";

// Mapa de funciones por índice de .step (0..10)
const steps = [
  () => { toHero(); },                         // 0
  () => { toOutline(); },                      // 1
  () => { toChoroplethSimple(); },             // 2
  () => { toChoroplethMargin(); },             // 3
  () => { showPointsStep4(); },                // 4  ← aparecen los puntos
  () => { forceSeparateStep5(); },             // 5
  () => { bubblesByTotalAndMarginStep6(); },   // 6
  () => { centerAllStep7(); },                 // 7
  () => { reorderXByMargin(); },               // 8
  () => { reorderYByTotal(); },                // 9
  () => { clusterByWinnerLabeled(); }          // 10
];

function setupSections(){
  const els = Array.from(document.querySelectorAll(".step"));
  if (els.length !== steps.length) {
    console.warn(`[sections] .step=${els.length} != steps=${steps.length}`);
  }

  let activeIndex = -1;

  const setActive = (i) => {
    if (i === activeIndex || i < 0 || i >= steps.length) return;
    activeIndex = i;

    // Visual: resaltar el step activo
    els.forEach((el, j) => el.classList.toggle("is-active", i===j));

    // Ejecutar escena
    const fn = steps[i];
    if (typeof fn === "function") {
      // Depuración: comenta la siguiente línea si no quieres logs
      console.log(`[sections] activate step ${i}`);
      fn();
    }

    // Si sales del 10, oculta etiquetas de clusters
    if (i !== 10) hideClusterLabels();
  };

  // Calcula el índice del step cuyo centro está más cerca del centro del viewport
  const stepNearViewportCenter = () => {
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const centerY = vh / 2;
    let best = -1, bestDist = Infinity;
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const elCenter = r.top + r.height / 2;
      const dist = Math.abs(elCenter - centerY);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  };

  // Activación inicial
  const activateInitial = () => {
    let bestIdx = 0, bestArea = 0;
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visible > bestArea){ bestArea = visible; bestIdx = i; }
    });
    setActive(bestIdx);
  };

  // Scroll con throttle (~8Hz)
  let ticking = false;
  let lastRun = 0;
  const SCROLL_THROTTLE_MS = 120;

  const onScroll = () => {
    const now = performance.now();
    if (now - lastRun < SCROLL_THROTTLE_MS) return;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const idx = stepNearViewportCenter();
      if (idx !== -1) setActive(idx);
      lastRun = now;
      ticking = false;
    });
  };

  // Resize/orientation → re-evaluar
  let rafId = null;
  const onResize = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      activateInitial();
      onScroll();
    });
  };

  // Eventos
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // Arranque
  activateInitial();

  // Atajos ↑/↓ para depurar manualmente
  // window.addEventListener("keydown", (ev) => {
  //   if (ev.key === "ArrowDown") setActive(Math.min(activeIndex + 1, steps.length - 1));
  //   if (ev.key === "ArrowUp")   setActive(Math.max(activeIndex - 1, 0));
  // });
}

document.addEventListener("DOMContentLoaded", async () => {
  await init();       // carga datos + dibuja base
  setupSections();    // conecta el scrollytelling
});
