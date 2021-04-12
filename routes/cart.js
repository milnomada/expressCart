// cart.js <routes>

const express = require('express');
const router = express.Router();
const _ = require('lodash');
const async = require('async');
const {
    getId,
    showCartCloseBtn,
    updateTotalCartAmount,
    updateSubscriptionCheck,
    emptyCart
} = require('../lib/common');
  

router.get('/cart/empty', async (req, res, next) => {
    emptyCart(req, res, req.headers["Content-Type".toLowerCase()] === "application/json" ? "json" : "");
});

router.post('/cart/empty', async (req, res, next) => {
    console.log(req.headers)
    emptyCart(req, res, req.headers["Content-Type".toLowerCase()] === "application/json" ? "json" : "");
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
router.delete('/cart/product/:id', async (req, res, next) => {
    const db = req.app.db;
    let itemRemoved = false;

    // remove item from cart
    req.session.cart.forEach((item) => {
        if (item) {
            if (item.productId === req.params.id) {
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

module.exports = router;
