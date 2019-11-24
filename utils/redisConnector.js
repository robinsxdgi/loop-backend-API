var Q = require('q');
var redis = require('redis');

function Connector(config, type) {
  this.config = config;
  this.redisClient = null;
  var self = this;
  var host = self.config.host;
  var port = self.config.port;
  var password = self.config.password;
  this.getRedis = function () {
    var deferred = Q.defer();
    self.redisClient = redis.createClient(port, host);
    self.redisClient.auth(password, function (err) {
      if (err) {
        console.log(err);
      }
    });
    // REDIS Events
    self.redisClient.on('connect', function () {
      console.log('Redis connect event for ' + type);
      return deferred.resolve(self.redisClient);
    });
    self.redisClient.on('disconnected', function (err) {
      console.log(err);
      deferred.reject(err);
    });
    self.redisClient.on('error', function (err) {
      console.log(err);
      return deferred.reject(err);
    });
    self.redisClient.on('end', function (err) {
      console.log(err, 'Redis end event ' + type);
    });
    return deferred.promise;
  };
}
module.exports = function (config, syslog, stats, type) {
  return new Connector(config, syslog, stats, type);
};
