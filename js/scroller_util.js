// js/scroller_util.js
function scroller() {
  let container = d3.select('body');
  let dispatch = d3.dispatch('active', 'progress');
  let sections = [];
  let sectionPositions = [];
  let currentIndex = -1;

  function scroll(selection) {
    sections = selection.nodes();

    // calcular posiciones de cada sección
    const yOffset = window.innerHeight * 0.6; // umbral ~60% de pantalla
    sectionPositions = sections.map(el => {
      const rect = el.getBoundingClientRect();
      const top = window.pageYOffset + rect.top;
      return top - yOffset;
    });

    d3.select(window)
      .on('scroll.scroller', position)
      .on('resize.scroller', resize);

    // disparar al inicio
    position();
    return scroll;
  }

  function position() {
    const pos = window.pageYOffset;
    let sectionIndex = d3.bisect(sectionPositions, pos) - 1;
    sectionIndex = Math.max(0, Math.min(sections.length - 1, sectionIndex));

    if (currentIndex !== sectionIndex) {
      currentIndex = sectionIndex;
      dispatch.call('active', this, currentIndex);
    }

    const prevIndex = Math.max(sectionIndex - 1, 0);
    const prevTop = sectionPositions[prevIndex];
    const prevBottom = sectionPositions[prevIndex + 1] || (document.body.scrollHeight);
    const progress = (pos - prevTop) / (prevBottom - prevTop);
    dispatch.call('progress', this, sectionIndex, Math.max(0, Math.min(1, progress)));
  }

  function resize() {
    scroll(d3.selectAll('.step'));
  }

  scroll.container = function(_x) {
    if (!arguments.length) return container;
    container = _x;
    return scroll;
  };

  scroll.on = function(event, handler) {
    dispatch.on(event, handler);
    return scroll;
  };

  return scroll;
}
