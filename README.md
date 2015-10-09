# mongootils
Promisified connection utils for Mongoose

## Requirements
`mongootils` requires [Mongoose](http://mongoosejs.com/) as a peer dependency, so make sure you have it installed in your project.

## Installation
`npm i --save mongootils`

## Usage
```javascript
var Mongootils = require('mongootils');

var db = new Mongootils('mongodb://localhost/database');
db.connect()
.then(function(connection){
  console.log('Connected to ' + db.getConnectionURI());
  return db.disconnect();
})
.then(function(uri){
  console.log('Disconnected from ' + uri);
});
```

### Using ExpressJS
```javascript
var Mongootils = require('mongootils');
var app = require('express')();

var db = new Mongootils('mongodb://localhost/database');
db.connect()
.then(function(connection){
  console.log('Connected to ' + db.getConnectionURI());
  app.set('db', db);
});

// In another place...
app.get('/api/users', function(req, res){
  var db = req.app.get('db');
  var User = db.model('User');
  // ...
});
```

## API
### new Mongootils(NativeConnection connection)
```javascript
var db = new Mongootils(mongoose.connections[3]);
```

### new Mongootils(uri, options)
The same arguments as `mongoose.connect` or `mongoose.createConnection`).
```javascript
var db = new Mongootils('mongodb://localhost/mongootils_test', { /* mongoose options object */ });
```

### db.connect()
Returns a Bluebird promise that is resolved when the connection has been effectively opened, or rejected otherwise.

### db.disconnect()
Returns a Bluebird promise that is resolved when the connection has been effectively closed, or rejected otherwise.

### db.is()
Checks for the underlying connection [state](http://mongoosejs.com/docs/api.html#connection_Connection-readyState).
```javascript
if (db.is('connecting') || db.is('connecting')) {
  // Listen to Thin Lizzy
} else {
  // ... or listen to Thin Lizzy
}
```

### db.getConnection()
Retrieves the underlying `NativeConnection` object.

### db.getConnectionURI()
Returns the `mongoose`-valid connection URI for the underlying connection.
```javascript
  var db = new Mongootils('mongodb://localhost:27000,127.0.0.1:27001/my_db');
  console.log(db.getConnectionURI()); // prints 'mongodb://localhost:27000/my_db,mongodb://127.0.0.1:27001/my_db'
```
