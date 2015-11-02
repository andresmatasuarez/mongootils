'use strict';

const mongoose = require('mongoose');
const Mongootils = require('./index');

const db1 = new Mongootils('localhost');
const db2 = new Mongootils('127.0.0.1');
const db3 = new Mongootils('dev.flowics.com');

console.log(mongoose.connections.length);
db1.connect().then(function(db){ console.log(1, mongoose.connections.length, db); });
db2.connect().then(function(db){ console.log(2, mongoose.connections.length, db); });
db3.connect().then(function(db){ console.log(3, mongoose.connections.length, db); });

setInterval(function(){
  console.log(5, mongoose.connections.length);
}, 5000);
