/**
 * commom.js
 * 
 * Legacy set of utility methods
 * (disaster Box design flaw)
 * 
 * <info@milnomada.io>
 */
const _ = require('lodash');
const uglifycss = require('uglifycss');
const colors = require('colors');

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const mustache = require('mustache');
const async = require('async');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');
const escape = require('html-entities').AllHtmlEntities;
const mkdirp = require('mkdirp');
const ObjectId = require('mongodb').ObjectID;

// Allowed mime types for product images
const allowedMimeType = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp'
];

const fileSizeLimit = 10485760;

// common functions
const cleanHtml = (html) => {
    return sanitizeHtml(html);
};

const mongoSanitize = (param) => {
    if(param instanceof Object){
        for(const key in param){
            if(/^\$/.test(key)){
                delete param[key];
            }
        }
    }
    return param;
};

const safeParseInt = (param) => {
    if(param){
        try{
            return parseInt(param);
        }catch(ex){
            return param;
        }
    }else{
        return param;
    }
};

const checkboxBool = (param) => {
    if(param && param === 'on'){
        return true;
    }
    return false;
};

const convertBool = (value) => {
    if(value === 'true' || value === true){
        return true;
    }
    return false;
};

const showCartCloseBtn = (page) => {
    let showCartCloseButton = true;
    if(page === 'checkout' || page === 'pay'){
        showCartCloseButton = false;
    }

    return showCartCloseButton;
};

// adds products to sitemap.xml
const addSitemapProducts = (req, res, cb) => {
    const db = req.app.db;

    const config = getConfig();
    const hostname = config.baseUrl;

    db.products.find({ productPublished: true }).toArray((err, products) => {
        const posts = [];
        if(err){
            cb(null, posts);
        }
        async.eachSeries(products, (item, callback) => {
            const post = {};
            let url = item._id;
            if(item.productPermalink){
                url = item.productPermalink;
            }
            post.url = hostname + '/' + url;
            post.changefreq = 'weekly';
            post.priority = 0.7;
            posts.push(post);
            callback(null, posts);
        }, () => {
            cb(null, posts);
        });
    });
};

const clearSessionValue = (session, sessionVar) => {
    let temp;
    if(session){
        temp = session[sessionVar];
        session[sessionVar] = null;
    }
    return temp;
};

const updateTotalCartAmount = (req, res) => {
    const config = getConfig();

    req.session.totalCartAmount = 0;

    _(req.session.cart).forEach((item) => {
        if(item.productDiscount && item.productDiscount > 0)
          req.session.totalCartAmount = req.session.totalCartAmount + (item.totalItemPrice - (item.totalItemPrice / item.productDiscount));
        else
          req.session.totalCartAmount = req.session.totalCartAmount + item.totalItemPrice;
    });

    // under the free shipping threshold
    if(req.session.totalCartAmount < config.freeShippingAmount){
        req.session.totalCartAmount = req.session.totalCartAmount + parseInt(config.flatShipping);
        req.session.shippingCostApplied = true;
    }else{
        req.session.shippingCostApplied = false;
    }
};

const updateSubscriptionCheck = (req, res) => {
    // If cart is empty
    if(!req.session.cart || req.session.cart.length === 0){
        req.session.cartSubscription = null;
        return;
    }

    req.session.cart.forEach((item) => {
        if(item.productSubscription){
            req.session.cartSubscription = item.productSubscription;
        }else{
            req.session.cartSubscription = null;
        }
    });
};

const checkDirectorySync = (directory) => {
    try{
        fs.statSync(directory);
    }catch(e){
        try{
            fs.mkdirSync(directory);
        }catch(err){
           mkdirp.sync(directory);// error : directory & sub directories to be newly created
        }
    }
};

const getThemes = () => {
    return fs.readdirSync(path.join(__dirname, '../', 'views', 'themes')).filter(file => fs.statSync(path.join(path.join(__dirname, '../', 'views', 'themes'), file)).isDirectory());
};

const getImages = async (id, req, res, callback) => {
    const db = req.app.db;

    const product = await db.products.findOne({ _id: getId(id) });
    if(!product){
        return[];
    }

    // loop files in /public/uploads/
    const files = await glob.sync(`public/uploads/${product._id.toString()}/**`, { nosort: true });

    // sort array
    files.sort();

    // declare the array of objects
    const fileList = [];

    // loop these files
    for(let i = 0; i < files.length; i++){
        // only want files
        if(fs.lstatSync(files[i]).isDirectory() === false){
            // declare the file object and set its values
            const file = {
                id: i,
                path: files[i].substring(6)
            };
            if(product.productImage === files[i].substring(6)){
                file.productImage = true;
            }
            // push the file object into the array
            fileList.push(file);
        }
    }
    return fileList;
};

