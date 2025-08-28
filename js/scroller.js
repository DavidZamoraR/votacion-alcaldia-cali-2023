/* scroller.js
   Enlaza el util de scrollytelling con el motor (engineCali)
   - Requiere: scroller_util.js (createScroller), engineCali.js
   - No carga datos ni define escenas; eso lo hace sections.js
*/

(function () {
  // No-op seguro
  const noop = () => {};

  // Convierte un nombre de método o función en callable seguro
  function toFn(engine, step) {
    if (typeof step === "function") return step;
    if (typeof step === "string" && engine && typeof engine[step] === "function") {
      return () => engine[step]();
    }
    return noop;
  }

  // Genera escenas por defecto si no se proveen
  function defaultScenesFromEngine(engine) {
    // Orden sugerido: 0 título → 1 mapa → 2 choropleth → 3 barras → 4 puestos → 5 conclusión (título)
    const seq = ["drawTitle", "showMap", "choroplet", "stackedBarsByComuna", "showCircles", "drawTitle"];
    return seq.map(name => toFn(engine, name));
  }

  /**
   * Crea y conecta el scroller con callbacks a escenas.
   * @param {Object} opts
   *   - engine: instancia devuelta por scrollerCali()
   *   - scenes: Array<function|engineMethodName> (índice = step data-step)
   *   - selectors: { stepsSelector, graphicSelector, visSelector, progressSelector }
   *   - hooks: { onEnter, onExit, onProgress } (opcionales)
   */
  function makeStoryScroller(opts = {}) {
    const engine = opts.engine || null;
    const scenesRaw = Array.isArray(opts.scenes) ? opts.scenes : defaultScenesFromEngine(engine);

    const scenes = scenesRaw.map(s => toFn(engine, s));

    const selectors = Object.assign({
      stepsSelector: "#sections .step",
      graphicSelector: "#graphic",
      visSelector: "#vis",
      progressSelector: "#progress .progress-bar"
    }, opts.selectors || {});

    const hooks = Object.assign({
      onEnter: noop,
      onExit: noop,
      onProgress: noop
    }, opts.hooks || {});

    // Crear el observador del scroll
    const scroller = window.createScroller(selectors).setCallbacks({
      onStepEnter: (i, el) => {
        // Ejecutar escena del índice i (si existe)
        if (scenes[i]) scenes[i]();

        // Hook del usuario
        hooks.onEnter(i, el);

        // Emitir evento global opcional para otras piezas (leyendas, etc.)
        window.dispatchEvent(new CustomEvent("story:enter", { detail: { index: i, el } }));
      },
      onStepExit: (i, el) => {
        hooks.onExit(i, el);
        window.dispatchEvent(new CustomEvent("story:exit", { detail: { index: i, el } }));
      },
      onStepProgress: (i, p, el) => {
        hooks.onProgress(i, p, el);
        window.dispatchEvent(new CustomEvent("story:progress", { detail: { index: i, progress: p, el } }));
      }
    });

    // API público
    function start() {
      scroller.observe();
      return api;
    }

    function destroy() {
      scroller.destroy();
    }

    function refresh() {
      scroller.refresh();
    }

    // Reenvía una actualización de tamaño (útil desde responsive.js)
    function updateSize() {
      if (engine && typeof engine.updateSize === "function") {
        engine.updateSize();
      }
      scroller.refresh();
    }

    const api = {
      start,
      destroy,
      refresh,
      updateSize,
      getActiveIndex: scroller.getActiveIndex
    };

    return api;
  }

  // Helpers expuestos
  window.makeStoryScroller = makeStoryScroller;
  window.storyScenesFromEngine = defaultScenesFromEngine;

})();
