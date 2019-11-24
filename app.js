const express = require('express');
const app = express();
const morgan = require('morgan');
const oneYearData = require('./test_data/one_year.json');
const csv = require('csv-parser');
const fs = require('fs');
const fetch = require("node-fetch");
const superagent = require('superagent');
var cors = require('cors');
var bodyParser = require('body-parser');
var redis = require('./utils').redisConnector;
var uuid = require('uuid');
const fileUpload = require('express-fileupload');

var redisClient;
setupRedis();

function setupRedis() {
  var config = {
    host: 'redis-10694.c17.us-east-1-4.ec2.cloud.redislabs.com',
    port: 10694,
    password: 'loop'
  }
  redis(config, 'data').getRedis()
  .then(function(client) {
    redisClient = client;
    startServer();
  })
  .catch(function(err) {
    console.log('Fatal Error in connecting to Redis. Killing Process!');
    process.exit();
  })
  .done(function() {
    console.log('Inside Redis Done')
  });
}


app.use(cors())
app.use(express.json())
app.use(bodyParser())
app.use(fileUpload());


function queryTS(options, callback) {
  if(!options && !res.body.metric) {
      callback({ 'message': 'Mandatory parameter "metric" is missing.' });
  } else {
      var body = {
          "metrics": [
              {
                  "name": options.metric,
                  "tags": options.tags
              }
          ],
          "cache_time":0,

      };

      if(options.start_rel || options.start_time || options.end_rel || options.end_time || options.group_tag) {
          if(options.group_tag) {
              body.metrics[0].group_by = [{
                  "name": "tag", "tags": [options.group_tag]
              }];
          }
          if(options.start_rel) {
              body.start_relative = {
                  value: options.start_rel.split('_')[0]
              }
              switch(options.start_rel.split('_')[1]) {
                  case 'Y':
                      body.start_relative.unit = 'years';
                      break;
                  case 'M':
                      body.start_relative.unit = 'months';
                      break;
              }
          }
          if(options.end_rel) {
              body.end_relative = {
                  value: options.end_rel.split('_')[0]
              }
              switch(end_rel.split('_')[1]) {
                  case 'Y':
                      body.end_relative.unit = 'years';
                      break;
                  case 'M':
                      body.end_relative.unit = 'months';
                      break;
              }
          }
          if(options.start_time) {
              body.start_absolute = options.start_time;
          }
          if(options.end_time) {
              body.end_absolute = options.end_time;
          }
      }
      // console.log(JSON.stringify(body))
      if(options.aggregator_name) {
        body.metrics[0].aggregators = [{
          "name": options.aggregator_name,
          "align_sampling": true,
          "sampling": {"value":"30","unit":"years"}
        }];
      }
      superagent.post('http://54.175.213.66:8082/api/v1/datapoints/query')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(body)
      .end(function(err, res) {
        if (err) { callback(err); }
        else { callback(null, res.body); }
      });
  }
}


function addTS(options, callback) {
  if(!options) {
      callback({ 'message': 'Necessary parameters are missing.' });
  } else {
      superagent.post('http://54.175.213.66:8082/api/v1/datapoints')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(options)
      .end(function(err) {
        if (err) { callback(err); }
        else { callback(null); }
      });
  }
}


//data with type uploading API
app.post('/api/loops/users/data-upload-with-type/', dataUploadwType);
function dataUploadwType(req, res, next) {
  console.log('Inside dataUpload function.');
  var data_json = req.body
  var senderids = data_json.senderid
  var timestamps = data_json.timestamp
  var receiverids = data_json.receiverid
  var datatype = data_json.datatype
  var dataObject = []
  var redisKey = 'log:s:' + senderids + ':r:' + receiverids;
  redisClient.zadd(redisKey, timestamps, JSON.stringify({
    id: (Math.random() * 10000).toString(),
    type: datatype,
    notes: data_json.notes,
    date: timestamps
  }));
  var i = 0;
  for(i = 0; i < receiverids.length; i++){
    var eachItem ={}
    eachItem.name = senderids;
    eachItem.datapoints = [[timestamps, 1]]
    eachItem.tags = {
      "receiver": receiverids[i],
      "datatype": datatype
    }
    dataObject.push(eachItem)
  }
  // record the opposite format i.e., receiverid as name, senderid as tag
  var j = 0;
  for(j = 0; j < receiverids.length; j++){
    var eachItem ={}
    eachItem.name = receiverids[j];
    eachItem.datapoints = [[timestamps, 1]]
    eachItem.tags = {
      "sender": senderids,
      "datatype": datatype
    }
    dataObject.push(eachItem)
  }

  options = dataObject
  // res.send(dataObject)

  addTS(options, function(err, res2){
    result = res2;//the result from the KairosDB and the data is of format of KairosDB
    res.send('go to kairosDB to check')
  });


  // var senderids = req.query.senderid
  // var timestamps = req.query.timestamp
  // var receiverids = JSON.parse(req.query.receiverid)
  // var dataObject = []
  // var i = 0;
  // for(i = 0; i < receiverids.length; i++){
  //   var eachItem ={}
  //   eachItem.name = senderids;
  //   eachItem.datapoints = [[timestamps, 1]]
  //   eachItem.tags = {
  //     "receiver": receiverids[i]
  //   }
  //   dataObject.push(eachItem)
  // }

  // options = dataObject
  // // res.send(dataObject)

  // addTS(options, function(err, res2){
  //   result = res2;//the result from the KairosDB and the data is of format of KairosDB
  //   res.send('go to kairosDB to check')
  // });


  // res.json(data_json)//for test
};