const getConfig = () => {
    let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'settings.json'), 'utf8'));
    const localConfigFilePath = path.join(__dirname, '../config', 'settings-local.json');

    // Check for local config file and merge with base settings
    if(fs.existsSync(localConfigFilePath)){
        const localConfigFile = JSON.parse(fs.readFileSync(localConfigFilePath, 'utf8'));
        config = Object.assign(config, localConfigFile);
    }

    config.customCss = typeof config.customCss !== 'undefined' ? escape.decode(config.customCss) : null;
    config.footerHtml = typeof config.footerHtml !== 'undefined' ? escape.decode(config.footerHtml) : null;
    config.googleAnalytics = typeof config.googleAnalytics !== 'undefined' ? escape.decode(config.googleAnalytics) : null;

    // set the environment for files
    config.env = '.min';
    if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined){
        config.env = '';
    }

    // setup theme
    config.themeViews = '';
    if(typeof config.theme === 'undefined' || config.theme === ''){
        config.theme = 'Cloth'; // Default to Cloth theme
    }

    config.themeViews = '../views/themes/' + config.theme + '/';

    // if db set to mongodb override connection with MONGODB_CONNECTION_STRING env var
    config.dbUri = process.env.MONGODB_CONNECTION_STRING || config.dbUri;

    return config;
};

const getPaymentConfig = () => {
    const siteConfig = getConfig();
    const gateConfigFile = path.join(__dirname, '../config', `${siteConfig.paymentGateway}.json`);

    let config = [];
    if(fs.existsSync(gateConfigFile)){
        config = JSON.parse(fs.readFileSync(gateConfigFile, 'utf8'));
    }

    // If a local config we combine the objects. Local configs are .gitignored
    const localConfig = path.join(__dirname, '../config', `${siteConfig.paymentGateway}-local.json`);
    if(fs.existsSync(localConfig)){
        const localConfigObj = JSON.parse(fs.readFileSync(localConfig, 'utf8'));
        config = Object.assign(config, localConfigObj);
    }

    return config;
};

const updateConfig = (fields) => {
    const settingsFile = getConfig();

    _.forEach(fields, (value, key) => {
        settingsFile[key] = value;
        if(key === 'customCss_input'){
            settingsFile.customCss = escape.encode(uglifycss.processString(value));
        }
        if(key === 'footerHtml_input'){
            const footerHtml = typeof value !== 'undefined' || value === '' ? escape.encode(value) : '';
            settingsFile.footerHtml = footerHtml;
        }
        if(key === 'googleAnalytics_input'){
            const googleAnalytics = typeof value !== 'undefined' ? escape.encode(value) : '';
            settingsFile.googleAnalytics = googleAnalytics;
        }
    });

    // delete settings
    delete settingsFile.customCss_input;
    delete settingsFile.footerHtml_input;
    delete settingsFile.googleAnalytics_input;

    if(fields.emailSecure === 'on'){
        settingsFile.emailSecure = true;
    }else{
        settingsFile.emailSecure = false;
    }

    if(!fields.menuEnabled){
        settingsFile.menuEnabled = false;
    }else{
        settingsFile.menuEnabled = true;
    }

    if(fields.emailPort){
        settingsFile.emailPort = parseInt(fields.emailPort);
    }

    if(fields.flatShipping){
        settingsFile.flatShipping = parseInt(fields.flatShipping);
    }

    if(fields.freeShippingAmount){
        settingsFile.freeShippingAmount = parseInt(fields.freeShippingAmount);
    }

    if(fields.productsPerRow){
        settingsFile.productsPerRow = parseInt(fields.productsPerRow);
    }

    if(fields.productsPerPage){
        settingsFile.productsPerPage = parseInt(fields.productsPerPage);
    }

    // If we have a local settings file (not git tracked) we loop its settings and save
    // and changes made to them. All other settings get updated to the base settings file.
    const localSettingsFile = path.join(__dirname, '../config', 'settings-local.json');
    if(fs.existsSync(localSettingsFile)){
        const localSettings = JSON.parse(fs.readFileSync(localSettingsFile));
        _.forEach(localSettings, (value, key) => {
            if(fields[key]){
                localSettings[key] = fields[key];

                // Exists in local so remove from main settings file
                delete settingsFile[key];
            }
        });
        // Save our local settings
        try{
            fs.writeFileSync(localSettingsFile, JSON.stringify(localSettings, null, 4));
        }catch(exception){
            console.log('Failed to save local settings file', exception);
        }
    }

    // write base settings file
    const baseSettingsFile = path.join(__dirname, '../config', 'settings.json');
    try{
        fs.writeFileSync(baseSettingsFile, JSON.stringify(settingsFile, null, 4));
        return true;
    }catch(exception){
        return false;
    }
};

