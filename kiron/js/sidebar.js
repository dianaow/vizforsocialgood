var sidebar = function () {

  ///////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// Globals /////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////  
  var lineOpacity = 1
  var lineStroke = "1.8px"
  var axisPad = 6 // axis formatting
  var R = 5
  var KIRON_COLOR = '#113893'

  var sidebar_chart = d3.select(".sidebar")
  var width = 230
  var height = 150

  ///////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// Initialize //////////////////////////////
  /////////////////////////////////////////////////////////////////////////// 

  return { 
    run : function () {

      //////////////////// Set up and initiate containers ///////////////////////
      var sidebar_svg = sidebar_chart.select("svg")
        .attr('class', 'sidebar')
        .attr("width", 275)
        .attr("height", 900)

      loadData()

      ///////////////////////////////////////////////////////////////////////////
      ////////////////////////////// Generate data //////////////////////////////
      ///////////////////////////////////////////////////////////////////////////

      function loadData() {

        d3.queue()   // queue function loads all external data files asynchronously
          .defer(d3.csv, './processed-data/country_stats.csv') // total refugee stock per country 
          .defer(d3.csv, './processed-data/semester_gender_stats.csv') // rollup sum of student entry to Kiron (breakdown by gender)
          .defer(d3.csv, './processed-data/country_edn_stats.csv') // rollup sum of student entry to Kiron (breakdown by gender)
          .await(processData);   

      }

      function processData(error, csv, csv2, csv3) {

        if (error) throw error;
        d3.select('#dimmer').style('display', 'none')

        var connData = csv
        var semester_gender_Data = csv2
        var country_edn_Data = csv3

        var top_countries = []
        for ( var i = 0; i < 10; i++) {
          if(connData[i]){
            top_countries.push({'index':i, 'country': connData[i]['country'], 'metric': connData[i]['pct']})
          }
        }
        var topCountries_list = top_countries.map(d=>d.country)

        countriesBarChart(top_countries)
        stackedBarChart(country_edn_Data, topCountries_list)
        multipleLineChart(semester_gender_Data)

      }

      ///////////////////////////////////////////////////////////////////////////
      ///////////////////////////////// Bar chart ///////////////////////////////
      ///////////////////////////////////////////////////////////////////////////

      function countriesBarChart(data) {

        sidebar_svg.append("g")
          .attr("transform", "translate(10, 220)")
          .append('text')
          .attr("fill", "white")
          .text("Top countries where refugees")

         sidebar_svg.append("g")
          .attr("transform", "translate(10, 240)")
          .append('text')
          .attr("fill", "white")
          .text("originate")

        var countriesChart = sidebar_svg.append("g")
            .attr("class","countries_barchart")
            .attr("transform", "translate(10, 250)")

        var xScale = d3.scaleBand()
          .domain(data.map(d=>d.country))
          .range([0, width])
          .padding(0.1)  
   
        var yScale = d3.scaleLinear()
          .domain([0, d3.max(data, d=>+d.metric)])
          .range([height, 10])  

        var rects = countriesChart.selectAll('g').data(data) 

        const entered_rects = rects.enter().append('g')

        entered_rects
           .merge(rects)
           .attr("transform", function(d) {
              return (
                "translate(" + xScale(d.country) + "," + yScale(+d.metric) + ")" 
              );
           })

        rects.exit().remove()

        entered_rects.append('rect')
          .merge(rects.select("rect"))
          .attr('class', 'bar')
          .attr('id', function(d) { return "bar" + d.country })
          .attr("fill", "white")
          .attr("width", xScale.bandwidth())
          .attr("height", function(d) { return height - yScale(+d.metric) })

        // add the text to the label group showing country name
        entered_rects.append("text")
          .merge(rects.select("text"))
           .style("text-anchor", "middle")
           .attr('class', 'rectLabel')
           .attr('id', function(d) { return "rectLabel" + d.country })
           .attr("dx", xScale.bandwidth()/2)
           .attr("dy", -5)
           .attr('font-size', '8px')
           .attr('font-weight', 'bold')
           .attr('fill', "white")
           .text(function(d) { return (Math.round(+d.metric*10)/10).toString() + "%" })
  
        var xAxis = d3.axisBottom(xScale)
          .tickSize(0)
          .tickValues(xScale.domain())

        countriesChart.append("g")
          .attr("class", "x_axis")
          .attr("transform", `translate(0, ${height})`) 
          .call(xAxis)
          .call(g => {
            g.selectAll("text")
              .style("text-anchor", "left")
              .attr("transform", d=> `translate(${xScale.bandwidth()/2}, ${20})rotate(50)`) 
              .attr('fill', 'white')

          })    

      }

      ///////////////////////////////////////////////////////////////////////////
      ///////////////////////////// Stacked bar chart ///////////////////////////
      ///////////////////////////////////////////////////////////////////////////
      
      function stackedBarChart(data, topCountries_list) {

        var ednChart = sidebar_svg.append("g")
          .attr("class","edn_barchart")
          .attr("transform", "translate(10, 500)")

        var binLabels = ['TRUE', 'FALSE', 'UNKNOWN']

        var xScale = d3.scaleLinear()
          .domain([0, 100])
          .range([0, width])  

        var yScale = d3.scaleBand()
          .domain(topCountries_list)
          .range([0, 20*topCountries_list.length])
          .padding(0.2)

        var colorScale = d3.scaleOrdinal()
          .range(['#FABF4B', '#45ADA8', '#82C3ED'])
          .domain(binLabels)

        var dataByCountry = d3.nest()
          .key(d=>d.country)
          .sortKeys(function(a,b) { return topCountries_list.indexOf(a) - topCountries_list.indexOf(b); })
          .entries(data)

        var dataNew = []
        dataByCountry.map((D,I) => {
          var oneCountryBin = Array.from(Array(binLabels.length), () => 0)
          D.values.map((d,i) => {
            oneCountryBin[binLabels.indexOf(d.attended_university)] = +d.pct
          })
          dataNew.push(oneCountryBin)
        })

        // Constructs a stack layout based on data 
        // d3's permute ensures each individual array is sorted in the same order. Important to ensure sort arrangement is aligned for all parameters before stack layout)
        var stackedData = Object.assign(d3.stack().keys(d3.range(binLabels.length))(dataNew), {
          keys: binLabels,
          ids: binLabels.map(R => topCountries_list.map(P => `${R}_${P}`)),
          countries: topCountries_list
        })

        stackedData.forEach((d,i) => {
          stackedData.countries.forEach((D,I) => {
            stackedData[i][I].key = stackedData.ids[i][I]
            stackedData[i][I].color = colorScale(stackedData.keys[i]) 
            stackedData[i][I].x = ( d[I][0] ? xScale(d[I][0]) : xScale(0) )
            stackedData[i][I].y = yScale(D)
            stackedData[i][I].width = ( d[I][1] ? xScale(d[I][1]) : xScale(0) ) - ( d[I][0] ? xScale(d[I][0]) : xScale(0) )
            stackedData[i][I].height = yScale.bandwidth()
          })
        })
        
        var groups = ednChart.selectAll("rect").data(stackedData.flat(), d=>d.key)

        groups.exit().remove()

        var groupsEnter = groups.enter().append("rect")
          .merge(groups)
          .attr('class', d=>d.key)
          .attr("fill", d=>d.color)
          .attr("x", d => d.x)
          .attr("width", d => d.width)
          .attr("y", d => d.y)
          .attr("height", d => d.height)

        var text = ednChart.selectAll("text").data(topCountries_list, d=>d)

        text.exit().remove()

        var entered_text = text.enter().append("text")
          .merge(text)
          .attr("x", 10)
          .attr('y', d=>yScale(d)+yScale.bandwidth()/2+3)
          //.style("alignment-baseline", "middle")
          .attr('fill', 'black')
          .attr('font-size', '12px')
          .text(d=>d)

        // CREATE LEGEND // 
        var svgLegend = sidebar_svg.append("g")
          .attr("transform", "translate(10, 480)")

        svgLegend.append('text')
          .attr("fill", "white")
          .text("University attendance")

        var legend = svgLegend.selectAll('.legend')
          .data(binLabels)
          .enter().append('g')
            .attr("class", "legend")
            .attr("transform", function (d, i) {return "translate(" +  (i * 50 + 10).toString() + "," + 15 + ")"})

        legend.append("circle")
            .attr("class", "legend-node")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", R)
            .style("fill", d=>colorScale(d))

        legend.append("text")
            .attr("class", "legend-text")
            .attr("x", R*2)
            .attr("y", R/2)
            .attr("fill", "#A9A9A9")
            .attr("font-size", 10)
            .text(d=>d)

      }

      ///////////////////////////////////////////////////////////////////////////
      ///////////////////////////// Multiple line chart /////////////////////////
      ///////////////////////////////////////////////////////////////////////////
      
      function multipleLineChart(data) {

        var width = 200

        var g = sidebar_svg.append("g")
            .attr("class","lineChart")
            .attr("transform", "translate(30, 0)")

        g.append('g')
          .attr('class', 'lines')

        g.append("g")
          .attr("class", "x_axis")

        g.append("g")
          .attr("class", "y_axis")

        g.append('g')
          .attr('class', 'gLegend')
          .attr("transform", "translate(" + 0 + "," + 10 + ")")

        var xScale = d3.scaleBand()
          .domain(data.map(d=>d.time))
          .range([0, width])
          .padding(0.1)

        var yScale = d3.scaleLinear()
          .domain([0, 5028])
          .range([height+20, 20]);

        var category = ['female', 'male']
        var color = d3.scaleOrdinal()
          .domain(category)
          .range(["white", KIRON_COLOR])

        // CREATE AXES // 
        // render axis first before lines so that lines will overlay the horizontal ticks
        var ticks = xScale.domain().filter((d,i)=>{ return !(i%2) } ) // only show tick labels for the first bidding exercise of the year
        var xAxis = d3.axisBottom(xScale)
          .tickSizeOuter(0)
          .tickSizeInner(-height)
          .tickValues(ticks)

        var yAxis = d3.axisLeft(yScale)
          .ticks(10, "s")
          .tickSize(-width)

        g.select(".x_axis")
          .attr("transform", `translate(0, ${height+20})`) 
          .call(xAxis)
          .call(g => {
            g.selectAll("text")
              .style("text-anchor", "middle")
              .attr("y", axisPad)
              .attr('fill', '#A9A9A9')

            g.selectAll("line")
              .attr('stroke', '#A9A9A9')
              .attr('stroke-width', 0.7) // make horizontal tick thinner and lighter so that line paths can stand out
              .attr('opacity', 0.7)

            g.select(".domain")
              .attr('stroke', '#A9A9A9')
          })      

        g.select(".y_axis")
          .call(yAxis)
          .call(g => {
            g.selectAll("text")
            .style("text-anchor", "middle")
            .attr("x", -axisPad*2)
            .attr('fill', '#A9A9A9')

            g.selectAll("line")
              .attr('stroke', '#A9A9A9')
              .attr('stroke-width', 0.7) // make horizontal tick thinner and lighter so that line paths can stand out
              .attr('opacity', 0.3)

            g.select(".domain").remove()
           })
      
        // APPEND MULTIPLE LINES //
        var line = d3.line()
          .x(d => xScale(d.time) + xScale.bandwidth() / 2)
          .y(d => yScale(+d.rollup))

        var res_nested = d3.nest() // necessary to nest data so that keys represent each category
          .key(d=>d.gender)
          .entries(data)

        var glines = g.select('.lines').selectAll('.line-group')
          .data(res_nested)

        glines.enter().append('g')
          .attr('class', 'line-group')  
          .append('path')
          .attr('class', 'line')  
          .attr('d', d => line(d.values))
          .style('stroke', (d, i) => color(i))
          .style('fill', 'none')
          .style('opacity', lineOpacity)
          .style('stroke-width', lineStroke)

        glines.select('path').attr('d', d => line(d.values)) // update

        glines.exit().remove()

        // CREATE LEGEND //             
        var legend = g.select('.gLegend').selectAll('.legend')
          .data(category)
          .enter().append('g')
            .attr("class", "legend")
            .attr("transform", function (d, i) {return "translate(" +  i * 80 + "," + i * 0 + ")"})

        legend.append("circle")
            .attr("class", "legend-node")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", R)
            .style("fill", d=>color(d))

        legend.append("text")
            .attr("class", "legend-text")
            .attr("x", R*2)
            .attr("y", R/2)
            .style("fill", "#A9A9A9")
            .style("font-size", 12)
            .text(d=>d)

      }
    }
  }
}()