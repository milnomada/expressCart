/**
 * Dashboard charts
 */
try {
  var ctx = document.getElementById('rebuilds').getContext('2d');
} catch(e) {
  var ctx = null;
} 


var genChart = function(type, labels, data){
  switch(type) {
    case 'bar':
      genBarChart(labels, data)
  }
}

var genColors = function(data, alpha) {
  var cArr = [], cHdArr = []
  for(var i in data){
    var r = Math.floor((Math.random() * 255) + 0),
        g = Math.floor((Math.random() * 255) + 0),
        b = Math.floor((Math.random() * 255) + 0)
        ;
        // t = Math.floor((Math.random() * 255) + 0);
    cArr.push('rgba(' + r + ',' + g + ',' + b + ',' + alpha[0] + ')')
    cHdArr.push('rgba(' + r + ',' + g + ',' + b + ',' + alpha[1] + ')')
  }
  return [cArr, cHdArr]
}

var genBarChart = function(labels, data) {
  var colors = genColors(data, [0.2, 1]),
    colorFill = colors[0],
    borderColor = colors[1];

  var myChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: labels,
          datasets: [{
              label: 'Rebuilds',
              data: data,
              backgroundColor: colorFill,
              borderColor: borderColor,
              borderWidth: 1
          }]
      },
      options: {
          scales: {
              yAxes: [{
                  gridLines: {
                      display: false
                  }, 
                  ticks: {
                      beginAtZero: true
                  }
              }],
              xAxes: [{
                  gridLines: {
                      display: false
                  }
              }]
          }
      }
  });
}

var formatRebuilds = function(){
  var dt = [], moments = {}, cur, keys, datum = [], labels = [];
  $.each( $('.rebuild-dt'), function(i, e){ dt.push($(e).attr('data-dt')) });
  for(var i in dt) {
    cur = moment(dt[i]).format("MM-YYYY")
    if(Object.keys(moments).indexOf(cur) == -1 )
      moments[cur] = 1
    else
      moments[cur] += 1
  }
  keys = Object.keys(moments)
  for(var i in keys) {
    labels.push(keys[i])
    datum.push(moments[keys[i]])
  }
  return {
    labels: labels,
    data: datum
  }
}

var getRebuildStatusColor = function(s){
  switch(s){
    case 0: // created
      return '#ffe73f'
    case 1: // confirmed
      return '#bef904'
    case 2: // paid
      return '#09f904'
    case 3: // started -- building...
      return '#f750b5'
    case 4: // sent
      return '#00bcd4'
    case 5: // cancelled
      return '#fd2222'
  }
}

var translateStatus = function(status) {
  switch(status){
    case 'Paid':
        return 3;
    case 'Approved':
        return 1;
    case 'Approved - Processing':
        return 2;
    case 'Failed':
        return 6;
    case 'Completed':
        return 4;
    case 'Shipped':
        return 5;
    case 'Pending':
        return 0;
    default:
        return 0;
  }
}

var getOrderStatusColor = function(s) {
  switch(translateStatus(s)){
    case 3: //'Paid':
        return '#bef904'
    case 1: //'Approved':
        return '#bef904'
    case 2: //'Approved - Processing':
        return '#bef904'
    case 6: // 'Failed':
        return '#fd2222'
    case 4: //'Completed':
        return '#09f904';
    case 5: //'Shipped':
        return '#00bcd4'
    case 0: //'Pending':
      return '#ffe73f'
      //  return 'warning';
    default:
        return 'danger';
  }
}

$(document).ready(function(){
  var rebuilds = formatRebuilds();
  
  if(ctx)
    genChart('bar', rebuilds.labels, rebuilds.data)

  $.each( $('.list-table.rebuilds i.fa-circle'), function(i, e) {
    console.log(i, e);
    $(e).css({color: getRebuildStatusColor(parseInt($(e).attr('data-status')))})
  })

  $.each( $('.list-table.orders i.fa-circle'), function(i, e) {
    console.log(
      getOrderStatusColor($(e).attr('data-status')), 
      e);
    $(e).css({color: getOrderStatusColor($(e).attr('data-status'))})
  })
})
