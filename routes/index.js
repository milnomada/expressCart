const express = require('express');
const router = express.Router();
const colors = require('colors');
const { checkLogin } = require('../lib/auth');
const { validateJson } = require('../lib/schema');
const async = require('async');
const crypto = require('crypto')
const _ = require('lodash');
const {
  getId,
  hooker,
  showCartCloseBtn,
  sendEmail,
  clearSessionValue,
  sortMenu,
  getMenu,
  getPaymentConfig,
  getImages,
  getRebuildTemplate,
  updateTotalCartAmount,
  updateSubscriptionCheck,
  getData,
  addSitemapProducts,
  emptyCart
} = require('../lib/common');

const { enrichProduct, productToSession, fetchProducts, fetchProduct, publicConfig } = require('../lib/product');


router.get('/cart/empty', async (req, res, next) => {
  emptyCart(req, res, req.headers["Content-Type"] === "application/json" ? "json" : "");
});


router.get('/cart/partial', (req, res) => {
  const config = req.app.config;

  res.render(`${config.themeViews}cart`, {
    pageCloseBtn: showCartCloseBtn(req.query.path),
    page: req.query.path,
    layout: false,
    helpers: req.handlebars.helpers,
    config: req.app.config,
    session: req.session
  });
});

// Add item to cart
router.post('/cart/product', async (req, res, next) => {
  const db = req.app.db;
  const config = req.app.config;
  let productQuantity = req.body.productQuantity ? parseInt(req.body.productQuantity) : 1;
  const productComment = req.body.productComment ? req.body.productComment : null;

  // Don't allow negative quantity
  if (productQuantity < 0) {
    productQuantity = 1;
  }

  // setup cart object if it doesn't exist
  if (!req.session.cart) {
    req.session.cart = [];
  }

  // Get the product from the DB
  const product = await db.products.findOne({ _id: getId(req.body.productId) });
  // No product found
  if (!product) {
    return res.status(400).json({ message: 'Error updating cart. Please try again.' });
  }

  // If cart already has a subscription you cannot add anything else
  if (req.session.cartSubscription) {
    return res.status(400).json({ message: 'Subscription already existing in cart. You cannot add more.' });
  }

  // If existing cart isn't empty check if product is a subscription
  if (req.session.cart.length !== 0) {
    if (product.productSubscription) {
      return res.status(400).json({ message: 'You cannot combine scubscription products with existing in your cart. Empty your cart and try again.' });
    }
  }

  // If stock management on check there is sufficient stock for this product
  if (config.trackStock && product.productStock) {
    const stockHeld = await db.cart.aggregate(
      {
        $match: {
          cart: { $elemMatch: { productId: product._id.toString() } }
        }
      },
      { $unwind: '$cart' },
      {
        $group: {
          _id: '$cart.productId',
          sumHeld: { $sum: '$cart.quantity' }
        }
      },
      {
        $project: {
          sumHeld: 1
        }
      }
    ).toArray();

    // If there is stock
    if (stockHeld.length > 0) {
      const totalHeld = _.find(stockHeld, { _id: product._id.toString() }).sumHeld;
      const netStock = product.productStock - totalHeld;

      // Check there is sufficient stock
      if (productQuantity > netStock) {
        return res.status(400).json({ message: 'There is insufficient stock of this product.' });
      }
    }
  }

  var productPrice = parseFloat(product.productPrice).toFixed(2);

  // Doc used to test if existing in the cart with the options. If not found, we add new.
  let options = {};
  if (req.body.productOptions) {
    try {
      if (typeof req.body.productOptions === 'object') {
        options = req.body.productOptions;
      } else {
        options = JSON.parse(req.body.productOptions);
      }
    } catch (ex) { }
  }
  const findDoc = {
    productId: req.body.productId,
    options: options
  };

  // if exists we add to the existing value
  const cartIndex = _.findIndex(req.session.cart, findDoc);
  let cartQuantity = 0;
  if (cartIndex > -1) {
    cartQuantity = parseInt(req.session.cart[cartIndex].quantity) + productQuantity;
    req.session.cart[cartIndex].quantity = cartQuantity;
    req.session.cart[cartIndex].totalItemPrice = productPrice * parseInt(req.session.cart[cartIndex].quantity);
  } else {
    // Doesnt exist so we add to the cart session
    req.session.cartTotalItems = req.session.cartTotalItems + productQuantity;

    // Set the card quantity
    cartQuantity = productQuantity;

    // new product details
    const productObj = {};
    productObj.productId = req.body.productId;
    productObj.title = product.productTitle;
    productObj.quantity = productQuantity;
    productObj.uniqueProduct = product.uniqueProduct;
    productObj.totalItemPrice = productPrice * productQuantity;
    productObj.options = options;
    productObj.productImage = product.productImage;
    productObj.productDiscount = product.productDiscount
    productObj.productComment = productComment;
    productObj.productSubscription = product.productSubscription;
    if (product.productPermalink) {
      productObj.link = product.productPermalink;
    } else {
      productObj.link = product._id;
    }

    // merge into the current cart
    req.session.cart.push(productObj);
  }

  // Update cart to the DB
  await db.cart.updateOne({ sessionId: req.session.id }, {
    $set: { cart: req.session.cart }
  }, { upsert: true });

  // update total cart amount
  updateTotalCartAmount(req, res);

  // Update checking cart for subscription
  updateSubscriptionCheck(req, res);

  if (product.productSubscription) {
    req.session.cartSubscription = product.productSubscription;
  }

  // update how many products in the shopping cart
  req.session.cartTotalItems = req.session.cart.reduce((a, b) => +a + +b.quantity, 0);
  return res.status(200).json({ message: 'Cart successfully updated', totalCartItems: req.session.cartTotalItems });
});