//Heatmap API
app.post('/api/loops/users/heatmap/', getHeatMap)
function getHeatMap(req, res, next) {
  // var options = {
  //   "metric": "prerak",
  //   "start_rel": "1_Y",
  //   "tags": { 
  //     "type": ["human"]
  //   },
  //   "group_tag": "type"
  // };
  // var options = {
  //   "metric": "000001",
  //   "start_rel": "1_Y",
  //   "tags": {
  //     "receiver": journeyFriends//contact list in a journey
  //   },
  //   "group_tag": "receiver"
  // };
  

  // res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader(
  //   "Access-Control-Allow-Headers",
  //   "Origin, Methods, X-Requested-With, Content-Type, Accept"
  // );
  // res.setHeader(
  //   "Access-Control-Allow-Methods",
  //   "GET, POST, PATCH, DELETE, OPTIONS"
  // );
  
  var data_json_heat = req.body 
  var senderids = data_json_heat.senderid
  var timeranges = data_json_heat.timerange
  var journeyFriends = data_json_heat.journeyFriends
  // var journeyF_rightForm = [] 
  // var k = 0
  // for(k = 0; k < journeyFriends.length; k++){
  //   journeyF_rightForm.push(journeyFriends[k])
  // }
  console.log("Heatmap request: %j", data_json_heat);
  // format check make sure senderid and journeyFriends are non empty
  if(senderids && (journeyFriends.length !== 0)){
    // // const journeyFriends = ["000091","000092","000093","000094","000095","000096","000097","000098"] //for test
    var options = {
      "metric": senderids,
      "start_rel": timeranges,
      "tags": {
        "receiver": journeyFriends//contact list in a journey
      },
      "group_tag": "receiver"
    }; 
    // res.json(options)
    queryTS(options, function(err, res2){
      var result = res2;//the result from the KairosDB and the data is of format of KairosDB
      console.log("Heatmap inner1 response: %j", result);

      if (typeof result !== 'undefined' && result){
        //transfer the format of KairosDB query to Heatmap JSON format
        var nFriends = result.queries[0].results
        console.log("Heatmap inner2 nFriends %j", nFriends)
        var touchList = [];
        if (nFriends[0].values.length) {
          touchList = nFriends.map(function(item) {
            return {
              "receiver": item.tags.receiver[0],
              "connections": Object.keys(item.values).length
            }
            // if('receiver' in item.tags){
            //   return {
            //     "receiver": item.tags.receiver[0],
            //     "connections": Object.keys(item.values).length
            //   }
            // }
            // else{
            //   return {
            //     "receiver": item.tags.receiver[0],
            //     "connections": Object.keys(item.values).length
            //   }
            // }
          })
        }
        console.log("Heatmap inner2 touchList %j", touchList)
        // effective friends that have already contacted
        var effFriends = []
        touchList.forEach(function(ele){
          effFriends.push(ele.receiver)
        })
        // ineffective friends that have not contacted in the journey
        var inEffFriends = journeyFriends.filter(value => !effFriends.includes(value))
        
        //total number of friends in the journey to display, row column numbers
        var n = journeyFriends.length
        var nRow = Math.ceil(Math.sqrt(n / 2))
        var nCol = Math.ceil(n / nRow)

        //store all the displayvalue and value to a dictionary,i.e., key, value pair
        //so that we can output in order of the same as the Journey friends
        var displayValueDict = {}
        var r = 0
        for(i = 0; i < nRow; i++) {
          for(j = 0; j < nCol; j++) {
            if (r < touchList.length){
              var eachItem ={}
              displayValueDict[touchList[r].receiver] = touchList[r].connections.toString();
              r = r + 1
            }
            else if (r < n){
              var eachItem ={}
              displayValueDict[inEffFriends[r - touchList.length]] = "0";
              r = r + 1
            }
          }
        }
        console.log("DisplayValueDict %j", displayValueDict)
        //construct dataset 
        var data = []
        var i = 0
        var j = 0
        var iter = 0
        for(i = 0; i < nRow; i++) {
          for(j = 0; j < nCol; j++) {
            if (iter < n){
              var eachItem ={}
              eachItem.displayvalue = journeyFriends[iter];
              eachItem.value = displayValueDict[journeyFriends[iter]];
              var tempRowid = i+1
              eachItem.rowid = tempRowid.toString();
              var tempColid = j+1
              eachItem.columnid = tempColid.toString();
              data.push(eachItem);
              iter = iter + 1
            }
          }
        }
        //update data by adding the response from receivers accordingly
        var count = 0
        for (let k = 0; k < data.length; k++){
          var options2 = {
            "metric": data[k].displayvalue,
            "start_rel": timeranges,
            "tags": {
              "receiver": [senderids]
            },
          }
          queryTS(options2, function(err3, res3){
            count += 1
            var updateValue = (Number(res3.queries[0].sample_size) + Number(data[k].value)).toString()
            data[k].value = updateValue
            if(count == data.length){
              //construct rows and columns
              var row = []
              var i = 0
              for(i = 0; i < nRow; i++){
                var eachItem ={}
                var tempid = i+1
                eachItem.id = tempid.toString();
                eachItem.label = "";
                row.push(eachItem);
              }
              var column = []
              var j = 0
              for(j = 0; j < nCol; j++){
                var eachItem ={}
                var tempid = j+1
                eachItem.id = tempid.toString();
                eachItem.label = "";
                column.push(eachItem);
              }

              //aggregate all to one object for front end
              heatMapData = {
                "rows":{
                  "row": row
                },
                "columns":{
                  "column": column
                },
                "dataset":[{
                  "data": data
                }]
              }
              res.json(heatMapData)
            }
          })
        }
      }
      else{
        res.json("Please check the request format")
      }
    });
  }
  else{
    res.json("Please make sure senderid and journeyFriends are non-empty")
  }

  

  // var senderids = req.query.senderid
  // var timeranges = req.query.timerange
  // var journeyFriends = JSON.parse(req.query.journeyFriends)

  // const journeyFriends = ["000091","000092","000093","000094","000095","000096","000097","000098"] //for test
  // var options = {
  //   "metric": senderids,
  //   "start_rel": timeranges,
  //   "tags": {
  //     "receiver": journeyFriends//contact list in a journey
  //   },
  //   "group_tag": "receiver"
  // };
  // queryTS(options, function(err, res2){
  //   var result = res2;//the result from the KairosDB and the data is of format of KairosDB
  //   //transfer the format of KairosDB query to Heatmap JSON format
  //   var nFriends = result.queries[0].results
  //   var touchList = nFriends.map(function(item) {
  //     return {
  //       "receiver": item.tags.receiver[0],
  //       "connections": Object.keys(item.values).length
  //     }
  //   })
  //   //total number of friends in the journey to display, row column numbers
  //   var n = journeyFriends.length
  //   var nRow = Math.ceil(Math.sqrt(n / 2))
  //   var nCol = Math.ceil(n / nRow)
    
  //   //construct dataset
  //   var data = []
  //   var i = 0
  //   var j = 0
  //   var iter = 0
  //   for(i = 0; i < nRow; i++){
  //     for(j = 0; j < nCol; j++){
  //       if (iter < n){
  //         var eachItem ={}
  //         eachItem.displayvalue = touchList[iter].receiver;
  //         eachItem.value = touchList[iter].connections;
  //         eachItem.rowid = i+1;
  //         eachItem.columnid = j+1;
  //         data.push(eachItem);
  //         iter = iter + 1
  //       }
  //     }
  //   }

  //   //construct rows and columns
  //   var row = []
  //   var i = 0
  //   for(i = 0; i < nRow; i++){
  //     var eachItem ={}
  //     eachItem.id = i+1;
  //     eachItem.label = "";
  //     row.push(eachItem);
  //   }
  //   var column = []
  //   var j = 0
  //   for(j = 0; j < nCol; j++){
  //     var eachItem ={}
  //     eachItem.id = j+1;
  //     eachItem.label = "";
  //     column.push(eachItem);
  //   }

  //   //aggregate all to one object for front end
  //   heatMapData = {
  //     "rows":{
  //       "row": row
  //     },
  //     "columns":{
  //       "column": column
  //     },
  //     "dataset":[{
  //       "data": data
  //     }]
  //   }
  //   res.json(req.query.journeyFriends)
  // });
}


