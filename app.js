const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');

const _ = require('lodash');
const MongoStore = require('connect-mongodb-session')(session);
const helmet = require('helmet');
const colors = require('colors');
const cron = require('node-cron');
const crypto = require('crypto');
const common = require('./lib/common');
const { runIndexing } = require('./lib/indexing');
const { addSchemas } = require('./lib/schema');
const { initDb } = require('./lib/db');
const hbs = require('express-handlebars');
const i18n = require('i18n');
const app = express();

// Validate our settings schema
const Ajv = require('ajv');
const ajv = new Ajv({ useDefaults: true });

// Validate config
const config = common.getConfig();
const baseConfig = ajv.validate(require('./config/baseSchema'), config);
if(baseConfig === false){
    console.log(colors.red(`settings.json incorrect: ${ajv.errorsText()}`));
    process.exit(2);
}

// Validate the payment gateway config
switch(config.paymentGateway){
    case'paypal':
        if(ajv.validate(require('./config/paypalSchema'), require('./config/paypal.json')) === false){
            console.log(colors.red(`PayPal config is incorrect: ${ajv.errorsText()}`));
            process.exit(2);
        }
        break;

    case'stripe':
        if(ajv.validate(require('./config/stripeSchema'), require('./config/stripe.json')) === false){
            console.log(colors.red(`Stripe config is incorrect: ${ajv.errorsText()}`));
            process.exit(2);
        }
        break;

    case'authorizenet':
        if(ajv.validate(require('./config/authorizenetSchema'), require('./config/authorizenet.json')) === false){
            console.log(colors.red(`Authorizenet config is incorrect: ${ajv.errorsText()}`));
            process.exit(2);
        }
        break;

    case'adyen':
        if(ajv.validate(require('./config/adyenSchema'), require('./config/adyen.json')) === false){
            console.log(colors.red(`adyen config is incorrect: ${ajv.errorsText()}`));
            process.exit(2);
        }
        break;
}

// index routes
const index = require('./routes/index');
const cart = require('./routes/cart');
const customer = require('./routes/customer');
const lamp = require('./routes/api/lamp');
// admin
const admin = require('./routes/admin/admin');
const product = require('./routes/admin/product');
const adminCustomer = require('./routes/admin/customer');
const order = require('./routes/admin/order');
const rebuild = require('./routes/admin/rebuild');
const user = require('./routes/admin/user');
// payments
const paypal = require('./routes/payments/paypal');
const stripe = require('./routes/payments/stripe');
const authorizenet = require('./routes/payments/authorizenet');
const adyen = require('./routes/payments/adyen');

// Language initialize
i18n.configure({
    locales: config.availableLanguages,
    defaultLocale: config.defaultLocale,
    cookie: 'locale',
    queryParameter: 'lang',
    directory: `${__dirname}/locales`,
    directoryPermissions: '755',
    api: {
        __: '__', // now req.__ becomes req.__
        __n: '__n' // and req.__n can be called as req.__n
    }
});

const handlebars = require('./lib/handlebars')(i18n, config);

// view engine setup
app.set('views', path.join(__dirname, '/views'));
app.engine('hbs', hbs({
    extname: 'hbs',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    defaultLayout: 'layout.hbs',
    partialsDir: [path.join(__dirname, 'views')]
}));
app.set('view engine', 'hbs');


// session store
const store = new MongoStore({
    uri: config.dbUri,
    collection: 'sessions'
});

// Setup secrets
if(!config.secretCookie || config.secretCookie === ''){
    const randomString = crypto.randomBytes(20).toString('hex');
    config.secretCookie = randomString;
    common.updateConfigLocal({ secretCookie: randomString });
}
if(!config.secretSession || config.secretSession === ''){
    const randomString = crypto.randomBytes(20).toString('hex');
    config.secretSession = randomString;
    common.updateConfigLocal({ secretSession: randomString });
}

/**
 * This setting tells express is behind a proxy
 * - X-Forwarded-Proto may be set by the reverse proxy
 * - req.ip and req.ips values will be populated with X-Forwarded-For's list of addresses
 * https://stackoverflow.com/questions/23413401/what-does-trust-proxy-actually-do-in-express-js-and-do-i-need-to-use-it
 */