// Remove single product from cart
router.delete('/cart/product', async (req, res, next) => {
  const db = req.app.db;
  let itemRemoved = false;

  // remove item from cart
  req.session.cart.forEach((item) => {
    if (item) {
      if (item.productId === req.body.cartId) {
        itemRemoved = true;
        req.session.cart = _.pull(req.session.cart, item);
      }
    }
  });

  // Update cart in DB
  await db.cart.updateOne({ sessionId: req.session.id }, {
    $set: { cart: req.session.cart }
  });
  // update total cart amount
  updateTotalCartAmount(req, res);

  // Update checking cart for subscription
  updateSubscriptionCheck(req, res);

  if (itemRemoved === false) {
    return res.status(400).json({ message: 'Product not found in cart' });
  }
  return res.status(200).json({ message: 'Product successfully removed', totalCartItems: Object.keys(req.session.cart).length });
});

// Updates a single product quantity
router.post('/cart/update', (req, res, next) => {
  const db = req.app.db;
  const config = req.app.config;
  const cartItems = JSON.parse(req.body.items);
  let hasError = false;
  let stockError = false;

  async.eachSeries(cartItems, async (cartItem, callback) => {
    const productQuantity = cartItem.itemQuantity ? cartItem.itemQuantity : 1;
    if (cartItem.itemQuantity === 0) {
      // quantity equals zero so we remove the item
      req.session.cart.splice(cartItem.cartIndex, 1);
      callback(null);
    } else {
      const product = await db.products.findOne({ _id: getId(cartItem.productId) });
      if (product) {
        // If stock management on check there is sufficient stock for this product
        if (config.trackStock) {
          if (productQuantity > product.productStock) {
            hasError = true;
            stockError = true;
            callback(null);
            return;
          }
        }

        const productPrice = parseFloat(product.productPrice).toFixed(2);
        if (req.session.cart[cartItem.cartIndex]) {
          req.session.cart[cartItem.cartIndex].quantity = productQuantity;
          req.session.cart[cartItem.cartIndex].totalItemPrice = productPrice * productQuantity;
          callback(null);
        }
      } else {
        hasError = true;
        callback(null);
      }
    }
  }, async () => {
    // update total cart amount
    updateTotalCartAmount(req, res);
    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);
    // Update cart to the DB
    await db.cart.updateOne({ sessionId: req.session.id }, {
      $set: { cart: req.session.cart }
    });

    // show response
    if (hasError === false) {
      res.status(200).json({ message: 'Cart successfully updated', totalCartItems: Object.keys(req.session.cart).length });
    } else {
      if (stockError) {
        res.status(400).json({ message: 'There is insufficient stock of this product.', totalCartItems: Object.keys(req.session.cart).length });
      } else {
        res.status(400).json({ message: 'There was an error updating the cart', totalCartItems: Object.keys(req.session.cart).length });
      }
    }
  });
});