//total connections/touch points API
app.post('/api/loops/users/touchPoints/', getTouchPoints)
function getTouchPoints(req, res, next) {
  
  var data_json_heat = req.body 
  var senderids = data_json_heat.senderid
  var journeyFriends = data_json_heat.journeyFriends
  console.log('total touch points request: %j', data_json_heat)
  if (!senderids || !journeyFriends || journeyFriends.length === 0){
    res.json("Please make sure senderid and journeyFriends are non-empty")
  }
  else{
    var touchpoint_temp = 0
    var options = {
      "metric": senderids,
      "start_rel": '10_Y',//10 years make sure select all the points
      "tags": {
        "receiver": journeyFriends//contact list in a journey
      },
    }; 
    var options2 = []
    for(let j = 0; j < journeyFriends.length; j++){
      options2.push({
        "metric": journeyFriends[j],
        "start_rel": '10_Y',//10 years make sure select all the points
        "tags": {
          "receiver": [senderids]
        },
      })
    }
    
    queryTS(options, function(err, res2){
      var result = res2;//the result from the KairosDB and the data is of format of KairosDB
      // console.log("%j", result);
      if (typeof result !== 'undefined' && result){
        // console.log(result);
        touchpoint_temp = result.queries[0].sample_size
        var count = 0
        for(let i = 0; i < journeyFriends.length; i++){
          queryTS(options2[i], function(err3, res3){
            count += 1
            touchpoint_temp = touchpoint_temp + res3.queries[0].sample_size
            if (count === journeyFriends.length){
              res.json({'touchPoints': touchpoint_temp})
            }
          })
        }
      }
      else{
        res.json("Please check the request format")
      }
    });
  }
    // var options = {
    //   "metric": senderids,
    //   "start_rel": '10_Y',//10 years make sure select all the points 
    // }; 
    
    // queryTS(options, function(err, res2){
    //   var result = res2;//the result from the KairosDB and the data is of format of KairosDB
    //   // console.log("%j", result);
    //   if (typeof result !== 'undefined' && result){
    //     // console.log(result);
    //     res.json({'touchPoints': result.queries[0].sample_size})
    //     //transfer the format of KairosDB query to Heatmap JSON format
    //   }
    //   else{
    //     res.json("Please check the request format")
    //   }
    // });
  
  // // res.json(options)
  // queryTS(options, function(err, res2){
  //   var result = res2;//the result from the KairosDB and the data is of format of KairosDB
  //   console.log(result);
  //   if (typeof result !== 'undefined' && result){
  //     console.log(result);
  //     res.json({'touchPoints': result.queries[0].sample_size})
  //     //transfer the format of KairosDB query to Heatmap JSON format
  //   }
  //   else{
  //     res.json("Please check the request format")
  //   }
  // });
}


