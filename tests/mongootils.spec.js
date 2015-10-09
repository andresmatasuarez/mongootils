'use strict';

var url        = require('url');
var expect     = require('chai').expect;
var mongoose   = require('mongoose');
var Mongootils = require('../index');

var fullUri      = 'mongodb://localhost/mongootils_test';
var DEFAULT_PORT = 27017;

var uri = {
  full : fullUri,
  host : url.parse(fullUri).hostname,
  port : url.parse(fullUri).port || DEFAULT_PORT,
  name : url.parse(fullUri).pathname.replace('/', '')
};

var finish = function(done){
  return function(){
    done();
  };
};

var ensureNoConnections = function(done){

  if (!mongoose.connections){
    done();
  }

  var closedConnections = 0;

  function iAmDone(){
    return closedConnections === mongoose.connections.length;
  }

  mongoose.connections.forEach(function(connection){
    if (connection.readyState === mongoose.Connection.STATES.disconnected ||
        connection.readyState === mongoose.Connection.STATES.uninitialized){
      closedConnections += 1;
      if (iAmDone()){
        return done();
      }
    } else {
      connection.close(function(){
        closedConnections += 1;
        if (iAmDone()){
          return done();
        }
      });
    }

  });

};

describe('Module: mongootils', function(){

  var connection;

  before(ensureNoConnections);

  afterEach(ensureNoConnections);

  it('should connect to database', function(done){
    var db = new Mongootils(uri.full);
    db.connect()
    .then(function(connection){
      expect(connection.host)       .to.equal(uri.host);
      expect(connection.port)       .to.equal(uri.port);
      expect(connection.name)       .to.equal(uri.name);
      expect(connection.readyState) .to.equal(mongoose.Connection.STATES.connected);
    })
    .then(finish(done))
    .catch(done);
  });

  it('should disconnect from an already opened connection', function(done){
    mongoose.connect(uri.full);
    mongoose.connection.once('open', function(){
      var db = new Mongootils(mongoose.connection);
      db.disconnect()
      .then(function(){
        expect(mongoose.connection.readyState).to.equal(mongoose.Connection.STATES.disconnected);
      })
      .then(finish(done))
      .catch(done);
    });
  });

  it('should not connect to an already opened connection', function(done){
    var db = new Mongootils(uri.full);
    var firstConnection, secondConnection;
    db.connect()
    .then(function(connection){
      firstConnection = connection;
      return db.connect();
    })
    .then(function(connection){
      expect(connection).to.equal(firstConnection);
      expect(connection.readyState).to.equal(mongoose.Connection.STATES.connected);
      secondConnection = connection;
      return new Mongootils(connection).connect();
    })
    .then(function(connection){
      expect(connection).to.equal(secondConnection);
      expect(connection.readyState).to.equal(mongoose.Connection.STATES.connected);
    })
    .then(finish(done))
    .catch(done);
  });

  it('should not try to disconnect from an uninitialized connection', function(done){
    var db = new Mongootils(uri.full);
    db.disconnect()
    .then(function(){
      expect(mongoose.connection.readyState).to.equal(mongoose.Connection.STATES.disconnected);
    })
    .then(finish(done))
    .catch(done);
  });

  it('should not try to disconnect from an already closed connection', function(done){
    mongoose.connect(uri.full);
    mongoose.connection.once('open', function(){
      var db = new Mongootils(mongoose.connection);
      mongoose.connection.close(function(){
        db.disconnect()
        .then(function(){
          expect(mongoose.connection.readyState).to.equal(mongoose.Connection.STATES.disconnected);
        })
        .then(finish(done))
        .catch(done);
      });
    });
  });

});