router.get('/checkout', async (req, res, next) => {
  const config = req.app.config;

  // if there is no items in the cart then render a failure
  if (!req.session.cart) {
    req.session.message = 'The are no items in your cart. Please add some items before checking out';
    req.session.messageType = 'danger';
    res.redirect('/');
    return;
  }

  // render the checkout
  res.render(`${config.themeViews}checkout`, {
    title: 'Checkout',
    // TODO: remove or filter config
    config: req.app.config,
    session: req.session,
    pageCloseBtn: showCartCloseBtn('checkout'),
    checkout: 'hidden',
    page: 'checkout',
    message: clearSessionValue(req.session, 'message'),
    messageType: clearSessionValue(req.session, 'messageType'),
    helpers: req.handlebars.helpers,
    showFooter: 'showFooter'
  });
});


router.get('/pay', async (req, res, next) => {
  const config = req.app.config;

  // if there is no items in the cart then render a failure
  if (!req.session.cart) {
    req.session.message = 'The are no items in your cart. Please add some items before checking out';
    req.session.messageType = 'danger';
    res.redirect('/checkout');
    return;
  }

  let paymentType = '';
  if (req.session.cartSubscription) {
    paymentType = '_subscription';
  }

  // render the payment page
  res.render(`${config.themeViews}pay`, {
    title: 'Pay',
    config: req.app.config,
    paymentConfig: getPaymentConfig(),
    pageCloseBtn: showCartCloseBtn('pay'),
    session: req.session,
    paymentPage: true,
    paymentType,
    page: 'pay',
    message: clearSessionValue(req.session, 'message'),
    messageType: clearSessionValue(req.session, 'messageType'),
    helpers: req.handlebars.helpers,
    showFooter: 'showFooter'
  });
});

// These is the customer facing routes
router.get('/payment/:orderId', async (req, res, next) => {
  const db = req.app.db;
  const config = req.app.config;

  // Get the order
  const order = await db.orders.findOne({ _id: getId(req.params.orderId) });
  if (!order) {
    res.render('error', { title: 'Not found', message: 'Order not found', helpers: req.handlebars.helpers, config });
    return;
  }

  // If stock management is turned on payment approved update stock level
  if (config.trackStock && req.session.paymentApproved) {
    order.orderProducts.forEach(async (product) => {
      const dbProduct = await db.products.findOne({ _id: getId(product.productId) });
      let newStockLevel = dbProduct.productStock - product.quantity;
      if (newStockLevel < 1) {
        newStockLevel = 0;
      }

      // Update product stock
      await db.products.updateOne({
        _id: getId(product.productId)
      }, {
        $set: {
          productStock: newStockLevel
        }
      }, { multi: false });
    });
  }

  // If hooks are configured, send hook
  if (config.orderHook) {
    await hooker(order);
  };

  res.render(`${config.themeViews}payment_complete`, {
    title: 'Payment complete',
    config: req.app.config,
    session: req.session,
    pageCloseBtn: showCartCloseBtn('payment'),
    result: order,
    message: clearSessionValue(req.session, 'message'),
    messageType: clearSessionValue(req.session, 'messageType'),
    helpers: req.handlebars.helpers,
    showFooter: 'showFooter',
    menu: sortMenu(await getMenu(db))
  });
});