//one to one touchpoint type pie chart API
app.post('/api/loops/users/pieChart/', pieChart)
function pieChart(req, res, next) {
  var data_json_pie = req.body 
  var senderids = data_json_pie.senderid
  var receiverids = data_json_pie.receiverid
  var start_rels = data_json_pie.start_rel
  const typelist = ['email', 'chat', 'inperson', 'socialmedia', 'phone']
  const typeDisplay = ['E-mail', 'Chat', 'In-Person', 'Social Media', 'Phone']
  var optionList = []
  var optionOppList = []
  var pie = [] //crete the final json format
  if (!senderids || !receiverids || !start_rels){
    res.json("Please make sure senderid and receiverid are non-empty")
  }
  else{
    typelist.forEach(function(e){
      var options = {
        "metric": senderids,
        "start_rel": start_rels,
        "tags": {
          "receiver": receiverids,
          "datatype": e
        },
      }; 
      optionList.push(options)
      var optionsOpp = {
        "metric": receiverids,
        "start_rel": start_rels,
        "tags": {
          "receiver": senderids,
          "datatype": e
        },
      };
      optionOppList.push(optionsOpp)
    })
    typeDisplay.forEach(function(e){
      var ele = {
        "label": e,
        "value": -1
      }
      pie.push(ele)
    })
    console.log('pie inner 1 %j', optionList)
    var count = 0
    for (let i = 0; i < optionList.length; i++){
      queryTS(optionList[i], function(err, res2){
        if (typeof res2 !== 'undefined' && res2){
          console.log('pie inner 1 %j', res2)
          count += 1
          pie[i].value = res2.queries[0].sample_size
          if (count == optionList.length){
            console.log('pie now 1 %j', pie)
            var count2 = 0
            for(let j = 0; j < optionOppList.length; j++){
              queryTS(optionOppList[j], function(err3, res3){
                console.log('pie inner 2 %j', res3)
                count2 += 1
                pie[j].value = (pie[j].value + res3.queries[0].sample_size).toString()
                if (count2 === optionOppList.length){
                  console.log('pie now 2 %j', pie)
                  res.json({"data": pie})
                }
              })
            }
          }
        }
        else{
          res.json("Please check the request format")
        }
      })
    }
  }
}


//response rate API
app.post('/api/loops/users/responseRate/', getResponseRate)
function getResponseRate(req, res, next) {
  
  var data_json_heat = req.body 
  var senderids = data_json_heat.senderid
  var journeyFriends = data_json_heat.journeyFriends
  var options = {
    "metric": senderids,
    "start_rel": '10_Y',//10 years make sure select all the points
    "tags": {
      "receiver": journeyFriends//contact list in a journey
    },
  }; 
  console.log('response rate request: %j', data_json_heat)
  if (!senderids || !journeyFriends || journeyFriends.length === 0){
    res.json("Please make sure senderid and journeyFriends are non-empty")
  }
  else{
    queryTS(options, function(err, res2){
      var result = res2;//the result from the KairosDB and the data is of format of KairosDB
      // console.log(JSON.stringify(result));
      
      if (typeof result !== 'undefined' && result){
        // console.log(result);
        // get the receiver list first
        var totalTouchpoints = result.queries[0].sample_size
        if (result.queries[0].results[0].values.length !== 0){
          var receriverList = result.queries[0].results[0].tags.receiver
          // console.log(result)
          // calculate and add the all response from receivers to the sender
          var totalResponse = 0
          var options2 = []
          receriverList.forEach(function(item){
            var opt = {
              "metric": item,
              "start_rel": '10_Y',//10 years make sure select all the points
              "tags": {
                "receiver": [senderids]
              },
            }; 
            options2.push(opt)
          })
          // res.json(options2)
          var count = 0
          for(let k = 0; k < receriverList.length; k++){
            queryTS(options2[k], function(err2, res3){
              // console.log(res3.queries[0].sample_size)
              count += 1
              if (typeof res3 !== 'undefined' && res3){
                totalResponse = totalResponse + res3.queries[0].sample_size
                if(count === receriverList.length){
                  var responseRate = 0
                  if (totalTouchpoints !== 0){
                    responseRate =  Math.round(100 * Math.min(totalResponse / totalTouchpoints, 1))
                  }
                  res.json({'responseRate': responseRate})
                }
              };
            });
          }
          
          // // calculate the total touchpoints
          // var totalTouchpoints = 0
          // var options = {
          //   "metric": senderids,
          //   "start_rel": '10_Y',//10 years make sure select all the points
          // };
          // queryTS(options, function(err3, res4){
          //   // var result = res2;//the result from the KairosDB and the data is of format of KairosDB
            
          //   if (typeof result !== 'undefined' && result){
          //     totalTouchpoints = res4.queries[0].sample_size
          //     if (totalTouchpoints === 0){
          //       responseRate = 0
          //     }
          //     else{
          //       var responseRate =  Math.round(100 * Math.min(totalResponse / totalTouchpoints, 1)).toString()
          //       res.json({'responseRate': responseRate})
          //     }
          //   }
          // });
        }
        else{
          //not send any messages yet, so response rate is 0
          res.json({'responseRate': 0})
        }
      }
      else{
        res.json("Please check the request format")
      }
    });
  }
}