const updateConfigLocal = (field) => {
    const localSettingsFile = path.join(__dirname, '../config', 'settings-local.json');
    try{
        let localSettings = {};
        if(fs.existsSync(localSettingsFile)){
            localSettings = JSON.parse(fs.readFileSync(localSettingsFile));
        }
        Object.assign(localSettings, field);
        fs.writeFileSync(localSettingsFile, JSON.stringify(localSettings, null, 4));
    }catch(exception){
        console.log('Failed to save local settings file', exception);
    }
};

const getMenu = (db) => {
    return db.menu.findOne({});
};

// creates a new menu item
const newMenu = (req, res) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // if no menu present
        if(!menu){
            menu = {};
            menu.items = [];
        }
        const newNav = {
            title: req.body.navMenu,
            link: req.body.navLink,
            order: Object.keys(menu.items).length + 1
        };

        menu.items.push(newNav);
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch((err) => {
        console.log('Error creating new menu', err);
        return false;
    });
};

// delete a menu item
const deleteMenu = (req, res, menuIndex) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // Remove menu item
        menu.items.splice(menuIndex, 1);
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

// updates and existing menu item
const updateMenu = (req, res) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // find menu item and update it
        const menuIndex = _.findIndex(menu.items, ['title', req.body.navId]);
        menu.items[menuIndex].title = req.body.navMenu;
        menu.items[menuIndex].link = req.body.navLink;
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};


const sortMenu = (menu) => {
    if(menu && menu.items){
        menu.items = _.sortBy(menu.items, 'order');
        return menu;
    }
    return{};
};

// orders the menu
const orderMenu = (req, res) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // update the order
        for(let i = 0; i < req.body.navId.length; i++){
            _.find(menu.items, ['title', req.body.navId[i]]).order = i;
        }
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

/**
 * Render email for payment confirmation
 * @param  {Object} data        [description]
 * @param  {Array} articles     [description]
 * @return {String}             [description]
 */
const renderPaymentEmail = (data, articles) => {
  const template = fs.readFileSync(path.join(__dirname, 'templates/article.html'), 'utf8');
  const layout = fs.readFileSync(path.join(__dirname, 'templates/articles.html'), 'utf8');

  // buggy buggy
  console.log(articles)

  const articlesHtml = articles.map(e => {
    var price;
    if(e.price)
      return mustache.render(template, {title: e.title, price: e.price, description: e.description, image: e.productImage, slug: e.productPermalink})
    else {
      if(e.productDiscount > 0) {
        price = e.totalItemPrice - ((e.totalItemPrice * e.productDiscount) / 100)
      } else
        price = e.totalItemPrice
      return mustache.render(template, {title: e.title, price: price, description: "", image: e.productImage, slug: e.link})
    }
  })
  var dt = new Date();

  var emailData = {
    host: "http://localhost:1111",
    appName: "Kala",
    content: articlesHtml,
    showConfirmation: false,
    tags: [],
    details: data.paymentDetails,
    message: data.message,
    year: dt.getFullYear()
  }

  if(data.greeting) {
    emailData.showGreeting = true
    emailData.greetingTitle = data.greeting.title          // "Thanks for buying a Kala lamp. We hope you find joyful the light from your new Kala.",
    emailData.greetingMessage = data.greeting.message      // "We hope you find joyful the light from your new Kala.",
  }

  return mustache.render(layout, emailData)
}

/**
 * Get template for emails
 * @param  {string} name  Template filename without extension
 * @param  {object} data  Email details
 * @return {string}       The rendered html template
 */
