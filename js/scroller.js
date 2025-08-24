// scroller.js
// Configura el sistema de scroll para las visualizaciones

function setupScroller() {
  // Verificar que las funciones de visualización existan
  if (typeof showIntro !== 'function') {
    console.error("❌ Las funciones de visualización no están disponibles");
    return;
  }

  const steps = d3.selectAll(".step");
  const chartContainer = d3.select("#chart-container");

  // Umbral diferente para móviles
  const threshold = typeof isMobileDevice === 'function' && isMobileDevice() ? 0.4 : 0.6;

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

    // Mostrar mensaje de carga si los datos no están listos
    if (!electionData || electionData.length === 0) {
      chartContainer.html(`
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando datos...</span>
          </div>
          <p class="mt-2">Cargando datos electorales...</p>
        </div>
      `);
      
      // Reintentar después de un breve tiempo
      setTimeout(() => {
        if (electionData && electionData.length > 0) {
          activateSection(index);
        }
      }, 500);
      return;
    }

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
        chartContainer.html(`<p>Visualización no disponible</p>`);
    }
  }

  // Activar la primera sección al inicio
  activateSection(0);
}