//1-1 response rate API
app.post('/api/loops/users/oneOneResponseRate/', oneToOneResponseRate)
function oneToOneResponseRate(req, res, next) {
  var data_json_1on1ResRate = req.body 
  var senderids = data_json_1on1ResRate.senderid
  var monthsAgo = data_json_1on1ResRate.monthsAgo
  var receiverid = data_json_1on1ResRate.receiverid
  
  //add format check make sure ids are non-empty
  if(senderids && receiverid){
    //generate the monthly start end timestamps
    var tNow = new Date()
    var tNowStamp = Date.now()
    var tStart = tNow
    var tEndStamp = tNowStamp //as initialization for the current month

    const wholeMonth = [0,1,2,3,4,5,6,7,8,9,10,11]
    const MonthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    //get the current month
    var MonthlyOptions = []
    var MonthlyResponseOptions = []
    var monthlyResRate = []
    wholeMonth.forEach(function(i){
      tStart.setDate(1);
      tStart.setHours(0, 0, 0);
      tStart.setMilliseconds(0);
      var tStartStamp = tStart.getTime()
      // console.log(tStartStamp)
      var options = {
        "metric": senderids,
        "start_time": tStartStamp,
        "end_time": tEndStamp,
        "tags": {
          "receiver": [receiverid]
        }
      }; 
      var ResOptions = {
        "metric": receiverid,
        "start_time": tStartStamp,
        "end_time": tEndStamp,
        "tags": {
          "receiver": [senderids]
        }
      }; 
      MonthlyOptions.push(options)
      MonthlyResponseOptions.push(ResOptions)
      data = new Date(tStartStamp)
      monthlyResRate.push({
        "label": MonthName[data.getMonth()],
        "value": -1
      })
      tStart.setMonth(tStart.getMonth() - 1);
      tEndStamp = tStartStamp
    })

    // console.log(MonthlyOptions)
    // res.json(monthlyResRate)
    var count = 0;
    for(let i = 0; i < 12; i++){
      queryTS(MonthlyOptions[i], function(err2, res2){
        count += 1
        monthlyResRate[i].value = res2.queries[0].sample_size
        if (count === 12){
          var count2 = 0;
          for(let j = 0; j < 12; j++){
            queryTS(MonthlyResponseOptions[j], function(err3, res3){
              count2 += 1
              if (monthlyResRate[j].value !== 0){
                monthlyResRate[j].value =  Math.round(100 * Math.min(res3.queries[0].sample_size / monthlyResRate[j].value, 1)).toString()
              }
              monthlyResRate[j].value = monthlyResRate[j].value.toString()
              if (count2 === 12){
                // calculat the overall response rate
                var options2 = {
                  "metric": senderids,
                  "start_rel": '10_Y',//10 years make sure select all the points
                  "tags": {
                    "receiver": [receiverid]
                  }
                }; 
                var nSendTotal = 0
                var nReceiveTotal = 0
                var resRateTotal = 0
                queryTS(options2, function(err4, res4){
                  nSendTotal = res4.queries[0].sample_size
                  var options3 = {
                    "metric": receiverid,
                    "start_rel": '10_Y',//10 years make sure select all the points
                    "tags": {
                      "receiver": [senderids]
                    }
                  };  
                  queryTS(options3, function(err5, res5){
                    nReceiveTotal = res5.queries[0].sample_size
                    if (nSendTotal !== 0){
                      resRateTotal =  Math.round(100 * Math.min(nReceiveTotal / nSendTotal, 1)).toString()
                    }
                    res.json({
                      "monthly": monthlyResRate.slice(0,monthsAgo),
                      "overall": resRateTotal.toString()
                    })
                  })
                })
              }
            })
          }
        }
      })
    }
  }
  else{
    res.json('Please specify senderid and receiverid.')
  }
}


//1-1 monthly touchpoints API
app.post('/api/loops/users/oneOneMonthlyTouchPoints/', oneOneMonTouchPoint)
function oneOneMonTouchPoint(req, res, next) {
  var data_json_1on1ResRate = req.body 
  var senderids = data_json_1on1ResRate.senderid
  var monthsAgo = data_json_1on1ResRate.monthsAgo
  var receiverid = data_json_1on1ResRate.receiverid
  
  //add format check make sure ids are non-empty
  if(senderids && receiverid){
    //generate the monthly start end timestamps
    var tNow = new Date()
    var tNowStamp = Date.now()
    var tStart = tNow
    var tEndStamp = tNowStamp //as initialization for the current month
    

    const wholeMonth = [0,1,2,3,4,5,6,7,8,9,10,11]
    const MonthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    //get the current month
    var MonthlyOptions = []
    var MonthlyResponseOptions = []
    var monthlyTouchPoints = []
    wholeMonth.forEach(function(i){
      tStart.setDate(1);
      tStart.setHours(0, 0, 0);
      tStart.setMilliseconds(0);
      var tStartStamp = tStart.getTime()
      // console.log(tStartStamp)
      var options = {
        "metric": senderids,
        "start_time": tStartStamp,
        "end_time": tEndStamp,
        "tags": {
          "receiver": [receiverid]
        }
      }; 
      var ResOptions = {
        "metric": receiverid,
        "start_time": tStartStamp,
        "end_time": tEndStamp,
        "tags": {
          "receiver": [senderids]
        }
      }; 
      MonthlyOptions.push(options)
      MonthlyResponseOptions.push(ResOptions)
      data = new Date(tStartStamp)
      monthlyTouchPoints.push({
        "label": MonthName[data.getMonth()],
        "value": -1
      })
      tStart.setMonth(tStart.getMonth() - 1);
      tEndStamp = tStartStamp
    })

    console.log("monthly options %j", MonthlyOptions)
    // res.json(monthlyResRate)
    var count = 0;
    for(let i = 0; i < 12; i++){
      queryTS(MonthlyOptions[i], function(err2, res2){
        count += 1
        monthlyTouchPoints[i].value = res2.queries[0].sample_size
        if (count === 12){
          var count2 = 0;
          for(let j = 0; j < 12; j++){
            queryTS(MonthlyResponseOptions[j], function(err3, res3){
              count2 += 1
              monthlyTouchPoints[j].value =  (monthlyTouchPoints[j].value + res3.queries[0].sample_size).toString()
              if(count2 === 12){
                res.json({
                  "monthly": monthlyTouchPoints.slice(0,monthsAgo)
                })
              }
            })
          }
        }
      })
    }
  }
  else{
    res.json('Please specify senderid and receiverid.')
  }
}

