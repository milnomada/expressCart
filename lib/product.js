// product.js

const { getId, getImages, getData, getMenu } = require('./common');


const enrichProduct = (product, rebuild) => {
    // new product into session cart
    const p = {};

    p.productId = rebuild.productId;
    p.title = product.productTitle;
    p.quantity = rebuild.units;
    p.uniqueProduct = product.uniqueProduct;
    if (product.productDiscount && product.productDiscount > 0)
        p.totalItemPrice = (product.productPrice - (product.productPrice / product.productDiscount)) * rebuild.units;
    else
        p.totalItemPrice = product.productPrice * rebuild.units;

    p.options = product.productOptions;
    p.productImage = product.productImage;
    p.productDiscount = product.productDiscount;
    p.productComment = product.productComment;
    p.productSubscription = product.productSubscription;
    p.rebuildId = rebuild._id;
    if (product.productPermalink) {
        p.link = product.productPermalink;
    } else {
        p.link = product._id;
    }
    return p
}

const productToSession = async (req, product) => {
    // load product into session,
    req.session.cart = []
    // Doesnt exist so we add to the cart session
    req.session.cartTotalItems = product.quantity;
    // merge into the current cart
    req.session.cart.push(product);

    // Add rebuild data to session
    req.session.isRebuild = true;
    req.session.rebuildId = product.rebuildId;

    // Update cart to the DB
    await db.cart.updateOne(
        { sessionId: req.session.id },
        { $set: { cart: req.session.cart } },
        { upsert: true }
    );
}

const fetchProducts = async (req, res, fn) => {
    const
        config = req.app.config,
        numberProducts = req.query.size ? req.query.size : config.productsPerPage,
        offset = req.query.offset ? req.query.offset : (req.params.pageNum ? req.params.pageNum : 0)
        ;
    // Promise.all([getData(req, req.params.pageNum), getMenu(db)])
    Promise
    .all([getData(req, offset, null, numberProducts)])
    .then(([results]) => {
        console.log(results)
        Promise.all([getImages(results.data[0]._id, req, res)]).then(([images]) => {
            console.log(images.length)
            fn(null, { results: results, images: images })
        });
    })
    .catch((err) => {
        console.error(colors.red('Error getting products for page', err));
        fn(err, null)
    });
}

const fetchProductsWithMenu = async (req, res, fn) => {
    const
        config = req.app.config,
        db = req.app.db,
        numberProducts = req.query.size ? req.query.size : config.productsPerPage,
        offset = req.query.offset ? req.query.offset : (req.params.pageNum ? req.params.pageNum : 0)
        ;
    // Promise.all([getData(req, req.params.pageNum), getMenu(db)])
    Promise
    .all([getData(req, offset, null, numberProducts), getMenu(db)])
    .then(([results, menu]) => {
        console.log(results)
        Promise.all([getImages(results.data[0]._id, req, res)]).then(([images]) => {
            console.log(images.length)
            fn(null, { results: results, images: images, menu: menu })
        });
    })
    .catch((err) => {
        console.error(colors.red('Error getting products for page', err));
        fn(err, null)
    });
}

const fetchProduct = async (req, res, id, fn) => {
    console.log(id)
    Promise.all([
        req.app.db.products.findOne({ $or: [{ _id: getId(id) }, { productPermalink: id }] })
    ])
    .then(([product]) => {
        Promise.all([getImages(product._id, req, res)]).then(([images]) => {
            product.images = images
            fn(null, product)
        });
    })
    .catch((err) => {
        console.error(colors.red('Error getting products for page', err));
        fn(err, null)
    });
}

const publicConfig = {
    availableLanguages: "",
    defaultLocale:      "",
    currencySymbol:     ""
}

module.exports = { enrichProduct, productToSession, fetchProducts, fetchProductsWithMenu, fetchProduct, publicConfig };
