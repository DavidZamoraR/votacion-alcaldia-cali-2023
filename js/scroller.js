// scroller.js
// Configura el sistema de scroll para las visualizaciones

function setupScroller() {
  const steps = d3.selectAll(".step");
  const chartContainer = d3.select("#chart-container");

  // Umbral diferente para móviles
  const threshold = isMobileDevice() ? 0.4 : 0.6;

  // Opciones del IntersectionObserver
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: threshold
  };

  // Crear observer
  const observer = new IntersectionObserver(handleIntersect, observerOptions);

  // Observar cada sección
  steps.nodes().forEach(step => observer.observe(step));

  // Manejar intersecciones
  function handleIntersect(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = Array.from(steps.nodes()).indexOf(entry.target);
        activateSection(index);
      }
    });
  }

  // Activar una sección
  function activateSection(index) {
    console.log("👉 Se activó la sección", index);

    // Actualizar clases activas
    steps.classed("active", false);
    d3.select(steps.nodes()[index]).classed("active", true);

    // Limpiar contenedor
    chartContainer.html("");

    // Ejecutar la visualización correspondiente
    switch (index) {
      case 0:
        showIntro();
        break;
      case 1:
        showMapaComunas();
        break;
      case 2:
        showColoresPorCandidato();
        break;
      case 3:
        showResultadosPorPuesto();
        break;
      case 4:
        showCirculosPorPuesto();
        break;
      case 5:
        showComparacionesComunas();
        break;
      case 6:
        showConclusiones();
        break;
      default:
        console.warn("⚠️ No hay función definida para la sección", index);
    }
  }

  // Activar la primera sección al inicio
  activateSection(0);
}