//generate name + email profiles for LinkedIn contacts
// notice that use uid and messages.csv to generate the user selfname and uuid profile
app.post('/api/loops/users/linkedInContacts', (req, res) =>{
  var userid = req.body.uid
  // linkedIn contacts
  var linkedInContacts = []
  const contactPath = './uploaded_files/' + userid + 'Contacts.csv'
  fs.access(contactPath, fs.F_OK, (err) => {
    if (err) {
      console.error(err)
      res.json("contacts haven't been uploaded");
      return
    }
    //file exists
    fs.createReadStream(contactPath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.Emails !== '' && row.FirstName !== '') {
        var ele = {};
        // ele.userid = uuid.v4();
        ele.name = row.FirstName + ' ' + row.LastName;
        ele.email = row.Emails;
        linkedInContacts.push(ele);
      }
    })
    .on('end', () => {
      // store the messages to KairosDB
      console.log('csv file has been parsed successfully');
      res.json(linkedInContacts);
    })
  })
});

//contact list test
app.post('/api/loops/users/linkedInContactsTest', (req, res) =>{
  var userid = req.body.uid
  // linkedIn contacts
  var linkedInContacts = []
  var contactDict = {}
  const contactPath = './uploaded_files/Contacts1.csv'
  const msgPath = './uploaded_files/messages.csv'
  const connectPath = './uploaded_files/Connections.csv'
  //deal with connection csv
  fs.access(connectPath, fs.F_OK, (err) => {
    if (err) {
      console.error(err)
      res.json("connections haven't been uploaded");
      return
    }
    //file exists
    fs.createReadStream(connectPath)
    .pipe(csv())
    .on('data', (row) => {
      if(row["First Name"] !== '' || row["Last Name"] !== ''){
        contactDict[row["First Name"] + ' ' + row["Last Name"]] = row["Email Address"]
      }
    })
    .on('end', () => {
      console.log('connection csv file has been parsed successfully');
      // deal with message csv
      fs.access(msgPath, fs.F_OK, (err) => {
        if (err) {
          console.error(err)
          res.json("messages haven't been uploaded");
          return
        }
        //file exists
        fs.createReadStream(msgPath)
        .pipe(csv())
        .on('data', (row2) => {
          if(row2.FROM !== '' || row2.TO !== ''){
            contactDict[row2.FROM] = '';
            contactDict[row2.TO] = '';
          }
        })
        .on('end', () => {
          console.log('messages csv file has been parsed successfully');
          // deal with contacts csv
          fs.access(contactPath, fs.F_OK, (err) => {
            if (err) {
              console.error(err)
              res.json("contacts haven't been uploaded");
              return
            }
            //file exists
            fs.createReadStream(contactPath)
            .pipe(csv())
            .on('data', (row3) => {
              if(row3["FirstName"] !== '' && row3["LastName"] !== ''){
                contactDict[row3["FirstName"] + ' ' + row3["LastName"]] = row3["Emails"];
              }
            })
            .on('end', () => {
              console.log('all csv files has been parsed successfully');
              // rearragne the contactDict to linkedInContacts
              Object.keys(contactDict).forEach(function(key) {
                var ele = {};
                // ele.userid = uuid.v4();
                ele.name = key;
                ele.email = contactDict[key];
                linkedInContacts.push(ele);
              })
              res.json(linkedInContacts);
            })
          })
        })
      })
    })
  })
});

//connection contacts generation and anlysis
app.post('/api/loops/users/linkedInConnections', (req, res) =>{
  var userid = req.body.uid
  // linkedIn contacts
  var linkedInContacts = []
  var contactDict = {}
  const contactPath = './uploaded_files/Contacts1.csv'
  const msgPath = './uploaded_files/messages.csv'
  const connectPath = './uploaded_files/Connections.csv'
  //deal with connection csv
  fs.access(connectPath, fs.F_OK, (err) => {
    if (err) {
      console.error(err)
      res.json("connections haven't been uploaded");
      return
    }
    //file exists
    fs.createReadStream(connectPath)
    .pipe(csv())
    .on('data', (row) => {
      if(row["First Name"] !== '' || row["Last Name"] !== ''){
        contactDict[row["First Name"] + ' ' + row["Last Name"]] = row["Email Address"]
      }
    })
    .on('end', () => {
      console.log('connection csv file has been parsed successfully');
      // deal with message csv
      fs.access(msgPath, fs.F_OK, (err) => {
        if (err) {
          console.error(err)
          res.json("messages haven't been uploaded");
          return
        }
        //file exists
        fs.createReadStream(msgPath)
        .pipe(csv())
        .on('data', (row2) => {
          if(row2.FROM !== '' || row2.TO !== ''){
            contactDict[row2.FROM] = '';
            contactDict[row2.TO] = '';
          }
        })
        .on('end', () => {
          console.log('messages csv file has been parsed successfully');
          // deal with contacts csv
          fs.access(contactPath, fs.F_OK, (err) => {
            if (err) {
              console.error(err)
              res.json("contacts haven't been uploaded");
              return
            }
            //file exists
            fs.createReadStream(contactPath)
            .pipe(csv())
            .on('data', (row3) => {
              if(row3["FirstName"] !== '' && row3["LastName"] !== ''){
                contactDict[row3["FirstName"] + ' ' + row3["LastName"]] = row3["Emails"];
              }
            })
            .on('end', () => {
              console.log('all csv files has been parsed successfully');
              // rearragne the contactDict to linkedInContacts
              Object.keys(contactDict).forEach(function(key) {
                var ele = {};
                // ele.userid = uuid.v4();
                ele.name = key;
                ele.email = contactDict[key];
                linkedInContacts.push(ele);
              })
              res.json(linkedInContacts);
            })
          })
        })
      })
    })
  })
});

