// js/scroller_util.js
// Utilidad para scrollytelling estilo John Guerra
function scrollerUtil() {
  let container = d3.select("body");
  let sections = null;
  let dispatch = d3.dispatch("active", "progress");

  let observer = null;
  let currentIndex = -1;

  function scroll(selection) {
    sections = selection;

    // Usamos IntersectionObserver para detectar scroll
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: d3.range(0, 1.05, 0.05) // progresivo (0, 0.05, 0.1, ...1)
    };

    observer = new IntersectionObserver(handleIntersect, options);
    sections.each(function(_, i) {
      observer.observe(this);
      this.__sectionIndex = i; // guardar índice en nodo
    });
  }

  function handleIntersect(entries) {
    entries.forEach(entry => {
      const i = entry.target.__sectionIndex;

      if (entry.intersectionRatio > 0.5) {
        if (i !== currentIndex) {
          currentIndex = i;
          dispatch.call("active", null, i);
        }
      }

      // progress (0 a 1)
      if (entry.isIntersecting) {
        dispatch.call("progress", null, i, entry.intersectionRatio);
      }
    });
  }

  // API
  scroll.container = function(_c) {
    if (!arguments.length) return container;
    container = _c;
    return scroll;
  };

  scroll.sections = function(_s) {
    if (!arguments.length) return sections;
    sections = _s;
    return scroll;
  };

  scroll.on = function(action, callback) {
    dispatch.on(action, callback);
    return scroll;
  };

  return scroll;
}
