// scroller.js
// Detecta la sección activa en el scroll y la muestra en consola

function setupScroller() {
  const steps = d3.selectAll(".step");  // todas las secciones narrativas
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.5  // al menos 50% visible
  };

  const observer = new IntersectionObserver(handleIntersect, observerOptions);

  steps.each(function(_, i) {
    observer.observe(this); // observar cada sección
  });

  function handleIntersect(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = Array.from(steps.nodes()).indexOf(entry.target);
        console.log(`Sección activa: ${index}`);
        activateSection(index);
      }
    });
  }
}

// función de callback que luego conectarás con sections.js
function activateSection(index) {
  console.log(`⚡ Ejecutar visualización para sección ${index}`);
}

// inicializa scroller al cargar
document.addEventListener("DOMContentLoaded", setupScroller);