// Store the LinkedIn messages to KairosDB 
app.post('/api/loops/users/linkedInMessages', (req, res) =>{
  var userid = req.body.uid
  // a uuid and firstname + lastname list that will be uploaded to KairosDB
  // const uidNameList= {
  //   'Zhaoqian (Zoey) Ren': "aaaabbbbcccc",
  //   'Yinxuan(Ian) Ma': "ddddeeeeffff"
  // }
  const nameUidPath = './uploaded_files/nameIdDictionary.json'
  fs.access(nameUidPath, fs.F_OK, (err) => {
    if (err) {
      console.error(err)
      res.json("LinkedIn connection.csv hasn't been uploaded");
      return
    }
    //file exists
    fs.readFile(nameUidPath, 'utf8', (err, jsonString) => {
      if (err) {
          console.log("Error reading file from disk:", err)
          return
      }
      try {
        const nameUidDict = JSON.parse(jsonString)
        const msgPath = './uploaded_files/messages.csv'
        // change by the line below when uploading is available
        // const msgPath = './uploaded_files/' + userid + 'messages.csv'
        var dataObject = []
        fs.access(msgPath, fs.F_OK, (err) => {
          if (err) {
            console.error(err)
            res.json("LinkedIn messages haven't been uploaded");
            return
          }
          //file exists
          fs.createReadStream(msgPath)
          .pipe(csv())
          .on('data', (row) => {
            if ((row.FROM in nameUidDict) && (!(row.TO in nameUidDict))) {
              // var dataObject = []
              var ele = {};
              ele.name = nameUidDict[row.FROM];
              ele.datapoints = [[Date.parse(row.DATE), 1]];
              ele.tags = {
                "receiver": userid,//the uuid of the user
                "datatype": "socialmedia"
              }
              dataObject.push(ele)
              var ele ={}
              ele.name = userid;
              ele.datapoints = [[Date.parse(row.DATE), 1]]
              ele.tags = {
                "sender": nameUidDict[row.FROM],
                "datatype": "socialmedia"
              }
              dataObject.push(ele)
              // console.log(row)

              // addTS(dataObject, function(err2, res2){
              //   result = res2;//the result from the KairosDB and the data is of format of KairosDB
              // });
            }
            else if((!(row.FROM in nameUidDict)) && (row.TO in nameUidDict)){
              // var dataObject = []
              var ele = {};
              ele.name = userid;
              ele.datapoints = [[Date.parse(row.DATE), 1]];
              ele.tags = {
                "receiver": nameUidDict[row.TO],//the uuid of the user
                "datatype": "socialmedia"
              }
              dataObject.push(ele)
              var ele ={}
              ele.name = nameUidDict[row.TO];
              ele.datapoints = [[Date.parse(row.DATE), 1]]
              ele.tags = {
                "sender": userid,
                "datatype": "socialmedia"
              }
              dataObject.push(ele)
              // console.log(row)

              // addTS(dataObject, function(err2, res2){
              //   result = res2;//the result from the KairosDB and the data is of format of KairosDB
              // });
            }
            else{
              console.log('from: ', row.FROM)
              console.log('to: ', row.TO)
            }
          })
          .on('end', () => {
            console.log('csv file has been parsed successfully');
            // console.log(nameUidDict)
            res.json(dataObject)
            // res.json('csv file has been parsed successfully');
          })
        })
      } 
      catch(err) {
          console.log('Error parsing JSON string:', err)
      }
    })
  })
});