// test
router.post('/product/sendme', (req, res, next) => {
  console.log(req.body)

  const db = req.app.db;

  db.products.findOne({ _id: getId(req.body.productId) }, function (err, data) {
    if (!data || err) {
      res.json({ status: 'error', message: 'Product not found' });
      return;
    }
    if (data.productPublished === false) {
      res.json({ status: 'error', message: 'Product not found' });
      return;
    }
    const emailHtml = getRebuildTemplate(
      "articles", {
      message: "You just ordered a rebuild of the following product",
      items: [data],
      hash: "hash-here"
    }
    )
    sendEmail(
      "milnomada@gmail.com",
      'Your payment with ' + req.app.config.cartTitle,
      emailHtml
    );
    res.status(200).json({})
  });
});

// show an individual product
router.get(['/product/:id'], async (req, res) => {
  const db = req.app.db;
  const config = req.app.config;

  const product = await db.products.findOne({ $or: [{ _id: getId(req.params.id) }, { productPermalink: req.params.id }] });
  if (!product) {
    res.render('error', { title: 'Not found', message: 'Order not found', helpers: req.handlebars.helpers, config });
    return;
  }
  if (product.productPublished === false) {
    res.render('error', { title: 'Not found', message: 'Product not found', helpers: req.handlebars.helpers, config });
    return;
  }
  const productOptions = product.productOptions;
  const totalProductCount = await db.products.count({ productPublished: true })

  // If JSON query param return json instead
  if (req.query.json === 'true') {
    res.status(200).json(product);
    return;
  }

  // show the view
  const images = await getImages(product._id, req, res);

  console.log(product)

  res.render(`${config.themeViews}product`, {
    title: product.productTitle,
    result: product,
    pageNum: product.productPermalink.slice(-1),
    productOptions: productOptions,
    images: images,
    productDescription: product.productDescription,
    metaDescription: config.cartTitle + ' - ' + product.productTitle,
    pageCloseBtn: showCartCloseBtn('product'),
    config: config,
    session: req.session,
    pageUrl: config.baseUrl + req.originalUrl,
    message: clearSessionValue(req.session, 'message'),
    messageType: clearSessionValue(req.session, 'messageType'),
    helpers: req.handlebars.helpers,
    showFooter: 'showFooter',
    totalProductCount: totalProductCount,
    menu: sortMenu(await getMenu(db))
  });
});

// Craft another like this feature
router.post('/product/rebuild', checkLogin, async (req, res, next) => {

  if (!req.apiAuthenticated) {
    res.status(401).json({ error: "Unauthorized" });
    return
  }

  var productId = req.body.productId,
    email = req.body.email,
    db = req.app.db,
    buffer = crypto.randomBytes(48)
    ;

  const doc = {
    productId: req.body.productId,
    customerEmail: email,
    units: 1,   // TODO: get this value from the rebuild form
    signature: buffer.toString('hex'),
    created: new Date(),
    status: 0
  };

  // Validate the body again schema
  const schemaResult = validateJson('newRebuild', doc);
  if (!schemaResult.valid)
    // If API request, return json
    res.status(400).json(schemaResult.errors);
  else {
    try {
      const saved = await db.rebuilds.insertOne(doc);
      const product = await db.products.findOne({ _id: getId(req.body.productId) })
      // get the new ID
      const newId = saved.insertedId;

      // Render email
      const emailHtml = getRebuildTemplate(
        "articles", {
        message: "You just ordered a rebuild of the following product",
        showConfirmation: true,
        items: [product],
        hash: doc.signature
      }
      )
      sendEmail(
        doc.customerEmail,
        'Your rebuild request from ' + req.app.config.cartTitle,
        emailHtml
      );

      res.status(201).json({ status: 'ok', message: 'email sent' });
      // Send email to admin (explain reprint) let's see

    } catch (e) {
      console.log(colors.red('Error inserting document: ' + e));
      res.status(400).json({ error: 'Error inserting document' });
    }
  }
});

