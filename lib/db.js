/**
 * db.js
 * 
 * Legacy db setup,
 * updated to remove mongodb-uri package and simplify logic
 * 
 * <info@milnomada.io>
 */
const MongoClient = require('mongodb').MongoClient;

let db;
let collections = [
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
    db = dbClient;

    // legacy setup collections
    for (var i in collections) {
        db[collections[i]] = dbClient.collection(collections[i]);
    }
}

const initDb = (url, callback) => { // eslint-disable-line
    if(db){
        console.warn('Trying to init DB again!');
        return callback(null, db);
    }
    MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
        connected(err, client);
        callback(null, db);
    })
}

module.exports = {
    initDb
}