// Test how to store the contact file to server, with the following format
// const uidNameList= {
//   'Zhaoqian (Zoey) Ren': "aaaabbbbcccc",
//   'Yinxuan(Ian) Ma': "ddddeeeeffff"
// }
app.get('/api/loops/users/linkedInConnectionTest', function(req, res) {
  // if (Object.keys(req.files).length == 0) {
  //   return res.status(400).send('No files were uploaded.');
  // }
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  // console.log('testest4: ', req.body)
  var userid = 'xxxxxxxxxxxx'
  // let contactFile = req.files.file;
  var linkedInConnections = []
  var nameUidDict = {}
  // Use the mv() method to place the file somewhere on your server
  // contactFile.mv('./uploaded_files/' + userid + 'Connections.csv', function(err) {
  // if (err)
  //   return res.status(500).send(err);
  const connectPath = './uploaded_files/Connections.csv'
  //deal with connection csv
  fs.access(connectPath, fs.F_OK, (err) => {
    if (err) {
      console.error(err)
      res.json("connections haven't been uploaded");
      return
    }
    //file exists
    fs.createReadStream(connectPath)
    .pipe(csv())
    .on('data', (row) => {
      if(row["First Name"] !== '' || row["Last Name"] !== ''){
        var temp = {};
        temp.uid = row["First Name"].replace(/\s/g, '') + row["Last Name"].replace(/\s/g, '') + (Date.parse(row["Connected On"])).toString()
        temp.name = row["First Name"].replace(/\s/g, '') + ' ' + row["Last Name"].replace(/\s/g, '');
        temp.email = row["Email Address"];
        temp.company = row["Company"];
        temp.position = row["Position"];
        linkedInConnections.push(temp);
        //create a dictionary to store for the other API used
        nameUidDict[temp.name] = temp.uid
        // store them to KairosDB
        var dataObject = []
        var ele = {};
        ele.name = userid;
        ele.datapoints = [[Date.parse(row["Connected On"]), 1]];
        ele.tags = {
          "receiver": temp.uid,//the uuid of the user
          "datatype": "socialmedia"
        }
        dataObject.push(ele)
        var ele ={}
        ele.name = temp.uid;
        ele.datapoints = [[Date.parse(row["Connected On"]), 1]]
        ele.tags = {
          "sender": userid,
          "datatype": "socialmedia"
        }
        dataObject.push(ele)
        // addTS(dataObject, function(err2, res2){
        //   result = res2;//the result from the KairosDB and the data is of format of KairosDB
        // });
        console.log('TEMP: ', ele)
        console.log('DATAOBJECT: ', dataObject)
      }
    })
    .on('end', () => {
      fs.writeFile('./uploaded_files/nameIdDictionary.json', JSON.stringify(nameUidDict), err => {
        if (err) {
            console.log('Error writing file', err)
        } else {
            console.log('Successfully wrote file')
        }
      })
      res.send(nameUidDict)
      console.log('connection csv file has been parsed successfully');
    })
  });
});

// Uploading connection files API
app.post('/api/loops/users/linkedInConnectionFilesUpload', function(req, res) {
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
  }
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  // console.log('testest4: ', req.body)
  var userid = req.body.uid
  let contactFile = req.files.file;
  var linkedInConnections = []
  var nameUidDict = {} //create a dictionary to store for the other API used
  // Use the mv() method to place the file somewhere on your server
  contactFile.mv('./uploaded_files/' + userid + 'Connections.csv', function(err) {
    if (err)
      return res.status(500).send(err);
    const connectPath = './uploaded_files/' + userid + 'Connections.csv'
    //deal with connection csv
    fs.access(connectPath, fs.F_OK, (err) => {
      if (err) {
        console.error(err)
        res.json("connections haven't been uploaded");
        return
      }
      //file exists
      fs.createReadStream(connectPath)
      .pipe(csv())
      .on('data', (row) => {
        if(row["First Name"] !== '' || row["Last Name"] !== ''){
          var temp = {};
          temp.uid = row["First Name"].replace(/\s/g, '') + row["Last Name"].replace(/\s/g, '') + (Date.parse(row["Connected On"])).toString()
          temp.name = row["First Name"].replace(/\s/g, '') + ' ' + row["Last Name"].replace(/\s/g, '');
          temp.email = row["Email Address"];
          temp.company = row["Company"];
          temp.position = row["Position"];
          linkedInConnections.push(temp);
          //create a dictionary to store for the other API used
          nameUidDict[temp.name] = temp.uid
          // store them to KairosDB
          var dataObject = []
          var ele = {};
          ele.name = userid;
          ele.datapoints = [[Date.parse(row["Connected On"]), 1]];
          ele.tags = {
            "receiver": temp.uid,//the uuid of the user
            "datatype": "socialmedia"
          }
          dataObject.push(ele)
          var ele ={}
          ele.name = temp.uid;
          ele.datapoints = [[Date.parse(row["Connected On"]), 1]]
          ele.tags = {
            "sender": userid,
            "datatype": "socialmedia"
          }
          dataObject.push(ele)
          addTS(dataObject, function(err2, res2){
            result = res2;//the result from the KairosDB and the data is of format of KairosDB
          });
          console.log('TEMP: ', ele)
          console.log('DATAOBJECT: ', dataObject)
        }
      })
      .on('end', () => {
        fs.writeFile('./uploaded_files/' + userid + 'nameIdDictionary.csv', JSON.stringify(nameUidDict), err => {
          if (err) {
              console.log('Error writing file', err)
          } else {
              console.log('Successfully wrote file')
          }
        })
        res.send(linkedInConnections)
        console.log('connection csv file has been parsed successfully');
      })
    })
  });
});

// Uploading contacts files API
app.post('/api/loops/users/linkedInFilesUpload', function(req, res) {
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
  }
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  // console.log('testest4: ', req.body)
  var userid = req.body.uid
  let contactFile = req.files.file;
  // Use the mv() method to place the file somewhere on your server
  contactFile.mv('./uploaded_files/' + userid + 'Contacts.csv', function(err) {
    if (err)
      return res.status(500).send(err);
    res.send('File uploaded!');
  });
});


app.get('/', (req, res) => {
    res.send('Loop makes your professional network better')
});


app.get('/api/loops/users/oneyear', (req, res) =>{
    res.json(oneYearData)
});

app.get('/api/loops/users/logs', (req, res) => {
  console.log('Inside User Logs Function');
  var redisKey = 'log:s:' + req.query.senderids + ':r:' + req.query.receiverids;
  redisClient.zrevrange(redisKey, 0, 4, function(err, data) {
    if(err) {
      res.status(500).send(err);
    } else {
      for(var i in data) {
        data[i] = JSON.parse(data[i]);
      }
      res.send({ entities: data });
    }
  });
})

function startServer() {
  const PORT = process.env.PORT || 3000
  // http://localhost:3000
  app.listen(PORT, () =>{
      console.log("Loop server is listening on: " + PORT)
  });
}