// Craft another like this feature
router.get('/product/rebuild/:hash/:extra', async (req, res, next) => {

  var productId = req.body.productId,
    email = req.body.email,
    db = req.app.db,
    buffer = crypto.randomBytes(48)
    ;

  const doc = {
    signature: req.params.hash
  }

  // Set Status Confirmed
  const rebuild = await db.rebuilds.findOne(doc) // {$set: {status: 1}}, (err, rebuild) => {

  if (!rebuild) {
    console.log(colors.yellow("No rebuild found", err, rebuild))
    res.redirect('/');
    return
  }

  if (rebuild.status !== 0 && rebuild.status !== 1) {
    console.log(colors.yellow("Rebuild already processed", rebuild))

    req.session.message = 'Rebuild processed. Please request a new rebuild in the product page.';
    req.session.messageType = 'danger';

    res.redirect('/');
    return
  }

  // this is not mongoose!
  var product = await db.products.findOne({ _id: getId(rebuild.productId) })
  if (!product) {
    console.log(colors.yellow("No product found", err, rebuild, product, getId(rebuild.productId)))
    res.redirect('/');
    return
  }

  // confirm rebuild
  await db.rebuilds.updateOne({ signature: rebuild.signature }, { $set: { status: 1 } }, { upsert: true })

  // Reuse session product with rebuild details
  product = enrichProduct(product, rebuild);
  productToSession(req, product)
  updateTotalCartAmount(req, res);

  // update total products in the shopping cart
  req.session.cartTotalItems = req.session.cart.reduce((a, b) => +a + +b.quantity, 0);
  req.session.user = null

  // redirect to pay
  res.redirect('/pay');
});

// search products
router.get('/search/:searchTerm/:pageNum?', (req, res) => {
  const db = req.app.db;
  const searchTerm = req.params.searchTerm;
  const productsIndex = req.app.productsIndex;
  const config = req.app.config;
  const numberProducts = config.productsPerPage ? config.productsPerPage : 6;

  const lunrIdArray = [];
  productsIndex.search(searchTerm).forEach((id) => {
    lunrIdArray.push(getId(id.ref));
  });

  let pageNum = 1;
  if (req.params.pageNum) {
    pageNum = req.params.pageNum;
  }

  Promise.all([
    getData(req, pageNum, { _id: { $in: lunrIdArray } }),
    getMenu(db)
  ])
    .then(([results, menu]) => {
      // If JSON query param return json instead
      if (req.query.json === 'true') {
        res.status(200).json(results.data);
        return;
      }

      res.render(`${config.themeViews}index`, {
        title: 'Results',
        results: results.data,
        filtered: true,
        session: req.session,
        metaDescription: req.app.config.cartTitle + ' - Search term: ' + searchTerm,
        searchTerm: searchTerm,
        pageCloseBtn: showCartCloseBtn('search'),
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        productsPerPage: numberProducts,
        totalProductCount: results.totalProducts,
        pageNum: pageNum,
        paginateUrl: 'search',
        config: config,
        menu: sortMenu(menu),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter'
      });
    })
    .catch((err) => {
      console.error(colors.red('Error searching for products', err));
    });
});

// search products
router.get('/category/:cat/:pageNum?', (req, res) => {
  const db = req.app.db;
  const searchTerm = req.params.cat;
  const productsIndex = req.app.productsIndex;
  const config = req.app.config;
  const numberProducts = config.productsPerPage ? config.productsPerPage : 6;

  const lunrIdArray = [];
  productsIndex.search(searchTerm).forEach((id) => {
    lunrIdArray.push(getId(id.ref));
  });

  let pageNum = 1;
  if (req.params.pageNum) {
    pageNum = req.params.pageNum;
  }

  Promise.all([
    getData(req, pageNum, { _id: { $in: lunrIdArray } }),
    getMenu(db)
  ])
    .then(([results, menu]) => {
      const sortedMenu = sortMenu(menu);

      // If JSON query param return json instead
      if (req.query.json === 'true') {
        res.status(200).json(results.data);
        return;
      }

      res.render(`${config.themeViews}index`, {
        title: 'Category',
        results: results.data,
        filtered: true,
        session: req.session,
        searchTerm: searchTerm,
        metaDescription: req.app.config.cartTitle + ' - Category: ' + searchTerm,
        pageCloseBtn: showCartCloseBtn('category'),
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        productsPerPage: numberProducts,
        totalProductCount: results.totalProducts,
        pageNum: pageNum,
        menuLink: _.find(sortedMenu.items, (obj) => { return obj.link === searchTerm; }),
        paginateUrl: 'category',
        config: config,
        menu: sortedMenu,
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter'
      });
    })
    .catch((err) => {
      console.error(colors.red('Error getting products for category', err));
    });
});

