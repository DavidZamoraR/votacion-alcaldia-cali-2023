/* scroller_util.js
   Utilidades para scrollytelling:
   - Observa pasos (.step) y activa/desactiva clases
   - Emite callbacks (enter/exit/progress)
   - Actualiza barra de progreso #progress .progress-bar
   - Gestiona estado sticky del panel #vis (is-fixed / is-bottom)
   Requiere: CSS con #vis.sticky (position: sticky) y .step.active
*/

(function () {

  // ----------------- Helpers -----------------
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function throttle(fn, wait) {
    let inThrottle = false, lastArgs, lastThis;
    return function throttled(...args) {
      lastArgs = args; lastThis = this;
      if (!inThrottle) {
        fn.apply(lastThis, lastArgs);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
          if (lastArgs !== args) {
            fn.apply(lastThis, lastArgs);
          }
        }, wait);
      }
    };
  }

  // ----------------- Factory -----------------
  function createScroller(opts = {}) {
    const cfg = {
      stepsSelector: opts.stepsSelector || "#sections .step",
      graphicSelector: opts.graphicSelector || "#graphic",
      visSelector: opts.visSelector || "#vis",
      progressSelector: opts.progressSelector || "#progress .progress-bar",
      activeClass: opts.activeClass || "active",
      // El umbral determina cuándo un paso se considera “activo”
      stepThreshold: opts.stepThreshold ?? 0.6,
      // Anclaje vertical para el cálculo de progreso del paso (porcentaje de viewport)
      anchorRatio: opts.anchorRatio ?? 0.6,
      // Throttling de scroll/resize
      throttleMs: opts.throttleMs ?? 50
    };

    // Estado interno
    let steps = Array.from(document.querySelectorAll(cfg.stepsSelector));
    const graphic = document.querySelector(cfg.graphicSelector);
    const vis = document.querySelector(cfg.visSelector);
    const progressBar = document.querySelector(cfg.progressSelector);

    let activeIndex = -1;
    let onStepEnter = () => {};
    let onStepExit = () => {};
    let onStepProgress = () => {};

    // Observers
    let stepObserver = null;

    // ----------------- Core -----------------
    function setActive(i) {
      if (i === activeIndex || i < 0 || i >= steps.length) return;
      // Salida del paso anterior
      if (activeIndex >= 0) {
        steps[activeIndex].classList.remove(cfg.activeClass);
        onStepExit(activeIndex, steps[activeIndex]);
      }
      // Entrada al nuevo
      activeIndex = i;
      steps[activeIndex].classList.add(cfg.activeClass);
      onStepEnter(activeIndex, steps[activeIndex]);
      updateProgressUI(); // ancho de barra
    }

    function updateProgressUI() {
      if (!progressBar || steps.length === 0) return;
      // Progreso total = (índice + progreso dentro del paso) / (n-1)
      const within = computeStepProgress(activeIndex);
      const denom = Math.max(1, steps.length - 1);
      const total = clamp((activeIndex + within) / denom, 0, 1);
      progressBar.style.width = (total * 100).toFixed(2) + "%";
    }

    function computeStepProgress(i) {
      if (i < 0 || i >= steps.length) return 0;
      const step = steps[i];
      const rect = step.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const anchorY = vh * cfg.anchorRatio;
      // 0 cuando la parte superior del paso está por debajo del ancla,
      // 1 cuando la parte inferior está por encima del ancla.
      const raw = (anchorY - rect.top) / rect.height;
      return clamp(raw, 0, 1);
    }

    function updateStickyState() {
      if (!graphic || !vis) return;
      const g = graphic.getBoundingClientRect();
      const v = vis.getBoundingClientRect();
      const offsetTop = 24; // mismo offset que en CSS

      // is-fixed si el top del contenedor gráfico pasó el offset y
      // aún no llegamos al final
      const shouldFix = g.top <= offsetTop && (g.bottom - offsetTop) > v.height;
      const shouldBottom = (g.bottom - offsetTop) <= v.height;

      vis.classList.toggle("is-fixed", shouldFix);
      vis.classList.toggle("is-bottom", shouldBottom);
      if (!shouldFix && !shouldBottom) {
        vis.classList.remove("is-fixed", "is-bottom");
      }
    }

    // ----------------- Observers -----------------
    function buildObservers() {
      destroyObservers();

      // Observer para activar paso cuando ~60% visible
      stepObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const i = steps.indexOf(entry.target);
          if (entry.isIntersecting && entry.intersectionRatio >= cfg.stepThreshold) {
            setActive(i);
          }
        });
      }, {
        root: null,
        threshold: [cfg.stepThreshold],
        rootMargin: "0px 0px 0px 0px"
      });

      steps.forEach(step => stepObserver.observe(step));
    }

    function destroyObservers() {
      if (stepObserver) { stepObserver.disconnect(); stepObserver = null; }
    }

    // ----------------- Handlers -----------------
    const onScroll = throttle(() => {
      // Emite progreso dentro del paso activo
      if (activeIndex >= 0) {
        const p = computeStepProgress(activeIndex);
        onStepProgress(activeIndex, p, steps[activeIndex]);
      }
      updateProgressUI();
      updateStickyState();
    }, cfg.throttleMs);

    const onResize = throttle(() => {
      // Recalcula referencias y estados al redimensionar
      steps = Array.from(document.querySelectorAll(cfg.stepsSelector));
      updateStickyState();
      updateProgressUI();
    }, cfg.throttleMs);

    // ----------------- API -----------------
    function observe() {
      // Estado inicial: forzar primer paso como activo si está en pantalla
      // o el primero si estamos arriba del todo.
      const startIndex = steps.findIndex(s => {
        const r = s.getBoundingClientRect();
        return r.top >= 0 && r.top < window.innerHeight * 0.8;
      });
      setActive(startIndex >= 0 ? startIndex : 0);

      buildObservers();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });

      // Primer cálculo
      updateStickyState();
      updateProgressUI();
    }

    function destroy() {
      destroyObservers();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    }

    function setCallbacks(cbs = {}) {
      if (typeof cbs.onStepEnter === "function") onStepEnter = cbs.onStepEnter;
      if (typeof cbs.onStepExit === "function") onStepExit = cbs.onStepExit;
      if (typeof cbs.onStepProgress === "function") onStepProgress = cbs.onStepProgress;
      return api;
    }

    function refresh() {
      // Vuelve a seleccionar pasos y re-observar (p. ej., si cambió el DOM)
      steps = Array.from(document.querySelectorAll(cfg.stepsSelector));
      buildObservers();
      updateStickyState();
      updateProgressUI();
    }

    const api = {
      observe,
      destroy,
      refresh,
      setCallbacks,
      getActiveIndex: () => activeIndex
    };
    return api;
  }

  // Exponer en window
  window.createScroller = createScroller;
  window._scroller_util = { throttle, clamp };

})();
