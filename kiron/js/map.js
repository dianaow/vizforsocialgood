var main = function () {

  ///////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// Globals /////////////////////////////////
  /////////////////////////////////////////////////////////////////////////// 
  var entityData, map, arcs, markersGroup, xTimeScale, handle, label, topCountries_list
    
  var ipadPRO_landscape = Math.min(window.innerWidth, screen.width)>1024 & Math.min(window.innerWidth, screen.width)<=1366 & (Math.abs(screen.orientation.angle == 90))
  var ipad_landscape = Math.min(window.innerWidth, screen.width)<=1024 & (Math.abs(screen.orientation.angle == 90))
  var ipad_portrait = Math.min(window.innerWidth, screen.width)<=1024 & (Math.abs(screen.orientation.angle == 0))
  var laptop = Math.min(window.innerWidth, screen.width) > 1024
  var desktop = Math.min(window.innerWidth, screen.width) > 1680

  if (ipadPRO_landscape) {
    console.log('ipadPRO_landscape')
    var LEGEND_POS_X = 10
    var LEGEND_POS_Y = 120
    canvasDim = { width: window.innerWidth*0.96, height: window.innerHeight*0.93}
  } else if (ipad_landscape) {
    console.log('ipad_landscape')
    var LEGEND_POS_X = 10
    var LEGEND_POS_Y = 160
    canvasDim = { width: window.innerWidth*0.96, height: window.innerHeight*0.93}
  } else if (ipad_portrait) {
    console.log('ipad_portrait')
    var LEGEND_POS_X = 10
    var LEGEND_POS_Y = 50
    canvasDim = { width: window.innerWidth*0.96, height: window.innerHeight*0.5}
  } else {
    var LEGEND_POS_X = 10
    var LEGEND_POS_Y = 138
    canvasDim = { width: window.innerWidth*0.96, height: window.innerHeight*0.93}    
  }

  var margin = {top: 0, right: 0, bottom: 0, left: 0}
  var width = canvasDim.width - margin.left - margin.right 
  var height = canvasDim.height - margin.top - margin.bottom 
  var chart = d3.select("#chart")

  var centroids = []
  var connector_angles = []
  var DEFAULT_MAP_COLOR = '#7F7F7F'
  var DEFAULT_MAP_STROKE = '#D9D9D9'
  var DEFAULT_SELECTED_CTRY = '#727272'
  var DEFAULT_PATH_WIDTH = 0.8
  var KIRON_COLOR = '#113893'
  var colorSource = '#45ADA8'
  var colorDestination = '#FABF4B'
  var playing = false
  var initialized = false
  var dragged = false
  var initDayId = 0
  var currentDayId = 0

  var lineScale = d3.scaleSqrt()
    .range([0.3, 30])
    .domain([0, 100])
  
  var formatTime = d3.timeFormat("%d %b %Y") // eg 16 Oct 2015
  var formatDate = d3.timeFormat("%b %Y")
  var parseDate = d3.timeParse("%Y-%m-%d")

  ///////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// Initialize //////////////////////////////
  /////////////////////////////////////////////////////////////////////////// 

  return { 
    run : function () {

      //////////////////// Set up and initiate containers ///////////////////////
      var svg = chart.select("svg")
        .attr('class', 'map')
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)

      var g = svg.append("g")
        .attr('id', 'zoom-group')
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
   
      const defs = g.append('defs')

      map = g
       .append("g")
       .attr("id", "map")

      arcs = g.append("g")
          .attr("class","arcs")

      markersGroup = g.append("g")
        .attr("class", "markers-group")

      chart.select("svg").append('rect')
        .attr('class', 'blurry')

      loadData()

      ///////////////////////////////////////////////////////////////////////////
      ////////////////////////////// Generate data //////////////////////////////
      ///////////////////////////////////////////////////////////////////////////

      function loadData() {

        d3.queue()   // queue function loads all external data files asynchronously 
          .defer(d3.json, './raw-data/map.geo.json') // country geometries
          .defer(d3.csv, './processed-data/country_stats.csv') // total refugee stock per country
          .defer(d3.csv, './processed-data/students_processed.csv') // details of each student
          .await(processData);   

      }

      function processData(error, geoJSON, csv, csv2) {
        
        if (error) throw error;
        d3.select('#dimmer').style('display', 'none')

        var connData = csv

        entityData = csv2.map((d,i) => {
          return {
            id: i,
            gender: d.gender,
            age: +d.age,
            student_since: parseDate(d.student_since),
            nationality: d.nationality,
            school_education: d.school_education,
            attended_university: d.attended_university
          }
        })
        console.log()
        var cols = []
        world = geoJSON.features;  // store the path in variable for ease
        for (var i in connData) {    // for each geometry object
          for (var j in world) {  // for each row in the CSV
            if (world[j].properties.name == connData[i]['country']) {   // if they match
              for (var k in connData[i]) {   // for each column in the a row within the CSV
                if ((k != 'country')) {  // let's not add the name or id as props since we already have them
                  world[j].properties[k] = (connData[i][k] != null ? Number(connData[i][k]) : 0)  // add each CSV column key/value to geometry object
                } 
              }
              break;  // stop looking through the CSV since we made our match
            } 
          }
        }

        var top_countries = []
        for ( var i = 0; i < 10; i++) {
          if(connData[i]){
            top_countries.push({'index':i, 'country': connData[i]['country'], 'metric': connData[i]['pct']})
          }
        }
        top_countries.push({'index':11, 'country': 'Germany', 'metric': 0})
        topCountries_list = top_countries.map(d=>d.country)

        drawMap(world, topCountries_list)
        updateMap('pct')
        drawLinksMap(world, 'pct')
        drawLegend()

        var scaleTime = d3.scaleTime().domain(d3.extent(entityData, d=>d.student_since))
        var days = scaleTime.ticks(d3.timeDay.every(1))
        slider(days)
        //d3.select('#clock > h2').html(formatTime(days[0]))  // populate the clock initially with the start of the recorded first day a refugee became a student 
        //timer = d3.interval(function(elapsed) { animateMarkers(days, elapsed) }, 200)
        
        d3.select('#play')  
          .on('click', function() {  // when user clicks the play button
            if(playing == false) {  // if the map is currently playing
              if(initialized==false) {
                t = d3.zoomIdentity.translate(-750, -150).scale(1.8)
                g.transition().duration(250).attr("transform", t)
                currentDayId = 0
                timer = d3.pausableTimer(function(elapsed) { animateMarkers(days, elapsed, 0) }, 350)
                initialized=true
                d3.select(this).attr('value', 'Stop');  // change the button label to stop
              } else {
                if(dragged == true) {
                  currentDayId = 0
                  timer = d3.pausableTimer(function(elapsed) { animateMarkers(days, elapsed, initDayId) }, 350)
                } else {
                  timer.resume()
                }
                d3.select(this).attr('value', 'Stop');  // change the button label to stop
              }
              playing = true;   // change the status of the animation
            } else if(playing == true) {    // else if is currently playing
              timer.pause();  // stop the animation by clearing the interval
              d3.select(this).attr('value', 'Play');   // change the button label to play
              playing = false;   // change the status again
            } 
        });

      }

      ///////////////////////////////////////////////////////////////////////////
      //////////////////////////////// Render map ///////////////////////////////
      ///////////////////////////////////////////////////////////////////////////

      if (ipadPRO_landscape) {
        var scale = width/4.2
        var translateX = -40
        var translateY = 40
      } else if (ipad_portrait) {
        var scale = width/3.5 
        var translateX = -40
        var translateY = 80
      } else if (desktop){
        var scale = width/4.2
        var translateX = -80
        var translateY = 100  
      } else {
        var scale = width/4
        var translateX = -80
        var translateY = 100
      }

      var projection = d3.geoEckert3()
         .center([0, 0]) // set centre to further North
         .scale([scale]) // scale to fit group width
         .translate([width/2 + translateX, height/2 + translateY]) 

      var path = d3.geoPath()
         .projection(projection)
      
      function drawMap(data, topCountries_list) {

        // draw a path for each feature/country
        countriesPaths = map
           .selectAll("path")
           .data(data)
           .enter().append("path")
           .attr("d", path)
           .attr("id", function(d, i) { return "country" + d.properties.name })
           .attr("class", "country")
           .attr('fill', DEFAULT_MAP_COLOR)
           .attr('stroke', DEFAULT_MAP_STROKE)
           .attr('stroke-width', '0.4px')

        var countryLabels = g.selectAll(".countryName")
           .data(data)
           .enter().append("g")
           .attr("class", "countryName")
           .attr('opacity', d => topCountries_list.indexOf(d.properties.name) != -1 ? 1 : 0)
           .attr('fill', d => d.properties.name == 'Germany' ? KIRON_COLOR : colorSource )
           .attr("transform", function(d) {
              return (
                 "translate(" + path.centroid(d)[0] + "," + (path.centroid(d)[1]+10).toString() + ")" // centroid of countries
              );
           })

        // add the text to the label group showing country name
        countryLabels
           .append("text")
           .style("text-anchor", "middle")
           .attr("dx", d => d.properties.name == 'Palestine' ? -25 : 0)
           .attr("dy", d => d.properties.name == 'Germany' ? -40 : (d.properties.name == 'Palestine' ? -10 : 0))
           .attr('font-size', d => d.properties.name == 'Germany' ? '1em' : '0.7em')
           .text(function(d) { return d.properties.name })
           .call(getTextBox) // move text position to center of centroid

        // add a background rectangle the same size as the text
        countryLabels
           .insert("rect", "text")
           .attr("class", "countryLabelBg")
           .attr('fill', 'white')
           .attr('opacity', 0.7)
           .attr("transform", function(d) {
              return "translate(" + (d.bbox.x - 2) + "," + d.bbox.y + ")";
           })
           .attr("width", function(d) {
              return d.bbox.width + 4;
           })
           .attr("height", function(d) {
              return d.bbox.height;
           })
        
        // store an array of each country's centroid
        data.map(d=> {
          centroids.push({
            name: d.properties.name,
            x: path.centroid(d)[0],
            y: path.centroid(d)[1]
          })
        })

        interactive(countriesPaths)
        interactive(d3.selectAll('.countryName'), topCountries_list)
      }

      ///////////////////////////////////////////////////////////////////////////
      //////////////////////////////// Zoomable map /////////////////////////////
      ///////////////////////////////////////////////////////////////////////////

      const mapWidth = svg.node().getBoundingClientRect().width;
      const mapHeight = svg.node().getBoundingClientRect().height;

      const zoom = d3.zoom()
        .scaleExtent([1, 3])
        .translateExtent([[-mapWidth, -mapHeight], [mapWidth, mapHeight]])
        .extent([[0,0], [mapWidth, mapHeight]])
        .on("zoom", zoomed)

      function zoomed(d){

        const {x,y,k} = d3.event.transform
        let t = d3.zoomIdentity
        t =  t.translate(x,y).scale(k).translate(50,50)
        g.attr("transform", t)

      }  

      svg.call(zoom)

      ////////////////////////////////////////////////////////////////////////////////////
      //////////////////////////////////// Chloropleth map ///////////////////////////////
      //////////////////////////////////////////////////////////////////////////////////// 
 
      function updateMap(X) {

        countriesPaths
          .attr('fill', function(d) {
            if ((d.properties[X] === undefined) | (d.properties[X] == 0)) {
              return DEFAULT_MAP_COLOR
            } else {
              return DEFAULT_SELECTED_CTRY
            }})

      }

      ////////////////////////////////////////////////////////////////////////////////////
      //////////////////////////////////// Interactive map ///////////////////////////////
      //////////////////////////////////////////////////////////////////////////////////// 

      function interactive(obj, topCountries_list) {

        obj
          .on("mousemove", function(d) {
            doMapActions(d.properties.name) 
          })
          .on("mouseout",  function(d) { 
            undoMapActions()
          })

      }

      function doMapActions(country) {
        d3.selectAll(".countryName")
          .filter(function(d) { return d.properties.name == country})
          .attr('opacity', 1)     
      }

      function undoMapActions() {
        d3.selectAll(".countryName")
          .attr('opacity', d => topCountries_list.indexOf(d.properties.name) != -1 ? 1 : 0)
      }

      ////////////////////////////////////////////////////////////////////////////////////
      /////////////////////////////// Draw connector paths on map ////////////////////////
      //////////////////////////////////////////////////////////////////////////////////// 

      function drawLinksMap(data, X) {

        // Create an array to feed into path selection
        //var arcdata = [
          //{
            //sourceName: Singapore,
            //targetName: Australia,
            //sourceLocation: [-99.5606025, 41.068178502813595],
            //targetLocation: [-106.503961875, 33.051502817366334]
          //}]

        var arcData = []
        var country = 'Germany'
        data.map((d,i)=>{
          if((d.properties[X] !== undefined) & (d.properties[X] !== 0) ) {
            var cS = centroids.find(c => c.name == d.properties.name)
            var cT = centroids.find(c => c.name == country)
            arcOne = {
              id: i,
              value: d.properties[X],
              sourceName: d.properties.name,
              targetName: country,
              sourceLocation: [cS.x, cS.y],
              targetLocation: [cT.x, cT.y],
              startColor: colorSource, 
              stopColor: colorDestination
            }
            arcData.push(arcOne)
          }
        }) 
        //console.log(arcData)

        var arcPaths = arcs.selectAll("path").data(arcData, d=>d.id) // Create a path for each source/target pair.

        arcPaths.exit().remove()

        arcPaths.enter().append("path")
          .merge(arcPaths)
          .attr('class', d=> 'line line-' + d.sourceName)
          .attr('fill', 'none')
          .attr('opacity', 1)
          .attr('stroke-linecap', 'round')
          .attr('stroke-width', function(d) { return lineScale(d.value) })
          .style('stroke', '#45ADA8')
          //.style("stroke", function(d,i) {
            //var sx = d.targetLocation[0] - d.sourceLocation[0]
            //return (sx > 0) ? 'url(#LinkStroke1)' : 'url(#LinkStroke2)'
          //})
          .attr('d', function(d) { 
            var a = Math.atan2(d.targetLocation[1] - d.sourceLocation[1], d.targetLocation[0] - d.sourceLocation[0]) * (180 / Math.PI)
            
            //if(d.sourceName=='Nigeria' | d.sourceName=='Niger' | d.sourceName=='Benin' | d.sourceName=='Togo' | d.sourceName=='Mali'){
              //connector_angles.push({'country': d.sourceName, 'flip': 2})
              //return line(d, 'sourceLocation', 'targetLocation')
            //}
            if(a>=-90 & a<=90){
              var path = arc(d, 'sourceLocation', 'targetLocation', 1)
              path ? connector_angles.push({'country': d.sourceName, 'flip': 1}) : connector_angles.push({'country': d.sourceName, 'flip': 2})
              return path ? path : line(d, 'sourceLocation', 'targetLocation')
            } else {
              connector_angles.push({'country': d.sourceName, 'flip': 2})
              var path = arc(d, 'sourceLocation', 'targetLocation', 2)
              return path ? path : line(d, 'sourceLocation', 'targetLocation')
            } 
          })

      } 

      ///////////////////////////////////////////////////////////////////////////////////
      //////////////////////////// Animate markers moving along path ////////////////////
      ///////////////////////////////////////////////////////////////////////////////////

      function animateMarkers(days, elapsed, initDayId) {
    
        const sexAccessor = d => d.gender
        const ednAccessor = d => d.attended_university
        const xProgressAccessor = d => (elapsed - d.startTime) / 5000

        function fillCategory(d) {
          if(ednAccessor(d) == 'TRUE'){
            return KIRON_COLOR
          } else if(ednAccessor(d) == 'FALSE'){
            return 'white'
          } else if(ednAccessor(d) == 'UNKNOWN'){
            return 'red'
          } 
        }

        currentDayIdNew = currentDayId + initDayId
        if(currentDayIdNew < days.length){
          var dayData= entityData.filter(d=>d.student_since == days[currentDayIdNew].toString())
          //d3.select('#clock > h2').html(formatTime(days[currentDayId]))  // update the clock
          people = [
            ...people,
            ...d3.range(dayData.length).map(() => generatePerson(elapsed)),
          ]
          currentDayId++
        }

        const m1 = markersGroup.selectAll(".marker-circle")
          .data(people.filter(function(d){ 
            return xProgressAccessor(d) > 0  && xProgressAccessor(d) < 1
          }), d => d.id)

        m1.enter().append("circle")
          .attr("class", "marker marker-circle")
          .attr("r", 1.7)
          .attr('fill', d=> sexAccessor(d) == 'male' ? KIRON_COLOR : 'white')
          //.attr("fill", d=>fillCategory(d))

        m1.exit().remove()

        //const trianglePoints = [
          //"-4,  5",
          //" 0, -5",
          //" 4,  5",
        //].join(" ")
        //const m2 = markersGroup.selectAll(".marker-triangle")
          //.data(people.filter(function(d){ 
            //return xProgressAccessor(d) > 0  && xProgressAccessor(d) < 1 && sexAccessor(d) == 'female'
          //}), d => d.id)

        //m2.enter().append("polygon")
          //.attr("class", "marker marker-triangle")
          //.attr("points", trianglePoints)
          //.attr('fill', '#113893')
          //.attr("fill", d=>fillCategory(d))

        //m2.exit().remove()

        const markers = d3.selectAll(".marker")

        markers.style("transform", (d,i) => {
          var xScale = d3.scaleLinear()
            .domain(d.flip == 1 ? [0.98, 0] : [0, 0.98])
            .range([0, d.path ? d.path.getTotalLength() : 0])
            .clamp(true)

        var currentPos = d.path ? d.path.getPointAtLength(xScale(xProgressAccessor(d))) : {x: 0, y: 0}
          return `translate(${ currentPos.x }px, ${ currentPos.y }px)`
        })        
        .attr('opacity', d=> d.path ? 1 : 0)

        //if (elapsed > 10000) timer.stop();
        // update position and text of label according to slider scale
        if(currentDayIdNew < days.length){
          handle.attr("cx", xTimeScale(days[currentDayIdNew]));
          label
            .attr("x", xTimeScale(days[currentDayIdNew]))
            .text(formatTime(days[currentDayIdNew]))
        }
          
      }
      
      let people = []
      let currentPersonId = 0      
      function generatePerson(elapsed) {

        const getRandomNumberInRange = (min, max) => Math.random() * (max - min) + min
        const getRandomValue = arr => arr[Math.floor(getRandomNumberInRange(0, arr.length))]
        var entity = entityData.find(d=>d.id == currentPersonId)
        var path =  entity.nationality == "Germany" ? null : arcs.selectAll("path").filter(d=>d.sourceName == entity.nationality).node()
        var country = connector_angles.find(d=>d.country == entity.nationality)
        var flip = country ? country.flip : 1
        //if(path==null){
          //console.log(entity.nationality) // track which countries are missing paths
        //}
        currentPersonId++
        return {
          id: currentDayIdNew,
          path: path,
          startTime: elapsed + getRandomNumberInRange(0, 10),
          country: entity.nationality,
          gender: entity.gender,
          attended_university: entity.attended_university,
          flip: flip
        }
      }

      ///////////////////////////////////////////////////////////////////////////////////
      //////////////////////////////////// Create legend ////////////////////////////////
      ///////////////////////////////////////////////////////////////////////////////////

      function drawLegend() {

        var legend = svg.append("g")
            .attr("class","legend")

        const legendGroup = legend.append("g")
          .attr("class", "legend")
          .attr("transform", `translate(${LEGEND_POS_X}, ${LEGEND_POS_Y})`)

        const femaleLegend = legendGroup.append("g")
            .attr("transform", `translate(${0}, 0)`)

        femaleLegend.append("circle")
            .attr("r", 5.5)
            .attr('fill', 'white')
            .attr("transform", "translate(15, 0)")

        femaleLegend.append("text")
            .attr("class", "legend-text-left")
            .text("Female")
            .attr('font-size', '11px')
            .attr('fill', 'white')
            .attr("x", 0)
            .attr("y", -10)

        const maleLegend = legendGroup.append("g")
            .attr("transform", `translate(${60}, 0)`)

        maleLegend.append("circle")
            .attr("r", 5.5)
            .attr('fill', '#113893')
            .attr("transform", "translate(5, 0)")

        maleLegend.append("text")
            .attr("class", "legend-text-right")
            .text("Male")
            .attr('font-size', '11px')
            .attr('fill', '#113893')
            .attr("x", 0)
            .attr("y", -10)

      }

      ///////////////////////////////////////////////////////////////////////////////////
      ////////////////////////////////// Create slider //////////////////////////////////
      ///////////////////////////////////////////////////////////////////////////////////
      function slider(days) {

        if (ipadPRO_landscape) {
          var targetValue = Math.min(window.innerWidth, screen.width) * 0.65
          var sliderPosX = Math.min(window.innerWidth, screen.width) * 0.28
          var sliderPosY = 75
        } else if (ipad_portrait) {
          var targetValue = Math.min(window.innerWidth, screen.width) * 0.8
          var sliderPosX = Math.min(window.innerWidth, screen.width) * 0.15
           var sliderPosY = 45
        } else if (desktop){
          var targetValue = Math.min(window.innerWidth, screen.width) * 0.63 
          var sliderPosX = Math.min(window.innerWidth, screen.width) * 0.32
          var sliderPosY = 75
        } else {
          var targetValue = Math.min(window.innerWidth, screen.width) * 0.63
          var sliderPosX = Math.min(window.innerWidth, screen.width) * 0.32
          var sliderPosY = 75
        }

        var currentValue = 0;
        var daysString = days.map(d=>formatTime(d))

        xTimeScale = d3.scaleTime()
            .domain([days[0], days[days.length-1]])
            .range([0, targetValue])
            .clamp(true);

        var slider = svg.append("g")
            .attr("class", "slider")
            .attr("transform", "translate(" + sliderPosX + "," + sliderPosY + ")");

        slider.append("line")
            .attr("class", "track")
            .attr("x1", xTimeScale.range()[0])
            .attr("x2", xTimeScale.range()[1])
          .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
            .attr("class", "track-inset")
          .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
            .attr("class", "track-overlay")
            //.call(d3.drag()
                //.on("start.interrupt", function() { slider.interrupt(); })
                //.on("start drag", function() {
                  //dragged = true
                  //currentValue = d3.event.x
                  //x = xTimeScale(xTimeScale.invert(currentValue))
                  //initDayId = daysString.indexOf(formatTime(xTimeScale.invert(currentValue)))
                  //handle.attr("cx", x)
                  //label
                    //.attr("x", x)
                    //.text(formatDate(xTimeScale.invert(currentValue)))
                //})
            //);

        slider.insert("g", ".track-overlay")
            .attr("class", "ticks")
            .attr("transform", "translate(0," + 18 + ")")
          .selectAll("text")
            .data(xTimeScale.ticks(10))
            .enter()
            .append("text")
            .attr("x", xTimeScale)
            .attr("y", 10)
            .attr("text-anchor", "middle")
            .text(function(d) { return formatDate(d); });

        handle = slider.insert("circle", ".track-overlay")
            .attr("class", "handle")
            .attr("r", 9);

        label = slider.append("text")  
            .attr("class", "label")
            .attr("font-weight", "bold")
            .attr("text-anchor", "middle")
            .text(formatTime(days[0]))
            .attr("transform", "translate(0," + (-25) + ")")

      }

    }
  }

  ///////////////////////////////////////////////////////////////////////////
  ///////////////////////////// Helper functions ////////////////////////////
  ///////////////////////////////////////////////////////////////////////////
  function getTextBox(selection) {
    selection.each(function(d) {
      d.bbox = this.getBBox();
    });
  }

  function findCenters(r, p1, p2) {
    var pm = { x : 0.5 * (p1.x + p2.x) , y: 0.5*(p1.y+p2.y) } ;
    var perpABdx= - ( p2.y - p1.y );
    var perpABdy = p2.x - p1.x;
    var norm = Math.sqrt(sq(perpABdx) + sq(perpABdy));
    perpABdx/=norm;
    perpABdy/=norm;
    var dpmp1 = Math.sqrt(sq(pm.x-p1.x) + sq(pm.y-p1.y)); 
    var sin = dpmp1 / r ;
    if (sin<-1 || sin >1) return null;
    var cos = Math.sqrt(1-sq(sin));
    var d = r*cos;
    var res1 = { x : pm.x + perpABdx*d, y: pm.y + perpABdy*d };
    var res2 = { x : pm.x - perpABdx*d, y: pm.y - perpABdy*d };
    return { c1 : res1, c2 : res2} ;  
  }

  function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;

    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  function describeArc(x, y, radius, startAngle, endAngle, category, NUM){
      var start = polarToCartesian(x, y, radius, endAngle);
      var end = polarToCartesian(x, y, radius, startAngle);
      var arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
      if (NUM === 1) {
        var d = [
            "M", start.x, start.y, 
            "A", radius, radius, 0, arcSweep, 0, end.x, end.y
        ].join(" ");
      } else if (NUM === 2){
        var d = [
            "M", end.x, end.y, 
            "A", radius, radius, 0, arcSweep, 0, start.x, start.y
        ].join(" ");
      }
      return d    
  }

  function sq(x) { return x*x ; }

  function drawCircleArcSVG(c, r, p1, p2, category, NUM) {
    if(c.x & c.y){
      var ang1 = Math.atan2(p1.y-c.y, p1.x-c.x)*180/Math.PI+90;
      var ang2 = Math.atan2(p2.y-c.y, p2.x-c.x)*180/Math.PI+90;
      var path = describeArc(c.x, c.y, r, ang1, ang2, category, NUM)
    }
    return path
  }

  function findCenters(r, p1, p2) {
    var pm = { x : 0.5 * (p1.x + p2.x) , y: 0.5*(p1.y+p2.y) } ;
    var perpABdx= - ( p2.y - p1.y );
    var perpABdy = p2.x - p1.x;
    var norm = Math.sqrt(sq(perpABdx) + sq(perpABdy));
    perpABdx/=norm;
    perpABdy/=norm;
    var dpmp1 = Math.sqrt(sq(pm.x-p1.x) + sq(pm.y-p1.y)); 
    var sin = dpmp1 / r ;
    if (sin<-1 || sin >1) return null;
    var cos = Math.sqrt(1-sq(sin));
    var d = r*cos;
    var res1 = { x : pm.x + perpABdx*d, y: pm.y + perpABdy*d };
    var res2 = { x : pm.x - perpABdx*d, y: pm.y - perpABdy*d };
    return { c1 : res1, c2 : res2} ;  
  }

  function arc(d, sourceName, targetName, NUM) {

    var sourceLngLat = d[sourceName],
        targetLngLat = d[targetName];

    if (targetLngLat && sourceLngLat) {

      var sourceX = sourceLngLat[0],
          sourceY = sourceLngLat[1];

      var targetX = targetLngLat[0],
          targetY = targetLngLat[1];

      var dx = targetX - sourceX,
          dy = targetY - sourceY

      var initialPoint = { x: sourceX, y: sourceY}
      var finalPoint = { x: targetX, y: targetY}
      d.r = Math.sqrt(sq(dx) + sq(dy)) * 2;
      var centers = findCenters(d.r, initialPoint, finalPoint);
      var path = drawCircleArcSVG(centers.c1, d.r, initialPoint, finalPoint, d.category, NUM);
      return path

    }

  }

  function line(d, sourceName, targetName){

    var sourceLngLat = d[sourceName],
        targetLngLat = d[targetName];

    if (targetLngLat && sourceLngLat) {

      var sourceX = sourceLngLat[0],
          sourceY = sourceLngLat[1];

      var targetX = targetLngLat[0],
          targetY = targetLngLat[1];

      var path = [
        "M", sourceX, sourceY, 
        "L", targetX, targetY
      ].join(" ")

      return path

    } else {
      return "M0,0,l0,0z";
    }
  }

}()