// Language setup in cookie
router.get('/lang/:locale', (req, res) => {
  res.cookie('locale', req.params.locale, { maxAge: 900000, httpOnly: true });
  res.redirect('back');
});

// return sitemap
router.get('/sitemap.xml', (req, res, next) => {
  const sm = require('sitemap');
  const config = req.app.config;

  addSitemapProducts(req, res, (err, products) => {
    if (err) {
      console.error(colors.red('Error generating sitemap.xml', err));
    }
    const sitemap = sm.createSitemap(
      {
        hostname: config.baseUrl,
        cacheTime: 600000,
        urls: [
          { url: '/', changefreq: 'weekly', priority: 1.0 }
        ]
      });

    const currentUrls = sitemap.urls;
    const mergedUrls = currentUrls.concat(products);
    sitemap.urls = mergedUrls;
    // render the sitemap
    sitemap.toXML((err, xml) => {
      if (err) {
        return res.status(500).end();
      }
      res.header('Content-Type', 'application/xml');
      res.send(xml);
      return true;
    });
  });
});


router.get(['/page/:pageNum', '/lamp/:pageNum'], (req, res, next) => {
  const config = req.app.config;
  const numberProducts = config.productsPerPage ? config.productsPerPage : 6;

  fetchProducts(req, res, (err, data) => {
    if (err) {
      console.error(colors.red('Error getting products for page', err));
    } else {
      const { results, images } = data

      if (req.query.json === 'true') {
        res.status(200).json(results.data);
        return;
      }

      if (results.data.length === 0) {
        res.status(200).json(results.data);
        return;
      }

      res.render(`${config.themeViews}index`, {
        title: 'Shop',
        results: results.data,
        images: images,
        session: req.session,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        metaDescription: req.app.config.cartTitle + ' - Products page: ' + req.params.pageNum,
        pageCloseBtn: showCartCloseBtn('page'),
        config: req.app.config,
        productsPerPage: numberProducts,
        totalProductCount: results.totalProducts,
        pageNum: req.params.pageNum,
        paginateUrl: 'page',
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter',
        menu: sortMenu(menu)
      });
    }
  })

  /* Promise.all([getData(req, req.params.pageNum), getMenu(db)])
  .then(([results, menu]) => {
      console.log(results)
      // If JSON query param return json instead
      if(req.query.json === 'true'){
          res.status(200).json(results.data);
          return;
      }
      if(results.data.length === 0){
          res.status(200).json(results.data);
          return;
      }
      Promise.all([getImages(results.data[0]._id, req, res)]).then(([images]) => {
        console.log(images.length)
        res.render(`${config.themeViews}index`, {
          title: 'Shop',
          results: results.data,
          images: images,
          session: req.session,
          message: clearSessionValue(req.session, 'message'),
          messageType: clearSessionValue(req.session, 'messageType'),
          metaDescription: req.app.config.cartTitle + ' - Products page: ' + req.params.pageNum,
          pageCloseBtn: showCartCloseBtn('page'),
          config: req.app.config,
          productsPerPage: numberProducts,
          totalProductCount: results.totalProducts,
          pageNum: req.params.pageNum,
          paginateUrl: 'page',
          helpers: req.handlebars.helpers,
          showFooter: 'showFooter',
          menu: sortMenu(menu)
        });
      });
  })
  .catch((err) => {
      console.error(colors.red('Error getting products for page', err));
  }); */
});


