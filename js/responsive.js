/* responsive.js
   Sincroniza tamaños del panel sticky y componentes D3
   - Observa resize de ventana y del contenedor #graphic/#vis
   - Llama _engine.updateSize() y _story.refresh()
   - Seguro aunque aún no existan _engine/_story
*/

(function () {
  // ------------- Utils -------------
  function debounce(fn, wait = 120) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function safeUpdate() {
    const eng = window._engine;
    const story = window._story;
    if (eng && typeof eng.updateSize === "function") {
      eng.updateSize();
    }
    if (story && typeof story.refresh === "function") {
      story.refresh();
    }
  }

  const debouncedUpdate = debounce(safeUpdate, 120);

  // ------------- Observers -------------
  let roGraphic = null;
  let roVis = null;

  function attachObservers() {
    const graphic = document.querySelector("#graphic");
    const vis = document.querySelector("#vis");

    if (window.ResizeObserver) {
      if (graphic) {
        roGraphic = new ResizeObserver(debouncedUpdate);
        roGraphic.observe(graphic);
      }
      if (vis) {
        roVis = new ResizeObserver(debouncedUpdate);
        roVis.observe(vis);
      }
    }

    // Eventos del viewport
    window.addEventListener("resize", debouncedUpdate, { passive: true });
    window.addEventListener("orientationchange", debouncedUpdate, { passive: true });

    // Por si cambia el zoom/DPR (algunos navegadores disparan esta media query)
    if (window.matchMedia) {
      try {
        const dprQuery = window.matchMedia(`(resolution: ${Math.round(window.devicePixelRatio || 1)}dppx)`);
        if (dprQuery && typeof dprQuery.addEventListener === "function") {
          dprQuery.addEventListener("change", debouncedUpdate);
        }
      } catch (_) { /* noop */ }
    }

    // Recalcular al entrar en cada escena (por si el layout cambia)
    window.addEventListener("story:enter", debouncedUpdate);
  }

  function detachObservers() {
    if (roGraphic) { roGraphic.disconnect(); roGraphic = null; }
    if (roVis) { roVis.disconnect(); roVis = null; }
    window.removeEventListener("resize", debouncedUpdate);
    window.removeEventListener("orientationchange", debouncedUpdate);
    window.removeEventListener("story:enter", debouncedUpdate);
  }

  // ------------- Auto-init -------------
  // Si el DOM ya está listo, adjunta. Con defer, esto se ejecuta al final.
  (function init() {
    attachObservers();
    // Primer ajuste por si el SVG se montó antes
    debouncedUpdate();
  })();

  // ------------- Exponer helpers opcionales -------------
  window._responsive = {
    refresh: debouncedUpdate,
    destroy: detachObservers
  };

})();
