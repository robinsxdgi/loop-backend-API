const superagent = require('superagent');

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

        superagent.post('http://3.89.40.83:8082/api/v1/datapoints/query')
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
        superagent.post('http://3.89.40.83:8082/api/v1/datapoints')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(options)
        .end(function(err) {
          if (err) { callback(err); }
          else { callback(null); }
        });
    }
}

module.exports = {
    queryTS: queryTS,
    addTS: addTS
};