router.get('/api/lamp', (req, res, next) => {

  fetchProducts(req, res, (err, data) => {
    if (err) {
      console.error(colors.red('Error getting products for page', err));
    } else {
      const { results, images } = data
      var conf = Object()
      Object.keys(publicConfig).map((k) => { conf[k] = req.app.config[k] })
      console.log(data)
      res.json({
        // title: 'Shop',
        results: results.data,
        images: images,
        session: req.session,
        // message: clearSessionValue(req.session, 'message'),
        // messageType: clearSessionValue(req.session, 'messageType'),
        // metaDescription: req.app.config.cartTitle + ' - Products page: ' + req.params.pageNum,
        // pageCloseBtn: showCartCloseBtn('page'),
        config: conf,
        productsPerPage: results.data.length,
        totalProductCount: results.totalProducts,
        pageNum: req.params.pageNum,
        // paginateUrl: 'page',
        // helpers: req.handlebars.helpers,
        // showFooter: 'showFooter',
        // menu: sortMenu(menu)
      });
    }
  })
});


router.get('/api/lamp/:id', (req, res, next) => {

  fetchProduct(req, res, req.params.id, (err, data) => {
    if (err) {
      console.error(colors.red(`Error getting product for id ${req.params.id}`, err));
    } else {
      var conf = Object()
      Object.keys(publicConfig).map((k) => { conf[k] = req.app.config[k] })
      console.log(data)
      res.json({
        result: data,
        session: req.session,
        config: conf
      });
    }
  })
});

// The custom about page
router.get('/about', async (req, res, next) => {
  const db = req.app.db;
  const config = req.app.config;

  res.render(`${config.themeViews}about`, {
    title: "About",
    session: req.session,
    message: clearSessionValue(req.session, 'message'),
    messageType: clearSessionValue(req.session, 'messageType'),
    pageCloseBtn: showCartCloseBtn('page'),
    config: req.app.config,
    metaDescription: "Meta description",
    helpers: req.handlebars.helpers,
    showFooter: 'showFooter',
    menu: sortMenu(await getMenu(db))
  });
});

// The main entry point of the shop
router.get('/:page?', async (req, res, next) => {
  const db = req.app.db;
  const config = req.app.config;
  const numberProducts = config.productsPerPage ? config.productsPerPage : 6;
  console.log("page", req.params.page)
  // if no page is specified, just render page 1 of the cart
  if (!req.params.page) {
    Promise.all([
      getData(req, 1, {}),
      getMenu(db)
    ])
      .then(([results, menu]) => {
        // If JSON query param return json instead
        if (req.query.json === 'true') {
          res.status(200).json(results.data);
          return;
        }
        console.log(results.data[0])
        // for(var i = 0; i< results.data.length; i++) {
        Promise.all([getImages(results.data[0]._id, req, res)]).then(([images]) => {
          console.log(images)
          res.render(`${config.themeViews}index`, {
            title: `${config.cartTitle} - Shop`,
            theme: config.theme,
            results: results.data,
            images: images,
            session: req.session,
            message: clearSessionValue(req.session, 'message'),
            messageType: clearSessionValue(req.session, 'messageType'),
            pageCloseBtn: showCartCloseBtn('page'),
            config,
            productsPerPage: numberProducts,
            totalProductCount: results.totalProducts,
            pageNum: 1,
            paginateUrl: 'page',
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter',
            menu: sortMenu(menu)
          });
        })
        // }
      })
      .catch((err) => {
        console.error(colors.red('Error getting products for page', err));
      });
  } else {
    if (req.params.page === 'admin') {
      next();
      return;
    }
    // lets look for a page
    const page = await db.pages.findOne({ pageSlug: req.params.page, pageEnabled: 'true' });
    // if we have a page lets render it, else throw 404
    if (page) {
      res.render(`${config.themeViews}page`, {
        title: page.pageName,
        page: page,
        searchTerm: req.params.page,
        session: req.session,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        pageCloseBtn: showCartCloseBtn('page'),
        config: req.app.config,
        metaDescription: req.app.config.cartTitle + ' - ' + page,
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter',
        menu: sortMenu(await getMenu(db))
      });
    } else {
      res.status(404).render('error', {
        title: '404 Error - Page not found',
        config: req.app.config,
        message: '404 Error - Page not found',
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter',
        menu: sortMenu(await getMenu(db))
      });
    }
  }
});


module.exports = router;