const getRebuildTemplate = (name, data) => {
    var config = getConfig(),
      layout = fs.readFileSync(path.join(__dirname, 'templates/' + name + '.html'), 'utf8'),
      itemTemplate = fs.readFileSync(path.join(__dirname, 'templates/article.html'), 'utf8'),
      articlesHtml = "",
      host = "http://localhost:1111"
      ;

    if(!layout)
      return null

    // generate products html
    data.items.map(e => { 
      articlesHtml += mustache.to_html(
        itemTemplate, 
        { host: host, 
          title: e.productTitle, 
          price: e.productPrice, 
          description: e.productDescription, 
          image: e.productImage, 
          slug: e.productPermalink
        })
    })
    var options = {year: "numeric", month: "short", day: "numeric"}, dt = new Date(), emailData;
    
    emailData = {
      host: host,
      appName: "Kala",
      content: articlesHtml,
      tags: [],
      details: data.productOptions,
      message: data.message,
      showConfirmation: true,
      hash: data.hash,
      year: dt.getFullYear(),
      week_date: new Intl.DateTimeFormat('en-US', options).format(dt),
      list_description: "You are receiving this email beacuse you requested a piece rebuid."
    }

    return mustache.to_html(layout, emailData)
};


const sendEmail = (to, subject, body) => {
    const config = getConfig();

    const emailSettings = {
        host: config.emailHost,
        port: config.emailPort,
        secure: config.emailSecure,
        auth: {
            user: config.emailUser,
            pass: config.emailPassword
        }
    };

    // outlook needs this setting
    if(config.emailHost === 'smtp-mail.outlook.com'){
        emailSettings.tls = { ciphers: 'SSLv3' };
    }

    const transporter = nodemailer.createTransport(emailSettings);

    const mailOptions = {
        from: config.emailAddress, // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        html: body// html body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if(error){
            return console.error(colors.red(error));
        }
        return true;
    });
};

// gets the correct type of index ID
const getId = (id) => {
    if(id){
        if(id.length !== 24){
            return id;
        }
    }
    return ObjectId(id);
};

const newId = () => {
    return new ObjectId();
};

const getData = (req, page, query, limit) => {
    const db = req.app.db;
    const config = getConfig();
    const numberProducts = limit ? limit : config.productsPerPage;
    let skip = 0;
    if(page > 1){
        skip = (page - 1) * numberProducts;
    }
    if(!query){
        query = {};
    }
    query.productPublished = { $ne: false };
    return Promise.all([
        db.products.find(query).skip(skip).limit(parseInt(numberProducts)).toArray(),
        db.products.countDocuments(query)
    ])
    .then((result) => {
        return { data: result[0], totalProducts: result[1] };
    })
    .catch((err) => {
        throw new Error('Error retrieving products');
    });
};

const hooker = (order) => {
    const config = getConfig();

    return axios.post(config.orderHook, order, { responseType: 'application/json' })
    .then((response) => {
        if(response.status === 200){
            console.info('Successfully called order hook');
        }
    })
    .catch((err) => {
        console.log('Error calling hook:', err);
    });
};

const emptyCart = async (req, res, type) => {
    const db = req.app.db;

    // Remove from session
    delete req.session.cart;
    delete req.session.orderId;

    // Remove cart from DB
    await db.cart.deleteOne({ sessionId: req.session.id });

    // update total cart amount
    updateTotalCartAmount(req, res);

    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);

    if(type === 'silent'){
        return;
    }

    // If POST, return JSON else redirect nome
    if(type === 'json'){
        res.status(200).json({ message: 'Cart successfully emptied', totalCartItems: 0 });
        return;
    }

    req.session.message = 'Cart successfully emptied.';
    req.session.messageType = 'success';
    res.redirect('/');
};

module.exports = {
    allowedMimeType,
    fileSizeLimit,
    cleanHtml,
    mongoSanitize,
    safeParseInt,
    checkboxBool,
    convertBool,
    showCartCloseBtn,
    addSitemapProducts,
    clearSessionValue,
    updateTotalCartAmount,
    updateSubscriptionCheck,
    checkDirectorySync,
    getThemes,
    getImages,
    getConfig,
    getPaymentConfig,
    updateConfig,
    updateConfigLocal,
    getMenu,
    newMenu,
    deleteMenu,
    updateMenu,
    sortMenu,
    orderMenu,
    getRebuildTemplate,
    renderPaymentEmail,
    sendEmail,
    getId,
    newId,
    getData,
    hooker,
    emptyCart
};
