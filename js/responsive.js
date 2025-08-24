// responsive.js
// Maneja el comportamiento responsive de las visualizaciones

// Variable para almacenar el ancho actual
let currentWidth = window.innerWidth;

// Función para verificar si es un dispositivo móvil
function isMobileDevice() {
    return window.innerWidth <= 768;
}

// Función para ajustar dimensiones según el dispositivo
function getResponsiveDimensions() {
    const container = d3.select("#chart-container").node();
    if (!container) return { width: 600, height: 400 };
    
    const containerWidth = container.clientWidth;
    
    if (isMobileDevice()) {
        return {
            width: containerWidth - 20, // Margen para móviles
            height: 400,
            margin: { top: 30, right: 20, bottom: 80, left: 100 }
        };
    } else {
        return {
            width: Math.min(650, containerWidth - 30),
            height: 500,
            margin: { top: 40, right: 150, bottom: 100, left: 200 }
        };
    }
}

// Función para ajustar estilos en móviles
function adjustForMobile() {
    if (isMobileDevice()) {
        // Ajustar fuentes para móviles
        d3.selectAll(".step h2").style("font-size", "1.3rem");
        d3.selectAll(".step p").style("font-size", "0.9rem");
        
        // Ajustar el contenedor de visualización
        d3.select("#vis").style("height", "50vh");
    } else {
        // Restaurar estilos para desktop
        d3.selectAll(".step h2").style("font-size", "");
        d3.selectAll(".step p").style("font-size", "");
        d3.select("#vis").style("height", "80vh");
    }
}

// Redibujar visualización actual cuando cambia el tamaño
function redrawCurrentVisualization() {
    const activeSection = d3.select(".step.active");
    if (!activeSection.empty()) {
        const index = Array.from(d3.selectAll(".step").nodes()).indexOf(activeSection.node());
        activateSection(index);
    }
}

// Escuchar cambios de tamaño de ventana
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        if (window.innerWidth !== currentWidth) {
            currentWidth = window.innerWidth;
            adjustForMobile();
            redrawCurrentVisualization();
        }
    }, 250); // Esperar 250ms después del último resize
});

// Ajustar inicialmente al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    adjustForMobile();
});