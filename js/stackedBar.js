// js/stackedBar.js
function stackedBarChart() {
  let width = 700, height = 500;
  let margin = { top: 40, right: 20, bottom: 60, left: 120 };
  let keys = [];
  let color = d3.scaleOrdinal(d3.schemeTableau10);

  // tooltip compartido
  const tooltip = d3.select("body")
    .append("div")
    .attr("id", "tooltip-stacked")
    .style("position", "absolute")
    .style("background", "rgba(255,255,255,0.9)")
    .style("padding", "6px 10px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("pointer-events", "none")
    .style("font-size", "12px")
    .style("opacity", 0);

  function chart(selection) {
    selection.each(function(data) {
      d3.select(this).selectAll("svg").remove();

      const svg = d3.select(this).append('svg')
        .attr('width', width)
        .attr('height', height);

      // stack
      const stackedData = d3.stack().keys(keys)(data);

      // escalas
      const x = d3.scaleLinear()
        .domain([0, 100]) // datos en %
        .range([margin.left, width - margin.right]);

      const y = d3.scaleBand()
        .domain(data.map(d => d.comuna))
        .range([margin.top, height - margin.bottom])
        .padding(0.15);

      // barras
      svg.append('g')
        .selectAll('g')
        .data(stackedData)
        .join('g')
        .attr('fill', d => color(d.key))
        .selectAll('rect')
        .data(d => d)
        .join('rect')
        .attr('x', d => x(d[0]))
        .attr('y', d => y(d.data.comuna))
        .attr('width', d => x(d[1]) - x(d[0]))
        .attr('height', y.bandwidth())
        .on("mouseover", function(event, d) {
          const key = d3.select(this.parentNode).datum().key;
          tooltip.style("opacity", 1)
            .html(`
              <strong>${d.data.comuna}</strong><br>
              ${key.replace("%_", "").replace(/_/g," ")}: ${(d[1]-d[0]).toFixed(1)}%
            `);
          d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.5);
        })
        .on("mousemove", function(event) {
          tooltip.style("left", (event.pageX + 10) + "px")
                 .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
          tooltip.style("opacity", 0);
          d3.select(this).attr("stroke", null);
        });

      // eje X
      svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%"));

      // eje Y
      svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

      // título
      svg.append('text')
        .attr('x', width/2)
        .attr('y', 20)
        .attr('text-anchor','middle')
        .style('font-size','16px')
        .text('Distribución porcentual por comuna');

      // leyenda
      const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right - 140}, ${margin.top})`);

      keys.forEach((k,i) => {
        legend.append("rect")
          .attr("x", 0)
          .attr("y", i*20)
          .attr("width", 14)
          .attr("height", 14)
          .attr("fill", color(k));

        legend.append("text")
          .attr("x", 20)
          .attr("y", i*20 + 12)
          .style("font-size", "12px")
          .text(k.replace("%_", "").replace(/_/g," "));
      });
    });
  }

  chart.keys = function(_k){ if(!arguments.length) return keys; keys = _k; color.domain(keys); return chart; };
  chart.size = function(w,h){ width=w; height=h; return chart; };

  return chart;
}