app.enable('trust proxy');
/**
 * Helmet
 * Helmet secures the connections to prevent among others CSS-Attacks, ClickHijacking,
 * Http-Header-Poisoning attacks and so on
 * https://www.geeksforgeeks.org/node-js-securing-apps-with-helmet-js/
 */
app.use(helmet());

app.set('port', process.env.PORT || 1111);

/**
 * Morgan
 * logger is a morgan instance. Morgan is and advanced login tool for Express
 * https://www.npmjs.com/package/morgan
 */
app.use(logger('dev'));


/**
 * bodyParser
 * parse url encoded forms
 */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({
    // Only on Stripe URL's which need the rawBody
    verify: (req, res, buf) => {
        if(req.originalUrl === '/stripe/subscription_update'){
            req.rawBody = buf.toString();
        }
    }
}));

app.use(cookieParser(config.secretCookie));

/**
 * Session
 * Cookie handled Session. 
 * Makes use of the mongodb to store session data.
 */
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: config.secretSession,
    cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 900000
    },
    store: store
}));

/**
 * Locales
 * Set Session Locale
 */
app.use(i18n.init);

// serving static content
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views', 'themes')));

/**
 * Request enrichment
 * 
 * - Append handlebars to request,
 * - Set Cache-Control headers
 */
app.use((req, res, next) => {
    req.handlebars = handlebars;
    res.setHeader('Cache-Control', 'no-cache, no-store');
    next();
});


// setup the routes
app.use('/', index);
app.use('/', cart);
app.use('/', customer);
app.use('/', adminCustomer);
app.use('/', product);
app.use('/', order);
app.use('/', rebuild);
app.use('/', user);
app.use('/', admin);
app.use('/paypal', paypal);
app.use('/stripe', stripe);
app.use('/authorizenet', authorizenet);
app.use('/adyen', adyen);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if(app.get('env') === 'development'){
    app.use((err, req, res, next) => {
        console.error(colors.red(err.stack));
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err,
            helpers: handlebars.helpers
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
    console.error(colors.red(err.stack));
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {},
        helpers: handlebars.helpers
    });
});

// Nodejs version check
const nodeVersionMajor = parseInt(process.version.split('.')[0].replace('v', ''));
if(nodeVersionMajor < 7){
    console.log(colors.red(`Please use Node.js version 7.x or above. Current version: ${nodeVersionMajor}`));
    process.exit(2);
}

app.on('uncaughtException', (err) => {
    console.error(colors.red(err.stack));
    process.exit(2);
});

initDb(config.dbUri, async (err, db) => {
    // On connection error we display then exit
    if(err){
        console.log(colors.red('Error connecting to MongoDB: ' + err));
        process.exit(2);
    }

    // add db to app for routes
    app.db = db;
    app.config = config;
    app.port = app.get('port');

    // Fire up the cron job to clear temp held stock
    cron.schedule('*/1 * * * *', async () => {
        const validSessions = await db.sessions.find({}).toArray();
        const validSessionIds = [];
        _.forEach(validSessions, (value) => {
            validSessionIds.push(value._id);
        });

        // Remove any invalid cart holds
        await db.cart.deleteMany({
            sessionId: { $nin: validSessionIds }
        });
    });

    // Set trackStock for testing
    if(process.env.NODE_ENV === 'test'){
        config.trackStock = true;
    }

    // Process schemas
    await addSchemas();

    // We index when not in test env
    if(process.env.NODE_ENV !== 'test'){
        try {
            await runIndexing(app);
        } catch(ex) {
            console.error(colors.red('Error setting up indexes:' + err));
        }
    }

    // Start the app
    try {
        await app.listen(app.get('port'));
        app.emit('appStarted');
        if(process.env.NODE_ENV !== 'test') {
            console.log(colors.green('expressCart running on host: http://localhost:' + app.get('port')));
        }
    } catch(ex) {
        console.error(colors.red('Error starting expressCart app:' + err));
        process.exit(2);
    }
});

module.exports = app;
