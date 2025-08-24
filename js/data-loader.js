// data-loader.js
// Carga y prepara los datos electorales

let electionData = [];
let dataLoaded = false;

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

// Cargar datos cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    loadElectionData().then(() => {
        // Iniciar el scroller una vez cargados los datos
        if (typeof setupScroller === 'function') {
            setupScroller();
        }
    });
});