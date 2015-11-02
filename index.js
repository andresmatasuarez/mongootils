/**
 * @module  mongootils
 * @desc    Promisified (with Bluebird) connection handler for Mongoose connections.
 * @see     {@link https://gist.github.com/andresmatasuarez/343d5ff39bb1a208a046| GitHub gist}
 * @author  Andrés Mata Suárez <amatasuarez@gmail>
 * @license {@link http://www.opensource.org/licenses/mit-license.php| MIT License}
 *
 * @requires {@link https://github.com/visionmedia/debug|debug}
 * @requires {@link https://github.com/petkaantonov/bluebird|bluebird}
 * @requires {@link https://github.com/mongolab/mongodb-uri-node|mongodb-uri}
 * @requires {@link http://mongoosejs.com/|mongoose} (as peerDependency)
 *
 * @example
 * var Mongootils = require('mongootils');
 *
 * var db = new Mongootils('mongodb://localhost/database');
 * db.connect()
 * .then(function(connection){
 *   console.log('Connected to ' + db.getConnectionURI());
 *   return db.disconnect();
 * })
 * .then(function(uri){
 *   console.log('Disconnected from ' + uri);
 * });
 *
 * @example
 * var Mongootils = require('mongootils');
 * var app = require('express')();
 *
 * var db = new Mongootils('mongodb://localhost/database');
 * db.connect()
 * .then(function(connection){
 *   console.log('Connected to ' + db.getConnectionURI());
 *   app.set('db', db);
 * });
 *
 * // In another place...
 * app.get('/users', function(req, res){
 *   var db = req.app.get('db');
 *   var User = db.model('User');
 *   // ...
 * })
 *
 */

'use strict';

var DEBUG_CONNECTING            = 'Connecting to %s...';
var DEBUG_ALREADY_CONNECTED     = 'Already connected to %s.';
var DEBUG_ALREADY_CONNECTING    = 'Already connecting to %s.';
var DEBUG_CONNECTED             = 'Successfully connected to %s.';
var DEBUG_CONNECTION_ERROR      = 'An error has occured while connecting to %s.';
var DEBUG_DISCONNECTING         = 'Disconnecting from %s...';
var DEBUG_ALREADY_DISCONNECTED  = 'Already disconnected from %s.';
var DEBUG_ALREADY_DISCONNECTING = 'Already disconnecting from %s.';
var DEBUG_DISCONNECTED          = 'Successfully disconnected from %s.';
var DEBUG_DISCONNECTION_ERROR   = 'An error has occured while disconnecting from %s.';

var BB         = require('bluebird');
var mongoose   = require('mongoose');
var debug      = require('debug');
var mongodburi = require('mongodb-uri');

var d = debug('mongootils');

/**
 * @constructor
 *
 * @param {string} uri     - Mongoose connection URI.
 * @param {object} options - Mongoose connection options.
 * @see http://mongoosejs.com/docs/connections.html
 *
 */
function Mongootils(){
  if (arguments[0] && arguments[0].constructor && arguments[0].constructor.name === 'NativeConnection'){
    this.connection = arguments[0];
    this.uri        = this.getConnectionURI();
    this.options    = this.connection.options;
  } else {
    this.uri     = arguments[0];
    this.options = arguments[1];
  }

}

Mongootils.prototype.getConnectionURI = function(){
  if (!this.connection){
    return;
  }

  var uriObject = {
    username : this.connection.user,
    password : this.connection.pass,
    database : this.connection.name
  };

  if (!this.connection.hosts){
    uriObject.hosts = [{
      host: this.connection.host,
      port: this.connection.port
    }];
  } else {
    uriObject.hosts = this.connection.hosts;
  }

  var uri = mongodburi.format(uriObject);

  return mongodburi.formatMongoose(uri);

};

Mongootils.prototype.getConnection = function(){
  return this.connection;
};

