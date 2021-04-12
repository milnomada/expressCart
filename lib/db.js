const MongoClient = require('mongodb').MongoClient;

let _db;
let _collections = [
    'users',
    'products',
    'orders',
    'pages',
    'menu',
    'customers',
    'rebuilds',
    'cart',
    'sessions'
]

const connected = (err, client) => {
    let dbClient, dbName;

    if(err){
        return callback(err);
    }

    dbName = (process.env.NODE_ENV === 'test') ? 'testingdb' : client.s.options.dbName
    dbClient = client.db(dbName);
    _db = dbClient;

    // setup collections
    // legacy
    for (var i in _collections) {
        _db[_collections[i]] = dbClient.collection(_collections[i]);
    }
}

function initDb(dbUrl, callback){ // eslint-disable-line
    if(_db){
        console.warn('Trying to init DB again!');
        return callback(null, _db);
    }
    MongoClient.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
        connected(err, client);
        return callback(null, _db);
    });
}

module.exports = {
    initDb
};
