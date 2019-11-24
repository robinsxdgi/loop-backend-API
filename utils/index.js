var redisConnector = require('./redisConnector');
var kairosDB = require('./tsdb');

module.exports = {
  redisConnector: redisConnector,
  tsdb: kairosDB
};