Mongootils.prototype.is = function(state){
  switch (state){
    case 'disconnected':
    case 'uninitialized':
      return !this.connection || this.connection.readyState === mongoose.Connection.STATES[state];
    default:
      return this.connection && this.connection.readyState === mongoose.Connection.STATES[state];
  }
};

/**
 * Adds connection listeners without adding more than one for each event.
 */
Mongootils.prototype.addConnectionListener = function(ev, cb){
  var listeners = this.connection._events;
  if (!listeners || !listeners[ev] || listeners[ev].length === 0){
    if (ev === 'error'){
      this.connection.on(ev, cb.bind(this));
    } else {
      this.connection.once(ev, cb.bind(this));
    }
  }
};

Mongootils.prototype.removeListeners = function(ev, cb){
  if (!this.connection){
    return;
  }

  var listeners = this.connection._events;

  if (!listeners || !listeners[ev]){
    return;
  }

  listeners = listeners[ev];

  if (Array.isArray(listeners)){
    listeners.forEach(function(l){
      this.connection.removeListener(ev, cb);
    });
  } else {
    this.connection.removeListener(ev, cb);
  }

}

/**
 * Returns a promise that gets resolved when successfully connected to MongoDB URI, or rejected otherwise.
 */
Mongootils.prototype.connect = function(){
  return new BB(function(resolve, reject){

    function onConnectionError(err){ d(DEBUG_CONNECTION_ERROR, this.uri); return reject(err); };
    function onConnectionOpened(){ d(DEBUG_CONNECTED, this.uri); return resolve(this.connection); };

    function cleanup(){
      this.removeListeners('error', onConnectionError);
      this.removeListeners('open', onConnectionOpened);
      this.removeListeners('close', cleanup);
    };

    if (this.is('connected')){
      d(DEBUG_ALREADY_CONNECTED, this.uri);
      return resolve(this.connection);
    }

    if (this.is('connecting')){
      d(DEBUG_ALREADY_CONNECTING, this.uri);
    } else {
      d(DEBUG_CONNECTING, this.uri);

      // If there is only one connection in connections array then it is the default one
      // and must be handled differently. If it is disconnected (readyState = 0), then connect to it
      // using 'mongoose.connect'. Otherwise, create a new connection with 'mongoose.createConnection'.
      if (mongoose.connections.length === 1 && mongoose.connections[0].readyState === 0){
        mongoose.connect(this.uri, this.options);
        this.connection = mongoose.connections[0];
      } else {
        this.connection = mongoose.createConnection(this.uri, this.options);
      }

      this.addConnectionListener('error', onConnectionError);
      this.addConnectionListener('open', onConnectionOpened);
      this.addConnectionListener('close', cleanup);
    }

  }.bind(this));
};

/**
 * Returns a promise that gets resolved when successfully disconnected from MongoDB URI, or rejected otherwise.
 */
Mongootils.prototype.disconnect = function(){
  return new BB(function(resolve, reject){

    function onDisconnectionError(err){ d(DEBUG_DISCONNECTION_ERROR, this.uri); return reject(err); };
    function onConnectionClosed(){ d(DEBUG_DISCONNECTED, this.uri); };

    function cleanup(){
      this.removeListeners('error', onDisconnectionError);
      this.removeListeners('disconnected', onConnectionClosed);
      this.removeListeners('close', cleanup);
    };

    if (this.is('disconnected') || this.is('uninitialized')){
      d(DEBUG_ALREADY_DISCONNECTED, this.uri);
      this.connection = undefined;
      return resolve(this.uri);
    }

    if (this.is('disconnecting')){
      d(DEBUG_ALREADY_DISCONNECTING, this.uri);
    } else {
      d(DEBUG_DISCONNECTING, this.uri);

      this.addConnectionListener('error', onDisconnectionError);
      this.addConnectionListener('disconnected', onConnectionClosed);
      this.addConnectionListener('close', cleanup);

      this.connection.close(function(){
        cleanup.bind(this)();
        this.connection = undefined;
        return resolve(this.uri);
      }.bind(this));
    }

  }.bind(this));
};

module.exports = Mongootils;
