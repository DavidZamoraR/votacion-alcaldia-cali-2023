// js/stackedBar.js
function stackedBarChart() {
  let width = 700, height = 500;
  let margin = { top: 40, right: 20, bottom: 60, left: 180 };
  let keys = ["eder","ortiz","renteria","resto"];
  let color = d3.scaleOrdinal()
    .domain(keys)
    .range(["#FFD700", "#FF0000", "#9b59b6", "#bdc3c7"]);

  function chart(selection) {
    selection.each(function(data) {
      const svg = d3.select(this).append('svg')
        .attr('width', width)
        .attr('height', height);

      const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.totalVotos) || 1])
        .range([margin.left, width - margin.right]);

      const y = d3.scaleBand()
        .domain(data.map(d => d.comuna))
        .range([margin.top, height - margin.bottom])
        .padding(0.15);

      // convertir a proporciones * total para corregir rounding
      const stackedData = d3.stack()
        .keys(keys)
        .value((d, key) => d[key]) (data);

      const g = svg.append('g');

      g.selectAll('g.layer')
        .data(stackedData)
        .join('g')
        .attr('class', 'layer')
        .attr('fill', d => color(d.key))
        .selectAll('rect')
        .data(d => d)
        .join('rect')
        .attr('x', d => x(d[0]))
        .attr('y', d => y(d.data.comuna))
        .attr('width', d => x(d[1]) - x(d[0]))
        .attr('height', y.bandwidth());

      const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.format(','));
      const yAxis = d3.axisLeft(y);

      svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(xAxis)
        .selectAll('text').style('font-size','10px');

      svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(yAxis)
        .selectAll('text').style('font-size','10px');

      svg.append('text')
        .attr('x', width/2)
        .attr('y', 22)
        .attr('text-anchor','middle')
        .style('font-size','16px')
        .text('Distribución de votos por comuna (apilado)');
    });
  }

  chart.keys = function(_k){ if(!arguments.length) return keys; keys = _k; return chart; };
  chart.size = function(w,h){ width=w; height=h; return chart; };

  return chart;
}
