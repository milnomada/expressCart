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

var genBarChart = function(labels, dss) {
  

  var myChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: labels,
          datasets: dss
          /* [{
              label: 'Rebuilds',
              data: data,
              backgroundColor: colorFill,
              borderColor: borderColor,
              borderWidth: 1
          }] */
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

var __formatRebuilds = function(){
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

var loadStatusArr = function() {
  var status = []
  // prepare distinct statuses, one per dataset
  $.each( $('.rebuilds tr'), function(i, e){ 
    var st = $(e).find('.fa-circle').attr('data-status')
    console.log("status", i, st)
    if(st && status.indexOf(st) == -1) {
      status.push(st)
    }
  })

  return status;
}

var buildLog = function(status) {
  var log = {}, dtArr = [], index;
  // load per status data
  // i:         status-column, 
  // arr[i]:    status-occurence for this value
  $.each( $('.rebuilds tr'), function(i, e){ 
    var dt = $(e).find('.rebuild-dt').attr('data-dt'),
        cur = moment(dt).format("MM-YYYY"),
        st
        ;

    if(Object.keys(log).indexOf(cur) == -1) {
      // start datasets
      log[cur] = []
      // one position per status
      for(var i in status)
        log[cur].push(0)
      // append formatted date
      dtArr.push(cur) 
    } else {
      st = $(e).find('.fa-circle').attr('data-status')
      index = status.indexOf(st)
      log[cur][index] += 1
    }
  });

  return {
    log: log,
    dtArr: dtArr
  }
}

var formatRebuilds = function(){
  var dtArr, 
      log,      
      dss = [],
      status,
      data,
      statusInt
      ;

  status = loadStatusArr()
  console.log("status Arr", status)

  logObj = buildLog(status)
  log = logObj.log          // key-value matrix, string --> Array(maxDistinctStatus)
  dtArr = logObj.dtArr      // single formatted dates array

  // generate chart dss with previous datasets
  for(var i=0; i < status.length; i++) {
    data = []
    statusInt = parseInt(status[i])
    // load values for this dataset from its relative column in log matrix
    for(var d in log) {
      data.push(log[d][i])
    }
    dss.push({
      label: getRebuildStatusName(statusInt),
      data: data,
      backgroundColor: getRebuildStatusColor(statusInt) + "33", // add opacity hexadecimal [00...ff]
      borderColor: getRebuildStatusColor(statusInt) + "ff",     // add dense opacity to border
      borderWidth: 1
    })
  }
  return {
    labels: dtArr,
    data: dss
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

var getRebuildStatusName = function(s){
  switch(s){
    case 0: // created
      return 'created'
    case 1: // confirmed
      return 'confirmed'
    case 2: // paid
      return 'paid'
    case 3: // started -- building...
      return 'started'
    case 4: // sent
      return 'sent'
    case 5: // cancelled
      return 'cancelled'
  }
}

/**
 * For compatibility with Paypal statuses, this method
 * translates a status string to a numeric code
 * @param  {String} status    String status (Paid)
 * @return {Int}              Numeric status
 */
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
    case 'Declined':
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
