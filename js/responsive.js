// responsive.js
// Maneja el comportamiento responsive de las visualizaciones

// Variables globales
let currentWidth = window.innerWidth;
let electionData = [];
let dataLoaded = false;

// Función para verificar si es un dispositivo móvil
function isMobileDevice() {
    return window.innerWidth <= 768;
}

// Función para ajustar dimensiones según el dispositivo
function getResponsiveDimensions() {
    const container = document.getElementById("chart-container");
    if (!container) return { width: 600, height: 400 };
    
    const containerWidth = container.clientWidth;
    
    if (isMobileDevice()) {
        return {
            width: containerWidth - 20,
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
        document.querySelectorAll(".step h2").forEach(el => {
            el.style.fontSize = "1.3rem";
        });
        document.querySelectorAll(".step p").forEach(el => {
            el.style.fontSize = "0.9rem";
        });
        document.getElementById("vis").style.height = "50vh";
    } else {
        document.querySelectorAll(".step h2").forEach(el => {
            el.style.fontSize = "";
        });
        document.querySelectorAll(".step p").forEach(el => {
            el.style.fontSize = "";
        });
        document.getElementById("vis").style.height = "80vh";
    }
}

// Cargar datos electorales
function loadElectionData() {
    return new Promise((resolve, reject) => {
        if (dataLoaded) {
            resolve(electionData);
            return;
        }

        d3.csv("data/votos.csv")
            .then(function(data) {
                electionData = data.map(d => {
                    return {
                        id: d.id_puesto,
                        puesto: d.nom_puesto,
                        comuna: d.territorio,
                        totalVotos: +d.TOTAL_VOTOS,
                        eder: +d["ALVARO ALEJANDRO EDER GARCES"],
                        ortiz: +d["ROBERTO ORTIZ URUEÑA"],
                        ganador: d.gana
                    };
                });
                
                dataLoaded = true;
                console.log("✅ Datos cargados:", electionData.length, "puestos");
                resolve(electionData);
            })
            .catch(function(error) {
                console.error("❌ Error al cargar los datos:", error);
                reject(error);
            });
    });
}

// Redibujar visualización actual cuando cambia el tamaño
function redrawCurrentVisualization() {
    const activeSection = document.querySelector(".step.active");
    if (activeSection && typeof activateSection === 'function') {
        const steps = document.querySelectorAll(".step");
        const index = Array.from(steps).indexOf(activeSection);
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
    }, 250);
});

// Inicializar cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    adjustForMobile();
    loadElectionData().then(() => {
        if (typeof setupScroller === 'function') {
            setupScroller();
        }
    }).catch(error => {
        console.error("Error al cargar datos:", error);
        document.getElementById("chart-container").innerHTML = `
            <div class="alert alert-danger">
                Error al cargar los datos. Por favor, recarga la página.
            </div>
        `;
    });
});